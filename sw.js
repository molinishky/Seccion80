// Sección 80: siempre trae lo más nuevo de internet (red primero) y, sin señal, usa la copia guardada en el teléfono.
// Se guarda: la página, meta.json, la cuenta cifrada y los archivos cifrados del trabajador (d/…) y las imágenes.
// Con señal lenta (datos móviles) no se espera de más: si internet tarda, se usa la copia guardada y se renueva por detrás.
// Los datos siguen cifrados con el IBM y PIN de cada quien; nadie más los puede abrir.
const CACHE = 's80-v3';
self.addEventListener('install', e => {
  self.skipWaiting();
  // la primera vez la página se abrió antes de que esto existiera: se guarda de una vez
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([['./', './'], ['meta.json', new URL('meta.json', self.registration.scope).pathname]]
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
  const esDato = /\/(version|datos|meta)\.json$/.test(url.pathname) || /\/d\/[^/]+\/[0-9a-f]+\.(bin|json)$/.test(url.pathname);
  const esImagen = /\.(webp|png|jpe?g|svg|woff2?|ico)$/i.test(url.pathname);
  if (esPagina || esDato) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE), clave = esPagina ? './' : url.pathname;   // sin ?v=…: una copia por archivo
      const red = fetch(req, { cache: 'no-store' }).then(r => { if (r.ok) e.waitUntil(c.put(clave, r.clone())); return r; });
      const g = await c.match(clave);
      if (!g) { try { return await red; } catch (err) { return Response.error(); } }
      // hay copia: se espera a internet unos segundos; si tarda (señal lenta) va la copia y la nueva se guarda al llegar
      const lento = new Promise(res => setTimeout(() => res('lento'), esPagina ? 4000 : 7000));
      const r = await Promise.race([red.catch(() => 'sinred'), lento]);
      if (r === 'sinred') return copia(g);
      if (r === 'lento') { e.waitUntil(red.catch(() => {})); return copia(g, 'lenta'); }
      return r;
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
