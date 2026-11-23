package br.com.nordtool.app.drumcam;

import android.content.Context;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Conta do YouTube e publicação. O login é o "fluxo de dispositivo" do Google (o mesmo das TVs): o app
 * mostra um código, a pessoa confirma em google.com/device em qualquer celular. Funciona sem Google Play
 * Services e sem biblioteca, então roda no celular antigo. Só o refresh token fica salvo, no armazenamento
 * privado do app.
 */
final class YouTube {

    private static final String TAG = "Drumcam";
    private static final String ESCOPO = "https://www.googleapis.com/auth/youtube";
    private static final String URL_CODIGO = "https://oauth2.googleapis.com/device/code";
    private static final String URL_TOKEN = "https://oauth2.googleapis.com/token";
    private static final String API = "https://www.googleapis.com/youtube/v3";
    private static final String API_UPLOAD = "https://www.googleapis.com/upload/youtube/v3";

    /** Erro que não adianta repetir (pedido recusado pelo YouTube, acesso removido). */
    private static final class Definitivo extends IOException {
        Definitivo(String mensagem) {
            super(mensagem);
        }
    }

    private final Context contexto;
    private final ExecutorService fila = Executors.newSingleThreadExecutor();
    private final ExecutorService login = Executors.newSingleThreadExecutor();

    private volatile String acesso;
    private volatile long acessoAte;
    /** Estado do login em andamento: código e endereço para mostrar no painel. */
    private volatile JSONObject conexao = new JSONObject();

    YouTube(Context contexto) {
        this.contexto = contexto.getApplicationContext();
    }

    // ---------- conta ----------

    JSONObject estado() throws JSONException {
        JSONObject e = new JSONObject();
        e.put("clientId", valor("yt_client_id"));
        e.put("temSegredo", valor("yt_client_secret") != null);
        e.put("conectado", valor("yt_refresh") != null);
        e.put("canal", valor("yt_canal"));
        e.put("conexao", conexao);
        return e;
    }

    void credenciais(String clientId, String clientSecret) {
        Config.texto(contexto, "yt_client_id", vazioParaNull(clientId));
        if (clientSecret != null && !clientSecret.trim().isEmpty()) {
            Config.texto(contexto, "yt_client_secret", clientSecret.trim());
        }
    }

    void desconectar() {
        String refresh = valor("yt_refresh");
        Config.texto(contexto, "yt_refresh", null);
        Config.texto(contexto, "yt_canal", null);
        acesso = null;
        conexao = new JSONObject();
        if (refresh != null) {
            login.execute(() -> {
                try {
                    chamar("POST", "https://oauth2.googleapis.com/revoke", "application/x-www-form-urlencoded",
                            "token=" + enc(refresh), null);
                } catch (IOException ignorado) {
                    // o token some de qualquer jeito daqui
                }
            });
        }
    }

    /** Pede um código ao Google e espera a confirmação em segundo plano. */
    JSONObject conectar() throws IOException, JSONException {
        String id = valor("yt_client_id");
        String segredo = valor("yt_client_secret");
        if (id == null || segredo == null) throw new IOException("Preencha o Client ID e o Client Secret primeiro.");
        Retorno r = chamar("POST", URL_CODIGO, "application/x-www-form-urlencoded",
                "client_id=" + enc(id) + "&scope=" + enc(ESCOPO), null);
        JSONObject j = r.json();
        if (r.status != 200) throw new IOException("O Google recusou: " + descricaoErro(j));
        String deviceCode = j.getString("device_code");
        long expira = SystemClock.elapsedRealtime() + j.optLong("expires_in", 1800) * 1000;
        long intervalo = j.optLong("interval", 5) * 1000;
        JSONObject c = new JSONObject()
                .put("estado", "aguardando")
                .put("codigo", j.getString("user_code"))
                .put("url", j.optString("verification_url", j.optString("verification_uri", "https://www.google.com/device")));
        conexao = c;
        login.execute(() -> aguardarConfirmacao(id, segredo, deviceCode, intervalo, expira, c));
        return c;
    }

    private void aguardarConfirmacao(String id, String segredo, String deviceCode, long intervalo, long expira, JSONObject c) {
        long espera = intervalo;
        try {
            while (SystemClock.elapsedRealtime() < expira && conexao == c) {
                Thread.sleep(espera);
                Retorno r = chamar("POST", URL_TOKEN, "application/x-www-form-urlencoded",
                        "client_id=" + enc(id) + "&client_secret=" + enc(segredo) + "&device_code=" + enc(deviceCode)
                                + "&grant_type=" + enc("urn:ietf:params:oauth:grant-type:device_code"), null);
                JSONObject j = r.json();
                if (r.status == 200) {
                    Config.texto(contexto, "yt_refresh", j.optString("refresh_token", null));
                    acesso = j.getString("access_token");
                    acessoAte = SystemClock.elapsedRealtime() + (j.optLong("expires_in", 3600) - 300) * 1000;
                    carregarCanal();
                    conexao = new JSONObject().put("estado", "conectado");
                    return;
                }
                String erro = j.optString("error");
                if ("authorization_pending".equals(erro)) continue;
                if ("slow_down".equals(erro)) {
                    espera += 5000;
                    continue;
                }
                conexao = new JSONObject().put("estado", "erro").put("erro",
                        "access_denied".equals(erro) ? "Você recusou o acesso no Google." : "O Google recusou: " + descricaoErro(j));
                return;
            }
            if (conexao == c) conexao = new JSONObject().put("estado", "erro").put("erro", "O código expirou. Tente de novo.");
        } catch (Exception e) {
            Log.w(TAG, "login", e);
            try {
                conexao = new JSONObject().put("estado", "erro").put("erro", "Sem conexão com o Google: " + e.getMessage());
            } catch (JSONException ignorado) {
                // nada
            }
        }
    }

    private void carregarCanal() {
        try {
            JSONObject j = api("GET", API + "/channels?part=snippet&mine=true", null);
            JSONArray itens = j.optJSONArray("items");
            if (itens != null && itens.length() > 0) {
                Config.texto(contexto, "yt_canal", itens.getJSONObject(0).getJSONObject("snippet").optString("title"));
            }
        } catch (Exception e) {
            Log.w(TAG, "canal", e);
        }
    }

    JSONArray playlists() throws IOException, JSONException {
        JSONObject j = api("GET", API + "/playlists?part=snippet&mine=true&maxResults=50", null);
        JSONArray saida = new JSONArray();
        JSONArray itens = j.optJSONArray("items");
        if (itens == null) return saida;
        for (int i = 0; i < itens.length(); i++) {
            JSONObject it = itens.getJSONObject(i);
            saida.put(new JSONObject().put("id", it.getString("id"))
                    .put("titulo", it.getJSONObject("snippet").optString("title")));
        }
        return saida;
    }

    private synchronized String token() throws IOException {
        if (acesso != null && SystemClock.elapsedRealtime() < acessoAte) return acesso;
        String refresh = valor("yt_refresh");
        if (refresh == null) throw new Definitivo("Conecte o YouTube nos Ajustes.");
        Retorno r = chamar("POST", URL_TOKEN, "application/x-www-form-urlencoded",
                "client_id=" + enc(valor("yt_client_id")) + "&client_secret=" + enc(valor("yt_client_secret"))
                        + "&refresh_token=" + enc(refresh) + "&grant_type=refresh_token", null);
        JSONObject j = r.json();
        if (r.status != 200) {
            if ("invalid_grant".equals(j.optString("error"))) {
                Config.texto(contexto, "yt_refresh", null);
                throw new Definitivo("O acesso ao YouTube expirou ou foi removido. Conecte de novo nos Ajustes.");
            }
            throw new IOException("O Google recusou o acesso: " + descricaoErro(j));
        }
        try {
            acesso = j.getString("access_token");
        } catch (JSONException e) {
            throw new IOException("resposta sem token");
        }
        acessoAte = SystemClock.elapsedRealtime() + (j.optLong("expires_in", 3600) - 300) * 1000;
        return acesso;
    }

    private JSONObject api(String metodo, String url, JSONObject corpo) throws IOException {
        Retorno r = chamar(metodo, url, corpo == null ? null : "application/json; charset=utf-8",
                corpo == null ? null : corpo.toString(), token());
        if (r.status == 401) {
            acesso = null;
            r = chamar(metodo, url, corpo == null ? null : "application/json; charset=utf-8",
                    corpo == null ? null : corpo.toString(), token());
        }
        if (r.status < 200 || r.status >= 300) throw new IOException(descricaoErro(r.json()));
        return r.json();
    }

    // ---------- publicação ----------

    /** Coloca o vídeo na fila. {@code pedido}: titulo, descricao, tags[], privacidade, playlistId, thumb. */
    void publicar(String nome, JSONObject pedido) throws JSONException {
        JSONObject pub = new JSONObject()
                .put("status", "fila")
                .put("progresso", 0)
                .put("titulo", pedido.optString("titulo"))
                .put("pedido", pedido);
        Videos.atualizarMeta(contexto, nome, "publicacao", pub);
        fila.execute(() -> enviar(nome));
    }

    /** Ao religar o serviço, retoma o que estava na fila ou no meio do envio. */
    void retomarPendentes() {
        File[] arquivos = Videos.pasta(contexto).listFiles((d, n) -> n.endsWith(".mp4"));
        if (arquivos == null) return;
        for (File f : arquivos) {
            JSONObject pub = Videos.meta(contexto, f.getName()).optJSONObject("publicacao");
            if (pub == null) continue;
            String s = pub.optString("status");
            if ("fila".equals(s) || "enviando".equals(s) || "thumb".equals(s)) {
                String nome = f.getName();
                fila.execute(() -> enviar(nome));
            }
        }
    }

    private void enviar(String nome) {
        File video = Videos.arquivo(contexto, nome);
        if (video == null) return;
        JSONObject pub = Videos.meta(contexto, nome).optJSONObject("publicacao");
        if (pub == null) return;
        try {
            JSONObject pedido = pub.getJSONObject("pedido");
            String videoId = pub.optString("videoId", null);
            if (videoId == null) {
                String sessao = pub.optString("sessao", null);
                if (sessao == null) {
                    sessao = abrirSessao(video, pedido);
                    pub.put("sessao", sessao);
                }
                pub.put("status", "enviando");
                Videos.atualizarMeta(contexto, nome, "publicacao", pub);
                videoId = subir(video, sessao, pub, nome);
                pub.put("videoId", videoId);
                pub.put("url", "https://youtu.be/" + videoId);
                pub.remove("sessao");
            }
            pub.put("status", "thumb").put("progresso", 100);
            Videos.atualizarMeta(contexto, nome, "publicacao", pub);

            StringBuilder avisos = new StringBuilder();
            String thumb = pedido.optString("thumb", "");
            if (!thumb.isEmpty() && !pub.optBoolean("thumbOk")) {
                try {
                    enviarThumb(videoId, thumb);
                    pub.put("thumbOk", true);
                } catch (IOException e) {
                    avisos.append("Thumb não aplicada: ").append(e.getMessage()).append(' ');
                }
            }
            String playlist = pedido.optString("playlistId", "");
            if (!playlist.isEmpty() && !pub.optBoolean("playlistOk")) {
                try {
                    api("POST", API + "/playlistItems?part=snippet", new JSONObject().put("snippet",
                            new JSONObject().put("playlistId", playlist).put("resourceId",
                                    new JSONObject().put("kind", "youtube#video").put("videoId", videoId))));
                    pub.put("playlistOk", true);
                } catch (IOException e) {
                    avisos.append("Playlist não aplicada: ").append(e.getMessage());
                }
            }
            pub.put("status", "publicado");
            if (avisos.length() > 0) pub.put("aviso", avisos.toString().trim());
            pub.remove("erro");
            Videos.atualizarMeta(contexto, nome, "publicacao", pub);
        } catch (Exception e) {
            Log.w(TAG, "publicar " + nome, e);
            try {
                pub.put("status", "erro").put("erro", e.getMessage() == null ? e.toString() : e.getMessage());
                Videos.atualizarMeta(contexto, nome, "publicacao", pub);
            } catch (JSONException ignorado) {
                // nada
            }
        }
    }

    private String abrirSessao(File video, JSONObject pedido) throws IOException, JSONException {
        JSONObject snippet = new JSONObject()
                .put("title", limpar(pedido.optString("titulo"), 100))
                .put("description", limpar(pedido.optString("descricao"), 4900))
                .put("categoryId", "10");
        JSONArray tags = pedido.optJSONArray("tags");
        if (tags != null && tags.length() > 0) snippet.put("tags", tags);
        String privacidade = pedido.optString("privacidade", "private");
        if (!privacidade.equals("public") && !privacidade.equals("unlisted")) privacidade = "private";
        JSONObject corpo = new JSONObject()
                .put("snippet", snippet)
                .put("status", new JSONObject().put("privacyStatus", privacidade).put("selfDeclaredMadeForKids", false));

        for (int tentativa = 0; ; tentativa++) {
            HttpURLConnection c = abrir("POST",
                    API_UPLOAD + "/videos?uploadType=resumable&part=snippet,status", token());
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("X-Upload-Content-Length", String.valueOf(video.length()));
            c.setRequestProperty("X-Upload-Content-Type", "video/mp4");
            c.setDoOutput(true);
            byte[] b = corpo.toString().getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(b.length);
            try (OutputStream out = c.getOutputStream()) {
                out.write(b);
            }
            int status = c.getResponseCode();
            if (status == 200) {
                String local = c.getHeaderField("Location");
                c.disconnect();
                if (local == null) throw new IOException("O YouTube não devolveu o endereço de envio.");
                return local;
            }
            String erro = descricaoErro(new Retorno(status, lerCorpo(c)).json());
            c.disconnect();
            if (status == 401 && tentativa == 0) {
                acesso = null;
                continue;
            }
            throw new IOException(erro);
        }
    }

    /** Envio retomável: se a conexão cair, pergunta ao YouTube até onde chegou e continua de lá. */
    private String subir(File video, String sessao, JSONObject pub, String nome) throws IOException, JSONException, InterruptedException {
        long total = video.length();
        long inicio = 0;
        int falhas = 0;
        while (true) {
            try {
                HttpURLConnection c = abrir("PUT", sessao, token());
                c.setRequestProperty("Content-Type", "video/mp4");
                if (inicio > 0) c.setRequestProperty("Content-Range", "bytes " + inicio + "-" + (total - 1) + "/" + total);
                c.setDoOutput(true);
                c.setFixedLengthStreamingMode(total - inicio);
                long ultimo = 0;
                try (InputStream in = new FileInputStream(video); OutputStream out = c.getOutputStream()) {
                    long pular = inicio;
                    while (pular > 0) {
                        long n = in.skip(pular);
                        if (n <= 0) throw new IOException("skip");
                        pular -= n;
                    }
                    byte[] buf = new byte[256 * 1024];
                    long enviado = inicio;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        enviado += n;
                        long agora = SystemClock.elapsedRealtime();
                        if (agora - ultimo > 2000) {
                            ultimo = agora;
                            pub.put("progresso", (int) (enviado * 99 / total));
                            Videos.atualizarMeta(contexto, nome, "publicacao", pub);
                        }
                    }
                }
                int status = c.getResponseCode();
                String texto = lerCorpo(c);
                c.disconnect();
                if (status == 200 || status == 201) return new JSONObject(texto).getString("id");
                if (status == 401) acesso = null;
                else if (status >= 400 && status < 500 && status != 408 && status != 429) {
                    throw new Definitivo(descricaoErro(new Retorno(status, texto).json()));
                }
            } catch (IOException e) {
                if (e instanceof Definitivo) throw e;
                Log.w(TAG, "envio interrompido", e);
            }
            if (++falhas > 30) throw new IOException("O envio falhou várias vezes. Confira a internet e tente de novo.");
            Thread.sleep(Math.min(60_000, 2000L * falhas));
            long onde = consultar(sessao, total);
            if (onde == -2) {
                // terminou entre a queda e a consulta: a consulta não devolve o id, então pede de novo com o resto vazio
                inicio = total;
            } else {
                inicio = onde;
            }
            if (inicio >= total) {
                String id = finalizar(sessao, total);
                if (id != null) return id;
                inicio = 0;
            }
        }
    }

    /** Até onde o YouTube recebeu: próximo byte a mandar, ou -2 se já recebeu tudo. */
    private long consultar(String sessao, long total) {
        try {
            HttpURLConnection c = abrir("PUT", sessao, token());
            c.setRequestProperty("Content-Range", "bytes */" + total);
            c.setDoOutput(true);
            c.setFixedLengthStreamingMode(0);
            c.getOutputStream().close();
            int status = c.getResponseCode();
            String range = c.getHeaderField("Range");
            c.disconnect();
            if (status == 200 || status == 201) return -2;
            if (status == 308 && range != null && range.contains("-")) {
                return Long.parseLong(range.substring(range.indexOf('-') + 1).trim()) + 1;
            }
            return 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private String finalizar(String sessao, long total) {
        try {
            HttpURLConnection c = abrir("PUT", sessao, token());
            c.setRequestProperty("Content-Range", "bytes */" + total);
            c.setDoOutput(true);
            c.setFixedLengthStreamingMode(0);
            c.getOutputStream().close();
            int status = c.getResponseCode();
            String texto = lerCorpo(c);
            c.disconnect();
            if (status == 200 || status == 201) return new JSONObject(texto).getString("id");
        } catch (Exception e) {
            Log.w(TAG, "finalizar", e);
        }
        return null;
    }

    private void enviarThumb(String videoId, String nomeThumb) throws IOException {
        File f = Videos.thumb(contexto, nomeThumb);
        if (f == null) throw new IOException("a imagem não existe mais");
        byte[] imagem = Videos.ler(f);
        for (int tentativa = 0; tentativa < 2; tentativa++) {
            HttpURLConnection c = abrir("POST", API_UPLOAD + "/thumbnails/set?videoId=" + enc(videoId), token());
            c.setRequestProperty("Content-Type", nomeThumb.endsWith(".png") ? "image/png" : "image/jpeg");
            c.setDoOutput(true);
            c.setFixedLengthStreamingMode(imagem.length);
            try (OutputStream out = c.getOutputStream()) {
                out.write(imagem);
            }
            int status = c.getResponseCode();
            String texto = lerCorpo(c);
            c.disconnect();
            if (status == 200) return;
            if (status == 401) {
                acesso = null;
                continue;
            }
            JSONObject j = new Retorno(status, texto).json();
            if (status == 403) {
                throw new IOException("o YouTube só aceita thumb personalizada em canal verificado por telefone (" + descricaoErro(j) + ")");
            }
            throw new IOException(descricaoErro(j));
        }
        throw new IOException("acesso recusado");
    }

    // ---------- HTTP ----------

    private static final class Retorno {
        final int status;
        final String texto;

        Retorno(int status, String texto) {
            this.status = status;
            this.texto = texto;
        }

        JSONObject json() {
            try {
                return new JSONObject(texto);
            } catch (JSONException e) {
                return new JSONObject();
            }
        }
    }

    private static HttpURLConnection abrir(String metodo, String url, String token) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(metodo);
        c.setConnectTimeout(30_000);
        c.setReadTimeout(300_000);
        if (token != null) c.setRequestProperty("Authorization", "Bearer " + token);
        return c;
    }

    private static Retorno chamar(String metodo, String url, String tipo, String corpo, String token) throws IOException {
        HttpURLConnection c = abrir(metodo, url, token);
        try {
            if (corpo != null) {
                byte[] b = corpo.getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", tipo);
                c.setFixedLengthStreamingMode(b.length);
                try (OutputStream out = c.getOutputStream()) {
                    out.write(b);
                }
            }
            int status = c.getResponseCode();
            return new Retorno(status, lerCorpo(c));
        } finally {
            c.disconnect();
        }
    }

    private static String lerCorpo(HttpURLConnection c) throws IOException {
        InputStream in;
        try {
            in = c.getInputStream();
        } catch (IOException e) {
            in = c.getErrorStream();
        }
        if (in == null) return "";
        try (InputStream entrada = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = entrada.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    private static String descricaoErro(JSONObject j) {
        Object erro = j.opt("error");
        if (erro instanceof JSONObject) {
            JSONObject e = (JSONObject) erro;
            JSONArray lista = e.optJSONArray("errors");
            String motivo = lista != null && lista.length() > 0 ? lista.optJSONObject(0).optString("reason") : "";
            if ("quotaExceeded".equals(motivo)) return "A cota diária da API do YouTube acabou. Tente amanhã.";
            if ("uploadLimitExceeded".equals(motivo)) return "O canal atingiu o limite de envios do dia.";
            return e.optString("message", motivo);
        }
        String d = j.optString("error_description", "");
        if (!d.isEmpty()) return d;
        return erro == null ? "erro desconhecido" : erro.toString();
    }

    /** O YouTube recusa "<" e ">" no título e na descrição. */
    private static String limpar(String s, int max) {
        String t = s == null ? "" : s.replace("<", "").replace(">", "").trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private String valor(String chave) {
        return Config.texto(contexto, chave);
    }

    private static String vazioParaNull(String s) {
        return s == null || s.trim().isEmpty() ? null : s.trim();
    }

    private static String enc(String s) {
        try {
            return URLEncoder.encode(s == null ? "" : s, "UTF-8");
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
