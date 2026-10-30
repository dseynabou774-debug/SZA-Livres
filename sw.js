const CACHE_NAME = 'sza-livres-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './db.js',
  './utils.js',
  './pages.js',
  './pages2.js',
  './orders.js',
  './watermark.js',
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

// Fetch: réseau d'abord (toujours la dernière version), cache si pas de connexion
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    new Promise((resolve) => {
      let done = false;
      const useCache = () => caches.match(req).then((c) => {
        if (!done && c) { done = true; resolve(c); }
      });
      const timer = setTimeout(useCache, 4000); // réseau trop lent : on prend le cache
      fetch(req).then((res) => {
        clearTimeout(timer);
        if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        if (!done) { done = true; resolve(res); }
      }).catch(() => {
        clearTimeout(timer);
        caches.match(req).then((c) => {
          if (!done) { done = true; resolve(c || Response.error()); }
        });
      });
    })
  );
});
