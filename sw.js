/* Cédelo · service worker mínimo: solo muestra una pantalla amable si no hay internet.
   No guarda en caché la web ni los datos (siempre se ve lo más nuevo). */
const OFF = 'offline.html';
self.addEventListener('install', e => { e.waitUntil(caches.open('cedelo-off-v1').then(c => c.addAll([OFF, 'icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(OFF)));
  }
});
