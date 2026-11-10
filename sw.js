/* JARVIS — funciona sin conexión. Cambia VERSION al publicar cambios. */
const VERSION = 'jarvis-v4';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'js/store.js', 'js/foods.js', 'js/recipes.js', 'js/guides.js', 'js/brain.js', 'js/plus.js', 'js/scan.js', 'js/barcode.js', 'js/catalog.js', 'css/theme.css', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Páginas y código propio: primero la red (para recibir actualizaciones), si no hay, la copia guardada
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  // Fuentes: primero la copia guardada
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
  }
});
