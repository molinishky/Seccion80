// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: id-card;
/**
 * SECCIÓN 80 · Widget para iPhone (Scriptable) · versión 2
 *
 * Chico   → tu neto de la semana, comparación y gráfica de las últimas semanas.
 * Mediano → neto con gráfica de 8 semanas, fondo de ahorro y préstamos.
 * Grande  → todo lo anterior + desglose (bruto / deducciones), evolución del
 *           fondo de ahorro y cada préstamo con su avance.
 *
 * Tu IBM y tu PIN se guardan solo en el Llavero de este iPhone. Los datos se
 * descifran en el mismo teléfono, igual que en la app; nunca salen de él.
 *
 * INSTALAR
 *  1. Instala "Scriptable" (App Store, gratis).
 *  2. Scriptable → "+" → pega todo este texto → nómbralo "Sección 80".
 *  3. Toca ▶. La primera vez pide tu IBM y tu PIN.
 *  4. Pantalla de inicio: mantén presionado → "+" → Scriptable → elige tamaño.
 *  5. Mantén presionado el widget → Editar widget → Script: "Sección 80",
 *     When Interacting: "Run Script" (al tocarlo actualiza y abre la app). Parameter: vacío, o "privado" para
 *     ocultar las cantidades.
 */

const APP = 'https://molinishky.github.io/Seccion80/';
const LLAVE = 's80_widget_cuenta';
const VERSION_WIDGET = 3;               // sube este número al publicar cambios: el widget se actualiza solo
const SEMANAS = 8;                       // semanas en la gráfica
const fm = FileManager.local();
const DIR = fm.joinPath(fm.documentsDirectory(), 'seccion80');
if (!fm.fileExists(DIR)) fm.createDirectory(DIR);
const CACHE = fm.joinPath(DIR, 'resumen.json');
const ESCUDO = fm.joinPath(DIR, 'escudo.png');
const ANCHO = (() => { try { return Device.screenSize().width >= 428 ? 334 : 308; } catch (e) { return 308; } })();   // ancho útil del widget grande
const PRIVADO = String(args.widgetParameter || '').toLowerCase().includes('priv');

// ================= colores (los de la app) =================
const dyn = (claro, oscuro, a = 1) => Color.dynamic(new Color(claro, a), new Color(oscuro, a));
const C = {
  // vidrio negro (oscuro) y vidrio blanco (claro), igual que la app y el panel
  fondo1: dyn('#F7F7F9', '#1C1C1F'), fondo2: dyn('#E6E6EA', '#030304'),
  azul: dyn('#0068B8', '#5AA9F0'), tx: dyn('#1C1C1E', '#F5F5F7'), mu: dyn('#5E5E66', '#A1A1A8'),
  verde: dyn('#1E8E3E', '#5BCB7C'), rojo: dyn('#C62828', '#FF7A7A'), ambar: dyn('#B26A00', '#FFB547'),
  linea: dyn('#000000', '#FFFFFF', 0.12),
};
C.caja = Color.dynamic(new Color('#FFFFFF', 0.62), new Color('#FFFFFF', 0.07));
C.borde = Color.dynamic(new Color('#FFFFFF', 0.95), new Color('#FFFFFF', 0.13));
const vidrio = b => { b.backgroundColor = C.caja; b.borderColor = C.borde; b.borderWidth = 1; };
// Las gráficas son imágenes: usan tonos que se leen bien en claro y en oscuro.
const G = { azul: '#3D95E0', verde: '#3DB866', gris: '#8E8E93', pista: '#8E8E93' };
const FRANJAS = ['#E53935', '#FDD835', '#0068B8', '#2E9E4B'];

// ================= utilidades =================
const normSocio = s => { const v = String(s || '').trim(); return /^\d{1,4}$/.test(v) ? '1' + v.padStart(4, '0') : v; };
const corto = s => /^1\d{4}$/.test(String(s)) ? (String(s).slice(1).replace(/^0+/, '') || '0') : String(s);
function money(n, dec = 2) {
  if (PRIVADO) return '$ •••••';
  n = Number(n) || 0; const neg = n < 0; n = Math.abs(n);
  const [e, d] = n.toFixed(dec).split('.');
  return (neg ? '−' : '') + '$' + e.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + d : '');
}
const k = n => PRIVADO ? '' : (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(Math.round(n)));
const leer = () => { try { return JSON.parse(fm.readString(CACHE)); } catch (e) { return null; } };
const cuenta = () => { try { return Keychain.contains(LLAVE) ? JSON.parse(Keychain.get(LLAVE)) : null; } catch (e) { return null; } };
const corta = t => String(t).replace('Préstamo ', '').replace('Económico', 'Econ.');

async function pedirCuenta(msg) {
  const a = new Alert();
  a.title = 'Sección 80';
  a.message = (msg ? msg + '\n\n' : '') + 'Escribe tu IBM y tu PIN de la app. Se guardan solo en el Llavero de este iPhone.';
  a.addTextField('IBM (ej. 5005)', '').setNumberPadKeyboard();
  a.addSecureTextField('PIN', '').setNumberPadKeyboard();
  a.addAction('Guardar'); a.addCancelAction('Cancelar');
  if (await a.presentAlert() === -1) return null;
  const c = { socio: normSocio(a.textFieldValue(0)), pin: a.textFieldValue(1).replace(/\D/g, '').replace(/^0+(?=\d)/, '') };
  if (!c.socio || !c.pin) return null;
  Keychain.set(LLAVE, JSON.stringify(c));
  return c;
}

// ================= descifrado (corre dentro de la página de la app, con WebCrypto) =================
const DESCIFRAR = `
var fin = o => completion(JSON.stringify(o));
(async (socio, pin, cuantas) => {
  try {
    const te = new TextEncoder(), td = new TextDecoder();
    const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    const D = await (await fetch('datos.json?v=' + Date.now(), { cache: 'no-store' })).json();
    const id = hex(await crypto.subtle.digest('SHA-256', te.encode('fondo-id:v1:' + socio))).slice(0, 40);
    const blob = D.cuentas[id];
    if (!blob) return fin({ error: 'ibm' });
    const base = await crypto.subtle.importKey('raw', te.encode(socio + ':' + pin), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(blob.s), iterations: blob.n || 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    let u;
    try { u = JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.i) }, key, unb64(blob.c)))); }
    catch (e) { return fin({ error: 'pin' }); }
    const semana = async w => {
      try {
        const r = await fetch('d/' + w + '/' + id + '.bin?v=' + ((D.meta && D.meta.version) || ''), { cache: 'no-store' });
        if (!r.ok) return null;
        const b = new Uint8Array(await r.arrayBuffer());
        return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12))));
      } catch (e) { return null; }
    };
    const ws = (u.desgloses || []).slice().sort((a, b) => a - b).slice(-cuantas);
    const sem = (await Promise.all(ws.map(semana))).map((s, i) => s && { w: ws[i] > 1000 ? ws[i] % 100 : ws[i], neto: s.tot[2], bruto: s.tot[0], ded: s.tot[1], periodo: s.info.periodo_txt }).filter(Boolean);
    const ult = sem[sem.length - 1] || null, ant = sem[sem.length - 2] || null;
    fin({
      nombre: u.nombre, socio: u.socio,
      semana: ult && ult.w, periodo: ult ? ult.periodo : '',
      neto: ult && ult.neto, bruto: ult && ult.bruto, ded: ult && ult.ded,
      semPrev: ant && ant.w, netoPrev: ant && ant.neto,
      serie: sem.map(s => [s.w, s.neto]),
      fondo: u.fondo ? u.saldo : null,
      fondoSerie: (u.historial || []).slice(-12).map(h => [h.p, h.s]),
      prestamos: (u.prestamos || []).map(p => ({ t: p.t, saldo: p.saldo, ini: p.ini, ant: p.ant })),
      leido: new Date().toISOString()
    });
  } catch (e) { fin({ error: 'red', msg: String(e) }); }
})(__SOCIO__, __PIN__, __N__);
0;`;

async function actualizar(c) {
  const wv = new WebView();
  await wv.loadURL(APP + 'version.json?t=' + Date.now());
  const js = DESCIFRAR.replace('__SOCIO__', JSON.stringify(c.socio)).replace('__PIN__', JSON.stringify(c.pin)).replace('__N__', String(SEMANAS));
  let r = await wv.evaluateJavaScript(js, true);
  if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = { error: 'red' }; } }
  if (r && !r.error) fm.writeString(CACHE, JSON.stringify(r));
  return r;
}

async function escudo() {
  if (fm.fileExists(ESCUDO)) return fm.readImage(ESCUDO);
  try { const i = await new Request(APP + 'escudo.png').loadImage(); fm.writeImage(ESCUDO, i); return i; } catch (e) { return null; }
}

// ================= gráficas (se dibujan como imagen) =================
function lienzo(w, h) { const c = new DrawContext(); c.size = new Size(w, h); c.opaque = false; c.respectScreenScale = true; return c; }
function rect(c, x, y, w, h, r, color) { const p = new Path(); p.addRoundedRect(new Rect(x, y, w, h), r, r); c.addPath(p); c.setFillColor(new Color(color.hex || color, color.a == null ? 1 : color.a)); c.fillPath(); }

// Barras del neto por semana: la última resaltada; etiquetas S## abajo y montos arriba.
function graficaNeto(serie, w, h, { montos = 'ultimo', etiquetas = true } = {}) {
  const c = lienzo(w, h);
  const n = serie.length; if (!n) return c.getImage();
  const pie = etiquetas ? 12 : 0, cab = montos === 'no' ? 2 : 12;
  const alto = h - pie - cab, gap = Math.max(3, Math.min(7, w / n * 0.22)), bw = (w - gap * (n - 1)) / n;
  const max = Math.max(...serie.map(s => s[1]), 1);
  c.setFont(Font.semiboldRoundedSystemFont(8.5)); c.setTextAlignedCenter();
  serie.forEach(([sem, v], i) => {
    const x = i * (bw + gap), bh = Math.max(3, alto * Math.max(v, 0) / max), y = cab + alto - bh, ult = i === n - 1;
    rect(c, x, cab, bw, alto, Math.min(4, bw / 2), { hex: G.pista, a: 0.08 });
    rect(c, x, y, bw, bh, Math.min(4, bw / 2), { hex: G.azul, a: ult ? 1 : 0.55 });
    if (montos === 'todos' || (montos === 'ultimo' && ult)) { c.setTextColor(new Color(ult ? G.azul : G.gris)); c.drawTextInRect(k(v), new Rect(Math.max(0, Math.min(w - bw - 12, x - 6)), y - 11, bw + 12, 11)); }
    if (etiquetas === true || (etiquetas === 'extremos' && (i === 0 || ult))) { c.setTextColor(new Color(ult ? G.azul : G.gris)); c.drawTextInRect('S' + sem, new Rect(Math.max(0, Math.min(w - bw - 12, x - 6)), h - 10.5, bw + 12, 11)); }
  });
  return c.getImage();
}

// Área del fondo de ahorro (crece semana a semana).
function graficaFondo(serie, w, h) {
  const c = lienzo(w, h);
  if (serie.length < 2) return c.getImage();
  const vals = serie.map(s => s[1]), max = Math.max(...vals), min = Math.min(0, ...vals), pad = 3;
  const pt = (v, i) => new Point(pad + (w - 2 * pad) * i / (vals.length - 1), pad + (h - 2 * pad) * (1 - (v - min) / (max - min || 1)));
  const area = new Path(); area.move(new Point(pad, h)); vals.forEach((v, i) => area.addLine(pt(v, i))); area.addLine(new Point(w - pad, h)); area.closeSubpath();
  c.addPath(area); c.setFillColor(new Color(G.verde, 0.18)); c.fillPath();
  const lin = new Path(); vals.forEach((v, i) => i ? lin.addLine(pt(v, i)) : lin.move(pt(v, i)));
  c.addPath(lin); c.setStrokeColor(new Color(G.verde)); c.setLineWidth(2); c.strokePath();
  const u = pt(vals[vals.length - 1], vals.length - 1);
  c.setFillColor(new Color(G.verde)); c.fillEllipse(new Rect(u.x - 3.5, u.y - 3.5, 7, 7));
  return c.getImage();
}

// Barra de avance (pagado / total).
function avance(f, w, h = 5) {
  const c = lienzo(w, h); f = Math.max(0, Math.min(1, f));
  rect(c, 0, 0, w, h, h / 2, { hex: G.pista, a: 0.22 });
  if (f > 0) rect(c, 0, 0, Math.max(h, w * f), h, h / 2, { hex: f >= 0.999 ? G.verde : G.azul, a: 1 });
  return c.getImage();
}

// ================= piezas del widget =================
function texto(st, t, size, color, peso = 'medium', lineas = 1) {
  const x = st.addText(String(t));
  x.font = { bold: Font.boldRoundedSystemFont, heavy: Font.heavyRoundedSystemFont, semibold: Font.semiboldRoundedSystemFont }[peso]?.(size) || Font.mediumRoundedSystemFont(size);
  x.textColor = color; x.lineLimit = lineas; x.minimumScaleFactor = 0.55;
  return x;
}
function franjas(st, w, h = 2.5) {
  const f = st.addStack(); f.spacing = 3;
  FRANJAS.forEach(c => { const s = f.addStack(); s.size = new Size(w, h); s.cornerRadius = h / 2; s.backgroundColor = new Color(c); });
}
async function encabezado(w, R, fam) {
  const h = w.addStack(); h.centerAlignContent();
  const esc = await escudo();
  if (esc) { const im = h.addImage(esc); im.imageSize = new Size(fam === 'small' ? 20 : 24, fam === 'small' ? 20 : 24); h.addSpacer(7); }
  const t = h.addStack(); t.layoutVertically(); t.spacing = 3;
  texto(t, 'SECCIÓN 80', fam === 'small' ? 10.5 : 12, C.azul, 'heavy');
  franjas(t, fam === 'small' ? 9 : 12);
  h.addSpacer();
  if (R && !R.error && fam !== 'small') {
    const d = h.addStack(); d.layoutVertically();
    const a = d.addStack(); a.addSpacer(); texto(a, 'IBM ' + corto(R.socio), 11, C.tx, 'bold');
    const b = d.addStack(); b.addSpacer(); texto(b, `Semana ${R.semana}`, 10, C.mu, 'semibold');
  }
}
function chip(st, txt, color) {
  const p = st.addStack(); p.backgroundColor = new Color(color === C.rojo ? '#E53935' : '#2E9E4B', 0.16);
  p.cornerRadius = 7; p.setPadding(2, 6, 2, 6); texto(p, txt, 9.5, color, 'bold'); return p;
}
function variacion(st, R) {
  if (R.netoPrev == null || PRIVADO) { texto(st, R.periodo || '', 10, C.mu, 'semibold'); return; }
  const d = R.neto - R.netoPrev, sube = d >= 0;
  const f = st.addStack(); f.centerAlignContent(); f.spacing = 5;
  chip(f, (sube ? '▲ ' : '▼ ') + money(Math.abs(d)), sube ? C.verde : C.rojo);
  texto(f, `vs sem ${R.semPrev}`, 9.5, C.mu, 'semibold');
}
function tarjeta(st, titulo, valor, color, nota) {
  const b = st.addStack(); b.layoutVertically(); vidrio(b); b.cornerRadius = 12; b.setPadding(7, 10, 7, 10);
  const t = b.addStack(); texto(t, titulo, 9.5, C.mu, 'semibold'); t.addSpacer();
  const v = b.addStack(); texto(v, valor, 14, color, 'bold'); v.addSpacer();
  if (nota) texto(b, nota, 8.5, C.mu, 'semibold');
  return b;
}
const deuda = R => (R.prestamos || []).reduce((a, p) => a + (p.saldo > 0.005 ? p.saldo : 0), 0);
const conDeuda = R => (R.prestamos || []).filter(p => p.saldo > 0.005).length;
function pie(w) {
  const f = w.addStack(); f.addSpacer(); texto(f, 'Toca para abrir la app ›', 9, C.azul, 'semibold');
}

// ================= armado por tamaño =================
async function armar(R, fam) {
  const w = new ListWidget();
  // al tocarlo: corre este script (actualiza los datos) y luego abre la app
  { const u = URLScheme.forRunningScript(); w.url = u + (u.includes('?') ? '&' : '?') + 'abrir=1'; }
  w.refreshAfterDate = new Date(Date.now() + 12 * 3600 * 1000);   // cada 12 horas
  const g = new LinearGradient(); g.colors = [C.fondo1, C.fondo2]; g.locations = [0, 1]; w.backgroundGradient = g;

  // Pantalla bloqueada
  if (fam === 'accessoryRectangular' || fam === 'accessoryInline' || fam === 'accessoryCircular') {
    if (!R || R.error) { texto(w, 'Sección 80', 13, Color.white(), 'bold'); texto(w, 'Abre Scriptable', 11, Color.white()); return w; }
    if (fam === 'accessoryInline') { texto(w, `S80 · Neto ${money(R.neto, 0)}`, 12, Color.white(), 'semibold'); return w; }
    if (fam === 'accessoryCircular') { texto(w, 'S' + R.semana, 10, Color.white(), 'semibold'); texto(w, k(R.neto), 15, Color.white(), 'bold'); return w; }
    texto(w, `SECCIÓN 80 · SEM ${R.semana}`, 10, Color.white(), 'semibold');
    texto(w, money(R.neto), 18, Color.white(), 'bold');
    if (R.fondo != null) texto(w, 'Fondo ' + money(R.fondo, 0), 11, Color.white(), 'semibold');
    return w;
  }

  w.setPadding(14, 15, 12, 15);
  await encabezado(w, R, fam);

  if (!R || R.error) {
    w.addSpacer(10);
    const m = { ibm: 'No encontré tu IBM.', pin: 'El PIN no coincide.', red: 'Sin conexión.' }[R && R.error] || 'Falta configurar.';
    texto(w, m, 15, C.tx, 'bold', 2); w.addSpacer(4);
    texto(w, 'Toca aquí para escribir tu IBM y tu PIN.', 11, C.mu, 'semibold', 3);
    w.url = URLScheme.forRunningScript(); w.addSpacer(); return w;
  }
  const serie = R.serie || [];

  // ---------- CHICO ----------
  if (fam === 'small') {
    w.addSpacer(8);
    texto(w, `Neto · semana ${R.semana}`, 10, C.mu, 'semibold');
    texto(w, money(R.neto), 21, C.azul, 'heavy');
    w.addSpacer(3); variacion(w, R);
    w.addSpacer();
    const im = w.addImage(graficaNeto(serie.slice(-6), 128, 34, { montos: 'no', etiquetas: false })); im.imageSize = new Size(128, 34);
    return w;
  }

  // ---------- MEDIANO / GRANDE: bloque principal ----------
  w.addSpacer(6);
  const top = w.addStack(); top.centerAlignContent();
  const izq = top.addStack(); izq.layoutVertically();
  texto(izq, 'Tu sueldo neto', 10, C.mu, 'semibold');
  texto(izq, money(R.neto), fam === 'large' ? 26 : 22, C.azul, 'heavy');
  izq.addSpacer(3); variacion(izq, R);
  top.addSpacer(10);
  const der = top.addStack(); der.layoutVertically();
  if (fam === 'medium') {
    const gw = 128, gh = 50; const im = der.addImage(graficaNeto(serie, gw, gh, { montos: 'ultimo', etiquetas: 'extremos' })); im.imageSize = new Size(gw, gh);
  } else {
    // desglose rápido: bruto, deducciones y qué parte se queda
    const fila = (t, v, col) => { const f = der.addStack(); f.size = new Size(130, 0); texto(f, t, 10, C.mu, 'semibold'); f.addSpacer(); texto(f, v, 11, col, 'bold'); };
    fila('Bruto', money(R.bruto), C.tx); der.addSpacer(3);
    fila('Deducciones', '−' + money(R.ded).replace('−', ''), C.rojo); der.addSpacer(5);
    const pct = R.bruto ? R.neto / R.bruto : 0;
    const b = der.addImage(avance(pct, 130, 6)); b.imageSize = new Size(130, 6); der.addSpacer(3);
    const f = der.addStack(); f.size = new Size(130, 0); texto(f, PRIVADO ? 'Te quedas con •• %' : `Te quedas con el ${Math.round(pct * 100)} %`, 9, C.mu, 'semibold');
  }

  // ---------- MEDIANO: fondo y préstamos ----------
  if (fam === 'medium') {
    w.addSpacer();
    const fila = w.addStack(); fila.spacing = 8;
    tarjeta(fila, 'Fondo de ahorro', R.fondo != null ? money(R.fondo) : '—', C.verde);
    const d = deuda(R);
    tarjeta(fila, d > 0.005 ? `Préstamos (${conDeuda(R)})` : 'Préstamos', d > 0.005 ? money(d) : 'Sin adeudo', d > 0.005 ? C.tx : C.verde);
    return w;
  }

  // ---------- GRANDE ----------
  w.addSpacer();
  const t1 = w.addStack(); texto(t1, `NETO · ÚLTIMAS ${serie.length} SEMANAS`, 9, C.mu, 'bold'); t1.addSpacer();
  if (R.periodo) texto(t1, R.periodo, 9, C.mu, 'semibold');
  w.addSpacer(5);
  const gi = w.addImage(graficaNeto(serie, ANCHO, 62, { montos: 'todos' })); gi.imageSize = new Size(ANCHO, 62); gi.centerAlignImage();
  w.addSpacer();

  // fondo de ahorro con su evolución
  const fb = w.addStack(); vidrio(fb); fb.cornerRadius = 12; fb.setPadding(9, 12, 9, 12); fb.centerAlignContent();
  const fi = fb.addStack(); fi.layoutVertically();
  texto(fi, 'FONDO DE AHORRO', 9, C.mu, 'bold');
  texto(fi, R.fondo != null ? money(R.fondo) : 'No participas', 16, C.verde, 'heavy');
  const fs = R.fondoSerie || [];
  if (fs.length > 1 && !PRIVADO) texto(fi, `+${money(fs[fs.length - 1][1] - fs[0][1], 0)} desde la sem ${fs[0][0]}`, 9, C.mu, 'semibold');
  fb.addSpacer();
  if (fs.length > 1) { const gf = fb.addImage(graficaFondo(fs, 140, 38)); gf.imageSize = new Size(140, 38); }
  w.addSpacer();

  // préstamos con su avance
  const tp = w.addStack(); texto(tp, 'PRÉSTAMOS', 9, C.mu, 'bold'); tp.addSpacer();
  const d = deuda(R); texto(tp, d > 0.005 ? 'Debes ' + money(d) : 'Sin adeudo', 9, d > 0.005 ? C.tx : C.verde, 'bold');
  w.addSpacer(4);
  // una línea por préstamo: nombre · barra de avance (pagado / monto) · saldo
  (R.prestamos || []).forEach(p => {
    const r = w.addStack(); r.centerAlignContent();
    const n = r.addStack(); n.size = new Size(92, 0); texto(n, corta(p.t), 11, C.tx, 'semibold'); n.addSpacer();
    const total = p.ini;   // monto original (el sindical solo trae saldo anterior, no el monto)
    if (total && p.saldo > 0.005) { r.addSpacer(4); const bw = ANCHO - 220; const a = r.addImage(avance(1 - p.saldo / total, bw, 5)); a.imageSize = new Size(bw, 5); }
    r.addSpacer();
    texto(r, p.saldo > 0.005 ? money(p.saldo) : p.saldo < -0.005 ? 'A favor ' + money(-p.saldo) : 'Liquidado ✓', 11, p.saldo > 0.005 ? C.tx : C.verde, 'bold');
    w.addSpacer(6);
  });
  w.addSpacer();
  pie(w);
  return w;
}

// ================= se actualiza solo =================
// Baja la versión publicada del widget y, si es más nueva, se reescribe (sin tocar tu IBM ni tu PIN,
// que están en el Llavero). El cambio se ve desde la siguiente vez que corre.
async function autoActualizar() {
  try {
    const r = new Request(APP + 'widget/Seccion80.js?t=' + Date.now()); r.timeoutInterval = 8;
    const t = await r.loadString();
    const m = t.match(/const VERSION_WIDGET = (\d+);/);
    if (!m || Number(m[1]) <= VERSION_WIDGET || !t.includes("const APP = 'https://molinishky.github.io/Seccion80/'")) return false;
    const f = module.filename, fx = f.includes('/Mobile Documents/') ? FileManager.iCloud() : FileManager.local();
    fx.writeString(f, t); return true;
  } catch (e) { return false; }
}

// ================= inicio =================
const fam = config.widgetFamily || 'medium';
let c = cuenta(), R = null;

const ABRIR = !!(args.queryParameters && args.queryParameters.abrir);

const NUEVO = await autoActualizar();
if (config.runsInWidget || config.runsInAccessoryWidget) {
  if (c) { try { R = await actualizar(c); } catch (e) { R = null; } }
  if (!R || R.error === 'red') R = leer() || R;   // sin red: muestra lo último que se leyó
  const W = await armar(R, fam);
  if (NUEVO) W.refreshAfterDate = new Date(Date.now() + 60 * 1000);   // se redibuja pronto ya con la versión nueva
  Script.setWidget(W);
} else if (ABRIR && c) {
  // vino del widget: actualiza en silencio y abre la app de la Sección 80
  try { await actualizar(c); } catch (e) {}
  Safari.open(APP);
} else {
  if (!c) c = await pedirCuenta();
  if (c) {
    R = await actualizar(c);
    while (R && (R.error === 'ibm' || R.error === 'pin')) {
      c = await pedirCuenta(R.error === 'ibm' ? 'No encontré ese IBM.' : 'El PIN no coincide.');
      if (!c) break; R = await actualizar(c);
    }
    if (R && R.error === 'red') R = leer() || R;
  }
  const m = new Alert(); m.title = 'Sección 80';
  m.message = R && !R.error ? `${R.nombre}\nNeto semana ${R.semana}: ${money(R.neto)}` : 'No se pudo leer la información.';
  ['Ver widget chico', 'Ver widget mediano', 'Ver widget grande', 'Cambiar IBM o PIN'].forEach(t => m.addAction(t));
  m.addDestructiveAction('Borrar mis datos de este iPhone'); m.addCancelAction('Listo');
  const op = await m.presentSheet();
  if (op === 0) await (await armar(R, 'small')).presentSmall();
  if (op === 1) await (await armar(R, 'medium')).presentMedium();
  if (op === 2) await (await armar(R, 'large')).presentLarge();
  if (op === 3) { const n = await pedirCuenta(); if (n) { R = await actualizar(n); await (await armar(R, 'medium')).presentMedium(); } }
  if (op === 4) { if (Keychain.contains(LLAVE)) Keychain.remove(LLAVE); [CACHE, ESCUDO].forEach(f => fm.fileExists(f) && fm.remove(f)); }
}
Script.complete();
