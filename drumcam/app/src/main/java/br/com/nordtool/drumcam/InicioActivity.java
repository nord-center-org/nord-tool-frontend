package br.com.nordtool.drumcam;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.LinearLayout;

/** Primeira tela: escolhe se este celular é a câmera ou o controle (fica lembrado). */
public class InicioActivity extends Activity {

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        boolean escolher = getIntent().getBooleanExtra("escolher", false);
        String modo = Config.modo(this);
        if (!escolher && modo != null) {
            abrir(modo);
            return;
        }
        LinearLayout col = Ui.coluna(this);
        Ui.titulo(this, col, "Drumcam");
        Ui.texto(this, col, "Use um celular parado como câmera e outro para controlar: gravar, parar, ver os vídeos "
                + "e publicar no YouTube. Os dois precisam estar no mesmo Wi-Fi.", 16, Ui.SUAVE);
        Ui.texto(this, col, "O que este celular vai ser?", 18, Ui.TEXTO);
        Ui.botao(this, col, "📷  Câmera  (fica parado gravando)", Ui.VERMELHO, v -> escolher(Config.MODO_CAMERA));
        Ui.botao(this, col, "🎮  Controle  (o seu celular)", Ui.CARTAO, v -> escolher(Config.MODO_CONTROLE));
    }

    private void escolher(String modo) {
        if (!Config.MODO_CAMERA.equals(modo) && ServicoCamera.ativo) ServicoCamera.parar(this);
        Config.modo(this, modo);
        abrir(modo);
    }

    private void abrir(String modo) {
        Class<?> tela = Config.MODO_CAMERA.equals(modo) ? CameraActivity.class : ControleActivity.class;
        startActivity(new Intent(this, tela));
        finish();
    }
}
