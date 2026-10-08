import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, '..');
const DIST_DIR = fs.existsSync(path.join(APP_DIR, 'dist'))
  ? path.join(APP_DIR, 'dist')
  : APP_DIR;

const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const ALBUMATY_BASE = 'https://www.albumaty.com';
const REQUEST_TIMEOUT_MS = 15000;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function normalizeAlbumatyUrl(value) {
  const decoded = decodeURIComponent(String(value || '').replace(/&amp;/g, '&').trim());

  if (decoded.startsWith('//')) return `https:${decoded}`;
  if (decoded.startsWith('/')) return `${ALBUMATY_BASE}${decoded}`;

  const parsed = parseUrl(decoded);
  if (!parsed) return `${ALBUMATY_BASE}/${decoded.replace(/^\/+/, '')}`;

  if (parsed.protocol === 'http:') parsed.protocol = 'https:';
  if (parsed.hostname.toLowerCase() === 'albumaty.com') {
    parsed.hostname = 'www.albumaty.com';
  }
  return parsed.toString();
}

function isAllowedAlbumatyUrl(raw) {
  const parsed = parseUrl(raw);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'albumaty.com' || host === 'www.albumaty.com';
}

function isAllowedAudioUrl(raw) {
  const parsed = parseUrl(raw);
  if (!parsed || !/^https?:$/.test(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'albumaty.com' || host === 'www.albumaty.com' || host.endsWith('.albumaty.com');
}

function pathParts(url) {
  const parsed = parseUrl(url);
  if (!parsed) return [];
  return parsed.pathname.toLowerCase().split('/').filter(Boolean);
}

function pageType(url) {
  return pathParts(url)[0] || '';
}

function isSongUrl(url) {
  return pageType(url) === 'song';
}

function isAlbumUrl(url) {
  return pageType(url) === 'album';
}

function isArtistUrl(url) {
  const kind = pageType(url);
  return kind === 'singer' || kind === 'artist';
}

function isCategoryUrl(url) {
  const kind = pageType(url);
  return kind === 'cat' || kind === 'category';
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script.*?<\/script>/gis, '')
    .replace(/<style.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLinks(html) {
  const links = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;

  for (const match of html.matchAll(regex)) {
    const title = stripHtml(match[2]);
    if (!title) continue;

    const url = normalizeAlbumatyUrl(match[1]);
    if (!isAllowedAlbumatyUrl(url)) continue;

    links.push({ title, url });
  }

  return links;
}

function extractMainContentHtml(html) {
  const h1Match = /<h1\b[^>]*>/i.exec(html);
  if (!h1Match || h1Match.index == null) return html;

  const start = h1Match.index;
  const footerPattern =
    /<(?:footer|\/footer)\b|(?:اتصل بنا|contact us|about us|جميع الحقوق محفوظة)/i;
  const footerMatch = footerPattern.exec(html.slice(start + h1Match[0].length));
  const end = footerMatch && footerMatch.index != null
    ? start + h1Match[0].length + footerMatch.index
    : html.length;

  return html.slice(start, end);
}

function parseSectionContent(html, type) {
  const scoped = extractMainContentHtml(html);
  if (!scoped.trim()) return [];

  let links = parseLinks(scoped);

  if (type === 'album') {
    links = links.filter((link) => isSongUrl(link.url));
  } else if (type === 'singer' || type === 'artist') {
    links = links.filter((link) => isAlbumUrl(link.url) || isSongUrl(link.url));
  } else if (type === 'cat' || type === 'category') {
    links = links.filter(
      (link) => isSongUrl(link.url) || isAlbumUrl(link.url) || isArtistUrl(link.url)
    );
  } else {
    links = links.filter(
      (link) => isSongUrl(link.url) || isAlbumUrl(link.url) || isArtistUrl(link.url)
    );
  }

  return links
    .filter((link) => !['', undefined, null].includes(link.url))
    .filter((link, index, all) => all.findIndex((item) => item.url === link.url) === index)
    .slice(0, 500);
}

function parseHome(html) {
  const links = parseLinks(html);
  return {
    categories: links.filter((link) => isCategoryUrl(link.url)).filter((x, i, a) => a.findIndex(y => y.url === x.url) === i).slice(0, 100),
    albums: links.filter((link) => isAlbumUrl(link.url)).filter((x, i, a) => a.findIndex(y => y.url === x.url) === i).slice(0, 100),
    songs: links.filter((link) => isSongUrl(link.url)).filter((x, i, a) => a.findIndex(y => y.url === x.url) === i).slice(0, 100),
    artists: links.filter((link) => isArtistUrl(link.url)).filter((x, i, a) => a.findIndex(y => y.url === x.url) === i).slice(0, 300),
  };
}

function extractDownloadPage(html) {
  const match = /<a[^>]+href=["']([^"']*\/download\/[^"']+)["'][^>]*>/i.exec(html);
  return match ? normalizeAlbumatyUrl(match[1]) : null;
}

function extractAudioUrl(html) {
  const direct = /https?:\/\/[^"'<>\s]+\.mp3(?:\?[^"'<>\s]*)?/i.exec(html);
  if (direct) return normalizeAlbumatyUrl(direct[0]);

  const source = /<(?:audio|source)[^>]+src=["']([^"']+)["']/i.exec(html);
  if (source && /\.mp3/i.test(source[1])) return normalizeAlbumatyUrl(source[1]);

  const download = /<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*(?:تحميل|download)[^<]*<\/a>/is.exec(html);
  if (download) {
    const url = normalizeAlbumatyUrl(download[1]);
    if (/\.mp3/i.test(url)) return url;
  }

  return null;
}

function extractSongTitle(html) {
  const match = /<h1[^>]*>\s*اغنية\s+(.+?)\s+MP3\s*<\/h1>/is.exec(html);
  return match ? stripHtml(match[1]).split(/\s+-\s+/).slice(0, 1)[0].trim() : '';
}

function extractArtist(html) {
  const match = /<h1[^>]*>\s*اغنية\s+(.+?)\s+-\s+(.+?)\s+MP3\s*<\/h1>/is.exec(html);
  return match ? stripHtml(match[2]).trim() : '';
}

function extractAlbum(html) {
  const text = stripHtml(html);
  const match = /اغاني\s+اخرى\s+من\s+ألبوم\s+([^<]+)/i.exec(text);
  return match ? match[1].trim() : undefined;
}

function extractImageUrl(html) {
  const match = /<img[^>]+(?:src|data-src)=["']([^"']+)["']/i.exec(html);
  return match ? normalizeAlbumatyUrl(match[1]) : undefined;
}

async function fetchText(url, accept = 'text/html,application/xhtml+xml') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DJ Desktop Studio',
        Accept: accept,
      },
    });

    if (!response.ok) {
      throw new Error(`Albumaty returned HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getAlbumatyHome() {
  const html = await fetchText(`${ALBUMATY_BASE}/cat/1.html`);
  return parseHome(html);
}

async function getAlbumatySection(url) {
  if (!isAllowedAlbumatyUrl(url)) throw new Error('Invalid Albumaty URL.');

  const html = await fetchText(url);
  const type = pageType(url);
  const content = parseSectionContent(html, type).filter(
    (link) => link.url.replace(/\/$/, '') !== url.replace(/\/$/, '')
  );

  return {
    title: stripHtml((/<h1[^>]*>(.*?)<\/h1>/is.exec(html) || [])[1] || '') || 'Albumaty',
    url,
    content,
  };
}

async function resolveAlbumatySong(songUrl) {
  if (!isAllowedAlbumatyUrl(songUrl) || !isSongUrl(songUrl)) {
    throw new Error('The selected item is not an Albumaty song.');
  }

  const songHtml = await fetchText(songUrl);
  const downloadPageUrl = extractDownloadPage(songHtml);
  if (!downloadPageUrl || !isAllowedAlbumatyUrl(downloadPageUrl)) {
    throw new Error('Download page for this song was not found.');
  }

  const downloadHtml = await fetchText(downloadPageUrl);
  const audioUrl = extractAudioUrl(downloadHtml) || extractAudioUrl(songHtml);

  if (!audioUrl || !isAllowedAudioUrl(audioUrl)) {
    throw new Error('Direct audio stream could not be resolved.');
  }

  return {
    id: songUrl,
    title: extractSongTitle(songHtml) || 'Albumaty Song',
    artist: extractArtist(songHtml) || 'Albumaty',
    album: extractAlbum(songHtml),
    artworkUrl: extractImageUrl(songHtml),
    streamUrl: audioUrl,
    downloadUrl: audioUrl,
  };
}

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

async function handleApi(req, res) {
  const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (!requestUrl.pathname.startsWith('/api/albumaty/')) return false;

  try {
    if (requestUrl.pathname === '/api/albumaty/home') {
      sendJson(res, 200, { ok: true, data: await getAlbumatyHome() });
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/section') {
      const target = requestUrl.searchParams.get('url') || '';
      sendJson(res, 200, { ok: true, data: await getAlbumatySection(normalizeAlbumatyUrl(target)) });
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/resolve') {
      const target = requestUrl.searchParams.get('url') || '';
      sendJson(res, 200, { ok: true, data: await resolveAlbumatySong(normalizeAlbumatyUrl(target)) });
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/download') {
      const target = requestUrl.searchParams.get('url') || '';
      const resolved = await resolveAlbumatySong(normalizeAlbumatyUrl(target));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const upstream = await fetch(resolved.downloadUrl, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DJ Desktop Studio',
            Referer: `${ALBUMATY_BASE}/`,
            Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
          },
        });

        if (!upstream.ok || !upstream.body) {
          throw new Error(`Audio download failed (HTTP ${upstream.status})`);
        }

        const contentLength = upstream.headers.get('content-length');
        const safeName = encodeURIComponent(`${resolved.title || 'song'}.mp3`);

        const headers = {
          'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
          'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
          'Cache-Control': 'no-store',
        };

        if (contentLength) headers['Content-Length'] = contentLength;

        res.writeHead(200, headers);

        for await (const chunk of upstream.body) {
          res.write(Buffer.from(chunk));
        }
        res.end();
        return true;
      } finally {
        clearTimeout(timer);
      }
    }

    sendJson(res, 404, { ok: false, error: 'Albumaty endpoint not found.' });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Online music request failed.';
    sendJson(res, 502, { ok: false, error: message });
    return true;
  }
}

const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;

  let requestPath;
  try {
    requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (requestPath === '/' || requestPath === '') requestPath = '/index.html';

  let filePath = path.join(DIST_DIR, requestPath);

  const relative = path.relative(DIST_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('DJ Desktop Studio: File Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('Internal Server Error');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[✓] DJ Desktop Studio running at http://127.0.0.1:${PORT}`);
});
