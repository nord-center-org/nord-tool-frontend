package br.com.nordtool.app.drumcam;

import android.content.Context;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.os.Environment;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.regex.Pattern;

/**
 * Os vídeos gravados ficam na pasta do app (Android/data/.../files/Movies), sem pedir permissão de
 * armazenamento. Cada vídeo tem um "nome.json" ao lado com a duração e o andamento da publicação.
 */
final class Videos {

    /** Nomes aceitos vindos da rede: impede sair da pasta ("../"). */
    static final Pattern NOME_SEGURO = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,120}");

    private Videos() {
    }

    static File pasta(Context c) {
        File pasta = c.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        if (pasta == null) pasta = new File(c.getFilesDir(), "videos");
        if (!pasta.exists()) pasta.mkdirs();
        return pasta;
    }

    static File pastaThumbs(Context c) {
        File pasta = new File(c.getFilesDir(), "thumbs");
        if (!pasta.exists()) pasta.mkdirs();
        return pasta;
    }

    static File arquivo(Context c, String nome) {
        if (nome == null || !NOME_SEGURO.matcher(nome).matches() || !nome.endsWith(".mp4")) return null;
        File f = new File(pasta(c), nome);
        return f.exists() ? f : null;
    }

    static File thumb(Context c, String nome) {
        if (nome == null || !NOME_SEGURO.matcher(nome).matches()) return null;
        File f = new File(pastaThumbs(c), nome);
        return f.exists() ? f : null;
    }

    private static File arquivoMeta(Context c, String nome) {
        return new File(pasta(c), nome.replaceAll("\\.mp4$", "") + ".json");
    }

    static synchronized JSONObject meta(Context c, String nome) {
        File f = arquivoMeta(c, nome);
        if (!f.exists()) return new JSONObject();
        try {
            return new JSONObject(new String(ler(f), StandardCharsets.UTF_8));
        } catch (IOException | JSONException e) {
            return new JSONObject();
        }
    }

    static synchronized void salvarMeta(Context c, String nome, JSONObject meta) {
        File f = arquivoMeta(c, nome);
        File tmp = new File(f.getPath() + ".tmp");
        try (OutputStream out = new FileOutputStream(tmp)) {
            out.write(meta.toString().getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            Log.w("Drumcam", "meta", e);
            return;
        }
        if (!tmp.renameTo(f)) tmp.delete();
    }

    /** Junta campos no meta (leitura e escrita na mesma trava). */
    static synchronized JSONObject atualizarMeta(Context c, String nome, Object... chavesValores) {
        JSONObject m = meta(c, nome);
        try {
            for (int i = 0; i + 1 < chavesValores.length; i += 2) {
                m.put((String) chavesValores[i], chavesValores[i + 1]);
            }
        } catch (JSONException e) {
            throw new IllegalArgumentException(e);
        }
        salvarMeta(c, nome, m);
        return m;
    }

    static void completarDuracao(Context c, File video) {
        MediaMetadataRetriever r = new MediaMetadataRetriever();
        try {
            r.setDataSource(video.getAbsolutePath());
            String d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            if (d != null) atualizarMeta(c, video.getName(), "duracaoMs", Long.parseLong(d));
        } catch (RuntimeException e) {
            Log.w("Drumcam", "duração", e);
        } finally {
            try {
                r.release();
            } catch (Exception ignorado) {
                // nada a fazer
            }
        }
    }

    /** Lista do mais novo para o mais antigo. */
    static JSONArray listar(Context c, String gravandoAgora) throws JSONException {
        File[] arquivos = pasta(c).listFiles((d, n) -> n.endsWith(".mp4"));
        JSONArray lista = new JSONArray();
        if (arquivos == null) return lista;
        Arrays.sort(arquivos, (a, b) -> b.getName().compareTo(a.getName()));
        for (File f : arquivos) {
            JSONObject m = meta(c, f.getName());
            boolean gravando = f.getName().equals(gravandoAgora);
            if (!gravando && !m.has("duracaoMs") && f.length() > 0) {
                completarDuracao(c, f);
                m = meta(c, f.getName());
            }
            JSONObject v = new JSONObject()
                    .put("nome", f.getName())
                    .put("tamanho", f.length())
                    .put("data", m.optLong("gravadoEm", f.lastModified()))
                    .put("duracaoMs", m.optLong("duracaoMs", 0))
                    .put("gravando", gravando);
            JSONObject pub = m.optJSONObject("publicacao");
            if (pub != null) {
                JSONObject resumo = new JSONObject();
                for (String k : new String[] {"status", "progresso", "url", "erro", "titulo", "aviso"}) {
                    if (pub.has(k)) resumo.put(k, pub.get(k));
                }
                v.put("publicacao", resumo);
            }
            lista.put(v);
        }
        return lista;
    }

    /** Um quadro do vídeo (JPEG pequeno), guardado em cache. */
    static byte[] quadro(Context c, File video) throws IOException {
        File cache = new File(c.getCacheDir(), video.getName() + ".jpg");
        if (cache.exists() && cache.lastModified() >= video.lastModified()) return ler(cache);
        MediaMetadataRetriever r = new MediaMetadataRetriever();
        try {
            r.setDataSource(video.getAbsolutePath());
            String d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            long meio = d == null ? 0 : Long.parseLong(d) * 1000 / 3;
            Bitmap quadro = r.getFrameAtTime(Math.min(meio, 15_000_000L), MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (quadro == null) throw new IOException("sem quadro");
            int largura = 360;
            Bitmap pequeno = Bitmap.createScaledBitmap(quadro, largura,
                    Math.max(1, quadro.getHeight() * largura / quadro.getWidth()), true);
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            pequeno.compress(Bitmap.CompressFormat.JPEG, 75, saida);
            byte[] jpeg = saida.toByteArray();
            try (OutputStream out = new FileOutputStream(cache)) {
                out.write(jpeg);
            }
            return jpeg;
        } catch (RuntimeException e) {
            throw new IOException("não consegui ler o vídeo", e);
        } finally {
            try {
                r.release();
            } catch (Exception ignorado) {
                // nada a fazer
            }
        }
    }

    static void apagar(Context c, String nome) {
        new File(pasta(c), nome).delete();
        arquivoMeta(c, nome).delete();
        new File(c.getCacheDir(), nome + ".jpg").delete();
    }

    static byte[] ler(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream((int) Math.min(f.length(), 1 << 20));
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }
}
