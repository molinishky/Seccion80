package mx.seccion80.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
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
    WebView web;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);
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
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadDataWithBaseURL(null, sinRed(), "text/html", "utf-8", null);
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(URL);
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
