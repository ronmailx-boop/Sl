self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('shopping-list-v1').then((cache) => cache.addAll([
      'https://ronmailx-boop.github.io/Sl/',
      'https://ronmailx-boop.github.io/Sl/index.html',
      'https://ronmailx-boop.github.io/Sl/manifest.json'
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});

