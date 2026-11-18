package br.com.nordtool.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * App Android do NordTool: abre o NordTool publicado numa WebView, com envio de arquivos,
 * downloads (inclusive os gerados no navegador, como PDF e planilhas) e o botão voltar.
 */
public class MainActivity extends Activity {

    private static final int PEDIDO_ARQUIVO = 1;

    /**
     * Os downloads do NordTool são gerados no navegador (URLs blob:), que o DownloadManager não alcança.
     * Este script intercepta esses cliques, lê o conteúdo e entrega à ponte {@link Ponte#salvar}.
     */
    private static final String SCRIPT_DOWNLOADS = "(function(){"
            + "if(window.__nordAndroid)return;window.__nordAndroid=true;"
            + "function enviar(url,nome){fetch(url).then(function(r){return r.blob();}).then(function(b){"
            + "var l=new FileReader();l.onloadend=function(){NordAndroid.salvar(String(l.result),nome||'arquivo');};"
            + "l.readAsDataURL(b);}).catch(function(){NordAndroid.falhou();});}"
            + "function trata(a){var h=a&&a.href||'';if(a&&a.hasAttribute&&a.hasAttribute('download')"
            + "&&(h.indexOf('blob:')===0||h.indexOf('data:')===0)){enviar(h,a.getAttribute('download'));return true;}return false;}"
            + "var clique=HTMLAnchorElement.prototype.click;"
            + "HTMLAnchorElement.prototype.click=function(){if(!trata(this))return clique.apply(this,arguments);};"
            + "document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a'):null;"
            + "if(a&&trata(a)){e.preventDefault();e.stopPropagation();}},true);"
            + "})();";

    private WebView webView;
    private ValueCallback<Uri[]> retornoArquivo;
    private String hostDoApp;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        hostDoApp = Uri.parse(BuildConfig.ENDERECO).getHost();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings ajustes = webView.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setDatabaseEnabled(true);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        ajustes.setAllowFileAccess(false);
        ajustes.setUserAgentString(ajustes.getUserAgentString() + " NordToolAndroid/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new Ponte(), "NordAndroid");
        webView.setWebViewClient(new Navegacao());
        webView.setWebChromeClient(new Janela());
        webView.setDownloadListener((url, agente, disposicao, tipo, tamanho) -> baixar(url, agente, disposicao, tipo));

        if (estado != null) {
            webView.restoreState(estado);
        } else {
            webView.loadUrl(BuildConfig.ENDERECO);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        webView.saveState(estado);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent dados) {
        if (pedido == PEDIDO_ARQUIVO && retornoArquivo != null) {
            retornoArquivo.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultado, dados));
            retornoArquivo = null;
            return;
        }
        super.onActivityResult(pedido, resultado, dados);
    }

    private void baixar(String url, String agente, String disposicao, String tipo) {
        if (url.startsWith("blob:") || url.startsWith("data:")) {
            return; // tratado pelo SCRIPT_DOWNLOADS
        }
        try {
            String nome = URLUtil.guessFileName(url, disposicao, tipo);
            DownloadManager.Request pedido = new DownloadManager.Request(Uri.parse(url));
            pedido.setMimeType(tipo);
            pedido.addRequestHeader("User-Agent", agente);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) pedido.addRequestHeader("Cookie", cookies);
            pedido.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            pedido.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, nome);
            DownloadManager gerenciador = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            gerenciador.enqueue(pedido);
            avisar("Baixando " + nome);
        } catch (RuntimeException erro) {
            abrirFora(Uri.parse(url));
        }
    }

    private void abrirFora(Uri endereco) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, endereco));
        } catch (ActivityNotFoundException erro) {
            avisar("Nenhum app consegue abrir este link.");
        }
    }

    private void avisar(String texto) {
        runOnUiThread(() -> Toast.makeText(this, texto, Toast.LENGTH_LONG).show());
    }

    /** Salva na pasta Downloads um arquivo recebido como data URL. */
    private void salvarNosDownloads(String dataUrl, String nome) throws IOException {
        int virgula = dataUrl.indexOf(',');
        if (!dataUrl.startsWith("data:") || virgula < 0) throw new IOException("conteúdo inválido");
        String cabecalho = dataUrl.substring(5, virgula);
        String tipo = cabecalho.contains(";") ? cabecalho.substring(0, cabecalho.indexOf(';')) : cabecalho;
        if (tipo.isEmpty()) tipo = "application/octet-stream";
        byte[] bytes = cabecalho.endsWith(";base64")
                ? Base64.decode(dataUrl.substring(virgula + 1), Base64.DEFAULT)
                : Uri.decode(dataUrl.substring(virgula + 1)).getBytes("UTF-8");
        String arquivo = nomeSeguro(nome, tipo);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues valores = new ContentValues();
            valores.put(MediaStore.Downloads.DISPLAY_NAME, arquivo);
            valores.put(MediaStore.Downloads.MIME_TYPE, tipo);
            valores.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri destino = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores);
            if (destino == null) throw new IOException("sem acesso aos Downloads");
            try (OutputStream saida = getContentResolver().openOutputStream(destino)) {
                if (saida == null) throw new IOException("sem acesso aos Downloads");
                saida.write(bytes);
            }
            valores.clear();
            valores.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(destino, valores, null, null);
        } else {
            File pasta = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!pasta.exists() && !pasta.mkdirs()) throw new IOException("sem acesso aos Downloads");
            try (FileOutputStream saida = new FileOutputStream(new File(pasta, arquivo))) {
                saida.write(bytes);
            }
        }
        avisar("Salvo em Downloads: " + arquivo);
    }

    private static String nomeSeguro(String nome, String tipo) {
        String limpo = nome == null ? "" : nome.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (limpo.isEmpty()) limpo = "arquivo";
        if (!limpo.contains(".")) {
            String extensao = MimeTypeMap.getSingleton().getExtensionFromMimeType(tipo);
            if (extensao != null) limpo += "." + extensao;
        }
        return limpo;
    }

    /** Ponte chamada pelo SCRIPT_DOWNLOADS. */
    private final class Ponte {
        @JavascriptInterface
        public void salvar(String dataUrl, String nome) {
            try {
                salvarNosDownloads(dataUrl, nome);
            } catch (IOException | IllegalArgumentException erro) {
                avisar("Não foi possível salvar o arquivo.");
            }
        }

        @JavascriptInterface
        public void falhou() {
            avisar("Não foi possível baixar o arquivo.");
        }
    }

    /** Mantém o NordTool dentro do app e abre os outros links no navegador. */
    private final class Navegacao extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest pedido) {
            Uri endereco = pedido.getUrl();
            String esquema = endereco.getScheme();
            if (("https".equals(esquema) || "http".equals(esquema)) && hostDoApp != null
                    && hostDoApp.equalsIgnoreCase(endereco.getHost())) {
                return false;
            }
            abrirFora(endereco);
            return true;
        }

        @Override
        public void onPageStarted(WebView vista, String url, Bitmap icone) {
            vista.evaluateJavascript(SCRIPT_DOWNLOADS, null);
        }

        @Override
        public void onPageFinished(WebView vista, String url) {
            vista.evaluateJavascript(SCRIPT_DOWNLOADS, null);
        }
    }

    /** Envio de arquivos pelos campos de upload do NordTool. */
    private final class Janela extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> retorno, FileChooserParams parametros) {
            if (retornoArquivo != null) retornoArquivo.onReceiveValue(null);
            retornoArquivo = retorno;
            try {
                Intent escolha = parametros.createIntent();
                if (parametros.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    escolha.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                startActivityForResult(Intent.createChooser(escolha, "Escolher arquivo"), PEDIDO_ARQUIVO);
                return true;
            } catch (ActivityNotFoundException erro) {
                retornoArquivo = null;
                avisar("Nenhum app para escolher arquivos.");
                return false;
            }
        }
    }
}
