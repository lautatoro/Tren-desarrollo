const CACHE = 'tren-v7';
const ARCHIVOS = ['./', './index.html', './estilos.css', './app.js', './logo.png', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.pathname.endsWith('datos.json') ||
      url.hostname.includes('tile.openstreetmap') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('cdnjs') ||
      url.hostname.includes('workers.dev')) {
    return;
  }

  e.respondWith(
    fetch(new Request(e.request, { cache: 'no-cache' }))
      .then(r => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
