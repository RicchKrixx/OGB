const CACHE_VERSION = 'ogb-v1';
const PRECACHE_ASSETS = [
  '/', 
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/android-chrome-192×192.png',
  '/icons/android-chrome-512×512.png'
    // update these to match your actual asset names
  '/app.js'
];

// Files to ignore or dynamically cache (e.g., big product images you want runtime caching for)
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
        // Save a copy for offline if online
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/offline.html')))
    );
    return;
  }

  // Images: cache-first with max entries
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

  // API requests: network-first with cache fallback (useful for orders/product data)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/orders')) {
    event.respondWith(
      fetch(req).then(res => {
        // optionally cache API responses
        const copy = res.clone();
        caches.open(RUNTIME_API_CACHE).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Default: try cache, then network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // optionally cache navigations and other static assets on first fetch
        return res;
      }).catch(() => {
        // if it's an HTML request and all else fails, show offline page
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match('/offline.html');
        }
      });
    })
  );
});