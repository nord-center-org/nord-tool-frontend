package br.com.nordtool.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.PowerManager;
import android.provider.Settings;
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
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.LinearLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * App Android do NordTool: abre o NordTool publicado numa WebView, com envio de arquivos,
 * downloads (inclusive os gerados no navegador, como PDF e planilhas) e o botão voltar.
 * Desde a versão 2: a sessão não cai (o aparelho renova a sessão sem pedir a senha) e um serviço em segundo
 * plano mostra os avisos do NordTool nas notificações do celular.
 */
public class MainActivity extends Activity {

    private static final int PEDIDO_ARQUIVO = 1;
    private static final int PEDIDO_NOTIFICACOES = 2;

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
    /** Página aberta no momento: a ponte da sessão só responde com o NordTool aberto (nunca outro site). */
    private volatile String hostAtual;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        hostDoApp = Uri.parse(BuildConfig.ENDERECO).getHost();

        webView = new WebView(this);
        setContentView(montarTela(webView));

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

        ServicoSegundoPlano.criarCanais(this);
        String destino = enderecoDoAviso(getIntent());
        if (destino != null) {
            webView.loadUrl(destino);
        } else if (estado != null) {
            webView.restoreState(estado);
        } else {
            webView.loadUrl(BuildConfig.ENDERECO);
        }
        if (new Armazenamento(this).temAparelho()) {
            pedirPermissaoDeNotificacao();
            ServicoSegundoPlano.iniciar(this);
        }
        Atualizador.verificar(this, true);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Voltou para o app (inclusive depois de liberar "Instalar apps desconhecidos"): confere de novo.
        Atualizador.verificar(this, false);
    }

    @Override
    protected void onNewIntent(Intent intencao) {
        super.onNewIntent(intencao);
        String destino = enderecoDoAviso(intencao);
        if (destino != null) webView.loadUrl(destino);
    }

    /** Tocou num aviso: abre a tela dele (só caminhos do próprio NordTool). */
    private static String enderecoDoAviso(Intent intencao) {
        String url = intencao == null ? null : intencao.getStringExtra(ServicoSegundoPlano.EXTRA_URL);
        if (url == null || !url.startsWith("/") || url.startsWith("//")) return null;
        return BuildConfig.ENDERECO.replaceAll("/+$", "") + url;
    }

    private void pedirPermissaoDeNotificacao() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, PEDIDO_NOTIFICACOES);
        }
    }

    /** Uma vez: pede para o Android não pausar o app para economizar bateria (senão os avisos atrasam). */
    @SuppressLint("BatteryLife")
    private void pedirParaNaoPausar() {
        Armazenamento dados = new Armazenamento(this);
        if (dados.pediuBateria()) return;
        dados.pediuBateria(true);
        try {
            PowerManager energia = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (energia != null && !energia.isIgnoringBatteryOptimizations(getPackageName())) {
                startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
            }
        } catch (RuntimeException ignorado) {
            // alguns fabricantes não têm a tela: o serviço segue funcionando
        }
    }

    /**
     * No Android 15 o app ocupa a tela inteira (até atrás da barra de horário e da barra de navegação). A página fica
     * entre as barras: em cima uma faixa azul do tamanho da barra de horário (ícones claros), embaixo o espaço da
     * navegação e do teclado. Nos Androids anteriores as barras já ficam fora e nada muda.
     */
    private View montarTela(WebView pagina) {
        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(0xFFF8FAFC);
        View faixa = new View(this);
        faixa.setBackgroundColor(0xFF1E40AF);
        raiz.addView(faixa, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0));
        raiz.addView(pagina, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        if (Build.VERSION.SDK_INT >= 35) {
            raiz.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets barras = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets teclado = insets.getInsets(WindowInsets.Type.ime());
                LinearLayout.LayoutParams alto = (LinearLayout.LayoutParams) faixa.getLayoutParams();
                if (alto.height != barras.top) {
                    alto.height = barras.top;
                    faixa.setLayoutParams(alto);
                }
                v.setPadding(barras.left, 0, barras.right, Math.max(barras.bottom, teclado.bottom));
                return WindowInsets.CONSUMED;
            });
            raiz.post(() -> {
                WindowInsetsController controle = getWindow().getInsetsController();
                if (controle != null) {
                    // ícones claros na faixa azul de cima, escuros na navegação clara de baixo
                    controle.setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                }
            });
        }
        return raiz;
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

    private boolean noNordTool() {
        return hostDoApp != null && hostDoApp.equalsIgnoreCase(hostAtual);
    }

    /** Ponte chamada pela página: downloads (SCRIPT_DOWNLOADS) e, desde a v2, a sessão pelo aparelho. */
    private final class Ponte {
        /** Depois de entrar com a senha: guarda o token do aparelho e liga o segundo plano. */
        @JavascriptInterface
        public void registrar(String token, String api) {
            if (!noNordTool() || token == null || token.isEmpty() || api == null || !api.startsWith("https://")) return;
            Armazenamento dados = new Armazenamento(MainActivity.this);
            String anterior = dados.token();
            String apiAnterior = dados.api();
            dados.guardar(token, api.replaceAll("/+$", ""));
            if (anterior != null && apiAnterior != null && !anterior.equals(token)) {
                new Thread(() -> Api.sair(apiAnterior, anterior), "nordtool-sair").start();
            }
            runOnUiThread(() -> {
                pedirPermissaoDeNotificacao();
                ServicoSegundoPlano.iniciar(MainActivity.this);
                pedirParaNaoPausar();
            });
        }

        @JavascriptInterface
        public boolean temAparelho() {
            return noNordTool() && new Armazenamento(MainActivity.this).temAparelho();
        }

        /** Sessão nova pelo token do aparelho; responde em window.__nordAndroidSessao(id, json ou ""). */
        @JavascriptInterface
        public void pedirSessao(String id) {
            if (!noNordTool()) return;
            Armazenamento dados = new Armazenamento(MainActivity.this);
            String api = dados.api();
            String token = dados.token();
            new Thread(() -> {
                String resposta = "";
                if (api != null && token != null) {
                    try {
                        resposta = Api.entrar(api, token).toString();
                    } catch (Api.Desconectado e) {
                        dados.esquecer();
                        runOnUiThread(() -> ServicoSegundoPlano.parar(MainActivity.this));
                    } catch (java.io.IOException | RuntimeException e) {
                        resposta = "";
                    }
                }
                String js = "window.__nordAndroidSessao && window.__nordAndroidSessao(" + JSONObject.quote(id) + "," + JSONObject.quote(resposta) + ")";
                runOnUiThread(() -> webView.evaluateJavascript(js, null));
            }, "nordtool-sessao").start();
        }

        /** Saiu da conta: desconecta o aparelho e para o segundo plano. */
        @JavascriptInterface
        public void sair() {
            if (!noNordTool()) return;
            Armazenamento dados = new Armazenamento(MainActivity.this);
            String api = dados.api();
            String token = dados.token();
            dados.esquecer();
            runOnUiThread(() -> ServicoSegundoPlano.parar(MainActivity.this));
            if (api != null && token != null) new Thread(() -> Api.sair(api, token), "nordtool-sair").start();
        }

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
            hostAtual = Uri.parse(url).getHost();
            vista.evaluateJavascript(SCRIPT_DOWNLOADS, null);
        }

        @Override
        public void doUpdateVisitedHistory(WebView vista, String url, boolean recarregou) {
            hostAtual = Uri.parse(url).getHost();
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
