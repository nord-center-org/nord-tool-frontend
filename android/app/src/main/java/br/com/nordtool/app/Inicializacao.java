package br.com.nordtool.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Liga o serviço em segundo plano quando o celular reinicia ou o app é atualizado. */
public class Inicializacao extends BroadcastReceiver {
    @Override
    public void onReceive(Context contexto, Intent intencao) {
        String acao = intencao.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(acao) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(acao)
                || "android.intent.action.QUICKBOOT_POWERON".equals(acao)) {
            ServicoSegundoPlano.iniciar(contexto);
            // A câmera ao vivo estava ligada antes da atualização/reinício: volta sozinha (app 12.0).
            ServicoAoVivo.religarSePrecisar(contexto);
        }
    }
}
