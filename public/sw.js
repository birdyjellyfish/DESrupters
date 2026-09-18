const CACHE_NAME = 'wayfinder-journey-v2';
const APP_SHELL = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        return response;
      })
      // Never return app HTML for a worker/module, vector tile, or API request.
      .catch(async () => (await caches.match(event.request)) ||
        (event.request.mode === 'navigate' ? await caches.match('/') : null) || Response.error()),
  );
});
