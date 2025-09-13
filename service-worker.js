const CACHE_VERSION = 'ogb-v1';
const PRECACHE_ASSETS = [
  '/', 
  '/index.html',
  '/offline.html',          // make sure this file exists
  '/manifest.json',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/app.js'                 // <-- fixed comma above
];

const RUNTIME_IMAGE_CACHE = 'ogb-images-v1';
const RUNTIME_API_CACHE = 'ogb-api-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION && !k.startsWith('ogb-'))
          .map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

function isImageRequest(request) {
  return request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(request.url);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Handle navigation requests -> serve cached page or offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Images: cache-first
  if (isImageRequest(req)) {
    event.respondWith(
      caches.open(RUNTIME_IMAGE_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/orders')) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME_API_CACHE).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Default: cache-first fallback to network
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => {
      if (req.headers.get('accept')?.includes('text/html')) {
        return caches.match('/offline.html');
      }
    }))
  );
});