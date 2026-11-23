package br.com.nordtool.drumcam;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Modo controle: acha a câmera no Wi-Fi (NSD) e abre o painel que ela serve. O painel é uma página
 * (assets/painel.html) servida pelo próprio celular-câmera, então qualquer navegador também controla.
 */
public class ControleActivity extends Activity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private NsdManager nsd;
    private NsdManager.DiscoveryListener descoberta;
    private WifiManager.MulticastLock travaMulticast;
    private final Map<String, String> cameras = new LinkedHashMap<>();
    private final Deque<NsdServiceInfo> paraResolver = new ArrayDeque<>();
    private boolean resolvendo;

    private LinearLayout lista;
    private TextView aviso;
    private WebView web;
    private ValueCallback<Uri[]> escolhaArquivo;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        if (Build.VERSION.SDK_INT >= 23 && Build.VERSION.SDK_INT <= 28
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.WRITE_EXTERNAL_STORAGE}, 2);
        }
        mostrarLista();
    }

    // ---------- lista de câmeras ----------

    private void mostrarLista() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        LinearLayout col = Ui.coluna(this);
        Ui.titulo(this, col, "🎮 Controle");
        aviso = Ui.texto(this, col, "Procurando câmeras neste Wi-Fi…", 16, Ui.SUAVE);
        lista = new LinearLayout(this);
        lista.setOrientation(LinearLayout.VERTICAL);
        col.addView(lista);

        Ui.texto(this, col, "Ou digite o endereço que aparece no celular-câmera:", 15, Ui.SUAVE);
        EditText campo = new EditText(this);
        campo.setHint("192.168.0.15:8080");
        campo.setTextColor(Ui.TEXTO);
        campo.setHintTextColor(Ui.SUAVE);
        campo.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        String ultimo = Config.texto(this, "ultimo_endereco");
        if (ultimo != null) campo.setText(ultimo);
        col.addView(campo);
        Ui.botao(this, col, "Conectar", Ui.VERMELHO, v -> {
            String e = campo.getText().toString().trim().replaceFirst("^https?://", "").replaceAll("/.*$", "");
            if (e.isEmpty()) return;
            if (!e.contains(":")) e += ":" + ServicoCamera.PORTA;
            abrirPainel(e);
        });
        Ui.botao(this, col, "Trocar o modo deste celular", Ui.CARTAO, v -> {
            startActivity(new Intent(this, InicioActivity.class).putExtra("escolher", true));
            finish();
        });
        cameras.clear();
        procurar();
    }

    private void procurar() {
        pararProcura();
        nsd = (NsdManager) getSystemService(NSD_SERVICE);
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        travaMulticast = wm.createMulticastLock("drumcam:controle");
        travaMulticast.acquire();
        descoberta = new NsdManager.DiscoveryListener() {
            @Override public void onStartDiscoveryFailed(String t, int e) { avisar("Não consegui procurar no Wi-Fi. Digite o endereço."); }
            @Override public void onStopDiscoveryFailed(String t, int e) { }
            @Override public void onDiscoveryStarted(String t) { }
            @Override public void onDiscoveryStopped(String t) { }
            @Override public void onServiceFound(NsdServiceInfo s) {
                handler.post(() -> {
                    paraResolver.add(s);
                    resolverProximo();
                });
            }
            @Override public void onServiceLost(NsdServiceInfo s) { }
        };
        try {
            nsd.discoverServices(ServicoCamera.TIPO_NSD, NsdManager.PROTOCOL_DNS_SD, descoberta);
        } catch (RuntimeException e) {
            descoberta = null;
            avisar("Não consegui procurar no Wi-Fi. Digite o endereço.");
        }
        handler.postDelayed(() -> {
            if (web == null && cameras.isEmpty()) {
                avisar("Nenhuma câmera achada ainda. Confira se os dois estão no mesmo Wi-Fi e se o modo câmera está ligado.");
            }
        }, 8000);
    }

    /** Versões antigas do Android só resolvem um serviço por vez. */
    @SuppressWarnings("deprecation")
    private void resolverProximo() {
        if (resolvendo || paraResolver.isEmpty() || nsd == null) return;
        resolvendo = true;
        NsdServiceInfo s = paraResolver.poll();
        nsd.resolveService(s, new NsdManager.ResolveListener() {
            @Override public void onResolveFailed(NsdServiceInfo i, int e) {
                handler.post(() -> {
                    resolvendo = false;
                    resolverProximo();
                });
            }
            @Override public void onServiceResolved(NsdServiceInfo i) {
                String host = i.getHost() == null ? null : i.getHost().getHostAddress();
                handler.post(() -> {
                    resolvendo = false;
                    if (host != null && !host.contains(":")) adicionar(i.getServiceName(), host + ":" + i.getPort());
                    resolverProximo();
                });
            }
        });
    }

    private void adicionar(String nome, String endereco) {
        if (web != null || lista == null || cameras.containsKey(endereco)) return;
        cameras.put(endereco, nome);
        avisar("Toque na câmera para controlar:");
        Ui.botao(this, lista, "📷  " + nome + "\n" + endereco, Ui.VERMELHO, v -> abrirPainel(endereco));
        // A mesma câmera da última vez: entra direto.
        if (endereco.equals(Config.texto(this, "ultimo_endereco"))) abrirPainel(endereco);
    }

    private void avisar(String texto) {
        handler.post(() -> {
            if (aviso != null) aviso.setText(texto);
        });
    }

    private void pararProcura() {
        if (nsd != null && descoberta != null) {
            try {
                nsd.stopServiceDiscovery(descoberta);
            } catch (RuntimeException ignorado) {
                // já parada
            }
        }
        descoberta = null;
        paraResolver.clear();
        resolvendo = false;
        if (travaMulticast != null && travaMulticast.isHeld()) travaMulticast.release();
    }

    // ---------- painel ----------

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void abrirPainel(String endereco) {
        pararProcura();
        Config.texto(this, "ultimo_endereco", endereco);
        lista = null;
        aviso = null;
        web = new WebView(this);
        web.setBackgroundColor(Ui.FUNDO);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new Ponte(), "DrumcamApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                if (url.startsWith("http://" + endereco + "/")) return false;
                // YouTube, google.com/device e outros sites abrem fora do painel.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (RuntimeException ignorado) {
                    // sem navegador
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView v, int codigo, String descricao, String url) {
                if (url != null && url.startsWith("http://" + endereco + "/") && url.endsWith("/")) {
                    Toast.makeText(ControleActivity.this, "A câmera não respondeu. Ela está ligada e no mesmo Wi-Fi?",
                            Toast.LENGTH_LONG).show();
                    Config.texto(ControleActivity.this, "ultimo_endereco", null);
                    mostrarLista();
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (escolhaArquivo != null) escolhaArquivo.onReceiveValue(null);
                escolhaArquivo = callback;
                try {
                    Intent i = params.createIntent();
                    if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    }
                    startActivityForResult(i, 10);
                } catch (RuntimeException e) {
                    escolhaArquivo = null;
                    return false;
                }
                return true;
            }
        });
        web.setDownloadListener((url, agente, disposicao, tipo, tamanho) -> baixar(url, disposicao, tipo));
        setContentView(web);
        web.loadUrl("http://" + endereco + "/");
    }

    @SuppressWarnings("deprecation")
    private void baixar(String url, String disposicao, String tipo) {
        String nome = URLUtil.guessFileName(url, disposicao, tipo);
        try {
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setTitle(nome);
            r.setMimeType(tipo);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_MOVIES, "Drumcam/" + nome);
            if (Build.VERSION.SDK_INT < 29) r.allowScanningByMediaScanner();
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(r);
            Toast.makeText(this, "Baixando para Filmes/Drumcam. Acompanhe nas notificações.", Toast.LENGTH_LONG).show();
        } catch (RuntimeException e) {
            Toast.makeText(this, "Não consegui baixar: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int codigo, int resultado, Intent dados) {
        if (codigo == 10 && escolhaArquivo != null) {
            escolhaArquivo.onReceiveValue(arquivosEscolhidos(resultado, dados));
            escolhaArquivo = null;
            return;
        }
        super.onActivityResult(codigo, resultado, dados);
    }

    private static Uri[] arquivosEscolhidos(int resultado, Intent dados) {
        if (resultado != RESULT_OK || dados == null) return null;
        if (dados.getClipData() != null) {
            Uri[] uris = new Uri[dados.getClipData().getItemCount()];
            for (int i = 0; i < uris.length; i++) uris[i] = dados.getClipData().getItemAt(i).getUri();
            return uris;
        }
        return WebChromeClient.FileChooserParams.parseResult(resultado, dados);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else if (web != null) {
            web.evaluateJavascript("window.voltar ? window.voltar() : false", valor -> {
                if (!"true".equals(valor)) moveTaskToBack(true);
            });
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        pararProcura();
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Chamadas do painel para o app. */
    private final class Ponte {
        @JavascriptInterface
        public void trocarCamera() {
            handler.post(() -> {
                Config.texto(ControleActivity.this, "ultimo_endereco", null);
                mostrarLista();
            });
        }

        @JavascriptInterface
        public void abrirLink(String url) {
            if (url == null || !(url.startsWith("https://"))) return;
            handler.post(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (RuntimeException ignorado) {
                    // sem navegador
                }
            });
        }
    }
}
