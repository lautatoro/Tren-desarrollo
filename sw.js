const CACHE = 'tren-v4';
const ARCHIVOS = ['./', './index.html', './estilos.css', './app.js', './logo.png', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
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

  // Datos y mapas siempre desde la red, nunca desde caché
  if (url.pathname.endsWith('datos.json') || url.hostname.includes('tile.openstreetmap') ||
      url.hostname.includes('google.com') || url.hostname.includes('unpkg') ||
      url.hostname.includes('cdnjs')) {
    return;
  }

  // Archivos de la app: primero red, si no hay conexión, caché
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
