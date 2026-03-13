#!/usr/bin/env node
/**
 * Local server for TV link page: serves the HTML and provides the two API
 * endpoints. Developer token from .env.local (EXPO_PUBLIC_APPLE_MUSIC_TOKEN).
 * Run from project root: node tv-link-page/server.mjs
 */
import {createServer} from 'node:http';
import {Buffer} from 'node:buffer';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const pageDir = __dirname;

// Load .env.local from project root
try {
  const envPath = resolve(projectRoot, '.env.local');
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, 'utf8');
    for (const line of env.split('\n')) {
      const m = line.match(/^\s*EXPO_PUBLIC_APPLE_MUSIC_TOKEN\s*=\s*(.+)/);
      if (m) {
        const raw = m[1].trim();
        process.env.EXPO_PUBLIC_APPLE_MUSIC_TOKEN =
          raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : raw;
        break;
      }
    }
  }
} catch {
  // ignore
}

const PORT = Number(process.env.TV_LINK_PORT) || 8080;
const developerToken = process.env.EXPO_PUBLIC_APPLE_MUSIC_TOKEN || '';

// In-memory store: code -> { musicUserToken, createdAt }
const store = new Map();
const activeCodes = new Map(); // code -> lastPolledAt
const TTL_MS = 15 * 60 * 1000; // 15 min

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, {'Content-Type': contentType});
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Music-User-Token',
  );
}

const server = createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // Serve index.html at / and /tv
  if (
    (url.pathname === '/' || url.pathname === '/tv') &&
    req.method === 'GET'
  ) {
    try {
      const html = readFileSync(resolve(pageDir, 'index.html'), 'utf8');
      send(res, 200, html, 'text/html');
    } catch (e) {
      send(res, 500, {error: 'Could not read index.html'});
    }
    return;
  }

  // GET /api/tv-link/developer-token
  if (url.pathname === '/api/tv-link/developer-token' && req.method === 'GET') {
    if (!developerToken) {
      send(res, 500, {
        error:
          'Developer token not set. Set EXPO_PUBLIC_APPLE_MUSIC_TOKEN in .env.local.',
      });
      return;
    }
    send(res, 200, {developerToken});
    return;
  }

  // POST /api/tv-link
  if (url.pathname === '/api/tv-link' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const {code, musicUserToken} = JSON.parse(body);
        if (!code || !musicUserToken) {
          send(res, 400, {error: 'Missing code or musicUserToken'});
          return;
        }

        const now = Date.now();
        for (const [k, v] of activeCodes.entries()) {
          if (now - v > 10000) activeCodes.delete(k); // Expire after 10s of no polling
        }

        if (!activeCodes.has(code.trim())) {
          send(res, 400, {error: 'Invalid TV code. Please check the screen and try again.'});
          return;
        }

        store.set(code.trim(), {musicUserToken, createdAt: Date.now()});
        send(res, 200, {ok: true});
      } catch {
        send(res, 400, {error: 'Invalid JSON body'});
      }
    });
    return;
  }

  // GET /api/apple-music-proxy/image?url=... — proxy artwork (emulator can't reach mzstatic.com)
  if (url.pathname === '/api/apple-music-proxy/image' && req.method === 'GET') {
    const imageUrl = url.searchParams.get('url');
    if (!imageUrl) {
      send(res, 400, {error: 'Missing url parameter'});
      return;
    }
    try {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        send(res, imgRes.status, {error: 'Image fetch failed'});
        return;
      }
      const buffer = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(Buffer.from(buffer));
    } catch (err) {
      send(res, 502, {
        error: 'Image proxy failed: ' + (err.message || String(err)),
      });
    }
    return;
  }

  // GET /api/apple-music-proxy/* — proxy to Apple Music API (for emulator)
  if (
    url.pathname.startsWith('/api/apple-music-proxy/') &&
    req.method === 'GET'
  ) {
    const applePath = url.pathname.replace('/api/apple-music-proxy', '');
    const appleUrl =
      'https://api.music.apple.com/v1' + applePath + (url.search || '');
    const musicUserToken = req.headers['music-user-token'] || '';

    if (!developerToken) {
      send(res, 500, {
        error:
          'Developer token not set. Set EXPO_PUBLIC_APPLE_MUSIC_TOKEN in .env.local.',
      });
      return;
    }

    const headers = {
      Authorization: `Bearer ${developerToken}`,
      'Content-Type': 'application/json',
    };
    if (musicUserToken) {
      headers['Music-User-Token'] = musicUserToken;
    }

    try {
      const proxyRes = await fetch(appleUrl, {headers});
      const body = await proxyRes.text();
      res.writeHead(proxyRes.status, {
        'Content-Type':
          proxyRes.headers.get('content-type') || 'application/json',
      });
      res.end(body);
    } catch (err) {
      send(res, 502, {
        error: 'Proxy failed: ' + (err.message || String(err)),
      });
    }
    return;
  }

  // GET /api/tv-link?code=XXX (TV app polling)
  if (url.pathname === '/api/tv-link' && req.method === 'GET') {
    const code = url.searchParams.get('code');
    if (!code) {
      send(res, 400, {error: 'Missing code'});
      return;
    }
    
    // Register the code as active since the TV app is trying to poll for it
    activeCodes.set(code.trim(), Date.now());

    const entry = store.get(code.trim());
    if (!entry) {
      send(res, 404, {error: 'Code not found or expired'});
      return;
    }
    if (Date.now() - entry.createdAt > TTL_MS) {
      store.delete(code.trim());
      send(res, 404, {error: 'Code expired'});
      return;
    }
    store.delete(code.trim()); // one-time use
    send(res, 200, {musicUserToken: entry.musicUserToken});
    return;
  }

  send(res, 404, {error: 'Not found'});
});

function printReady(port) {
  console.log('');
  console.log('  TV Link (local)');
  console.log('  ---------------');
  console.log('  Open in browser:  http://localhost:' + port + '/tv');
  console.log(
    '  From Android TV emulator, use:  http://10.0.2.2:' + port + '/tv',
  );
  console.log(
    '  Apple Music proxy (emulator):  http://10.0.2.2:' +
      port +
      '/api/apple-music-proxy/*',
  );
  console.log(
    '  Developer token: ' +
      (developerToken
        ? 'loaded from .env.local'
        : 'NOT SET (set EXPO_PUBLIC_APPLE_MUSIC_TOKEN)'),
  );
  console.log('');
}

server.once('listening', () => {
  const boundPort = server.address().port;
  printReady(boundPort);
});
server.once('error', err => {
  console.error(
    '  Port ' +
      PORT +
      ' in use. Set TV_LINK_PORT to another port (e.g. TV_LINK_PORT=8081 npm run tv-link:serve)',
  );
  process.exit(1);
});
server.listen(PORT, '0.0.0.0');
