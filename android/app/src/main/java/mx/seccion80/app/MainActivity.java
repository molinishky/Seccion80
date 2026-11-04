package mx.seccion80.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.view.PixelCopy;
import android.webkit.RenderProcessGoneDetail;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    static final String URL = "https://molinishky.github.io/Seccion80/";
    static final String HOST = "molinishky.github.io";
    static final String VERSION = "1.4";
    WebView web;
    ValueCallback<Uri[]> elegir;
    // ----- Protección contra pantalla en blanco (algunos chips gráficos no dibujan el WebView) -----
    final Handler h = new Handler(Looper.getMainLooper());
    SharedPreferences prefs;
    boolean revisado = false;
    static final int FOTO = 7;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("s80", MODE_PRIVATE);
        web = new WebView(this);
        if (prefs.getBoolean("software", false)) web.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        web.setBackgroundColor(getResources().getColor(R.color.fondo, getTheme()));
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " Seccion80App/" + VERSION);
        web.addJavascriptInterface(new Puente(), "AndroidApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/Seccion80")) return false;
                abrirFuera(u);
                return true;
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                if (url != null && url.startsWith(URL) && !revisado) { revisado = true; h.postDelayed(() -> revisarPantalla(), 7000); }
            }
            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                // el motor de la página se cayó: reabrir dibujando por software
                prefs.edit().putBoolean("software", true).apply();
                recreate();
                return true;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadDataWithBaseURL(null, sinRed(), "text/html", "utf-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (elegir != null) elegir.onReceiveValue(null);
                elegir = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("image/*");
                try { startActivityForResult(Intent.createChooser(i, "Elige tu foto"), FOTO); }
                catch (ActivityNotFoundException e) { elegir = null; return false; }
                return true;
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(prefs.getBoolean("software", false) ? URL + "?seguro=1" : URL);
    }

    /** Mira la pantalla real: si es toda de un solo color, la página no se dibujó. */
    void revisarPantalla() {
        if (Build.VERSION.SDK_INT < 26 || isFinishing()) return;
        try {
            final Bitmap bmp = Bitmap.createBitmap(72, 160, Bitmap.Config.ARGB_8888);
            PixelCopy.request(getWindow(), bmp, res -> {
                if (res != PixelCopy.SUCCESS) return;
                int base = bmp.getPixel(36, 120), iguales = 0, total = 0;
                for (int y = 0; y < 160; y += 2) for (int x = 0; x < 72; x += 2) {
                    int c = bmp.getPixel(x, y); total++;
                    if (Math.abs(((c >> 16) & 255) - ((base >> 16) & 255)) < 10 && Math.abs(((c >> 8) & 255) - ((base >> 8) & 255)) < 10 && Math.abs((c & 255) - (base & 255)) < 10) iguales++;
                }
                if (iguales >= total * 0.99) recuperar();
            }, h);
        } catch (Exception e) { /* sin revisión */ }
    }

    void recuperar() {
        if (!prefs.getBoolean("software", false)) {
            prefs.edit().putBoolean("software", true).apply();
            web.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            revisado = false;
            web.loadUrl(URL + "?seguro=1");
        } else {
            new AlertDialog.Builder(this)
                .setTitle("No se pudo mostrar la app")
                .setMessage("Tu teléfono no logra mostrar la app aquí. Ábrela en Chrome; ahí funciona igual.")
                .setPositiveButton("Abrir en Chrome", (dlg, w) -> abrirFuera(Uri.parse(URL)))
                .setNegativeButton("Reintentar", (dlg, w) -> { prefs.edit().putBoolean("software", false).apply(); recreate(); })
                .show();
        }
    }

    String sinRed() {
        return "<html><body style='font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;text-align:center;color:#1F2430;padding:24px'>"
            + "<div><h2>Sin conexión</h2><p style='color:#5B6575'>Revisa tu internet y vuelve a intentar.</p>"
            + "<button onclick=\"location.href='" + URL + "'\" style='margin-top:16px;background:#0068B8;color:#fff;border:0;border-radius:14px;padding:14px 28px;font-size:17px'>Reintentar</button></div></body></html>";
    }

    void abrirFuera(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "No hay una app para abrir esto", Toast.LENGTH_SHORT).show(); }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FOTO && elegir != null) {
            Uri[] r = null;
            if (res == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{ data.getData() };
            elegir.onReceiveValue(r);
            elegir = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }

    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    File temporal(String b64, String nombre) throws Exception {
        File dir = new File(getCacheDir(), "pdf");
        dir.mkdirs();
        File f = new File(dir, nombre.replaceAll("[^A-Za-z0-9._-]", "_"));
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(Base64.decode(b64, Base64.DEFAULT)); }
        return f;
    }

    class Puente {
        @JavascriptInterface
        public String version() { return VERSION; }

        @JavascriptInterface
        public void guardarPdf(String b64, String nombre) {
            runOnUiThread(() -> {
                try {
                    byte[] data = Base64.decode(b64, Base64.DEFAULT);
                    Uri ver;
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.Downloads.DISPLAY_NAME, nombre);
                        cv.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                        cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Seccion80");
                        Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                        try (OutputStream o = getContentResolver().openOutputStream(u)) { o.write(data); }
                        ver = u;
                        Toast.makeText(MainActivity.this, "Guardado en Descargas/Seccion80", Toast.LENGTH_LONG).show();
                    } else {
                        File d = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        File f = new File(d, nombre);
                        try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
                        ver = FileProvider.getUriForFile(MainActivity.this, "mx.seccion80.app.files", f);
                        Toast.makeText(MainActivity.this, "PDF guardado", Toast.LENGTH_LONG).show();
                    }
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(ver, "application/pdf");
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try { startActivity(i); } catch (ActivityNotFoundException e) { /* sin visor: queda guardado */ }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "No pude guardar el PDF", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void compartirPdf(String b64, String nombre, String texto, String telefono) {
            runOnUiThread(() -> {
                try {
                    File f = temporal(b64, nombre);
                    Uri u = FileProvider.getUriForFile(MainActivity.this, "mx.seccion80.app.files", f);
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("application/pdf");
                    i.putExtra(Intent.EXTRA_STREAM, u);
                    i.putExtra(Intent.EXTRA_TEXT, texto);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    String[] pk = {"com.whatsapp", "com.whatsapp.w4b"};
                    for (String p : pk) {
                        try {
                            Intent w = new Intent(i);
                            w.setPackage(p);
                            if (telefono != null && !telefono.isEmpty()) w.putExtra("jid", telefono + "@s.whatsapp.net");
                            startActivity(w);
                            return;
                        } catch (ActivityNotFoundException ignored) { }
                    }
                    startActivity(Intent.createChooser(i, "Enviar oficio"));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "No pude compartir el PDF", Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}
