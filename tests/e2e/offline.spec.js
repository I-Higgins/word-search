import { test, expect } from '@playwright/test';

test('loads and plays offline after the first visit', async ({ page, context, browserName }) => {
  await page.goto('./');
  const supported = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!supported, `Service workers not available in ${browserName} here`);

  // Wait until the service worker has installed and controls the page.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Every precached file is in the cache.
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('wordsearch-')));
    return (await cache.keys()).length;
  });
  expect(cached).toBeGreaterThan(15);

  // Playwright's WebKit can't reload a page offline through a service worker
  // ("WebKit encountered an internal error"); it's a test-harness limit, not an app
  // bug. WebKit still proves above that the worker controls the page and every
  // file is cached; the offline reload itself runs in Chromium. Real-device check:
  // see README ("Installing on iPad", step 4, then Wi-Fi off).
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot reload offline via a service worker');

  await context.setOffline(true);
  await page.goto('./#/play/cars/3');
  await page.reload();
  await expect(page.locator('.cells .cell').first()).toBeVisible();
  await page.evaluate(() => {
    const s = window.__wordsearch.store; s.setSetting('seenHelp', true);
  });
  await page.reload();

  const level = await page.evaluate(() => {
    const { generateLevel, categories } = window.__wordsearch;
    return generateLevel(categories.find((c) => c.id === 'cars'), 3);
  });
  const w = level.words[0];
  const box = async ([r, c]) => {
    const b = await page.locator(`.cell[data-r="${r}"][data-c="${c}"]`).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const a = await box(w.cells[0]);
  const z = await box(w.cells[w.cells.length - 1]);
  await page.touchscreen.tap(a.x, a.y);
  await page.touchscreen.tap(z.x, z.y);
  await expect(page.locator('.word[data-word="0"]')).toHaveClass(/is-found/);

  // Other screens also work offline.
  await page.goto('./#/');
  await expect(page.locator('.topic')).toHaveCount(16);
  await context.setOffline(false);
});

test('design/ and tests/ are not served', async ({ request }) => {
  expect((await request.get('design/Word_Search_Game_Design.html')).status()).toBe(404);
  expect((await request.get('tests/e2e/offline.spec.js')).status()).toBe(404);
});
