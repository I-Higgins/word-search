import { test, expect } from '@playwright/test';

test('a new version shows the update banner on Home, never during a puzzle', async ({ page, request, browserName }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('wordsearch:v1')) {
      localStorage.setItem('wordsearch:v1', JSON.stringify({ version: 1, settings: { seenHelp: true, installDismissedAt: Date.now() }, completed: {} }));
    }
  });
  await page.goto('./');
  test.skip(!(await page.evaluate(() => 'serviceWorker' in navigator)), `no service workers in ${browserName}`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Pretend a new release was deployed (the test server changes BUILD in sw.js).
  const build = await (await request.post('/__bump')).text();

  // In a puzzle: an update arrives but no banner appears.
  await page.goto('./#/play/fishing/1');
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), { timeout: 15000 }).toBe(true);
  await expect(page.getByText('A new version is ready.')).toHaveCount(0);

  // Back on Home: the banner shows; Refresh reloads into the new version.
  await page.getByRole('button', { name: 'Levels' }).click();
  await expect(page.getByText('A new version is ready.')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).join()), { timeout: 15000 }).toContain(build);
  await expect(page.getByText('A new version is ready.')).toHaveCount(0);
});
