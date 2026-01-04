const CACHE_NAME = 'shopping-v1';
const ASSETS = [
  'https://ronmailx-boop.github.io/Sl/',
  'https://ronmailx-boop.github.io/Sl/index.html',
  'https://ronmailx-boop.github.io/Sl/manifest.json',
  'https://ronmailx-boop.github.io/Sl/icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

