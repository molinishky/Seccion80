// Sección 80: siempre trae la versión más nueva de la app (red primero) y usa la copia guardada solo sin internet.
const CACHE = 's80-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const esPagina = req.mode === 'navigate' || url.pathname.endsWith('/index.html');
  const esDato = /\/(version|datos)\.json$/.test(url.pathname);
  if (!esPagina && !esDato) return; // lo demás lo maneja el navegador normal
  e.respondWith((async () => {
    try {
      const r = await fetch(req, { cache: 'no-store' });
      if (esPagina && r.ok) { const c = await caches.open(CACHE); c.put('./', r.clone()); }
      return r;
    } catch (err) {
      const c = await caches.open(CACHE);
      return (esPagina && await c.match('./')) || Response.error();
    }
  })());
});
