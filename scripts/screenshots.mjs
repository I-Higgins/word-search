#!/usr/bin/env node
// Captures every screen and state at the design's viewports and themes, and
// builds side-by-side images (design | app) for the screens the design shows.
// Output: screenshots/ (git-ignored).  Usage: npm run screenshots
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'screenshots');
const PORT = 4174;
const BASE = `http://localhost:${PORT}/`;

// Same progress the design mock-ups show.
const DESIGN_STATE = {
  completed: { fishing: 11, boats: 3, cars: 8, animals: 20, birds: 4, sport: 1, ocean: 2 },
  game: { categoryId: 'fishing', level: 12, found: [] },
};

const VIEWPORTS = {
  'ipad-landscape': { width: 1180, height: 820 },
  'ipad-portrait': { width: 820, height: 1180 },
  iphone: { width: 390, height: 844 },
  'ipad-768': { width: 768, height: 1024 },
  'ipad-1366': { width: 1366, height: 1024 },
};

// [app shot name, design screen file] for side-by-side comparison.
const PAIRS = [
  ['light-normal-ipad-landscape-home', '00-home-ipad-landscape.png'],
  ['light-normal-ipad-portrait-home', '01-home-ipad-portrait.png'],
  ['light-normal-iphone-home', '02-home-iphone.png'],
  ['light-xl-ipad-landscape-home', '03-home-xl.png'],
  ['light-xl-iphone-home', '04-home-iphone-xl.png'],
  ['light-normal-ipad-landscape-levels', '05-levels-ipad-landscape.png'],
  ['light-normal-ipad-portrait-levels', '06-levels-ipad-portrait.png'],
  ['light-normal-iphone-levels', '07-levels-iphone.png'],
  ['light-normal-ipad-landscape-settings', '08-settings-ipad-landscape.png'],
  ['light-normal-ipad-landscape-reset', '09-settings-reset.png'],
  ['light-normal-iphone-settings', '10-settings-iphone.png'],
];

function seed(theme, text) {
  const completed = {};
  for (const [id, n] of Object.entries(DESIGN_STATE.completed)) completed[id] = Array.from({ length: n }, (_, i) => i + 1);
  return JSON.stringify({
    version: 1,
    settings: { textSize: text, theme: theme === 'light' ? 'light' : theme, sound: false, seenHelp: true, installDismissedAt: Date.now() },
    completed,
    game: DESIGN_STATE.game,
    route: null,
    lastCategory: 'fishing',
  });
}

async function main() {
  await mkdir(out, { recursive: true });
  const server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));
  const browser = await chromium.launch();
  const shots = [];
  try {
    const combos = [];
    for (const theme of ['light', 'dark', 'hc']) {
      for (const [vp] of Object.entries(VIEWPORTS)) combos.push([theme, 'normal', vp]);
    }
    combos.push(['light', 'xl', 'ipad-landscape'], ['light', 'xl', 'iphone'], ['light', 'large', 'ipad-portrait']);

    for (const [theme, text, vp] of combos) {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      await ctx.addInitScript((data) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('wordsearch:v1', data); sessionStorage.setItem('s', '1'); } }, seed(theme, text));
      const page = await ctx.newPage();
      const snap = async (name) => {
        await page.waitForTimeout(150);
        const file = `${theme}-${text}-${vp}-${name}`;
        await page.screenshot({ path: path.join(out, `${file}.png`) });
        shots.push(file);
      };
      await page.goto(`${BASE}#/`);
      await snap('home');
      await page.goto(`${BASE}#/topic/fishing`);
      await snap('levels');
      await page.goto(`${BASE}#/settings`);
      await snap('settings');
      await page.getByRole('button', { name: 'Reset progress…' }).click();
      await snap('reset');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Show how to play' }).click();
      await snap('help');
      await page.keyboard.press('Escape');

      // Game states: empty, anchor + hint, some found, drag in progress, complete.
      for (const level of [12, 60, 110]) {
        await page.goto(`${BASE}#/play/fishing/${level}`);
        await snap(`game-${level}`);
      }
      await page.goto(`${BASE}#/play/fishing/12`);
      const lvl = await page.evaluate(() => window.__wordsearch.generateLevel(window.__wordsearch.categories[0], 12));
      const cellBox = async ([r, c]) => {
        const b = await page.locator(`.cell[data-r="${r}"][data-c="${c}"]`).boundingBox();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      };
      for (const w of lvl.words.slice(0, 2)) {
        const b0 = await cellBox(w.cells[0]);
        await page.locator('.cells').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: b0.x, clientY: b0.y });
        const e = await cellBox(w.cells[w.cells.length - 1]);
        await page.locator('.cells').dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: e.x, clientY: e.y });
        await page.locator('.cells').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: e.x, clientY: e.y });
      }
      await page.getByRole('button', { name: /Hint/ }).click();
      const w3 = lvl.words[2];
      const s = await cellBox(w3.cells[0]);
      await page.touchscreen.tap(s.x, s.y);
      await snap('game-states');
      // Drag in progress
      const w4 = lvl.words[3] || lvl.words[2];
      const a = await cellBox(w4.cells[0]);
      const z = await cellBox(w4.cells[w4.cells.length - 1]);
      await page.locator('.cells').dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: a.x, clientY: a.y });
      await page.locator('.cells').dispatchEvent('pointermove', { pointerId: 2, pointerType: 'touch', clientX: z.x, clientY: z.y });
      await snap('game-dragging');
      await page.locator('.cells').dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch', clientX: z.x, clientY: z.y });
      for (const w of lvl.words) {
        const p = await cellBox(w.cells[0]);
        const q = await cellBox(w.cells[w.cells.length - 1]);
        await page.locator('.cells').dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch', clientX: p.x, clientY: p.y });
        await page.locator('.cells').dispatchEvent('pointermove', { pointerId: 3, pointerType: 'touch', clientX: q.x, clientY: q.y });
        await page.locator('.cells').dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch', clientX: q.x, clientY: q.y });
      }
      await page.waitForTimeout(900);
      await snap('complete');

      // Small pieces: install card and error state.
      await page.evaluate(() => { window.__wordsearch.store.setSetting('installDismissedAt', 0); });
      await page.goto(`${BASE}#/`);
      await page.reload();
      await snap('install-card');
      await page.evaluate(() => localStorage.setItem('wordsearch:v1', '{broken'));
      await page.reload();
      await snap('error');
      await ctx.close();
    }

    // Side-by-side with the design.
    const page = await browser.newPage({ viewport: { width: 2400, height: 1300 } });
    for (const [mine, theirs] of PAIRS) {
      const a = (await readFile(path.join(root, 'design/screens', theirs))).toString('base64');
      const b = (await readFile(path.join(out, `${mine}.png`))).toString('base64');
      await page.setContent(`<body style="margin:0;background:#888;display:flex;gap:24px;padding:24px;align-items:flex-start;font:16px system-ui">
        <figure style="margin:0"><figcaption>Design</figcaption><img src="data:image/png;base64,${a}"></figure>
        <figure style="margin:0"><figcaption>App</figcaption><img src="data:image/png;base64,${b}"></figure></body>`);
      await page.waitForTimeout(100);
      const el = await page.$('body');
      await el.screenshot({ path: path.join(out, `compare-${theirs}`) });
    }
    console.log(`Saved ${shots.length} screenshots and ${PAIRS.length} comparisons to screenshots/`);
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
