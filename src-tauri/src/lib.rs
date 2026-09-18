// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::Regex;
use scraper::{Html, Selector};
use serde::Serialize;
use tauri::State;
use url::Url;

const ALBUMATY_BASE: &str = "https://www.albumaty.com";
const ALBUMATY_HOME: &str = "https://www.albumaty.com/cat/1.html";

#[derive(Debug, Serialize, Clone)]
struct OnlineLink {
    title: String,
    url: String,
    kind: String,
}

#[derive(Debug, Serialize, Clone)]
struct AlbumatyHome {
    categories: Vec<OnlineLink>,
    albums: Vec<OnlineLink>,
    songs: Vec<OnlineLink>,
    artists: Vec<OnlineLink>,
}

#[derive(Debug, Serialize, Clone)]
struct AlbumatyTrack {
    id: String,
    title: String,
    artist: String,
    album: Option<String>,
    artwork_url: Option<String>,
    stream_url: String,
    download_url: Option<String>,
    source_url: String,
}

fn strip_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string()
}

fn normalize_albumaty_url(value: &str) -> Option<String> {
    let value = value.trim().replace("&amp;", "&");
    if value.is_empty() || value.starts_with('#') || value.starts_with("javascript:") {
        return None;
    }

    let absolute = if value.starts_with("http://") || value.starts_with("https://") {
        value.replace("http://", "https://")
    } else if value.starts_with("//") {
        format!("https:{value}")
    } else if value.starts_with('/') {
        format!("{ALBUMATY_BASE}{value}")
    } else {
        format!("{ALBUMATY_BASE}/{}", value.trim_start_matches('/'))
    };

    let mut url = Url::parse(&absolute).ok()?;
    if url.host_str()?.trim_start_matches("www.") != "albumaty.com" {
        return None;
    }
    url.set_scheme("https").ok();
    Some(url.to_string())
}

fn classify(url: &str) -> &'static str {
    let path = Url::parse(url)
        .ok()
        .map(|u| u.path().trim_matches('/').to_ascii_lowercase())
        .unwrap_or_default();

    let first = path.split('/').next().unwrap_or_default();
    if first == "song" || first.starts_with("song") {
        "song"
    } else if first == "album" {
        "album"
    } else if first == "singer" || first == "artist" {
        "artist"
    } else if first == "cat" || first == "category" {
        "category"
    } else {
        "other"
    }
}

fn parse_links(html: &str) -> Vec<OnlineLink> {
    let document = Html::parse_document(html);
    let selector = match Selector::parse("a[href]") {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for node in document.select(&selector) {
        let href = match node.value().attr("href") {
            Some(v) => v,
            None => continue,
        };
        let url = match normalize_albumaty_url(href) {
            Some(v) => v,
            None => continue,
        };
        let title = strip_text(&node.text().collect::<Vec<_>>().join(" "));
        if title.is_empty() || !seen.insert(url.clone()) {
            continue;
        }

        let kind = classify(&url);
        if matches!(kind, "song" | "album" | "artist" | "category") {
            out.push(OnlineLink {
                title,
                url,
                kind: kind.to_string(),
            });
        }
    }

    out
}

fn scope_main_content(html: &str) -> String {
    let lower = html.to_ascii_lowercase();
    let start = lower.find("<h1").unwrap_or(0);
    let footer = lower[start..]
        .find("<footer")
        .map(|offset| start + offset)
        .or_else(|| lower[start..].find("جميع الحقوق محفوظة").map(|offset| start + offset))
        .unwrap_or(html.len());

    if footer > start {
        html[start..footer].to_string()
    } else {
        html[start..].to_string()
    }
}

fn extract_audio_url(html: &str) -> Option<String> {
    let document = Html::parse_document(html);

    if let Ok(source_selector) = Selector::parse("audio source[src], audio[src]") {
        for node in document.select(&source_selector) {
            let value = node.value().attr("src")?;
            if value.to_ascii_lowercase().contains(".mp3") {
                if let Some(url) = normalize_external_url(value) {
                    return Some(url);
                }
            }
        }
    }

    let mp3_re = Regex::new(r#"https?://[^"'<>\s]+\.mp3(?:\?[^"'<>\s]*)?"#).ok()?;
    mp3_re.find(html).map(|m| m.as_str().replace("&amp;", "&"))
}

fn normalize_external_url(value: &str) -> Option<String> {
    let value = value.trim().replace("&amp;", "&");
    if value.starts_with("http://") || value.starts_with("https://") {
        return Some(value.replace("http://", "https://"));
    }
    if value.starts_with("//") {
        return Some(format!("https:{value}"));
    }
    None
}

fn extract_image_url(html: &str) -> Option<String> {
    let document = Html::parse_document(html);
    let selector = Selector::parse("img[src], img[data-src]").ok()?;
    for node in document.select(&selector) {
        let value = node
            .value()
            .attr("src")
            .or_else(|| node.value().attr("data-src"))?;
        if let Some(url) = normalize_external_url(value) {
            return Some(url);
        }
        if let Some(url) = normalize_albumaty_url(value) {
            return Some(url);
        }
    }
    None
}

fn extract_download_page(html: &str) -> Option<String> {
    let document = Html::parse_document(html);
    let selector = Selector::parse("a[href]").ok()?;
    for node in document.select(&selector) {
        let href = node.value().attr("href")?;
        if href.to_ascii_lowercase().contains("/download/") {
            return normalize_albumaty_url(href);
        }
    }
    None
}

fn text_from_h1(html: &str) -> String {
    let document = Html::parse_document(html);
    let selector = Selector::parse("h1").ok();
    selector
        .and_then(|s| document.select(&s).next())
        .map(|node| strip_text(&node.text().collect::<Vec<_>>().join(" ")))
        .unwrap_or_default()
}

fn parse_track(source_url: &str, html: &str, resolved_audio: &str) -> AlbumatyTrack {
    let h1 = text_from_h1(html);
    let title_artist = Regex::new(r#"(?i)^(?:اغنية\s+)?(.+?)\s+-\s+(.+?)(?:\s+mp3)?$"#)
        .ok()
        .and_then(|re| re.captures(&h1));

    let (title, artist) = if let Some(cap) = title_artist {
        (
            strip_text(cap.get(1).map(|m| m.as_str()).unwrap_or(&h1)),
            strip_text(cap.get(2).map(|m| m.as_str()).unwrap_or("Albumaty")),
        )
    } else {
        (
            h1.trim_start_matches("اغنية ").trim().to_string(),
            "Albumaty".to_string(),
        )
    };

    let album = Regex::new(r#"(?i)اغاني\s+اخرى\s+من\s+ألبوم\s+([^<]+)"#)
        .ok()
        .and_then(|re| re.captures(&strip_text(html)))
        .and_then(|cap| cap.get(1).map(|m| strip_text(m.as_str())));

    AlbumatyTrack {
        id: format!("albumaty:{}", source_url),
        title: if title.is_empty() { "Albumaty Song".to_string() } else { title },
        artist,
        album,
        artwork_url: extract_image_url(html),
        stream_url: resolved_audio.to_string(),
        download_url: Some(resolved_audio.to_string()),
        source_url: source_url.to_string(),
    }
}

async fn albumaty_get(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 DJDesktop/3.6.8")
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await
        .map_err(|e| format!("Albumaty network error: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Albumaty returned HTTP {}", response.status()));
    }

    response
        .text()
        .await
        .map_err(|e| format!("Albumaty response error: {e}"))
}

#[tauri::command]
async fn albumaty_home(state: State<'_, reqwest::Client>, query: String) -> Result<AlbumatyHome, String> {
    let html = albumaty_get(&state, ALBUMATY_HOME).await?;
    let scoped = scope_main_content(&html);
    let all = parse_links(&scoped);

    let matches = |item: &&OnlineLink| {
        query.trim().is_empty()
            || item.title.to_lowercase().contains(&query.trim().to_lowercase())
    };

    Ok(AlbumatyHome {
        categories: all.iter().filter(matches).filter(|x| x.kind == "category").cloned().take(80).collect(),
        albums: all.iter().filter(matches).filter(|x| x.kind == "album").cloned().take(120).collect(),
        songs: all.iter().filter(matches).filter(|x| x.kind == "song").cloned().take(120).collect(),
        artists: all.iter().filter(matches).filter(|x| x.kind == "artist").cloned().take(300).collect(),
    })
}

#[tauri::command]
async fn albumaty_section(state: State<'_, reqwest::Client>, url: String) -> Result<Vec<OnlineLink>, String> {
    if normalize_albumaty_url(&url).is_none() {
        return Err("Invalid Albumaty URL".to_string());
    }
    let html = albumaty_get(&state, &url).await?;
    let links = parse_links(&html);
    let kind = classify(&url);

    Ok(links
        .into_iter()
        .filter(|item| match kind {
            "album" => item.kind == "song",
            "artist" | "singer" => item.kind == "album" || item.kind == "song",
            "category" | "cat" => matches!(item.kind.as_str(), "song" | "album" | "artist"),
            _ => matches!(item.kind.as_str(), "song" | "album" | "artist"),
        })
        .filter(|item| item.url.trim_end_matches('/') != url.trim_end_matches('/'))
        .take(500)
        .collect())
}

#[tauri::command]
async fn albumaty_resolve_song(state: State<'_, reqwest::Client>, url: String) -> Result<AlbumatyTrack, String> {
    if normalize_albumaty_url(&url).is_none() || classify(&url) != "song" {
        return Err("Invalid Albumaty song URL".to_string());
    }

    let song_html = albumaty_get(&state, &url).await?;
    let audio_url = if let Some(download_page) = extract_download_page(&song_html) {
        let download_html = albumaty_get(&state, &download_page).await?;
        extract_audio_url(&download_html)
            .or_else(|| extract_audio_url(&song_html))
    } else {
        extract_audio_url(&song_html)
    }
    .ok_or_else(|| "لم يتم العثور على رابط الصوت المباشر من Albumaty".to_string())?;

    Ok(parse_track(&url, &song_html, &audio_url))
}

pub fn run() {
    tauri::Builder::default()
        .manage(reqwest::Client::builder().redirect(reqwest::redirect::Policy::limited(5)).build().expect("http client"))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            albumaty_home,
            albumaty_section,
            albumaty_resolve_song
        ])
        .run(tauri::generate_context!())
        .expect("error while running DJ Desktop application");
}
