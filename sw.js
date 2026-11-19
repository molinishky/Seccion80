// Sección 80: siempre trae lo más nuevo de internet (red primero) y, sin señal, usa la copia guardada en el teléfono.
// Se guarda: la página, datos.json (cuentas cifradas), los archivos cifrados del trabajador (d/…) y las imágenes.
// Los datos siguen cifrados con el IBM y PIN de cada quien; nadie más los puede abrir.
const CACHE = 's80-v2';
self.addEventListener('install', e => {
  self.skipWaiting();
  // la primera vez la página se abrió antes de que esto existiera: se guarda de una vez
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([['./', './'], ['datos.json', new URL('datos.json', self.registration.scope).pathname]]
    .map(([u, k]) => fetch(u, { cache: 'no-store' }).then(r => r.ok && c.put(k, r)).catch(() => {})))));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
const copia = (r, desde) => {
  const h = new Headers(r.headers); h.set('X-S80-Copia', desde || '1');
  return r.blob().then(b => new Response(b, { status: r.status, statusText: r.statusText, headers: h }));
};
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/panel/')) return;                       // el panel de administración no se guarda aquí
  const esPagina = req.mode === 'navigate' || url.pathname.endsWith('/index.html');
  const esDato = /\/(version|datos)\.json$/.test(url.pathname) || /\/d\/[^/]+\/[0-9a-f]+\.bin$/.test(url.pathname);
  const esImagen = /\.(webp|png|jpe?g|svg|woff2?|ico)$/i.test(url.pathname);
  if (esPagina || esDato) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE), clave = esPagina ? './' : url.pathname;   // sin ?v=…: una copia por archivo
      try {
        const r = await fetch(req, { cache: 'no-store' });
        if (r.ok) c.put(clave, r.clone());
        return r;
      } catch (err) {
        const g = await c.match(clave);
        return g ? copia(g) : Response.error();
      }
    })());
  } else if (esImagen) {
    // imágenes: la copia guardada al instante y se renueva por detrás
    e.respondWith((async () => {
      const c = await caches.open(CACHE), g = await c.match(url.pathname);
      const red = fetch(req).then(r => { if (r.ok) c.put(url.pathname, r.clone()); return r; }).catch(() => null);
      return g || (await red) || Response.error();
    })());
  }
});
