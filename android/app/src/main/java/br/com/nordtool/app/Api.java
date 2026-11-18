package br.com.nordtool.app;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Chamadas diretas à API do NordTool (fora da página): sessão pelo aparelho e caixa de notificações. */
final class Api {

    /** O aparelho foi desconectado (senha trocada, saiu da conta, 60 dias sem uso): só entrando de novo. */
    static final class Desconectado extends Exception {
        Desconectado() { super("aparelho desconectado"); }
    }

    private Api() {
    }

    /** Abre uma sessão nova com o token do aparelho; devolve o corpo (o mesmo de /auth/login). */
    static JSONObject entrar(String api, String token) throws IOException, Desconectado {
        Resposta r = chamar("POST", api + "/auth/aparelho/entrar", null, json("txToken", token));
        if (r.status == 401 || r.status == 400) throw new Desconectado();
        return corpo(r);
    }

    static void sair(String api, String token) {
        try {
            chamar("POST", api + "/auth/aparelho/sair", null, json("txToken", token));
        } catch (IOException ignorado) {
            // sem rede: o token para de valer sozinho depois de 60 dias sem uso
        }
    }

    /** Avisos da caixa depois de {@code depois} (negativo: só pergunta de onde começar). null = token recusado. */
    static JSONObject caixa(String api, String acesso, long depois) throws IOException {
        String url = api + "/notificacoes/caixa" + (depois >= 0 ? "?depois=" + depois : "");
        Resposta r = chamar("GET", url, acesso, null);
        if (r.status == 401) return null;
        return corpo(r);
    }

    private static String json(String chave, String valor) {
        try {
            return new JSONObject().put(chave, valor).toString();
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    private static JSONObject corpo(Resposta r) throws IOException {
        if (r.status < 200 || r.status >= 300) throw new IOException("HTTP " + r.status);
        try {
            JSONObject envelope = new JSONObject(r.texto);
            JSONObject corpo = envelope.optJSONObject("body");
            if (corpo == null) throw new IOException("resposta sem corpo");
            return corpo;
        } catch (JSONException e) {
            throw new IOException("resposta inválida", e);
        }
    }

    private static final class Resposta {
        final int status;
        final String texto;

        Resposta(int status, String texto) {
            this.status = status;
            this.texto = texto;
        }
    }

    private static Resposta chamar(String metodo, String endereco, String acesso, String corpo) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(endereco).openConnection();
        try {
            c.setRequestMethod(metodo);
            c.setConnectTimeout(15_000);
            c.setReadTimeout(20_000);
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("User-Agent", "NordToolAndroid/" + BuildConfig.VERSION_NAME);
            if (acesso != null) c.setRequestProperty("Authorization", "Bearer " + acesso);
            if (corpo != null) {
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream saida = c.getOutputStream()) {
                    saida.write(corpo.getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = c.getResponseCode();
            InputStream entrada = status >= 400 ? c.getErrorStream() : c.getInputStream();
            return new Resposta(status, ler(entrada));
        } finally {
            c.disconnect();
        }
    }

    private static String ler(InputStream entrada) throws IOException {
        if (entrada == null) return "";
        try (InputStream in = entrada; ByteArrayOutputStream saida = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) > 0) saida.write(buffer, 0, n);
            return saida.toString("UTF-8");
        }
    }
}
