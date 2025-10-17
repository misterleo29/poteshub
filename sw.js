// sw.js - cache minimal, mobile-friendly
const CACHE_NAME = 'poteshub-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=4',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then(resp => resp || fetch(req).then(fetchResp => {
      // Cache fetched resources (optional)
      if (req.url.startsWith(self.location.origin)) {
        caches.open(CACHE_NAME).then(cache => cache.put(req, fetchResp.clone()).catch(()=>{}));
      }
      return fetchResp;
    }).catch(()=> caches.match('/index.html')))
  );
});
