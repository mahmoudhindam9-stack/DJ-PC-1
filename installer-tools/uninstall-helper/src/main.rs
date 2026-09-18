#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::process::Command;

#[link(name = "user32")]
extern "system" {
    fn MessageBoxW(
        hwnd: *mut core::ffi::c_void,
        text: *const u16,
        caption: *const u16,
        typ: u32,
    ) -> i32;
}

fn message_box(text: &str, caption: &str) {
    let text: Vec<u16> = OsStr::new(text).encode_wide().chain([0]).collect();
    let caption: Vec<u16> = OsStr::new(caption).encode_wide().chain([0]).collect();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            caption.as_ptr(),
            0x00000040,
        );
    }
}

fn parse_uninstall_command(value: &str) -> Option<(PathBuf, Vec<String>)> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }

    if value.starts_with('"') {
        let rest = &value[1..];
        let end = rest.find('"')?;
        let exe = PathBuf::from(&rest[..end]);
        let args = rest[end + 1..]
            .split_whitespace()
            .map(ToOwned::to_owned)
            .collect();
        return Some((exe, args));
    }

    let mut parts = value.split_whitespace();
    let exe = PathBuf::from(parts.next()?);
    let args = parts.map(ToOwned::to_owned).collect();
    Some((exe, args))
}

fn registry_uninstaller() -> Option<(PathBuf, Vec<String>)> {
    let output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall",
            "/s",
        ])
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut is_dj_key = false;

    for raw_line in text.lines() {
        let line = raw_line.trim();

        if line.starts_with("HKEY_") {
            is_dj_key = false;
            continue;
        }

        if line.to_ascii_lowercase().starts_with("displayname") {
            is_dj_key = line.to_ascii_lowercase().contains("dj desktop");
            continue;
        }

        if is_dj_key && line.to_ascii_lowercase().starts_with("uninstallstring") {
            let value = line
                .splitn(2, "REG_SZ")
                .nth(1)
                .unwrap_or("")
                .trim();

            if let Some(parsed) = parse_uninstall_command(value) {
                return Some(parsed);
            }
        }
    }

    None
}

fn candidate_uninstallers() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(local) = env::var("LOCALAPPDATA") {
        candidates.push(PathBuf::from(&local).join("Programs\DJ Desktop\uninstall.exe"));
        candidates.push(PathBuf::from(&local).join("DJ Desktop\uninstall.exe"));
        candidates.push(PathBuf::from(&local).join("com.djdesktop.app\uninstall.exe"));
    }

    if let Ok(roaming) = env::var("APPDATA") {
        candidates.push(PathBuf::from(&roaming).join("DJ Desktop\uninstall.exe"));
        candidates.push(PathBuf::from(&roaming).join("com.djdesktop.app\uninstall.exe"));
    }

    candidates
}

fn main() {
    let mut command = registry_uninstaller();

    if command.is_none() {
        for path in candidate_uninstallers() {
            if Path::new(&path).is_file() {
                command = Some((path, Vec::new()));
                break;
            }
        }
    }

    let Some((exe, args)) = command else {
        message_box(
            "DJ Desktop is not installed on this computer.",
            "DJ Desktop - Uninstall",
        );
        return;
    };

    let mut process = Command::new(&exe);
    process.args(args);
    process.arg("/S");

    if process.spawn().is_err() {
        message_box(
            "Could not start the DJ Desktop uninstaller.",
            "DJ Desktop - Uninstall",
        );
    }
}
