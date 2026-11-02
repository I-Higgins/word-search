#!/usr/bin/env node
// Tiny static server for local development and tests (no dependencies).
// Serves only the app files (the same set that is deployed), never design/ or tests/.
// Usage: node scripts/serve.mjs [port]   ->  http://localhost:8080/
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAppFile } from './app-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);
// Optional sub-path, to mimic GitHub Pages (e.g. BASE=/word-search/).
const base = (process.env.BASE || '/').replace(/\/?$/, '/');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// Test hook (only with TEST_HOOKS=1): POST /__bump pretends a new release was deployed
// by changing the service worker's BUILD string, like the deploy workflow does.
let build = null;

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (process.env.TEST_HOOKS === '1' && req.method === 'POST' && p === '/__bump') {
      build = `test${Date.now()}`;
      res.writeHead(200).end(build);
      return;
    }
    if (!p.startsWith(base)) { res.writeHead(404).end('Not found'); return; }
    p = p.slice(base.length) || 'index.html';
    if (p.endsWith('/')) p += 'index.html';
    const rel = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
    if (!isAppFile(rel)) { res.writeHead(404).end('Not found'); return; }
    const file = path.join(root, rel);
    await stat(file);
    let body = await readFile(file);
    if (build && rel === 'sw.js') body = Buffer.from(body.toString().replace("const BUILD = 'dev';", `const BUILD = '${build}';`));
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(port, () => console.log(`Word Search running at http://localhost:${port}${base}`));
