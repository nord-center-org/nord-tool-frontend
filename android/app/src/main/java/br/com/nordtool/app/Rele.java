package br.com.nordtool.app;

import android.content.Context;
import android.util.Base64;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.SSLSocketFactory;

/**
 * Drumcam pela internet: o celular-câmera fica conectado ao relé do NordTool (WebSocket) com a conta do app. O painel
 * aberto em Repertório → Drumcam, de qualquer lugar, manda pedidos pelo relé; a câmera responde como se fosse no
 * Wi-Fi. Sem conta no app (aparelho não registrado), a câmera continua só no Wi-Fi.
 */
public final class Rele {

    /** Quem atende os pedidos (o serviço da câmera). */
    public interface Tratador {
        JSONObject tratar(JSONObject pedido);
    }

    private static final int MAX_MENSAGEM = 1_500_000;
    private static volatile Thread linha;
    private static volatile String estado = "desligado";
    private static volatile Ws atual;

    private Rele() {
    }

    /** "conectado", "conectando", "sem conta" ou "sem internet". */
    public static String estado() {
        return estado;
    }

    public static synchronized void iniciar(Context contexto, String nome, Tratador tratador) {
        if (linha != null) return;
        Context c = contexto.getApplicationContext();
        Thread t = new Thread(() -> laco(c, nome, tratador), "drumcam-rele");
        linha = t;
        t.start();
    }

    public static synchronized void parar() {
        Thread t = linha;
        linha = null;
        estado = "desligado";
        Ws ws = atual;
        if (ws != null) ws.fechar();
        if (t != null) t.interrupt();
    }

    private static void laco(Context c, String nome, Tratador tratador) {
        ExecutorService trabalho = Executors.newFixedThreadPool(3);
        long espera = 5_000;
        try {
            while (linha == Thread.currentThread()) {
                Armazenamento dados = new Armazenamento(c);
                String api = dados.api();
                String token = dados.token();
                if (api == null || token == null) {
                    estado = "sem conta";
                    dormir(60_000);
                    continue;
                }
                estado = "conectando";
                try {
                    String acesso = Api.entrar(api, token).optString("token", null);
                    if (acesso == null) throw new IOException("sem sessão");
                    String bilhete = Api.bilheteDrumcam(api, acesso, nome);
                    Ws ws = Ws.abrir(api.replaceFirst("^https://", "wss://").replaceFirst("^http://", "ws://")
                            + "/drumcam/ws?bilhete=" + bilhete, BuildConfig.ENDERECO.replaceAll("/+$", ""));
                    atual = ws;
                    estado = "conectado";
                    espera = 5_000;
                    ouvir(ws, tratador, trabalho);
                } catch (Api.Desconectado e) {
                    estado = "sem conta";
                    dormir(60_000);
                    continue;
                } catch (IOException | JSONException | RuntimeException e) {
                    Log.w("Drumcam", "relé: " + e.getMessage());
                } finally {
                    Ws ws = atual;
                    atual = null;
                    if (ws != null) ws.fechar();
                }
                if (linha != Thread.currentThread()) break;
                estado = "sem internet";
                dormir(espera);
                espera = Math.min(60_000, espera * 2);
            }
        } finally {
            trabalho.shutdownNow();
        }
    }

    /** Lê as mensagens até a conexão cair; manda um ping a cada 30 s para o servidor não fechar por inatividade. */
    private static void ouvir(Ws ws, Tratador tratador, ExecutorService trabalho) throws IOException, JSONException {
        Thread ping = new Thread(() -> {
            try {
                while (!ws.fechado) {
                    Thread.sleep(30_000);
                    ws.enviar("{\"t\":\"ping\"}");
                }
            } catch (InterruptedException | IOException ignorado) {
                ws.fechar();
            }
        }, "drumcam-ping");
        ping.start();
        try {
            while (true) {
                String texto = ws.receber();
                if (texto == null) return;
                JSONObject m = new JSONObject(texto);
                if (!"req".equals(m.optString("t"))) continue;
                trabalho.execute(() -> {
                    JSONObject resposta = tratador.tratar(m);
                    try {
                        resposta.put("t", "resp").put("para", m.optString("de")).put("id", m.opt("id"));
                        ws.enviar(resposta.toString());
                    } catch (JSONException | IOException e) {
                        ws.fechar();
                    }
                });
            }
        } finally {
            ping.interrupt();
        }
    }

    private static void dormir(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** WebSocket cliente mínimo (RFC 6455): texto, ping/pong e fechamento. Basta para o relé, sem bibliotecas. */
    static final class Ws {
        private final Socket socket;
        private final InputStream in;
        private final OutputStream out;
        private final SecureRandom aleatorio = new SecureRandom();
        volatile boolean fechado;

        private Ws(Socket socket) throws IOException {
            this.socket = socket;
            this.in = socket.getInputStream();
            this.out = socket.getOutputStream();
        }

        static Ws abrir(String endereco, String origem) throws IOException {
            URI u = URI.create(endereco);
            boolean seguro = "wss".equals(u.getScheme());
            int porta = u.getPort() > 0 ? u.getPort() : seguro ? 443 : 80;
            Socket s = seguro ? SSLSocketFactory.getDefault().createSocket() : new Socket();
            s.connect(new InetSocketAddress(u.getHost(), porta), 15_000);
            s.setSoTimeout(90_000);
            Ws ws = new Ws(s);
            byte[] chave = new byte[16];
            ws.aleatorio.nextBytes(chave);
            String k = Base64.encodeToString(chave, Base64.NO_WRAP);
            String caminho = u.getRawPath() + (u.getRawQuery() == null ? "" : "?" + u.getRawQuery());
            String pedido = "GET " + caminho + " HTTP/1.1\r\nHost: " + u.getHost() + (u.getPort() > 0 ? ":" + porta : "")
                    + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: " + k
                    + "\r\nSec-WebSocket-Version: 13\r\nOrigin: " + origem
                    + "\r\nUser-Agent: NordToolAndroid/" + BuildConfig.VERSION_NAME + "\r\n\r\n";
            ws.out.write(pedido.getBytes(StandardCharsets.UTF_8));
            ws.out.flush();
            String status = ws.linha();
            if (status == null || !status.contains(" 101")) { ws.fechar(); throw new IOException("handshake: " + status); }
            String aceite = null;
            for (String h = ws.linha(); h != null && !h.isEmpty(); h = ws.linha()) {
                int p = h.indexOf(':');
                if (p > 0 && h.substring(0, p).trim().equalsIgnoreCase("Sec-WebSocket-Accept")) aceite = h.substring(p + 1).trim();
            }
            if (!esperado(k).equals(aceite)) { ws.fechar(); throw new IOException("aceite inválido"); }
            return ws;
        }

        private static String esperado(String k) throws IOException {
            try {
                byte[] h = MessageDigest.getInstance("SHA-1").digest((k + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.US_ASCII));
                return Base64.encodeToString(h, Base64.NO_WRAP);
            } catch (java.security.NoSuchAlgorithmException e) {
                throw new IOException(e);
            }
        }

        private String linha() throws IOException {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            int c;
            while ((c = in.read()) != -1) {
                if (c == '\n') break;
                if (c != '\r') b.write(c);
                if (b.size() > 8192) throw new IOException("cabeçalho grande demais");
            }
            if (c == -1 && b.size() == 0) return null;
            return b.toString("UTF-8");
        }

        synchronized void enviar(String texto) throws IOException {
            quadro(0x1, texto.getBytes(StandardCharsets.UTF_8));
        }

        private synchronized void quadro(int opcode, byte[] dados) throws IOException {
            if (fechado) throw new IOException("fechado");
            ByteArrayOutputStream b = new ByteArrayOutputStream(dados.length + 14);
            b.write(0x80 | opcode);
            int n = dados.length;
            if (n < 126) b.write(0x80 | n);
            else if (n < 65536) { b.write(0x80 | 126); b.write(n >>> 8); b.write(n & 0xff); }
            else { b.write(0x80 | 127); for (int i = 7; i >= 0; i--) b.write(i >= 4 ? 0 : (n >>> (8 * i)) & 0xff); }
            byte[] mascara = new byte[4];
            aleatorio.nextBytes(mascara);
            b.write(mascara, 0, 4);
            for (int i = 0; i < n; i++) b.write(dados[i] ^ mascara[i & 3]);
            out.write(b.toByteArray());
            out.flush();
        }

        /** Próxima mensagem de texto; null quando a conexão fecha. */
        String receber() throws IOException {
            ByteArrayOutputStream msg = new ByteArrayOutputStream();
            while (true) {
                int b0 = in.read();
                if (b0 < 0) return null;
                int b1 = ler();
                int opcode = b0 & 0x0f;
                long n = b1 & 0x7f;
                if (n == 126) n = (ler() << 8) | ler();
                else if (n == 127) { n = 0; for (int i = 0; i < 8; i++) n = (n << 8) | ler(); }
                if (n > MAX_MENSAGEM || msg.size() + n > MAX_MENSAGEM) throw new IOException("mensagem grande demais");
                byte[] mascara = (b1 & 0x80) != 0 ? new byte[] {(byte) ler(), (byte) ler(), (byte) ler(), (byte) ler()} : null;
                byte[] dados = new byte[(int) n];
                int lido = 0;
                while (lido < n) {
                    int r = in.read(dados, lido, (int) n - lido);
                    if (r < 0) throw new EOFException();
                    lido += r;
                }
                if (mascara != null) for (int i = 0; i < n; i++) dados[i] ^= mascara[i & 3];
                if (opcode == 0x8) { fechar(); return null; }
                if (opcode == 0x9) { quadro(0xA, dados); continue; }
                if (opcode == 0xA) continue;
                msg.write(dados, 0, dados.length);
                if ((b0 & 0x80) != 0) return msg.toString("UTF-8");
            }
        }

        private int ler() throws IOException {
            int b = in.read();
            if (b < 0) throw new EOFException();
            return b;
        }

        void fechar() {
            fechado = true;
            try {
                socket.close();
            } catch (IOException ignorado) {
                // já fechou
            }
        }
    }
}
