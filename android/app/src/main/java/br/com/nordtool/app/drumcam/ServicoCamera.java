package br.com.nordtool.app.drumcam;

import br.com.nordtool.app.BuildConfig;

import br.com.nordtool.app.R;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.StatFs;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Modo câmera: fica ligado com a tela apagada, segurando CPU e Wi-Fi, com o servidor do painel aberto
 * na rede local. O controle (ou qualquer navegador no mesmo Wi-Fi) manda gravar, parar e publicar.
 */
public class ServicoCamera extends Service {

    static final String TIPO_NSD = "_drumcam._tcp.";
    static final int PORTA = 8080;
    private static final String CANAL = "drumcam";
    private static final int NOTIFICACAO = 1;
    /** Tentativas erradas de PIN por IP antes de bloquear por 5 minutos. */
    private static final int TENTATIVAS = 10;

    static volatile boolean ativo;

    /** Para a página do NordTool saber se este celular está como câmera. */
    public static boolean ativa() {
        return ativo;
    }
    static volatile int porta;

    private Gravador gravador;
    private YouTube youtube;
    private Servidor servidor;
    private PowerManager.WakeLock travaCpu;
    private WifiManager.WifiLock travaWifi;
    private WifiManager.MulticastLock travaMulticast;
    private NsdManager.RegistrationListener registro;
    private final Map<String, int[]> erros = new HashMap<>();
    private final Map<String, Long> bloqueados = new HashMap<>();

    static void iniciar(Context c) {
        Intent i = new Intent(c, ServicoCamera.class);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
        else c.startService(i);
    }

    static void parar(Context c) {
        c.stopService(new Intent(c, ServicoCamera.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        entrarEmPrimeiroPlano("Iniciando…");
        gravador = new Gravador(this);
        youtube = new YouTube(this);
        servidor = new Servidor(this::tratar);
        try {
            porta = servidor.iniciar(PORTA);
        } catch (IOException e) {
            Log.e("Drumcam", "servidor", e);
            stopSelf();
            return;
        }
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        travaCpu = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "drumcam:camera");
        travaCpu.acquire();
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
        travaWifi = wm.createWifiLock(Build.VERSION.SDK_INT >= 29
                ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF, "drumcam:wifi");
        travaWifi.acquire();
        travaMulticast = wm.createMulticastLock("drumcam:nsd");
        travaMulticast.acquire();
        anunciar();
        br.com.nordtool.app.Rele.iniciar(this, "Drumcam " + Build.MODEL, this::tratarRele);
        youtube.retomarPendentes();
        ativo = true;
        atualizarNotificacao();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        atualizarNotificacao();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        ativo = false;
        br.com.nordtool.app.Rele.parar();
        try {
            gravador.parar();
        } catch (Exception ignorado) {
            // desligando
        }
        if (servidor != null) servidor.parar();
        if (registro != null) {
            try {
                ((NsdManager) getSystemService(NSD_SERVICE)).unregisterService(registro);
            } catch (RuntimeException ignorado) {
                // já saiu
            }
        }
        if (travaCpu != null && travaCpu.isHeld()) travaCpu.release();
        if (travaWifi != null && travaWifi.isHeld()) travaWifi.release();
        if (travaMulticast != null && travaMulticast.isHeld()) travaMulticast.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ---------- notificação e rede ----------

    private void entrarEmPrimeiroPlano(String texto) {
        Notification n = notificacao(texto);
        if (Build.VERSION.SDK_INT >= 30) {
            startForeground(NOTIFICACAO, n,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICACAO, n);
        }
    }

    private void atualizarNotificacao() {
        String texto;
        if (gravador != null && gravador.gravando()) texto = "● Gravando";
        else texto = "Pronto · " + endereco() + " · PIN " + Config.pin(this);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICACAO, notificacao(texto));
    }

    @SuppressWarnings("deprecation")
    private Notification notificacao(String texto) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel(CANAL, "Câmera ativa", NotificationManager.IMPORTANCE_LOW));
            b = new Notification.Builder(this, CANAL);
        } else {
            b = new Notification.Builder(this).setPriority(Notification.PRIORITY_LOW);
        }
        int flags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent abrir = PendingIntent.getActivity(this, 0, new Intent(this, CameraActivity.class), flags);
        return b.setSmallIcon(R.drawable.ic_notificacao)
                .setContentTitle("Drumcam · modo câmera")
                .setContentText(texto)
                .setOngoing(true)
                .setContentIntent(abrir)
                .build();
    }

    /** Endereço do celular no Wi-Fi (ex.: 192.168.0.15:8080). */
    String endereco() {
        return ip() + ":" + porta;
    }

    static String ip() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String nome = ni.getName();
                boolean wifi = nome.startsWith("wlan") || nome.startsWith("ap") || nome.startsWith("swlan");
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLoopbackAddress() && (wifi || a.isSiteLocalAddress())) {
                        return a.getHostAddress();
                    }
                }
            }
        } catch (Exception ignorado) {
            // sem rede
        }
        return "sem Wi-Fi";
    }

    private void anunciar() {
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName("Drumcam " + Build.MODEL);
        info.setServiceType(TIPO_NSD);
        info.setPort(porta);
        registro = new NsdManager.RegistrationListener() {
            @Override public void onRegistrationFailed(NsdServiceInfo s, int e) { Log.w("Drumcam", "nsd " + e); }
            @Override public void onUnregistrationFailed(NsdServiceInfo s, int e) { }
            @Override public void onServiceRegistered(NsdServiceInfo s) { }
            @Override public void onServiceUnregistered(NsdServiceInfo s) { }
        };
        try {
            ((NsdManager) getSystemService(NSD_SERVICE)).registerService(info, NsdManager.PROTOCOL_DNS_SD, registro);
        } catch (RuntimeException e) {
            registro = null;
            Log.w("Drumcam", "nsd", e);
        }
    }

    // ---------- relé do NordTool (pela internet) ----------

    /** Maior corpo de resposta que vai pelo relé (a prévia e as miniaturas cabem; vídeo, não). */
    private static final int MAX_CORPO_RELE = 1_000_000;

    /**
     * Pedido que chegou pelo relé: roda a mesma rota do Wi-Fi e devolve status, tipo e corpo (base64). Baixar o vídeo
     * pela internet não vale (arquivos de GB): só no mesmo Wi-Fi.
     */
    private org.json.JSONObject tratarRele(org.json.JSONObject m) {
        org.json.JSONObject resposta = new org.json.JSONObject();
        try {
            Servidor.Pedido p = new Servidor.Pedido();
            p.metodo = m.optString("m", "GET").toUpperCase(java.util.Locale.ROOT);
            String c = m.optString("c", "");
            int q = c.indexOf('?');
            if (q >= 0) {
                for (String par : c.substring(q + 1).split("&")) {
                    int igual = par.indexOf('=');
                    if (igual > 0) p.query.put(java.net.URLDecoder.decode(par.substring(0, igual), "UTF-8"), java.net.URLDecoder.decode(par.substring(igual + 1), "UTF-8"));
                }
                c = c.substring(0, q);
            }
            p.caminho = "/api/" + c.replaceFirst("^/+", "");
            p.ip = "relé";
            p.rele = true;
            String tipo = m.optString("tipo", "");
            if (!tipo.isEmpty()) p.cabecalhos.put("content-type", tipo);
            String b = m.optString("b", "");
            if (!b.isEmpty()) p.corpo = android.util.Base64.decode(b, android.util.Base64.NO_WRAP);
            String[] partes = p.caminho.substring(5).split("/");
            if ("GET".equals(p.metodo) && partes.length == 2 && "videos".equals(partes[0])) {
                return resposta.put("s", 403).put("tipo", "application/json").put("b", base64("{\"erro\":\"Para baixar o vídeo, use o mesmo Wi-Fi da câmera.\"}"));
            }
            java.io.ByteArrayOutputStream saida = new java.io.ByteArrayOutputStream();
            Servidor.Resposta r = new Servidor.Resposta(saida);
            try {
                tratar(p, r);
            } catch (Exception e) {
                if (!r.enviada) r.erro(500, e.getMessage() == null ? "Erro na câmera." : e.getMessage());
            }
            byte[] bruto = saida.toByteArray();
            int fimCabecalho = indice(bruto);
            String cabecalho = new String(bruto, 0, Math.max(0, fimCabecalho), java.nio.charset.StandardCharsets.UTF_8);
            int status = 500;
            String tipoResp = "application/octet-stream";
            String[] linhas = cabecalho.split("\r\n");
            if (linhas.length > 0 && linhas[0].split(" ").length > 1) status = Integer.parseInt(linhas[0].split(" ")[1]);
            for (String l : linhas) if (l.toLowerCase(java.util.Locale.ROOT).startsWith("content-type:")) tipoResp = l.substring(13).trim();
            int inicio = fimCabecalho < 0 ? bruto.length : fimCabecalho + 4;
            int tamanho = bruto.length - inicio;
            if (tamanho > MAX_CORPO_RELE) {
                return resposta.put("s", 413).put("tipo", "application/json").put("b", base64("{\"erro\":\"Grande demais para ir pela internet.\"}"));
            }
            return resposta.put("s", status).put("tipo", tipoResp)
                    .put("b", android.util.Base64.encodeToString(bruto, inicio, tamanho, android.util.Base64.NO_WRAP));
        } catch (Exception e) {
            try {
                return resposta.put("s", 500).put("tipo", "application/json").put("b", base64("{\"erro\":\"Erro na câmera.\"}"));
            } catch (org.json.JSONException ignorado) {
                return resposta;
            }
        }
    }

    private static String base64(String texto) {
        return android.util.Base64.encodeToString(texto.getBytes(java.nio.charset.StandardCharsets.UTF_8), android.util.Base64.NO_WRAP);
    }

    private static int indice(byte[] b) {
        for (int i = 0; i + 3 < b.length; i++) if (b[i] == '\r' && b[i + 1] == '\n' && b[i + 2] == '\r' && b[i + 3] == '\n') return i;
        return -1;
    }

    // ---------- rotas ----------

    private void tratar(Servidor.Pedido p, Servidor.Resposta r) throws Exception {
        String c = p.caminho;
        if (p.metodo.equals("GET") && (c.equals("/") || c.equals("/index.html"))) {
            r.enviar(200, "text/html; charset=utf-8", asset("painel.html"));
            return;
        }
        if (c.equals("/api/ping")) {
            r.json(200, new JSONObject().put("app", "drumcam").put("nome", "Drumcam " + Build.MODEL));
            return;
        }
        if (!c.startsWith("/api/")) {
            r.erro(404, "Não encontrado.");
            return;
        }
        if (!autorizado(p, r)) return;

        String[] partes = c.substring(5).split("/");
        String m = p.metodo;
        switch (partes[0]) {
            case "estado":
                r.json(200, estado());
                return;
            case "gravar":
                if (!m.equals("POST")) break;
                try {
                    gravador.iniciar();
                } catch (Exception e) {
                    r.erro(409, gravador.erro() != null ? gravador.erro() : "Não consegui gravar: " + e.getMessage());
                    return;
                }
                atualizarNotificacao();
                r.json(200, estado());
                return;
            case "parar":
                if (!m.equals("POST")) break;
                gravador.parar();
                atualizarNotificacao();
                r.json(200, estado());
                return;
            case "previa.jpg": {
                byte[] img = gravador.previa();
                if (img == null) {
                    // a câmera acabou de abrir ou está gravando: o painel tenta de novo
                    r.erro(409, gravador.gravando() ? "Gravando." : "Abrindo a câmera…");
                    return;
                }
                r.enviar(200, "image/jpeg", img);
                return;
            }
            case "ajustes":
                if (m.equals("PUT") || m.equals("POST")) {
                    if (gravador.gravando()) {
                        JSONObject novos = new JSONObject(p.corpoTexto());
                        if (novos.has("qualidade") || novos.has("orientacao") || novos.has("audio")) {
                            r.erro(409, "Pare a gravação para mudar a câmera.");
                            return;
                        }
                    }
                    r.json(200, Config.mesclarAjustes(this, new JSONObject(p.corpoTexto())));
                } else {
                    r.json(200, Config.ajustes(this));
                }
                return;
            case "pin":
                if (!m.equals("POST")) break;
                r.json(200, new JSONObject().put("pin", Config.trocarPin(this)));
                atualizarNotificacao();
                return;
            case "videos":
                videos(p, r, partes);
                return;
            case "thumbs":
                thumbs(p, r, partes);
                return;
            case "youtube":
                youtube(p, r, partes);
                return;
            default:
                break;
        }
        r.erro(404, "Não encontrado.");
    }

    private boolean autorizado(Servidor.Pedido p, Servidor.Resposta r) throws IOException {
        if (p.rele) return true;
        synchronized (erros) {
            Long ate = bloqueados.get(p.ip);
            if (ate != null && ate > System.currentTimeMillis()) {
                r.erro(429, "Muitas tentativas com PIN errado. Espere 5 minutos.");
                return false;
            }
        }
        String pin = p.cabecalho("x-pin");
        if (pin == null) pin = p.query.get("pin");
        if (pin != null && MessageDigest.isEqual(pin.getBytes(), Config.pin(this).getBytes())) {
            synchronized (erros) {
                erros.remove(p.ip);
            }
            return true;
        }
        synchronized (erros) {
            int[] n = erros.get(p.ip);
            if (n == null) erros.put(p.ip, n = new int[1]);
            if (++n[0] >= TENTATIVAS) {
                bloqueados.put(p.ip, System.currentTimeMillis() + 5 * 60_000);
                erros.remove(p.ip);
            }
        }
        r.erro(401, "PIN errado.");
        return false;
    }

    private JSONObject estado() throws Exception {
        Intent bateria = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int nivel = bateria == null ? -1 : bateria.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int escala = bateria == null ? 100 : bateria.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
        int ligado = bateria == null ? 0 : bateria.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
        int temperatura = bateria == null ? 0 : bateria.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0);
        StatFs fs = new StatFs(Videos.pasta(this).getAbsolutePath());
        long livre = fs.getAvailableBytes();
        JSONObject e = new JSONObject()
                .put("aparelho", Build.MANUFACTURER + " " + Build.MODEL)
                .put("android", Build.VERSION.RELEASE)
                .put("versaoApp", BuildConfig.VERSION_NAME)
                .put("gravando", gravador.gravando())
                .put("desde", gravador.inicio())
                .put("agora", System.currentTimeMillis())
                .put("arquivo", gravador.arquivoAtual())
                .put("bateria", nivel >= 0 ? nivel * 100 / escala : -1)
                .put("carregando", ligado != 0)
                .put("temperatura", temperatura / 10.0)
                .put("livre", livre)
                .put("resolucao", gravador.resolucao())
                .put("youtube", Config.texto(this, "yt_refresh") != null)
                .put("internet", br.com.nordtool.app.Rele.estado());
        if (gravador.erro() != null) e.put("erro", gravador.erro());
        return e;
    }

    private void videos(Servidor.Pedido p, Servidor.Resposta r, String[] partes) throws Exception {
        if (partes.length == 1) {
            r.json(200, Videos.listar(this, gravador.gravando() ? gravador.arquivoAtual() : null));
            return;
        }
        String nome = partes[1];
        File f = Videos.arquivo(this, nome);
        if (f == null) {
            r.erro(404, "Vídeo não encontrado.");
            return;
        }
        boolean emGravacao = gravador.gravando() && nome.equals(gravador.arquivoAtual());
        String acao = partes.length > 2 ? partes[2] : "";
        switch (p.metodo + " " + acao) {
            case "GET ": {
                String baixar = p.query.containsKey("baixar") ? nome : null;
                r.arquivo(f, "video/mp4", p.cabecalho("range"), baixar);
                return;
            }
            case "GET quadro.jpg":
                if (emGravacao) {
                    r.erro(409, "Gravando.");
                    return;
                }
                r.enviar(200, "image/jpeg", Videos.quadro(this, f));
                return;
            case "DELETE ": {
                if (emGravacao) {
                    r.erro(409, "Pare a gravação antes de apagar.");
                    return;
                }
                JSONObject pub = Videos.meta(this, nome).optJSONObject("publicacao");
                String s = pub == null ? "" : pub.optString("status");
                if (s.equals("fila") || s.equals("enviando") || s.equals("thumb")) {
                    r.erro(409, "Espere terminar o envio ao YouTube.");
                    return;
                }
                Videos.apagar(this, nome);
                r.json(200, new JSONObject().put("ok", true));
                return;
            }
            case "POST publicar": {
                if (emGravacao) {
                    r.erro(409, "Pare a gravação antes de publicar.");
                    return;
                }
                if (Config.texto(this, "yt_refresh") == null) {
                    r.erro(409, "Conecte o YouTube nos Ajustes primeiro.");
                    return;
                }
                JSONObject pub = Videos.meta(this, nome).optJSONObject("publicacao");
                String s = pub == null ? "" : pub.optString("status");
                if (s.equals("fila") || s.equals("enviando") || s.equals("thumb")) {
                    r.erro(409, "Este vídeo já está sendo enviado.");
                    return;
                }
                JSONObject pedido = new JSONObject(p.corpoTexto());
                if (pedido.optString("titulo").trim().isEmpty()) {
                    r.erro(400, "Falta o título.");
                    return;
                }
                youtube.publicar(nome, pedido);
                r.json(200, new JSONObject().put("ok", true));
                return;
            }
            default:
                r.erro(404, "Não encontrado.");
        }
    }

    private void thumbs(Servidor.Pedido p, Servidor.Resposta r, String[] partes) throws Exception {
        if (partes.length == 1 && p.metodo.equals("GET")) {
            File[] lista = Videos.pastaThumbs(this).listFiles();
            JSONArray saida = new JSONArray();
            if (lista != null) {
                java.util.Arrays.sort(lista, (a, b) -> b.getName().compareTo(a.getName()));
                for (File f : lista) saida.put(new JSONObject().put("nome", f.getName()).put("tamanho", f.length()));
            }
            r.json(200, saida);
            return;
        }
        if (partes.length == 1 && p.metodo.equals("POST")) {
            String tipo = p.cabecalho("content-type");
            String ext = tipo != null && tipo.contains("png") ? ".png" : ".jpg";
            if (p.corpo.length == 0) {
                r.erro(400, "Imagem vazia.");
                return;
            }
            if (p.corpo.length > 2 * 1024 * 1024) {
                r.erro(413, "O YouTube aceita thumb de até 2 MB.");
                return;
            }
            String nome = "thumb-" + new SimpleDateFormat("yyyyMMdd-HHmmss-SSS", Locale.ROOT).format(new Date()) + ext;
            try (OutputStream out = new FileOutputStream(new File(Videos.pastaThumbs(this), nome))) {
                out.write(p.corpo);
            }
            r.json(200, new JSONObject().put("nome", nome));
            return;
        }
        if (partes.length == 2) {
            File f = Videos.thumb(this, partes[1]);
            if (f == null) {
                r.erro(404, "Imagem não encontrada.");
                return;
            }
            if (p.metodo.equals("GET")) {
                r.enviar(200, f.getName().endsWith(".png") ? "image/png" : "image/jpeg", Videos.ler(f));
                return;
            }
            if (p.metodo.equals("DELETE")) {
                f.delete();
                r.json(200, new JSONObject().put("ok", true));
                return;
            }
        }
        r.erro(404, "Não encontrado.");
    }

    private void youtube(Servidor.Pedido p, Servidor.Resposta r, String[] partes) throws Exception {
        String acao = partes.length > 1 ? partes[1] : "";
        switch (p.metodo + " " + acao) {
            case "GET ":
                r.json(200, youtube.estado());
                return;
            case "POST credenciais": {
                JSONObject j = new JSONObject(p.corpoTexto());
                youtube.credenciais(j.optString("clientId"), j.optString("clientSecret"));
                r.json(200, youtube.estado());
                return;
            }
            case "POST conectar":
                try {
                    r.json(200, youtube.conectar());
                } catch (IOException e) {
                    r.erro(409, e.getMessage());
                }
                return;
            case "POST desconectar":
                youtube.desconectar();
                r.json(200, youtube.estado());
                return;
            case "GET playlists":
                try {
                    r.json(200, youtube.playlists());
                } catch (IOException e) {
                    r.erro(409, e.getMessage());
                }
                return;
            default:
                r.erro(404, "Não encontrado.");
        }
    }

    private byte[] asset(String nome) throws IOException {
        try (InputStream in = getAssets().open(nome)) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }
}
