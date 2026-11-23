package br.com.nordtool.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

/**
 * Drumcam v4 (app 9.0): enquanto o celular é câmera ao vivo do Estúdio, a câmera da página continua no ar com a tela
 * apagada ou com o app em segundo plano. Este serviço em primeiro plano (tipo câmera e microfone, com a notificação
 * "Câmera ao vivo no ar") é o que o Android exige para a câmera seguir ligada fora da tela; ele também segura a CPU
 * e o Wi-Fi. A página continua "visível" para o WebView ({@link MainActivity}), então o vídeo e o relé não param.
 */
public class ServicoAoVivo extends Service {

    private static final String TAG = "NordToolAoVivo";
    private static final String CANAL = "aovivo";
    private static final int NOTIFICACAO = 9;

    /** A página pediu para ficar no ar (a MainActivity lê para manter o WebView acordado). */
    static volatile boolean ativo;

    private PowerManager.WakeLock travaCpu;
    private WifiManager.WifiLock travaWifi;

    /** Liga ou desliga. Ligar só funciona com o app na frente (regra do Android para câmera em segundo plano). */
    static void ligar(Context contexto, boolean ligar, String nome) {
        Intent i = new Intent(contexto, ServicoAoVivo.class);
        if (!ligar) {
            ativo = false;
            contexto.stopService(i);
            return;
        }
        i.putExtra("nome", nome);
        try {
            if (Build.VERSION.SDK_INT >= 26) contexto.startForegroundService(i);
            else contexto.startService(i);
            ativo = true;
        } catch (RuntimeException e) {
            // Sem permissão de câmera ainda, ou o Android não deixou: a câmera segue só com a tela ligada.
            Log.w(TAG, "Não deu para ligar o serviço da câmera ao vivo", e);
            ativo = false;
        }
    }

    @Override
    public int onStartCommand(Intent intencao, int flags, int id) {
        String nome = intencao != null ? intencao.getStringExtra("nome") : null;
        try {
            Notification n = notificacao(nome);
            if (Build.VERSION.SDK_INT >= 30) {
                startForeground(NOTIFICACAO, n,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIFICACAO, n);
            }
        } catch (RuntimeException e) {
            Log.w(TAG, "Serviço da câmera ao vivo recusado pelo Android", e);
            ativo = false;
            stopSelf();
            return START_NOT_STICKY;
        }
        segurar();
        // Se o Android fechar o app, a página (e a câmera) já foram junto: não faz sentido voltar sozinho.
        return START_NOT_STICKY;
    }

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
        if (travaCpu != null && travaCpu.isHeld()) travaCpu.release();
        if (travaWifi != null && travaWifi.isHeld()) travaWifi.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @SuppressWarnings("deprecation")
    private Notification notificacao(String nome) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel(CANAL, "Câmera ao vivo", NotificationManager.IMPORTANCE_LOW));
            b = new Notification.Builder(this, CANAL);
        } else {
            b = new Notification.Builder(this).setPriority(Notification.PRIORITY_LOW);
        }
        int flags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        Intent abrir = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        String texto = nome != null && !nome.isEmpty() ? nome + " · pode apagar a tela" : "Pode apagar a tela; toque para voltar";
        return b.setSmallIcon(R.drawable.ic_notificacao)
                .setContentTitle("Câmera ao vivo no ar")
                .setContentText(texto)
                .setOngoing(true)
                .setContentIntent(PendingIntent.getActivity(this, 1, abrir, flags))
                .build();
    }
}
