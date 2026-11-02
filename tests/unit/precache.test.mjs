import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { listAppFiles } from '../../scripts/app-files.mjs';

const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const list = JSON.parse(
  sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'),
);

test('every app file is precached by the service worker', () => {
  const missing = listAppFiles().filter((f) => f !== 'sw.js' && !list.includes(f));
  assert.deepEqual(missing, [], `Add these to PRECACHE in sw.js: ${missing.join(', ')}`);
});

test('every precached file exists and is an app file (nothing from design/ or tests/)', () => {
  const app = new Set(listAppFiles());
  for (const f of list) {
    if (f === './') continue;
    assert.ok(existsSync(new URL(`../../${f}`, import.meta.url)), `${f} does not exist`);
    assert.ok(app.has(f), `${f} is not an app file`);
    assert.ok(!f.startsWith('design/') && !f.startsWith('tests/'), f);
  }
});

test('all paths are relative (works under /<repo>/ on GitHub Pages)', () => {
  for (const f of list) assert.ok(!f.startsWith('/') && !/^https?:/.test(f), f);
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const r of refs) assert.ok(!r.startsWith('/') && !/^https?:/.test(r), `index.html: ${r}`);
  const manifest = JSON.parse(readFileSync(new URL('../../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok(list.includes(icon.src), `manifest icon ${icon.src} precached`);
});

test('no external requests in app code', () => {
  for (const f of listAppFiles().filter((x) => /\.(js|css|html|webmanifest)$/.test(x))) {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    const urls = [...src.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0])
      // Allowed: the "see the code" link (a normal link the user taps; not loaded by the app).
      .filter((u) => !u.startsWith('https://github.com/I-Higgins/word-search'))
      // SVG namespace identifiers aren't requests.
      .filter((u) => !u.startsWith('http://www.w3.org/'));
    assert.deepEqual(urls, [], `${f} references external URLs`);
  }
});

test('manifest colours match the design tokens', () => {
  const tokens = readFileSync(new URL('../../css/tokens.css', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../../manifest.webmanifest', import.meta.url), 'utf8'));
  const bg = tokens.match(/--c-bg:\s*(#[0-9A-Fa-f]{6})/)[1];
  assert.equal(manifest.background_color.toLowerCase(), bg.toLowerCase());
  assert.equal(manifest.theme_color.toLowerCase(), bg.toLowerCase());
});
