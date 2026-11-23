package br.com.nordtool.app.drumcam;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** Tela do celular-câmera: liga o serviço e mostra o endereço e o PIN para o controle. */
public class CameraActivity extends Activity {

    private TextView situacao;
    private TextView endereco;
    private Button bateria;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable atualizar = new Runnable() {
        @Override
        public void run() {
            mostrar();
            handler.postDelayed(this, 2000);
        }
    };

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        // Este celular passa a ser câmera: volta sozinho como câmera quando o celular religar.
        Config.modo(this, Config.MODO_CAMERA);
        LinearLayout col = Ui.coluna(this);
        Ui.titulo(this, col, "📷 Modo câmera");
        situacao = Ui.texto(this, col, "", 18, Ui.TEXTO);
        endereco = Ui.texto(this, col, "", 30, Ui.TEXTO);
        Ui.texto(this, col, "No outro celular, abra o Drumcam no modo controle: esta câmera aparece sozinha na lista. "
                + "Se não aparecer, digite o endereço acima. O PIN protege a câmera de quem estiver no mesmo Wi-Fi.", 15, Ui.SUAVE);
        Ui.texto(this, col, "Dicas: deixe na tomada e com o iRig ligado antes de gravar. Pode apagar a tela e sair "
                + "deste app; a câmera continua pronta (veja a notificação).", 15, Ui.SUAVE);
        bateria = Ui.botao(this, col, "Não deixar o Android desligar o app", Ui.CARTAO, v -> pedirSemEconomia());
        Ui.botao(this, col, "Parar o modo câmera", Ui.CARTAO, v -> {
            Config.modo(this, null);
            ServicoCamera.parar(this);
            handler.postDelayed(this::mostrar, 500);
        });
        Ui.botao(this, col, "Voltar ao NordTool", Ui.CARTAO, v -> finish());
        pedirPermissoes();
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(atualizar);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(atualizar);
        super.onPause();
    }

    private void pedirPermissoes() {
        if (Build.VERSION.SDK_INT < 23) {
            ligar();
            return;
        }
        List<String> faltam = new ArrayList<>();
        faltam.add(Manifest.permission.CAMERA);
        faltam.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT >= 33) faltam.add(Manifest.permission.POST_NOTIFICATIONS);
        List<String> pedir = new ArrayList<>();
        for (String p : faltam) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) pedir.add(p);
        if (pedir.isEmpty()) ligar();
        else requestPermissions(pedir.toArray(new String[0]), 1);
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permissoes, int[] resultados) {
        if (Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            ligar();
        } else {
            situacao.setText("Sem permissão de câmera e microfone o modo câmera não funciona. Toque para tentar de novo.");
            situacao.setOnClickListener(v -> pedirPermissoes());
        }
    }

    private void ligar() {
        ServicoCamera.iniciar(this);
        handler.postDelayed(this::mostrar, 800);
    }

    private void mostrar() {
        if (ServicoCamera.ativo) {
            situacao.setText("✅ Pronto e esperando o controle");
            endereco.setText(ServicoCamera.ip() + ":" + ServicoCamera.porta + "\nPIN " + Config.pin(this));
        } else {
            situacao.setText("Câmera desligada. Toque para ligar.");
            situacao.setOnClickListener(v -> pedirPermissoes());
            endereco.setText("");
        }
        bateria.setVisibility(semEconomia() ? android.view.View.GONE : android.view.View.VISIBLE);
    }

    private boolean semEconomia() {
        if (Build.VERSION.SDK_INT < 23) return true;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    @SuppressLint("BatteryLife")
    private void pedirSemEconomia() {
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + getPackageName())));
        } catch (RuntimeException e) {
            startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
    }
}
