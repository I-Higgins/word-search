// Service worker: precache every app file on install, serve cache-first, so the
// game works with no internet after the first visit.
//
// VERSION changes every release (the deploy workflow stamps BUILD with the commit),
// which installs a new cache and shows the "A new version is ready" banner.

const VERSION = '1.0.0';
const BUILD = 'dev';
const CACHE = `wordsearch-${VERSION}-${BUILD}`;

// Every file the app needs. tests/unit/precache.test.mjs fails if an app file is missing here.
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/app.css',
  'js/app.js',
  'js/blocklist.js',
  'js/generator.js',
  'js/icons.js',
  'js/input.js',
  'js/sound.js',
  'js/storage.js',
  'data/categories.js',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // cache: 'reload' bypasses the HTTP cache so a new version never stores stale files.
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
  // Don't skipWaiting here: the page asks first ("Refresh" on the update banner),
  // so a puzzle is never reloaded mid-game. The very first install activates at once
  // because there is no older worker waiting.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wordsearch-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Page loads (any path within scope, with or without #hash) get the app shell.
    if (req.mode === 'navigate') {
      const shell = (await cache.match('index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
