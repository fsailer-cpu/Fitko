// Service Worker: hält die App offline lauffähig.
// Strategie: Netz zuerst (damit Updates ankommen), Cache als Rückfall.

const CACHE = 'fitko-v1';
const ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/router.js',
  'js/store.js',
  'js/model.js',
  'js/dom.js',
  'js/textio.js',
  'js/views/history.js',
  'js/views/new.js',
  'js/views/workout.js',
  'js/views/templates.js',
  'js/views/exercises.js',
  'js/views/data.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html'))),
  );
});
