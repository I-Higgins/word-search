#!/usr/bin/env node
// Renders the PNG app icons from the SVG source art with headless Chromium.
// Usage: npm run icons   (needs Playwright's Chromium; the PNGs are committed)
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobs = [
  { src: 'icons/src/app-icon.svg', out: 'icons/icon-512.png', size: 512 },
  { src: 'icons/src/app-icon.svg', out: 'icons/icon-192.png', size: 192 },
  { src: 'icons/src/app-icon-maskable.svg', out: 'icons/icon-maskable-512.png', size: 512 },
  { src: 'icons/src/app-icon-maskable.svg', out: 'icons/icon-maskable-192.png', size: 192 },
  // iOS draws its own rounded corners, so the touch icon uses the full-bleed art.
  { src: 'icons/src/app-icon-maskable.svg', out: 'icons/apple-touch-icon.png', size: 180, full: true },
  { src: 'icons/src/app-icon.svg', out: 'icons/favicon-32.png', size: 32 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const j of jobs) {
  let svg = await readFile(path.join(root, j.src), 'utf8');
  if (j.full) {
    // Apple touch icon: same art as the main icon but square (iOS masks it).
    svg = (await readFile(path.join(root, 'icons/src/app-icon.svg'), 'utf8')).replace('rx="112"', 'rx="0"');
  }
  await page.setViewportSize({ width: j.size, height: j.size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
    <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${j.size}" height="${j.size}" style="display:block"></body></html>`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(root, j.out), omitBackground: true, clip: { x: 0, y: 0, width: j.size, height: j.size } });
  console.log('wrote', j.out);
}
await browser.close();
