package br.com.nordtool.drumcam;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** Celular-câmera religado (queda de energia): volta a ficar pronto sozinho. */
public class Inicializacao extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (!Config.MODO_CAMERA.equals(Config.modo(c))) return;
        try {
            ServicoCamera.iniciar(c);
        } catch (RuntimeException e) {
            // Android 14+ não deixa abrir serviço de câmera sem a pessoa abrir o app: fica para quando abrir.
            Log.w("Drumcam", "não deu para iniciar no boot", e);
        }
    }
}
