// Playwright end-to-end tests. Runs the app from a local static server under
// /word-search/ (the same sub-path GitHub Pages uses).
//   npx playwright install chromium webkit   (first time)
//   npm run test:e2e
import { defineConfig } from '@playwright/test';

const PORT = 4173;
const ipad = {
  viewport: { width: 820, height: 1180 },
  hasTouch: true,
  deviceScaleFactor: 2,
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/word-search/`,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'chromium-ipad', use: { browserName: 'chromium', ...ipad, isMobile: true } },
    { name: 'webkit-ipad', use: { browserName: 'webkit', ...ipad, isMobile: true } },
  ],
  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    env: { BASE: '/word-search/', TEST_HOOKS: '1' },
    url: `http://localhost:${PORT}/word-search/`,
    reuseExistingServer: !process.env.CI,
  },
});
