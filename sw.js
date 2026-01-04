const CACHE_NAME = 'shopping-list-v1';
const ASSETS = [
  'https://ronmailx-boop.github.io/Sl/',
  'https://ronmailx-boop.github.io/Sl/index.html',
  'https://ronmailx-boop.github.io/Sl/manifest.json',
  'https://ronmailx-boop.github.io/Sl/icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});

