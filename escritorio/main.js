// Panel Sección 80 para Windows: abre el mismo panel web en su propia ventana.
// La llave de GitHub se guarda solo en esta computadora (almacenamiento local de la app).
const { app, BrowserWindow, shell, Menu } = require('electron');
const PANEL = 'https://molinishky.github.io/Seccion80/panel/';
const SIN_RED = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;font:16px 'Segoe UI',sans-serif;color:#1F2430;text-align:center"><div><h2 style="color:#0068B8">Sin conexión</h2><p>El panel necesita internet para subir archivos.</p><button onclick="location.href='${PANEL}'" style="height:44px;padding:0 22px;border:0;border-radius:12px;background:#0068B8;color:#fff;font-weight:700;font-size:15px;cursor:pointer">Reintentar</button></div></body>`)}`;
if (!app.requestSingleInstanceLock()) app.quit();
let win;
function crear() {
  win = new BrowserWindow({
    width: 500, height: 900, minWidth: 380, minHeight: 640,
    title: 'Panel Sección 80', icon: __dirname + '/icono.png', backgroundColor: '#FFFFFF', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  Menu.setApplicationMenu(null);
  win.loadURL(PANEL);
  // Enlaces externos (GitHub, app, accesos) se abren en el navegador normal.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(PANEL) && !url.startsWith('data:')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on('did-fail-load', (e, code, d, url, main) => { if (main && code !== -3) win.loadURL(SIN_RED); });
  // F5 recarga
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F5') win.reload(); });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(crear);
app.on('window-all-closed', () => app.quit());
