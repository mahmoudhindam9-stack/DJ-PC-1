import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, '..');
const DIST_DIR = fs.existsSync(path.join(APP_DIR, 'dist'))
  ? path.join(APP_DIR, 'dist')
  : APP_DIR;

const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const ALBUMATY_BASE = 'https://www.albumaty.com';
const UPDATE_REPOSITORY = 'mahmoudhindam9-stack/DJ-PC-1';
const REQUEST_TIMEOUT_MS = 15000;
const ACE_STEP_BASE_URL = 'http://127.0.0.1:8001';
const LOCAL_MUSIC_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.HOME || process.cwd(), '.local'),
  'DJ Desktop Studio',
  'Generated Music',
);

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
  const raw = String(value || '').replace(/&amp;/g, '&').trim();
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Keep already-encoded paths when a literal percent sign is present.
  }

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
  if (!parsed || parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  // Albumaty MP3 files may be hosted on a separate public CDN.
  // Reject local names, IP literals, and unusual ports to avoid a general-purpose proxy.
  const host = parsed.hostname.toLowerCase().replace(/\\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal') ||
      host.endsWith('.lan') || host.endsWith('.home.arpa')) return false;
  if (!host.includes('.') || /^\\d+(?:\\.\\d+){3}$/.test(host) || host.includes(':')) return false;
  if (parsed.port && parsed.port !== '443') return false;
  return true;
}

function isAllowedAudiusUrl(raw) {
  const parsed = parseUrl(raw);
  if (!parsed || !/^https?:$/.test(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'audius.co' || host.endsWith('.audius.co');
}

function pathParts(url) {
  const parsed = parseUrl(url);
  if (!parsed) return [];
  return parsed.pathname.toLowerCase().split('/').filter(Boolean);
}

function pageType(url) {
  const parts = pathParts(url);
  // The current Albumaty catalog uses both /song/... and legacy /n/song/... URLs.
  return ['n', 'a'].includes(parts[0]) ? (parts[1] || '') : (parts[0] || '');
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
  const ogAudio = /<meta\s+[^>]*property=["']og:audio["'][^>]*content=["']([^"']+)["']/i.exec(html) ||
                  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:audio["']/i.exec(html);
  if (ogAudio) return normalizeAlbumatyUrl(ogAudio[1]);

  const source = /<(?:audio|source)[^>]+src=["']([^"']+)["']/i.exec(html);
  if (source && /\.mp3/i.test(source[1])) return normalizeAlbumatyUrl(source[1]);

  const direct = /https?:\/\/[^"'<>\s]+\.mp3(?:\?[^"'<>\s]*)?/i.exec(html);
  if (direct) return normalizeAlbumatyUrl(direct[0]);

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
  const ogAlbum = /<meta\s+[^>]*property=["']og:audio:album["'][^>]*content=["']([^"']+)["']/i.exec(html) ||
                  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:audio:album["']/i.exec(html);
  if (ogAlbum) return ogAlbum[1].trim();

  const text = stripHtml(html);
  const match = /اغاني\s+اخرى\s+من\s+ألبوم\s+([^\r\n<,]+)/i.exec(text);
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

function normalizeAlbumatySearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    // Remove Arabic diacritics and tatweel; normalize common letters and real whitespace.
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase('ar')
    .replace(/\s+/g, ' ')
    .trim();
}

function albumatySearchMatches(title, terms) {
  const normalized = normalizeAlbumatySearchText(title);
  return terms.every((term) => normalized.includes(term));
}

function groupAlbumatySearchResults(links) {
  const uniqueLinks = links.filter((link, index, all) =>
    all.findIndex((candidate) => candidate.url === link.url) === index
  );
  return {
    categories: uniqueLinks.filter((link) => isCategoryUrl(link.url)),
    albums: uniqueLinks.filter((link) => isAlbumUrl(link.url)),
    songs: uniqueLinks.filter((link) => isSongUrl(link.url)),
    artists: uniqueLinks.filter((link) => isArtistUrl(link.url)),
  };
}

async function getAlbumatySearch(query) {
  const searchTerm = String(query || '').trim().slice(0, 120);
  if (searchTerm.length < 2) {
    return { categories: [], albums: [], songs: [], artists: [] };
  }

  const terms = normalizeAlbumatySearchText(searchTerm).split(' ').filter(Boolean);
  if (terms.length === 0) {
    return { categories: [], albums: [], songs: [], artists: [] };
  }

  // Albumaty has appeared with both the PHP search endpoint and query-string forms.
  // Try its native search routes, then filter the returned links by the full query.
  const encoded = encodeURIComponent(searchTerm);
  const searchUrls = [
    `${ALBUMATY_BASE}/search.php?search=${encoded}`,
    `${ALBUMATY_BASE}/?search=${encoded}`,
    `${ALBUMATY_BASE}/?s=${encoded}`,
    `${ALBUMATY_BASE}/search.php?q=${encoded}`,
  ];

  const pages = await Promise.all(searchUrls.map(async (url, index) => {
    try {
      const html = await fetchText(url);
      const matches = parseLinks(html).filter((link) =>
        albumatySearchMatches(link.title, terms) &&
        (isSongUrl(link.url) || isAlbumUrl(link.url) || isArtistUrl(link.url) || isCategoryUrl(link.url))
      );
      return { index, matches };
    } catch (error) {
      return { index, matches: [], error: error instanceof Error ? error.message : String(error) };
    }
  }));

  // Legacy search endpoints may list artists on one route and songs on another.
  // Merge their hits so a title query is not lost just because another route returned more artists.
  const matches = pages
    .sort((left, right) => left.index - right.index)
    .flatMap((page) => page.matches);
  return groupAlbumatySearchResults(matches);
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
  let audioUrl = extractAudioUrl(songHtml);

  if (!audioUrl) {
    const downloadPageUrl = extractDownloadPage(songHtml);
    if (downloadPageUrl && isAllowedAlbumatyUrl(downloadPageUrl)) {
      try {
        const downloadHtml = await fetchText(downloadPageUrl);
        audioUrl = extractAudioUrl(downloadHtml);
      } catch {
        // Fall back to direct audio check
      }
    }
  }

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

// v3.14.2: Albumaty CDN downloads are proxied only over validated public HTTPS URLs.
async function proxyAudioStream(req, res, url, downloadName) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let upstream;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DJ Desktop Studio',
    Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
  };
  if (req.headers.range) headers.Range = String(req.headers.range);
  const parsed = parseUrl(url);
  headers.Referer = parsed && isAllowedAudioUrl(url) ? parsed.origin + '/' : 'https://audius.co/';

  try {
    upstream = await fetch(url, { signal: controller.signal, redirect: 'follow', headers });
  } finally {
    // Only connection setup has a timeout. The audio body may be much longer than 15 seconds.
    clearTimeout(timer);
  }

  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  // Validate the final URL too, because fetch follows redirects by default.
  if (!isAllowedAudioUrl(upstream.url)) {
    await upstream.body?.cancel().catch(() => {});
    throw new Error('Audio host redirected to an unsupported destination.');
  }

  if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
    throw new Error('Audio stream failed (HTTP ' + upstream.status + ')');
  }

  const responseHeaders = {
    'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
    'Cache-Control': 'no-store',
    'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
  };
  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  if (contentLength) responseHeaders['Content-Length'] = contentLength;
  if (contentRange) responseHeaders['Content-Range'] = contentRange;

  if (downloadName) {
    const safeAsciiName = String(downloadName).replace(/[\\/:*?"<>|\r\n]/g, '_').replace(/[^\x20-\x7E]/g, '_') || 'song.mp3';
    responseHeaders['Content-Disposition'] =
      'attachment; filename="' + safeAsciiName + '"; filename*=UTF-8\'\'' + encodeURIComponent(downloadName);
  }

  res.writeHead(upstream.status, responseHeaders);
  for await (const chunk of upstream.body) {
    if (!res.write(Buffer.from(chunk))) {
      await new Promise((resolve) => res.once('drain', resolve));
    }
  }
  res.end();
}

function compareVersions(left, right) {
  const parse = (value) => String(value || '').replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
}

async function getLatestReleaseInfo() {
  let currentVersion = '0.0.0';
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
    currentVersion = String(packageJson.version || currentVersion);
  } catch {
    // Continue with the remote release version if the local manifest cannot be read.
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch('https://api.github.com/repos/' + UPDATE_REPOSITORY + '/releases/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DJ Desktop Studio Updater' },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new Error('GitHub update check failed (HTTP ' + response.status + ').');
  const release = await response.json();
  const latestVersion = String(release.tag_name || release.name || '').replace(/^v/i, '');
  if (!latestVersion) throw new Error('The latest release did not include a version tag.');
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const versionedAssetName = 'DJ-Desktop-PC-v' + latestVersion + '.zip';
  const pcAsset = assets.find((asset) => String(asset.name || '').toLowerCase() === versionedAssetName.toLowerCase()) ||
    assets.find((asset) => String(asset.name || '').toLowerCase() === 'dj-desktop-pc-latest.zip');
  const downloadsDir = path.join(process.env.USERPROFILE || process.env.HOME || process.cwd(), 'Downloads');
  const versionedPackagePath = path.join(downloadsDir, versionedAssetName);

  return {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    canAutoInstall: process.platform === 'win32' && Boolean(pcAsset && pcAsset.browser_download_url),
    assetName: pcAsset ? String(pcAsset.name || versionedAssetName) : versionedAssetName,
    assetUrl: pcAsset ? String(pcAsset.browser_download_url || '') : '',
    downloadedPackageAvailable: fs.existsSync(versionedPackagePath),
    downloadPath: versionedPackagePath,
    releaseUrl: String(release.html_url || ('https://github.com/' + UPDATE_REPOSITORY + '/releases/latest')),
    publishedAt: String(release.published_at || ''),
    releaseNotes: String(release.body || '').slice(0, 3000),
  };
}

async function getAceStepHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(ACE_STEP_BASE_URL + '/health', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { ready: false, service: 'ACE-Step 1.5' };
    const payload = await response.json();
    const ready = payload?.code === 200 || payload?.data?.status === 'ok';
    return {
      ready,
      service: String(payload?.data?.service || 'ACE-Step 1.5'),
      version: String(payload?.data?.version || ''),
    };
  } catch {
    return { ready: false, service: 'ACE-Step 1.5' };
  } finally {
    clearTimeout(timer);
  }
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

function readJsonBody(req, maxBytes = 4096) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > maxBytes) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res) {
  const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (!requestUrl.pathname.startsWith('/api/')) return false;

  try {
    if (requestUrl.pathname === '/api/window/always-on-top' && req.method === 'POST') {
      if (process.platform !== 'win32') {
        sendJson(res, 409, { ok: false, error: 'Native always-on-top is only available in the Windows desktop launcher.' });
        return true;
      }
      const body = await readJsonBody(req);
      if (typeof body.enabled !== 'boolean') {
        sendJson(res, 400, { ok: false, error: 'The enabled field must be a boolean.' });
        return true;
      }
      const pinScript = path.join(APP_DIR, 'scripts', 'set-window-always-on-top.ps1');
      if (!fs.existsSync(pinScript)) {
        sendJson(res, 500, { ok: false, error: 'The Windows window-control helper is missing.' });
        return true;
      }
      const outcome = await new Promise((resolve) => {
        const child = spawn('powershell.exe', [
          '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', pinScript,
          '-WindowTitle', 'DJ Control Center - DJ Desktop Studio',
          '-Enabled', body.enabled ? 'true' : 'false',
        ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
        child.on('error', (error) => resolve({ code: -1, message: error.message }));
        child.on('close', (code) => resolve({ code: code ?? -1, message: stderr.trim() }));
      });
      if (outcome.code !== 0) {
        sendJson(res, 409, {
          ok: false,
          error: outcome.message || 'The control panel window was not found. Close and reopen the control panel, then retry.',
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: { enabled: body.enabled } });
      return true;
    }


    if (requestUrl.pathname === '/api/local-music/health' && req.method === 'GET') {
      const health = await getAceStepHealth();
      sendJson(res, 200, { ok: true, data: health });
      return true;
    }

    if (requestUrl.pathname === '/api/local-music/start' && req.method === 'POST') {
      if (process.platform !== 'win32') {
        sendJson(res, 409, { ok: false, error: 'The one-click local AI setup is currently available in the Windows package.' });
        return true;
      }
      const health = await getAceStepHealth();
      if (health.ready) {
        sendJson(res, 200, { ok: true, data: { launched: false, ready: true } });
        return true;
      }
      const setupScript = path.join(APP_DIR, 'scripts', 'setup-local-music-ai.ps1');
      if (!fs.existsSync(setupScript)) {
        sendJson(res, 500, { ok: false, error: 'The local AI setup script is missing. Download the latest complete Windows package.' });
        return true;
      }
      try {
        const child = spawn('powershell.exe', [
          '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', setupScript,
        ], { detached: true, stdio: 'ignore', windowsHide: false });
        child.once('error', (error) => console.warn('Could not launch ACE-Step setup:', error));
        child.unref();
        sendJson(res, 200, {
          ok: true,
          data: { launched: true, ready: false, message: 'Setup is running in a separate PowerShell window.' },
        });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Could not start the local AI setup.' });
      }
      return true;
    }

    if (requestUrl.pathname === '/api/local-music/generate' && req.method === 'POST') {
      const health = await getAceStepHealth();
      if (!health.ready) {
        sendJson(res, 503, { ok: false, error: 'ACE-Step is not running yet. Use “Set up / start local model” and wait for it to become ready.' });
        return true;
      }

      const body = await readJsonBody(req, 20000);
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      const lyrics = typeof body.lyrics === 'string' ? body.lyrics.trim() : '';
      const vocalMode = body.vocalMode === 'instrumental' || body.vocalMode === 'generated' || body.vocalMode === 'custom'
        ? body.vocalMode
        : 'instrumental';
      const bpm = Math.max(30, Math.min(300, Math.round(Number(body.bpm) || 120)));
      const durationSeconds = Math.max(10, Math.min(600, Math.round(Number(body.durationSeconds) || 120)));

      if (prompt.length < 12 || prompt.length > 12000) {
        sendJson(res, 400, { ok: false, error: 'The music description must contain between 12 and 12,000 characters.' });
        return true;
      }
      if (lyrics.length > 12000) {
        sendJson(res, 400, { ok: false, error: 'Lyrics are too long. Keep them under 12,000 characters.' });
        return true;
      }

      const requestController = new AbortController();
      const requestTimer = setTimeout(() => requestController.abort(), 45000);
      let taskResponse;
      try {
        taskResponse = await fetch(ACE_STEP_BASE_URL + '/release_task', {
          method: 'POST',
          signal: requestController.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            prompt,
            lyrics,
            bpm,
            audio_duration: durationSeconds,
            audio_format: 'mp3',
            thinking: true,
            use_format: vocalMode === 'custom',
            sample_mode: vocalMode === 'generated',
            sample_query: vocalMode === 'generated' ? prompt : '',
            task_type: 'text2music',
          }),
        });
      } catch (error) {
        const message = error && error.name === 'AbortError'
          ? 'ACE-Step did not accept the task in time.'
          : 'Could not connect to the local ACE-Step engine.';
        sendJson(res, 503, { ok: false, error: message });
        return true;
      } finally {
        clearTimeout(requestTimer);
      }

      let taskPayload;
      try {
        taskPayload = await taskResponse.json();
      } catch {
        sendJson(res, 502, { ok: false, error: 'ACE-Step returned an invalid task response.' });
        return true;
      }
      if (!taskResponse.ok || taskPayload?.code >= 400 || taskPayload?.error) {
        sendJson(res, 502, { ok: false, error: String(taskPayload?.error || 'ACE-Step could not queue the music generation task.').slice(0, 1000) });
        return true;
      }
      const taskId = String(taskPayload?.data?.task_id || '');
      if (!taskId || taskId.length > 160) {
        sendJson(res, 502, { ok: false, error: 'ACE-Step did not return a valid task ID.' });
        return true;
      }

      const generationDeadline = Date.now() + 20 * 60 * 1000;
      let outputItem = null;
      while (Date.now() < generationDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 1600));
        const pollController = new AbortController();
        const pollTimer = setTimeout(() => pollController.abort(), 30000);
        let pollResponse;
        try {
          pollResponse = await fetch(ACE_STEP_BASE_URL + '/query_result', {
            method: 'POST',
            signal: pollController.signal,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ task_id_list: [taskId] }),
          });
        } catch (error) {
          if (error && error.name === 'AbortError') continue;
          sendJson(res, 502, { ok: false, error: 'Lost connection to the local music engine while waiting for the song.' });
          return true;
        } finally {
          clearTimeout(pollTimer);
        }

        let pollPayload;
        try {
          pollPayload = await pollResponse.json();
        } catch {
          continue;
        }
        if (!pollResponse.ok || pollPayload?.error || pollPayload?.code >= 500) {
          sendJson(res, 502, { ok: false, error: String(pollPayload?.error || 'Local generation status check failed.').slice(0, 1000) });
          return true;
        }

        const rows = Array.isArray(pollPayload?.data) ? pollPayload.data : [];
        const row = rows.find((entry) => String(entry?.task_id) === taskId) || rows[0];
        if (!row) continue;

        const status = Number(row.status);
        if (status === 2) {
          let detail = String(row.error || 'ACE-Step marked this music generation as failed.');
          try {
            const parsed = typeof row.result === 'string' ? JSON.parse(row.result) : row.result;
            const failed = Array.isArray(parsed) ? parsed.find((entry) => entry?.error) : parsed;
            if (failed?.error) detail = String(failed.error);
          } catch { /* Keep the task-level error message. */ }
          sendJson(res, 502, { ok: false, error: detail.slice(0, 1200) });
          return true;
        }
        if (status !== 1) continue;

        let resultItems;
        try {
          resultItems = typeof row.result === 'string' ? JSON.parse(row.result) : row.result;
        } catch {
          resultItems = [];
        }
        if (!Array.isArray(resultItems)) resultItems = resultItems ? [resultItems] : [];
        outputItem = resultItems.find((item) => item && typeof item.file === 'string' && Number(item.status || 1) === 1)
          || resultItems.find((item) => item && typeof item.file === 'string');
        if (!outputItem) {
          sendJson(res, 502, { ok: false, error: 'ACE-Step reported success but did not return a playable audio file.' });
          return true;
        }
        break;
      }

      if (!outputItem) {
        sendJson(res, 504, { ok: false, error: 'Local music generation exceeded 20 minutes. Check the ACE-Step PowerShell window and try again.' });
        return true;
      }

      let outputAudioUrl;
      try {
        outputAudioUrl = new URL(String(outputItem.file), ACE_STEP_BASE_URL);
      } catch {
        sendJson(res, 502, { ok: false, error: 'ACE-Step returned an invalid audio URL.' });
        return true;
      }
      if (outputAudioUrl.origin !== ACE_STEP_BASE_URL || outputAudioUrl.pathname !== '/v1/audio') {
        sendJson(res, 502, { ok: false, error: 'ACE-Step returned an unsupported audio file URL.' });
        return true;
      }

      const audioController = new AbortController();
      const audioTimer = setTimeout(() => audioController.abort(), 180000);
      let audioResponse;
      try {
        audioResponse = await fetch(outputAudioUrl, { signal: audioController.signal });
      } catch {
        sendJson(res, 502, { ok: false, error: 'Could not retrieve the generated audio from ACE-Step.' });
        return true;
      } finally {
        clearTimeout(audioTimer);
      }
      if (!audioResponse.ok) {
        sendJson(res, 502, { ok: false, error: 'ACE-Step generated a task but its audio file could not be downloaded.' });
        return true;
      }

      let audioBuffer;
      try {
        audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      } catch {
        sendJson(res, 502, { ok: false, error: 'Could not read the generated audio file.' });
        return true;
      }
      if (audioBuffer.length < 512 || audioBuffer.length > 600 * 1024 * 1024) {
        sendJson(res, 502, { ok: false, error: 'ACE-Step returned an audio file with an invalid size.' });
        return true;
      }

      let fileName;
      try {
        fs.mkdirSync(LOCAL_MUSIC_DIR, { recursive: true });
        fileName = 'ace-step-' + randomUUID() + '.mp3';
        fs.writeFileSync(path.join(LOCAL_MUSIC_DIR, fileName), audioBuffer);
      } catch {
        sendJson(res, 500, { ok: false, error: 'Could not save the generated audio to your local music folder.' });
        return true;
      }

      const resultDuration = Number(outputItem?.metas?.duration);
      sendJson(res, 200, {
        ok: true,
        data: {
          audioUrl: '/api/local-music/audio/' + fileName,
          lyrics: String(outputItem.lyrics || lyrics || ''),
          durationSeconds: Number.isFinite(resultDuration) && resultDuration >= 10 ? resultDuration : durationSeconds,
          bpm: Number(outputItem?.metas?.bpm) || bpm,
          model: String(outputItem.dit_model || 'ACE-Step 1.5'),
          generatedAt: new Date().toISOString(),
        },
      });
      return true;
    }

    if (requestUrl.pathname.startsWith('/api/local-music/audio/') && req.method === 'GET') {
      const fileName = requestUrl.pathname.slice('/api/local-music/audio/'.length);
      if (!/^ace-step-[a-f0-9-]{36}\.mp3$/i.test(fileName)) {
        sendJson(res, 400, { ok: false, error: 'Invalid local audio filename.' });
        return true;
      }
      const localAudioPath = path.join(LOCAL_MUSIC_DIR, fileName);
      if (!fs.existsSync(localAudioPath)) {
        sendJson(res, 404, { ok: false, error: 'The saved local AI audio file was not found.' });
        return true;
      }
      const stat = fs.statSync(localAudioPath);
      const range = req.headers.range;
      const rangeMatch = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      if (rangeMatch) {
        const start = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
        const requestedEnd = rangeMatch[2] ? Number(rangeMatch[2]) : stat.size - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= stat.size || requestedEnd < start) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size });
          res.end();
          return true;
        }
        const end = Math.min(requestedEnd, stat.size - 1);
        res.writeHead(206, {
          'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
          'Content-Length': end - start + 1,
        });
        fs.createReadStream(localAudioPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Length': stat.size });
        fs.createReadStream(localAudioPath).pipe(res);
      }
      return true;
    }

    if (requestUrl.pathname === '/api/update/check' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, data: await getLatestReleaseInfo() });
      return true;
    }

    if (requestUrl.pathname === '/api/update/install' && req.method === 'POST') {
      if (process.platform !== 'win32') {
        sendJson(res, 409, { ok: false, error: 'Automatic installation is only supported in the Windows desktop package.' });
        return true;
      }
      const update = await getLatestReleaseInfo();
      if (!update.updateAvailable) {
        sendJson(res, 200, { ok: true, data: { accepted: false, message: 'The app is already up to date.' } });
        return true;
      }
      if (!update.assetUrl || !update.canAutoInstall) {
        sendJson(res, 409, { ok: false, error: 'The latest release does not contain a Windows PC update package.' });
        return true;
      }
      const updaterScript = path.join(APP_DIR, 'scripts', 'apply-update.ps1');
      if (!fs.existsSync(updaterScript)) {
        sendJson(res, 500, { ok: false, error: 'The Windows update installer is missing. Download the latest PC package manually.' });
        return true;
      }

      // Run a temporary copy: Windows may refuse to rename APP_DIR while it is a
      // running process's current directory, which previously blocked self-update.
      const updaterLaunchDir = path.join(process.env.TEMP || process.env.TMP || process.cwd(), 'DJ-Desktop-Updater-' + randomUUID());
      fs.mkdirSync(updaterLaunchDir, { recursive: true });
      const updaterLaunchScript = path.join(updaterLaunchDir, 'apply-update.ps1');
      try {
        fs.copyFileSync(updaterScript, updaterLaunchScript);
      } catch (error) {
        fs.rmSync(updaterLaunchDir, { recursive: true, force: true });
        throw new Error('Could not prepare the update installer: ' + (error instanceof Error ? error.message : String(error)));
      }

      const child = spawn('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', updaterLaunchScript,
        '-PackageUrl', update.assetUrl, '-AppDir', APP_DIR, '-TargetVersion', update.latestVersion, '-ServerPid', String(process.pid),
      ], { cwd: updaterLaunchDir, detached: true, stdio: 'ignore', windowsHide: true });
      child.unref();
      sendJson(res, 200, { ok: true, data: { accepted: true, message: 'The update is accepted; the app will reopen after installation.' } });
      setTimeout(() => { server.close(() => process.exit(0)); }, 1200);
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/home' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, data: await getAlbumatyHome() });
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/search' && req.method === 'GET') {
      const query = requestUrl.searchParams.get('q') || '';
      if (query.trim().length < 2) {
        sendJson(res, 400, { ok: false, error: 'Enter at least two characters to search for an artist or song.' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: await getAlbumatySearch(query) });
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/section' && req.method === 'GET') {
      const target = requestUrl.searchParams.get('url') || '';
      sendJson(res, 200, { ok: true, data: await getAlbumatySection(normalizeAlbumatyUrl(target)) });
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/resolve' && req.method === 'GET') {
      const target = requestUrl.searchParams.get('url') || '';
      sendJson(res, 200, { ok: true, data: await resolveAlbumatySong(normalizeAlbumatyUrl(target)) });
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/stream' && req.method === 'GET') {
      const target = requestUrl.searchParams.get('url') || '';
      const resolved = await resolveAlbumatySong(normalizeAlbumatyUrl(target));
      await proxyAudioStream(req, res, resolved.streamUrl);
      return true;
    }

    if (requestUrl.pathname === '/api/albumaty/download' && req.method === 'GET') {
      const target = requestUrl.searchParams.get('url') || '';
      const resolved = await resolveAlbumatySong(normalizeAlbumatyUrl(target));
      await proxyAudioStream(req, res, resolved.downloadUrl, (resolved.title || 'song') + '.mp3');
      return true;
    }

    if ((requestUrl.pathname === '/api/online/stream' || requestUrl.pathname === '/api/online/download') && req.method === 'GET') {
      const target = requestUrl.searchParams.get('url') || '';
      if (!isAllowedAudiusUrl(target)) {
        sendJson(res, 400, { ok: false, error: 'Invalid Audius audio URL.' });
        return true;
      }
      if (requestUrl.pathname === '/api/online/stream') {
        await proxyAudioStream(req, res, target);
      } else {
        const requestedName = requestUrl.searchParams.get('name') || 'song.mp3';
        const safeName = requestedName.toLowerCase().endsWith('.mp3') ? requestedName : requestedName + '.mp3';
        await proxyAudioStream(req, res, target, safeName);
      }
      return true;
    }

    sendJson(res, 404, { ok: false, error: 'API endpoint not found.' });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Online music request failed.';
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
    } else {
      sendJson(res, 502, { ok: false, error: message });
    }
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

export { handleApi, server };

const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
  process.argv[1].endsWith('server.js')
);

if (isDirectRun) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[✓] DJ Desktop Studio running at http://127.0.0.1:${PORT}`);
  });
}

