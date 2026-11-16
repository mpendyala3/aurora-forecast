/* Aurora Hunt service worker.
 * Network-first for pages, scripts and styles (so a deploy is never masked by a stale cache),
 * cache-first for fonts and images. Only same-origin, successful, basic responses are cached. */
const VERSION = '20261117';
const CACHE_NAME = `aurora-hunt-${VERSION}`;
const PRECACHE = [
  '/', '/about.html', '/contact.html', '/cookies.html', '/privacy.html', '/terms.html', '/submit-operator.html', '/404.html',
  `/styles.css?v=${VERSION}`, `/boot.js?v=${VERSION}`, `/script.js?v=${VERSION}`, `/sky.js?v=${VERSION}`, `/globe.js?v=${VERSION}`,
  `/consent.js?v=${VERSION}`, `/monitoring.js?v=${VERSION}`, `/forms.js?v=${VERSION}`,
  '/manifest.json', '/favicon.ico', '/assets/logo.svg?v=4', '/assets/favicon.svg?v=4', '/assets/land-110m.json',
  '/assets/fonts/instrument-serif-400.woff2', '/assets/fonts/instrument-serif-400-italic.woff2',
  '/assets/fonts/geist-var.woff2', '/assets/fonts/geist-mono-var.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const cacheable = (response) => response && response.ok && response.type === 'basic';
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (cacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await cache.match(request, { ignoreSearch: true }) || (fallbackUrl && await cache.match(fallbackUrl));
    if (cached) return cached;
    throw error;
  }
}
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/healthz.html' || url.pathname === '/sw.js') return;
  if (request.mode === 'navigate') { event.respondWith(networkFirst(request, '/')); return; }
  if (/\.(?:woff2|png|svg|ico)$/i.test(url.pathname)) { event.respondWith(cacheFirst(request)); return; }
  if (/\.(?:css|js|json|webmanifest)$/i.test(url.pathname)) event.respondWith(networkFirst(request));
});
