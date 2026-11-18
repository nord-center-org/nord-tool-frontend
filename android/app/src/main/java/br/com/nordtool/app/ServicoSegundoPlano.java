package br.com.nordtool.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;

/**
 * Mantém o NordTool ativo em segundo plano: a cada 30 segundos lê a caixa de notificações da pessoa (avisos do
 * cronograma, do SAC e, para administradores, as alterações feitas por qualquer pessoa, com o nome de quem fez) e
 * mostra cada aviso novo nas notificações do celular. Volta sozinho depois de reiniciar o celular.
 */
public class ServicoSegundoPlano extends Service {

    static final String CANAL_SERVICO = "segundo_plano";
    static final String CANAL_AVISOS = "avisos";
    static final String EXTRA_URL = "url";
    private static final int ID_SERVICO = 1;
    private static final int ID_DESCONECTADO = 2;
    private static final long INTERVALO_MS = 30_000;
    private static final long INTERVALO_MAXIMO_MS = 5 * 60_000;

    private volatile boolean rodando;
    private Thread laco;
    private String acesso;
    /** Quando o token de acesso vence (relógio do celular, em ms); o app pede outro um minuto antes. */
    private long acessoAte;

    /** Liga o serviço (se houver aparelho registrado). */
    static void iniciar(Context contexto) {
        if (!new Armazenamento(contexto).temAparelho()) return;
        Intent intencao = new Intent(contexto, ServicoSegundoPlano.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) contexto.startForegroundService(intencao);
            else contexto.startService(intencao);
        } catch (RuntimeException ignorado) {
            // o Android pode recusar iniciar em segundo plano; o app tenta de novo ao abrir
        }
    }

    static void parar(Context contexto) {
        contexto.stopService(new Intent(contexto, ServicoSegundoPlano.class));
    }

    static void criarCanais(Context contexto) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = contexto.getSystemService(NotificationManager.class);
        NotificationChannel servico = new NotificationChannel(CANAL_SERVICO, "NordTool ativo", NotificationManager.IMPORTANCE_MIN);
        servico.setDescription("Mantém o NordTool acompanhando os avisos em segundo plano.");
        servico.setShowBadge(false);
        nm.createNotificationChannel(servico);
        NotificationChannel avisos = new NotificationChannel(CANAL_AVISOS, "Avisos do NordTool", NotificationManager.IMPORTANCE_HIGH);
        avisos.setDescription("Demandas, SAC e alterações feitas no NordTool.");
        nm.createNotificationChannel(avisos);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        criarCanais(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification fixa = construtor(CANAL_SERVICO)
                .setContentTitle("NordTool ativo")
                .setContentText("Acompanhando os avisos em segundo plano")
                .setContentIntent(abrir(this, null, 0))
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(ID_SERVICO, fixa, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(ID_SERVICO, fixa);
        }
        if (!new Armazenamento(this).temAparelho()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (laco == null || !laco.isAlive()) {
            rodando = true;
            laco = new Thread(this::rodar, "nordtool-avisos");
            laco.start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        rodando = false;
        if (laco != null) laco.interrupt();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void rodar() {
        long espera = INTERVALO_MS;
        while (rodando) {
            try {
                verificar();
                espera = INTERVALO_MS;
            } catch (Api.Desconectado e) {
                desconectado();
                return;
            } catch (IOException | RuntimeException e) {
                // sem rede ou servidor fora: tenta de novo, cada vez um pouco mais espaçado
                espera = Math.min(INTERVALO_MAXIMO_MS, espera * 2);
            }
            try {
                Thread.sleep(espera);
            } catch (InterruptedException e) {
                return;
            }
        }
    }

    private void verificar() throws IOException, Api.Desconectado {
        Armazenamento dados = new Armazenamento(this);
        String api = dados.api();
        String token = dados.token();
        if (api == null || token == null) {
            rodando = false;
            stopSelf();
            return;
        }
        if (acesso == null || System.currentTimeMillis() > acessoAte) renovarAcesso(api, token);
        JSONObject caixa = Api.caixa(api, acesso, dados.ultimo());
        if (caixa == null) {
            // token de acesso recusado (sessão encerrada): pede outro na próxima volta
            acesso = null;
            return;
        }
        long ultimo = caixa.optLong("nrUltimo", 0);
        JSONArray itens = caixa.optJSONArray("itens");
        long lido = dados.ultimo() < 0 ? ultimo : dados.ultimo();
        if (itens != null) {
            for (int i = 0; i < itens.length(); i++) {
                JSONObject item = itens.optJSONObject(i);
                if (item == null) continue;
                mostrar(item);
                lido = Math.max(lido, item.optLong("nrSeq", lido));
            }
            // Mais de uma página de avisos: continua de onde parou; senão, do fim da caixa.
            if (itens.length() < 50) lido = Math.max(lido, ultimo);
        }
        dados.ultimo(lido);
    }

    private void renovarAcesso(String api, String token) throws IOException, Api.Desconectado {
        JSONObject sessao = Api.entrar(api, token);
        acesso = sessao.optString("token", null);
        // Duração do token (minutos) contada pelo relógio do celular: não depende do celular estar com a hora certa.
        long minutos = Math.max(2, sessao.optLong("inatividadeMinutos", 10));
        acessoAte = System.currentTimeMillis() + (minutos - 1) * 60_000L;
    }

    private void mostrar(JSONObject item) {
        long id = item.optLong("id");
        String titulo = item.optString("txTitulo", "NordTool");
        String corpo = item.optString("txCorpo", "");
        String url = item.isNull("txUrl") ? null : item.optString("txUrl", null);
        int idNotificacao = (int) (100 + (id % 1_000_000_000L));
        Notification n = construtor(CANAL_AVISOS)
                .setContentTitle(titulo)
                .setContentText(corpo)
                .setStyle(new Notification.BigTextStyle().bigText(corpo))
                .setContentIntent(abrir(this, url, idNotificacao))
                .setAutoCancel(true)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true)
                .build();
        notificar(idNotificacao, n);
    }

    private void desconectado() {
        new Armazenamento(this).esquecer();
        notificar(ID_DESCONECTADO, construtor(CANAL_AVISOS)
                .setContentTitle("NordTool desconectado")
                .setContentText("Entre de novo com a sua senha para voltar a receber os avisos.")
                .setContentIntent(abrir(this, null, ID_DESCONECTADO))
                .setAutoCancel(true)
                .build());
        rodando = false;
        stopForeground(true);
        stopSelf();
    }

    private void notificar(int id, Notification n) {
        try {
            getSystemService(NotificationManager.class).notify(id, n);
        } catch (SecurityException ignorado) {
            // sem permissão de notificação (Android 13+): a pessoa liga nas configurações
        }
    }

    private Notification.Builder construtor(String canal) {
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, canal) : new Notification.Builder(this);
        return b.setSmallIcon(R.drawable.ic_notificacao).setColor(0xFF2563EB);
    }

    static PendingIntent abrir(Context contexto, String url, int pedido) {
        Intent intencao = new Intent(contexto, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (url != null && url.startsWith("/")) intencao.putExtra(EXTRA_URL, url);
        return PendingIntent.getActivity(contexto, pedido, intencao, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
