const CACHE_NAME = 'cable-guy-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Rückgabe aus Cache oder Fetch aus dem Netzwerk
      return cachedResponse || fetch(event.request).catch(() => {
        // Fallback wenn beides fehlschlägt (z.B. Offline)
        return caches.match('/index.html');
      });
    })
  );
});
