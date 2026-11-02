import { test, expect } from '@playwright/test';

// Skip the first-run "How to play" dialog and the install card in most tests.
async function freshStart(page, extra = {}) {
  await page.addInitScript((settings) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('wordsearch:v1', JSON.stringify({
        version: 1,
        settings: { textSize: 'normal', theme: null, sound: false, seenHelp: true, installDismissedAt: Date.now(), ...settings },
        completed: {}, game: null, route: null,
      }));
      sessionStorage.setItem('seeded', '1');
    }
  }, extra);
}

async function openLevel(page, cat = 'fishing', level = 1) {
  await page.goto(`./#/play/${cat}/${level}`);
  await expect(page.locator('.cells .cell').first()).toBeVisible();
  return page.evaluate(([c, l]) => {
    const { generateLevel, categories } = window.__wordsearch;
    return generateLevel(categories.find((x) => x.id === c), l);
  }, [cat, level]);
}

async function cellCenter(page, [r, c]) {
  const box = await page.locator(`.cell[data-r="${r}"][data-c="${c}"]`).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width };
}

async function tapCell(page, cell) {
  const p = await cellCenter(page, cell);
  await page.touchscreen.tap(p.x, p.y);
}

/** Touch drag using synthetic pointer events (works in every engine). */
async function touchDrag(page, from, to, steps = 8) {
  const a = await cellCenter(page, from);
  const b = await cellCenter(page, to);
  await page.evaluate(({ a, b, steps }) => {
    const el = document.querySelector('.cells');
    const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1,
    }));
    fire('pointerdown', a.x, a.y);
    for (let i = 1; i <= steps; i++) fire('pointermove', a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    fire('pointerup', b.x, b.y);
  }, { a, b, steps });
}

const wordItem = (page, i) => page.locator(`.word[data-word="${i}"]`);

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('home shows all topics and opens a level list', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Word Search' })).toBeVisible();
  await expect(page.locator('.topic')).toHaveCount(16);
  await page.getByRole('button', { name: /^Fishing/ }).click();
  await expect(page.getByRole('heading', { name: 'Fishing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Level 1, play next' })).toBeVisible();
  await page.getByRole('button', { name: /Play level 1/ }).click();
  await expect(page.getByRole('heading', { name: /Level 1/ })).toBeVisible();
});

test('tap-tap finds a word', async ({ page }) => {
  const level = await openLevel(page);
  const w = level.words[0];
  await tapCell(page, w.cells[0]);
  await expect(page.locator(`.cell[data-r="${w.cells[0][0]}"][data-c="${w.cells[0][1]}"]`)).toHaveClass(/is-anchor/);
  await tapCell(page, w.cells[w.cells.length - 1]);
  await expect(wordItem(page, 0)).toHaveClass(/is-found/);
  await expect(page.locator('[data-count]')).toHaveText(`1 of ${level.words.length} found`);
});

test('tapping the first letter again cancels', async ({ page }) => {
  const level = await openLevel(page);
  const start = level.words[0].cells[0];
  await tapCell(page, start);
  await expect(page.locator('.cell.is-anchor')).toHaveCount(1);
  await tapCell(page, start);
  await expect(page.locator('.cell.is-anchor')).toHaveCount(0);
});

test('a wrong selection clears gently and finds nothing', async ({ page }) => {
  const level = await openLevel(page);
  // Two cells in a straight line that are not a word: pick row 0 cols 0..1 unless that is a word.
  const isWord = (a, b) => level.words.some((w) => {
    const k = (c) => c.join(',');
    const ends = [k(w.cells[0]), k(w.cells[w.cells.length - 1])];
    return ends.includes(k(a)) && ends.includes(k(b));
  });
  let a = [0, 0]; let b = [0, 1];
  for (let r = 0; r < level.size && isWord(a, b); r++) { a = [r, 0]; b = [r, 1]; }
  await tapCell(page, a);
  await tapCell(page, b);
  await expect(page.locator('.word.is-found')).toHaveCount(0);
  await expect(page.locator('.cell.is-anchor')).toHaveCount(0);
});

test('drag finds a word (mouse)', async ({ page }) => {
  const level = await openLevel(page);
  const w = level.words[1];
  const a = await cellCenter(page, w.cells[0]);
  const b = await cellCenter(page, w.cells[w.cells.length - 1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  await expect(wordItem(page, 1)).toHaveClass(/is-found/);
});

test('drag finds a word (touch) and snaps to the nearest direction', async ({ page }) => {
  const level = await openLevel(page, 'fishing', 30); // includes diagonals
  const i = Math.max(0, level.words.findIndex((w) => w.dir === 'SE' || w.dir === 'NE'));
  const w = level.words[i];
  const a = await cellCenter(page, w.cells[0]);
  const end = w.cells[w.cells.length - 1];
  const b = await cellCenter(page, end);
  // End slightly off the true line: should still snap onto it.
  await page.evaluate(({ a, b, off }) => {
    const el = document.querySelector('.cells');
    const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
    fire('pointerdown', a.x, a.y);
    for (let s = 1; s <= 10; s++) fire('pointermove', a.x + ((b.x - a.x) * s) / 10 + off, a.y + ((b.y - a.y) * s) / 10 - off);
    fire('pointerup', b.x + off, b.y - off);
  }, { a, b, off: a.w * 0.25 });
  await expect(wordItem(page, i)).toHaveClass(/is-found/);
});

test('backwards selection works (tap-tap and drag)', async ({ page }) => {
  const level = await openLevel(page);
  const w0 = level.words[0];
  await tapCell(page, w0.cells[w0.cells.length - 1]);
  await tapCell(page, w0.cells[0]);
  await expect(wordItem(page, 0)).toHaveClass(/is-found/);
  const w2 = level.words[2];
  await touchDrag(page, w2.cells[w2.cells.length - 1], w2.cells[0]);
  await expect(wordItem(page, 2)).toHaveClass(/is-found/);
});

test('a tiny accidental drag counts as a tap', async ({ page }) => {
  const level = await openLevel(page);
  const start = level.words[0].cells[0];
  const a = await cellCenter(page, start);
  await page.evaluate(({ a }) => {
    const el = document.querySelector('.cells');
    const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 4, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
    fire('pointerdown', a.x, a.y);
    fire('pointermove', a.x + a.w * 0.2, a.y + a.w * 0.1);
    fire('pointerup', a.x + a.w * 0.2, a.y + a.w * 0.1);
  }, { a });
  await expect(page.locator(`.cell[data-r="${start[0]}"][data-c="${start[1]}"]`)).toHaveClass(/is-anchor/);
});

test('hint highlights the first letter of an unfound word', async ({ page }) => {
  const level = await openLevel(page);
  await page.getByRole('button', { name: /Hint/ }).click();
  const hinted = page.locator('.cell.is-hint');
  await expect(hinted).toHaveCount(1);
  const r = Number(await hinted.getAttribute('data-r'));
  const c = Number(await hinted.getAttribute('data-c'));
  expect(level.words.some((w) => w.cells[0][0] === r && w.cells[0][1] === c)).toBe(true);
});

test('progress survives a reload, and finishing a level marks it done', async ({ page }) => {
  const level = await openLevel(page);
  const w = level.words[0];
  await touchDrag(page, w.cells[0], w.cells[w.cells.length - 1]);
  await expect(wordItem(page, 0)).toHaveClass(/is-found/);

  await page.reload();
  await expect(wordItem(page, 0)).toHaveClass(/is-found/);

  // Reopening the app at its start URL resumes the same puzzle.
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /Level 1/ })).toBeVisible();
  await expect(wordItem(page, 0)).toHaveClass(/is-found/);

  for (let i = 1; i < level.words.length; i++) {
    const x = level.words[i];
    await touchDrag(page, x.cells[0], x.cells[x.cells.length - 1]);
  }
  await expect(page.getByRole('heading', { name: 'Well done!' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to levels' }).click();
  await expect(page.getByRole('button', { name: 'Level 1, done' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Level 1, done' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Level 2, play next' })).toBeVisible();
});

test('reset progress asks first', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => window.__wordsearch.store.markCompleted('fishing', 1));
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Start again from level 1?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep my progress' }).click();
  expect(await page.evaluate(() => window.__wordsearch.store.completedLevels('fishing'))).toEqual([1]);
  await page.getByRole('button', { name: 'Reset progress…' }).click();
  await page.getByRole('button', { name: 'Yes, reset everything' }).click();
  expect(await page.evaluate(() => window.__wordsearch.store.completedLevels('fishing'))).toEqual([]);
});

test('settings change theme and text size', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('radio', { name: /High contrast/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hc');
  await page.getByRole('radio', { name: /Extra large/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'xl');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hc');
  await expect(page.getByRole('switch', { name: 'Sounds' })).toHaveAttribute('aria-checked', 'false');
});

test('unreadable saved progress shows the friendly error, never a crash', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wordsearch:v1', '{not json'));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: "We couldn't find your saved levels" })).toBeVisible();
  await page.getByRole('button', { name: 'Carry on from level 1' }).click();
  await expect(page.locator('.topic')).toHaveCount(16);
});

test('install card only shows outside standalone mode, and "Not now" hides it', async ({ page }) => {
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('wordsearch:v1'));
    s.settings.installDismissedAt = 0;
    localStorage.setItem('wordsearch:v1', JSON.stringify(s));
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Keep Word Search on your Home Screen' })).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByRole('heading', { name: 'Keep Word Search on your Home Screen' })).toHaveCount(0);
});

test('first game shows how to play once', async ({ page }) => {
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('wordsearch:v1'));
    if (!sessionStorage.getItem('help-seeded')) {
      s.settings.seenHelp = false;
      localStorage.setItem('wordsearch:v1', JSON.stringify(s));
      sessionStorage.setItem('help-seeded', '1');
    }
  });
  await page.goto('./#/play/fishing/1');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'How to play' })).toHaveCount(0);
});

test('keyboard can play (screen-reader friendly grid)', async ({ page }) => {
  const level = await openLevel(page);
  const w = level.words[0];
  await page.locator('.cell[data-r="0"][data-c="0"]').focus();
  const moveTo = async ([r, c], from) => {
    for (let i = 0; i < r - from[0]; i++) await page.keyboard.press('ArrowDown');
    for (let i = 0; i < c - from[1]; i++) await page.keyboard.press('ArrowRight');
  };
  await moveTo(w.cells[0], [0, 0]);
  await page.keyboard.press('Enter');
  const end = w.cells[w.cells.length - 1];
  await page.keyboard.press('Home');
  for (let i = 0; i < end[0] - w.cells[0][0]; i++) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < end[1]; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(wordItem(page, 0)).toHaveClass(/is-found/);
});
