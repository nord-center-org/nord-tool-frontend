package br.com.nordtool.app.drumcam;

import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Servidor HTTP mínimo (sem bibliotecas) que o celular-câmera abre no Wi-Fi. Uma conexão por pedido.
 */
final class Servidor {

    interface Tratador {
        void tratar(Pedido pedido, Resposta resposta) throws Exception;
    }

    static final class Pedido {
        String metodo;
        String caminho;
        final Map<String, String> query = new HashMap<>();
        final Map<String, String> cabecalhos = new HashMap<>();
        byte[] corpo = new byte[0];
        String ip;
        /** Veio pelo relé do NordTool (a conta já autorizou): não pede o PIN. */
        boolean rele;

        String cabecalho(String nome) {
            return cabecalhos.get(nome.toLowerCase(Locale.ROOT));
        }

        String corpoTexto() {
            return new String(corpo, StandardCharsets.UTF_8);
        }
    }

    static final class Resposta {
        private final OutputStream saida;
        boolean enviada;

        Resposta(OutputStream saida) {
            this.saida = saida;
        }

        void enviar(int status, String tipo, byte[] corpo) throws IOException {
            cabecalho(status, tipo, corpo.length, null);
            saida.write(corpo);
            saida.flush();
        }

        void json(int status, Object json) throws IOException {
            enviar(status, "application/json; charset=utf-8", json.toString().getBytes(StandardCharsets.UTF_8));
        }

        void erro(int status, String mensagem) throws IOException {
            json(status, "{\"erro\":" + org.json.JSONObject.quote(mensagem) + "}");
        }

        /** Envia um arquivo, aceitando "Range" (o player e o download retomado pedem pedaços). */
        void arquivo(File f, String tipo, String range, String nomeDownload) throws IOException {
            long total = f.length();
            long ini = 0;
            long fim = total - 1;
            boolean parcial = false;
            if (range != null && range.startsWith("bytes=")) {
                String[] partes = range.substring(6).split("-", 2);
                try {
                    if (partes[0].isEmpty()) {
                        ini = Math.max(0, total - Long.parseLong(partes[1].trim()));
                    } else {
                        ini = Long.parseLong(partes[0].trim());
                        if (partes.length > 1 && !partes[1].trim().isEmpty()) {
                            fim = Math.min(fim, Long.parseLong(partes[1].trim()));
                        }
                    }
                    parcial = true;
                } catch (NumberFormatException ignorado) {
                    ini = 0;
                }
                if (ini > fim) {
                    saida.write(("HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */" + total
                            + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                    enviada = true;
                    return;
                }
            }
            long tamanho = fim - ini + 1;
            StringBuilder extra = new StringBuilder("Accept-Ranges: bytes\r\n");
            if (parcial) extra.append("Content-Range: bytes ").append(ini).append('-').append(fim).append('/').append(total).append("\r\n");
            if (nomeDownload != null) extra.append("Content-Disposition: attachment; filename=\"").append(nomeDownload).append("\"\r\n");
            cabecalho(parcial ? 206 : 200, tipo, tamanho, extra.toString());
            try (InputStream in = new FileInputStream(f)) {
                long pular = ini;
                while (pular > 0) {
                    long n = in.skip(pular);
                    if (n <= 0) throw new IOException("skip");
                    pular -= n;
                }
                byte[] buf = new byte[64 * 1024];
                long falta = tamanho;
                while (falta > 0) {
                    int n = in.read(buf, 0, (int) Math.min(buf.length, falta));
                    if (n < 0) break;
                    saida.write(buf, 0, n);
                    falta -= n;
                }
            }
            saida.flush();
        }

        private void cabecalho(int status, String tipo, long tamanho, String extra) throws IOException {
            enviada = true;
            String h = "HTTP/1.1 " + status + " " + texto(status) + "\r\n"
                    + "Content-Type: " + tipo + "\r\n"
                    + "Content-Length: " + tamanho + "\r\n"
                    + "Cache-Control: no-store\r\n"
                    + "Connection: close\r\n"
                    + (extra == null ? "" : extra)
                    + "\r\n";
            saida.write(h.getBytes(StandardCharsets.UTF_8));
        }

        private static String texto(int status) {
            switch (status) {
                case 200: return "OK";
                case 204: return "No Content";
                case 206: return "Partial Content";
                case 400: return "Bad Request";
                case 401: return "Unauthorized";
                case 404: return "Not Found";
                case 409: return "Conflict";
                case 413: return "Payload Too Large";
                case 429: return "Too Many Requests";
                default: return status >= 500 ? "Error" : "OK";
            }
        }
    }

    private static final int CORPO_MAXIMO = 15 * 1024 * 1024;

    private final Tratador tratador;
    private final ExecutorService pool = Executors.newFixedThreadPool(12);
    private ServerSocket socket;
    private volatile boolean ativo;

    Servidor(Tratador tratador) {
        this.tratador = tratador;
    }

    /** Abre na porta pedida (ou na seguinte livre). Devolve a porta. */
    int iniciar(int porta) throws IOException {
        IOException ultimo = null;
        for (int p = porta; p < porta + 10; p++) {
            try {
                ServerSocket s = new ServerSocket();
                s.setReuseAddress(true);
                s.bind(new InetSocketAddress(p));
                socket = s;
                break;
            } catch (IOException e) {
                ultimo = e;
            }
        }
        if (socket == null) throw ultimo;
        ativo = true;
        Thread t = new Thread(this::aceitar, "servidor");
        t.start();
        return socket.getLocalPort();
    }

    void parar() {
        ativo = false;
        try {
            if (socket != null) socket.close();
        } catch (IOException ignorado) {
            // fechando
        }
        pool.shutdownNow();
    }

    private void aceitar() {
        while (ativo) {
            try {
                Socket s = socket.accept();
                pool.execute(() -> atender(s));
            } catch (IOException e) {
                if (ativo) Log.w("Drumcam", "accept", e);
            }
        }
    }

    private void atender(Socket s) {
        try (Socket conexao = s) {
            conexao.setSoTimeout(30_000);
            InputStream in = new BufferedInputStream(conexao.getInputStream());
            OutputStream out = conexao.getOutputStream();
            Resposta resposta = new Resposta(out);
            Pedido pedido;
            try {
                pedido = ler(in);
            } catch (IllegalArgumentException e) {
                resposta.erro(e.getMessage().startsWith("413") ? 413 : 400, "Pedido inválido.");
                return;
            }
            if (pedido == null) return;
            pedido.ip = conexao.getInetAddress().getHostAddress();
            // Depois de ler o pedido o tempo de espera não importa mais (downloads longos).
            conexao.setSoTimeout(0);
            try {
                tratador.tratar(pedido, resposta);
                if (!resposta.enviada) resposta.erro(404, "Não encontrado.");
            } catch (Exception e) {
                Log.w("Drumcam", pedido.metodo + " " + pedido.caminho, e);
                if (!resposta.enviada) {
                    String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                    resposta.erro(500, msg);
                }
            }
        } catch (SocketTimeoutException ignorado) {
            // cliente sumiu
        } catch (IOException e) {
            // conexão caiu no meio (normal quando o download é cancelado)
        }
    }

    private static Pedido ler(InputStream in) throws IOException {
        String linha = linha(in);
        if (linha == null || linha.isEmpty()) return null;
        String[] partes = linha.split(" ");
        if (partes.length < 2) throw new IllegalArgumentException("400");
        Pedido p = new Pedido();
        p.metodo = partes[0].toUpperCase(Locale.ROOT);
        String alvo = partes[1];
        int q = alvo.indexOf('?');
        p.caminho = decodificar(q >= 0 ? alvo.substring(0, q) : alvo);
        if (q >= 0) {
            for (String par : alvo.substring(q + 1).split("&")) {
                if (par.isEmpty()) continue;
                int eq = par.indexOf('=');
                if (eq < 0) p.query.put(decodificar(par), "");
                else p.query.put(decodificar(par.substring(0, eq)), decodificar(par.substring(eq + 1)));
            }
        }
        String h;
        int quantos = 0;
        while ((h = linha(in)) != null && !h.isEmpty()) {
            if (++quantos > 100) throw new IllegalArgumentException("400");
            int dp = h.indexOf(':');
            if (dp > 0) p.cabecalhos.put(h.substring(0, dp).trim().toLowerCase(Locale.ROOT), h.substring(dp + 1).trim());
        }
        String tamanho = p.cabecalho("content-length");
        if (tamanho != null) {
            int n;
            try {
                n = Integer.parseInt(tamanho);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("400");
            }
            if (n < 0) throw new IllegalArgumentException("400");
            if (n > CORPO_MAXIMO) throw new IllegalArgumentException("413");
            byte[] corpo = new byte[n];
            int lido = 0;
            while (lido < n) {
                int r = in.read(corpo, lido, n - lido);
                if (r < 0) throw new IOException("corpo incompleto");
                lido += r;
            }
            p.corpo = corpo;
        }
        return p;
    }

    private static String linha(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) >= 0) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 8192) throw new IllegalArgumentException("400");
        }
        if (c < 0 && b.size() == 0) return null;
        return b.toString("UTF-8");
    }

    private static String decodificar(String s) {
        try {
            return URLDecoder.decode(s, "UTF-8");
        } catch (UnsupportedEncodingException | IllegalArgumentException e) {
            return s;
        }
    }
}
