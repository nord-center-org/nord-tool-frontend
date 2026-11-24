package br.com.nordtool.app;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

/**
 * Câmera ao vivo em segundo plano (app 11.0). A câmera não roda mais na tela do NordTool: roda numa página só dela
 * ({@code /camera-servico}), dentro deste serviço em primeiro plano (tipo câmera e microfone). Por isso:
 * <ul>
 *   <li>o celular continua livre para usar o NordTool normalmente enquanto é câmera;</li>
 *   <li>fechar o app (voltar ou tirar dos recentes) não derruba a câmera: a página não pertence a nenhuma tela;</li>
 *   <li>fica só a notificação "Câmera ao vivo no ar", e ela só desliga em Estúdio → Gravação → "Desligar câmera".</li>
 * </ul>
 * A página fica numa janelinha invisível de 1×1 (com a permissão "Aparecer sobre outros apps"), para o WebView seguir
 * "visível" e o Chromium não suspender a câmera; sem essa permissão, roda solta (pode parar em alguns aparelhos).
 */
public class ServicoAoVivo extends Service {

    private static final String TAG = "NordToolAoVivo";
    private static final String CANAL = "aovivo";
    private static final int NOTIFICACAO = 9;
    static final String ACAO_LIGAR = "br.com.nordtool.app.AOVIVO_LIGAR";
    static final String ACAO_DESLIGAR = "br.com.nordtool.app.AOVIVO_DESLIGAR";

    /** A câmera está ligada (a tela principal e a própria página leem). */
    static volatile boolean ativo;
    /** Último estado que a página da câmera contou (JSON: rele, vendo, nome, gravando, erro). */
    static volatile String estado = "";
    /** A página roda presa a uma janela (true) ou solta, sem a permissão de sobrepor (false). */
    static volatile boolean comJanela;

    private PowerManager.WakeLock travaCpu;
    private WifiManager.WifiLock travaWifi;
    private WebView pagina;
    private String nome = "";
    /** Sessão entregue pela tela principal, para quando o aparelho não tem o token do app. */
    private String sessaoEntregue = "";

    static boolean podeSobrepor(Context c) {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c);
    }

    /** Liga com o app na frente (regra do Android para câmera em segundo plano). Devolve false se o Android recusar. */
    static boolean ligar(Context contexto, String nome, String sessao) {
        Intent i = new Intent(contexto, ServicoAoVivo.class).setAction(ACAO_LIGAR)
                .putExtra("nome", nome == null ? "" : nome).putExtra("sessao", sessao == null ? "" : sessao);
        try {
            if (Build.VERSION.SDK_INT >= 26) contexto.startForegroundService(i);
            else contexto.startService(i);
            return true;
        } catch (RuntimeException e) {
            Log.w(TAG, "Não deu para ligar a câmera ao vivo", e);
            return false;
        }
    }

    private static final String PREFS = "nordtool-aovivo";

    /** Guarda que a câmera está ligada (e o nome): depois de atualizar o app ou reiniciar o celular, ela volta sozinha. */
    private static void lembrar(Context contexto, boolean ligada, String nome) {
        contexto.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("ligada", ligada).putString("nome", nome == null ? "" : nome).apply();
    }

    /**
     * App atualizado (o Android fecha o app para instalar) ou celular reiniciado com a câmera ligada: religa. A sessão
     * vem do token do aparelho e o relé aceita o passe de retomada. Se o Android não deixar abrir a câmera assim,
     * fica um aviso para religar com um toque.
     */
    static void religarSePrecisar(Context contexto) {
        android.content.SharedPreferences p = contexto.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean("ligada", false)) return;
        if (!ligar(contexto, p.getString("nome", ""), "")) avisarParaReligar(contexto);
    }

    @SuppressWarnings("deprecation")
    private static void avisarParaReligar(Context contexto) {
        NotificationManager nm = (NotificationManager) contexto.getSystemService(NOTIFICATION_SERVICE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CANAL, "Câmera ao vivo", NotificationManager.IMPORTANCE_LOW));
            b = new Notification.Builder(contexto, CANAL);
        } else {
            b = new Notification.Builder(contexto);
        }
        int flags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        Intent abrir = new Intent(contexto, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(ServicoSegundoPlano.EXTRA_URL, "/gestao/repertorio?aba=gravacao");
        nm.notify(NOTIFICACAO + 1, b.setSmallIcon(R.drawable.ic_notificacao)
                .setContentTitle("Câmera ao vivo desligada")
                .setContentText("O app foi atualizado. Toque para ligar a câmera de novo.")
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(contexto, 2, abrir, flags | PendingIntent.FLAG_UPDATE_CURRENT))
                .build());
    }

    static void desligar(Context contexto) {
        lembrar(contexto, false, null);
        ativo = false;
        estado = "";
        contexto.stopService(new Intent(contexto, ServicoAoVivo.class));
    }

    @Override
    public int onStartCommand(Intent intencao, int flags, int id) {
        if (intencao == null || !ACAO_LIGAR.equals(intencao.getAction())) {
            // Reiniciado pelo sistema sem pedido da pessoa: o Android não deixa abrir a câmera assim. Sai.
            stopSelf();
            return START_NOT_STICKY;
        }
        nome = limpar(intencao.getStringExtra("nome"));
        sessaoEntregue = intencao.getStringExtra("sessao") == null ? "" : intencao.getStringExtra("sessao");
        try {
            Notification n = notificacao();
            if (Build.VERSION.SDK_INT >= 30) {
                startForeground(NOTIFICACAO, n,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIFICACAO, n);
            }
        } catch (RuntimeException e) {
            Log.w(TAG, "Serviço da câmera ao vivo recusado pelo Android", e);
            ativo = false;
            avisarParaReligar(this);
            stopSelf();
            return START_NOT_STICKY;
        }
        ativo = true;
        lembrar(this, true, nome);
        segurar();
        if (pagina == null) abrirPagina();
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent raiz) {
        // Tiraram o app dos recentes: a câmera continua (só para em "Desligar câmera").
        super.onTaskRemoved(raiz);
    }

    private static String limpar(String s) {
        String n = s == null ? "" : s.replaceAll("[\\p{Cntrl}]", "").trim();
        return n.length() > 60 ? n.substring(0, 60) : n;
    }

    // ------------------------------------------------------------ a página da câmera

    /** WebView que sempre se vê visível: com a tela apagada ou sem janela, o Chromium não suspende a câmera. */
    private static final class PaginaSempreVisivel extends WebView {
        PaginaSempreVisivel(Context contexto) {
            super(contexto);
        }

        @Override
        protected void onWindowVisibilityChanged(int visibilidade) {
            super.onWindowVisibilityChanged(View.VISIBLE);
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void abrirPagina() {
        pagina = new PaginaSempreVisivel(this);
        WebSettings ajustes = pagina.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setDatabaseEnabled(true);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        ajustes.setAllowFileAccess(false);
        ajustes.setUserAgentString(ajustes.getUserAgentString() + " NordToolAndroid/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptThirdPartyCookies(pagina, true);
        pagina.addJavascriptInterface(new PonteCamera(), "NordAndroid");
        String hostDoApp = Uri.parse(BuildConfig.ENDERECO).getHost();
        pagina.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                // A página da câmera não navega para fora do NordTool.
                return hostDoApp == null || !hostDoApp.equalsIgnoreCase(r.getUrl().getHost());
            }
        });
        pagina.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest pedido) {
                new Handler(Looper.getMainLooper()).post(() -> liberar(pedido, hostDoApp));
            }
        });
        if (Build.VERSION.SDK_INT >= 26) pagina.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);

        comJanela = false;
        if (podeSobrepor(this)) {
            try {
                WindowManager.LayoutParams p = new WindowManager.LayoutParams(1, 1,
                        Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : tipoAntigo(),
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                        PixelFormat.TRANSLUCENT);
                p.gravity = Gravity.TOP | Gravity.START;
                p.alpha = 0f;
                ((WindowManager) getSystemService(WINDOW_SERVICE)).addView(pagina, p);
                comJanela = true;
            } catch (RuntimeException e) {
                Log.w(TAG, "Sem a janelinha da câmera; a página roda solta", e);
            }
        }
        pagina.loadUrl(BuildConfig.ENDERECO.replaceAll("/+$", "") + "/camera-servico");
    }

    @SuppressWarnings("deprecation")
    private static int tipoAntigo() {
        return WindowManager.LayoutParams.TYPE_PHONE;
    }

    /** Só o NordTool, só câmera e microfone, e só o que o Android já permitiu ao app. */
    private void liberar(PermissionRequest pedido, String hostDoApp) {
        String host = pedido.getOrigin() == null ? null : pedido.getOrigin().getHost();
        if (hostDoApp == null || !hostDoApp.equalsIgnoreCase(host)) {
            pedido.deny();
            return;
        }
        java.util.List<String> dar = new java.util.ArrayList<>();
        for (String r : pedido.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && permitido("android.permission.CAMERA")) dar.add(r);
            else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && permitido("android.permission.RECORD_AUDIO")) dar.add(r);
        }
        if (dar.isEmpty()) pedido.deny();
        else pedido.grant(dar.toArray(new String[0]));
    }

    private boolean permitido(String permissao) {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(permissao) == PackageManager.PERMISSION_GRANTED;
    }

    /** O que a página da câmera pode pedir ao app. */
    private final class PonteCamera {
        /** Sessão pelo token do aparelho (como a tela principal) ou, sem ele, a entregue ao ligar. */
        @JavascriptInterface
        public boolean temAparelho() {
            return new Armazenamento(ServicoAoVivo.this).temAparelho() || !sessaoEntregue.isEmpty();
        }

        @JavascriptInterface
        public void pedirSessao(String id) {
            Armazenamento dados = new Armazenamento(ServicoAoVivo.this);
            String api = dados.api();
            String token = dados.token();
            new Thread(() -> {
                String resposta = "";
                if (api != null && token != null) {
                    try {
                        resposta = Api.entrar(api, token).toString();
                    } catch (Api.Desconectado | java.io.IOException | RuntimeException e) {
                        resposta = "";
                    }
                }
                if (resposta.isEmpty()) resposta = sessaoEntregue;
                String js = "window.__nordAndroidSessao && window.__nordAndroidSessao(" + JSONObject.quote(id) + "," + JSONObject.quote(resposta) + ")";
                new Handler(Looper.getMainLooper()).post(() -> {
                    if (pagina != null) pagina.evaluateJavascript(js, null);
                });
            }, "nordtool-sessao-camera").start();
        }

        /** A página da câmera não registra nem desconecta o aparelho: isso é da tela principal. */
        @JavascriptInterface
        public void registrar(String token, String api) {
            // nada
        }

        @JavascriptInterface
        public void sair() {
            // nada
        }

        @JavascriptInterface
        public boolean cameraNaPagina() {
            return true;
        }

        /** A página da câmera já está num serviço: nada a fazer (e não prende a tela). */
        @JavascriptInterface
        public boolean aoVivo(boolean ligar, String nomeNovo) {
            return true;
        }

        @JavascriptInterface
        public String nomeDaCamera() {
            return nome;
        }

        /** Desligada pelo Monitoramento de outro aparelho: sai do ar (o mesmo que "Desligar câmera"). */
        @JavascriptInterface
        public void desligarCamera() {
            new Handler(Looper.getMainLooper()).post(() -> desligar(ServicoAoVivo.this));
        }

        /** A página conta como está (no ar, quantos vendo, erro…); a tela principal mostra. */
        @JavascriptInterface
        public void estadoCamera(String json) {
            if (json != null && json.length() < 4000) estado = json;
        }

        @JavascriptInterface
        public int versaoApp() {
            return BuildConfig.VERSION_CODE;
        }

        @JavascriptInterface
        public String nomeVersaoApp() {
            return BuildConfig.VERSION_NAME;
        }
    }

    // ------------------------------------------------------------ travas e notificação

    private void segurar() {
        if (travaCpu == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            travaCpu = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nordtool:aovivo");
            travaCpu.setReferenceCounted(false);
            travaCpu.acquire();
        }
        if (travaWifi == null) {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            if (wm != null) {
                travaWifi = wm.createWifiLock(Build.VERSION.SDK_INT >= 29
                        ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF, "nordtool:aovivo");
                travaWifi.setReferenceCounted(false);
                travaWifi.acquire();
            }
        }
    }

    @Override
    public void onDestroy() {
        ativo = false;
        estado = "";
        if (pagina != null) {
            if (comJanela) {
                try {
                    ((WindowManager) getSystemService(WINDOW_SERVICE)).removeView(pagina);
                } catch (RuntimeException ignorado) {
                    // já saiu
                }
            }
            pagina.loadUrl("about:blank");
            pagina.destroy();
            pagina = null;
        }
        comJanela = false;
        if (travaCpu != null && travaCpu.isHeld()) travaCpu.release();
        if (travaWifi != null && travaWifi.isHeld()) travaWifi.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @SuppressWarnings("deprecation")
    private Notification notificacao() {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel(CANAL, "Câmera ao vivo", NotificationManager.IMPORTANCE_LOW));
            b = new Notification.Builder(this, CANAL);
        } else {
            b = new Notification.Builder(this).setPriority(Notification.PRIORITY_LOW);
        }
        int flags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        // Tocar abre Estúdio → Gravação, onde fica o "Desligar câmera".
        Intent abrir = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(ServicoSegundoPlano.EXTRA_URL, "/gestao/repertorio?aba=gravacao");
        String texto = (nome.isEmpty() ? "Este celular" : nome) + " está como câmera · toque para desligar";
        return b.setSmallIcon(R.drawable.ic_notificacao)
                .setContentTitle("Câmera ao vivo no ar")
                .setContentText(texto)
                .setOngoing(true)
                .setContentIntent(PendingIntent.getActivity(this, 1, abrir, flags | PendingIntent.FLAG_UPDATE_CURRENT))
                .build();
    }
}
