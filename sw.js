const CACHE_NAME = 'aurora-hunt-shell-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/about.html',
  '/contact.html',
  '/cookies.html',
  '/privacy.html',
  '/terms.html',
  '/submit-operator.html',
  '/404.html',
  '/500.html',
  '/styles.css',
  '/script.js',
  '/consent.js',
  '/consent-bootstrap.js',
  '/manifest.json',
  '/favicon.ico',
  '/assets/logo.svg?v=4',
  '/assets/favicon.svg?v=4',
  '/assets/favicon-32.png',
  '/assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => key === CACHE_NAME ? null : caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';
  const isShellAsset = /\.(?:css|js|ico|png|svg|webmanifest|json)$/i.test(url.pathname);

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((match) => match || caches.match('/index.html')))
    );
    return;
  }

  if (isShellAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
