const CACHE = 'tren-v1';
const ARCHIVOS = ['./', './index.html', './estilos.css', './app.js', './logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Datos: primero internet, si falla usa la última copia guardada
  if (e.request.url.includes('datos.json')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Resto: primero caché, si no está va a internet
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
