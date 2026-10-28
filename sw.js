const CACHE_NAME = 'sza-livres-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './db.js',
  './utils.js',
  './files.js',
  './pages.js',
  './pages2.js',
  './app.js',
  './icon-192.png',
  './icon-512.png',
  './logo.png'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for app shell, network-first fallback to cache for others
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          const sameOrigin = req.url.startsWith(self.location.origin);
          // Les bibliothèques externes (PDF, QR code, polices) sont aussi gardées pour le mode hors-ligne
          const cdn = /^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(req.url);
          if (networkResponse && ((sameOrigin && networkResponse.status === 200) || (cdn && (networkResponse.status === 200 || networkResponse.type === 'opaque')))) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
