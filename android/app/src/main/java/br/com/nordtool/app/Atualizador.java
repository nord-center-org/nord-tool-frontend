package br.com.nordtool.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Atualização do app: ao abrir, confere {@code /app/versao.json} no NordTool publicado. Se houver versão nova, baixa o
 * APK sozinho e abre a confirmação de instalação do Android (a pessoa só autoriza). O Android só aceita o APK se for
 * do mesmo pacote e assinado com a mesma chave.
 */
final class Atualizador {

    /** Confere de novo ao voltar para o app só depois deste tempo (ao abrir o app, confere sempre). */
    private static final long INTERVALO_MS = 30 * 60_000L;
    private static final String ACAO_RESULTADO = "br.com.nordtool.app.ATUALIZACAO";
    private static volatile boolean emAndamento;
    private static volatile long ultimaVerificacao;

    private Atualizador() {
    }

    /** Confere em segundo plano; {@code abrindo} = o app acabou de abrir (ignora o intervalo). */
    static void verificar(Activity tela, boolean abrindo) {
        conferir(tela, abrindo, false);
    }

    /** Botão "Verificar atualizações" das Configurações: confere na hora e sempre responde com um aviso. */
    static void verificarAgora(Activity tela) {
        if (emAndamento) {
            Toast.makeText(tela, "Já estou conferindo a atualização…", Toast.LENGTH_SHORT).show();
            return;
        }
        Toast.makeText(tela, "Conferindo se tem versão nova…", Toast.LENGTH_SHORT).show();
        conferir(tela, true, true);
    }

    /**
     * Botão "Instalar a última versão" (app 10.0+): baixa o APK publicado e manda instalar mesmo que seja a versão que já
     * está no celular (reinstalar por cima). Só não aceita versão mais velha (o Android também não deixaria).
     */
    static void instalarUltima(Activity tela) {
        if (emAndamento) {
            Toast.makeText(tela, "Já estou cuidando da atualização…", Toast.LENGTH_SHORT).show();
            return;
        }
        emAndamento = true;
        Toast.makeText(tela, "Conferindo a última versão…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                Versao publicada = versaoPublicada();
                if (publicada == null || publicada.codigo <= 0) {
                    emAndamento = false;
                    avisar(tela, "Não achei a versão publicada do app. Tente de novo em instantes.");
                    return;
                }
                if (publicada.codigo < BuildConfig.VERSION_CODE) {
                    emAndamento = false;
                    avisar(tela, "Este celular já tem uma versão mais nova (" + BuildConfig.VERSION_NAME + ") que a publicada.");
                    return;
                }
                tela.runOnUiThread(() -> pedirPermissaoOuBaixar(tela, publicada, true));
            } catch (IOException | RuntimeException e) {
                emAndamento = false;
                avisar(tela, "Sem conexão para baixar o app. Tente de novo em instantes.");
            }
        }, "nordtool-reinstalar").start();
    }

    private static void conferir(Activity tela, boolean abrindo, boolean manual) {
        long agora = System.currentTimeMillis();
        if (emAndamento || (!abrindo && agora - ultimaVerificacao < INTERVALO_MS)) return;
        emAndamento = true;
        ultimaVerificacao = agora;
        new Thread(() -> {
            try {
                Versao nova = versaoPublicada();
                if (nova != null && nova.codigo > BuildConfig.VERSION_CODE) {
                    tela.runOnUiThread(() -> pedirPermissaoOuBaixar(tela, nova, false));
                    return;
                }
                if (manual) avisar(tela, "Você já está na versão mais nova (" + BuildConfig.VERSION_NAME + ").");
            } catch (IOException | RuntimeException e) {
                // sem rede: confere de novo na próxima vez
                if (manual) avisar(tela, "Sem conexão para conferir a atualização. Tente de novo em instantes.");
            }
            emAndamento = false;
        }, "nordtool-atualizacao").start();
    }

    private static void avisar(Activity tela, String texto) {
        tela.runOnUiThread(() -> Toast.makeText(tela, texto, Toast.LENGTH_LONG).show());
    }

    static final class Versao {
        final int codigo;
        final String nome;

        Versao(int codigo, String nome) {
            this.codigo = codigo;
            this.nome = nome;
        }
    }

    private static String base() {
        return BuildConfig.ENDERECO.replaceAll("/+$", "");
    }

    static Versao versaoPublicada() throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(base() + "/app/versao.json?t=" + System.currentTimeMillis()).openConnection();
        try {
            c.setConnectTimeout(15_000);
            c.setReadTimeout(15_000);
            c.setUseCaches(false);
            c.setRequestProperty("Cache-Control", "no-cache");
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream saida = new ByteArrayOutputStream()) {
                byte[] b = new byte[4096];
                int n;
                while ((n = in.read(b)) > 0) saida.write(b, 0, n);
                JSONObject json = new JSONObject(saida.toString("UTF-8"));
                return new Versao(json.optInt("versionCode", 0), json.optString("versionName", ""));
            } catch (org.json.JSONException e) {
                // site sem o arquivo (o servidor devolve a página): sem atualização
                return null;
            }
        } finally {
            c.disconnect();
        }
    }

    /** Android 8+: instalar exige a permissão "Instalar apps desconhecidos" para o NordTool (pedida uma vez). */
    private static void pedirPermissaoOuBaixar(Activity tela, Versao nova, boolean mesmaVersao) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !tela.getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(tela)
                    .setTitle("Atualização do NordTool")
                    .setMessage((mesmaVersao ? "Para instalar a versão " + nova.nome + " do app" : "Tem uma versão nova do app (" + nova.nome + "). Para o NordTool se atualizar sozinho")
                            + ", "
                            + "permita \"Instalar apps desconhecidos\" na próxima tela e volte para o app.")
                    .setPositiveButton("Permitir", (d, w) -> {
                        emAndamento = false;
                        ultimaVerificacao = 0;
                        try {
                            tela.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + tela.getPackageName())));
                        } catch (RuntimeException e) {
                            Toast.makeText(tela, "Permita instalar apps do NordTool nas configurações do celular.", Toast.LENGTH_LONG).show();
                        }
                    })
                    .setNegativeButton("Agora não", (d, w) -> emAndamento = false)
                    .setOnCancelListener(d -> emAndamento = false)
                    .show();
            return;
        }
        Toast.makeText(tela, "Baixando a versão " + (mesmaVersao ? "" : "nova ") + "do NordTool (" + nova.nome + ")…", Toast.LENGTH_LONG).show();
        Context app = tela.getApplicationContext();
        new Thread(() -> {
            try {
                File apk = baixar(app);
                PackageInfo info = app.getPackageManager().getPackageArchiveInfo(apk.getPath(), 0);
                if (info == null || !app.getPackageName().equals(info.packageName) || codigo(info) < BuildConfig.VERSION_CODE
                        || (!mesmaVersao && codigo(info) == BuildConfig.VERSION_CODE)) {
                    throw new IOException("APK inválido");
                }
                instalar(app, apk);
            } catch (IOException | RuntimeException e) {
                emAndamento = false;
                tela.runOnUiThread(() -> Toast.makeText(tela, "Não foi possível baixar a atualização. Tento de novo depois.", Toast.LENGTH_LONG).show());
            }
        }, "nordtool-baixar").start();
    }

    @SuppressWarnings("deprecation")
    private static long codigo(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private static File baixar(Context app) throws IOException {
        File destino = new File(app.getCacheDir(), "atualizacao.apk");
        HttpURLConnection c = (HttpURLConnection) new URL(base() + "/app/nordtool.apk?t=" + System.currentTimeMillis()).openConnection();
        try {
            c.setConnectTimeout(15_000);
            c.setReadTimeout(60_000);
            c.setUseCaches(false);
            if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(destino)) {
                byte[] b = new byte[16_384];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
            }
        } finally {
            c.disconnect();
        }
        return destino;
    }

    /** Entrega o APK ao instalador do Android, que mostra a confirmação "Atualizar este app?". */
    private static void instalar(Context app, File apk) throws IOException {
        PackageInstaller instalador = app.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(app.getPackageName());
        int id = instalador.createSession(params);
        try (PackageInstaller.Session sessao = instalador.openSession(id)) {
            try (InputStream in = new FileInputStream(apk); OutputStream out = sessao.openWrite("nordtool.apk", 0, apk.length())) {
                byte[] b = new byte[16_384];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
                sessao.fsync(out);
            }
            Intent resultado = new Intent(app, Resultado.class).setAction(ACAO_RESULTADO);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            sessao.commit(PendingIntent.getBroadcast(app, id, resultado, flags).getIntentSender());
        }
    }

    /** Resposta do instalador: pede a confirmação da pessoa ou avisa se não deu certo. */
    public static class Resultado extends BroadcastReceiver {
        @Override
        public void onReceive(Context contexto, Intent intencao) {
            int status = intencao.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Intent confirmar = intencao.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirmar != null) {
                    confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    contexto.startActivity(confirmar);
                }
                return;
            }
            emAndamento = false;
            if (status != PackageInstaller.STATUS_SUCCESS && status != PackageInstaller.STATUS_FAILURE_ABORTED) {
                Toast.makeText(contexto, "A atualização não foi instalada. Baixe de novo pelo menu do NordTool.", Toast.LENGTH_LONG).show();
            }
        }
    }
}
