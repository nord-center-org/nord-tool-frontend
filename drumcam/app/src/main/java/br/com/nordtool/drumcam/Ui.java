package br.com.nordtool.drumcam;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Telas nativas simples, montadas em código (sem XML nem bibliotecas). */
final class Ui {

    static final int FUNDO = Color.parseColor("#0f0f0f");
    static final int CARTAO = Color.parseColor("#212121");
    static final int TEXTO = Color.WHITE;
    static final int SUAVE = Color.parseColor("#aaaaaa");
    static final int VERMELHO = Color.parseColor("#ff3b30");

    private Ui() {
    }

    static int dp(Activity a, float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, a.getResources().getDisplayMetrics());
    }

    /** Coluna rolável que vira o conteúdo da tela. */
    static LinearLayout coluna(Activity a) {
        ScrollView rolagem = new ScrollView(a);
        rolagem.setBackgroundColor(FUNDO);
        rolagem.setFillViewport(true);
        LinearLayout col = new LinearLayout(a);
        col.setOrientation(LinearLayout.VERTICAL);
        int m = dp(a, 20);
        col.setPadding(m, dp(a, 32), m, m);
        rolagem.addView(col);
        a.setContentView(rolagem);
        return col;
    }

    static TextView titulo(Activity a, LinearLayout col, String texto) {
        TextView t = texto(a, col, texto, 26, TEXTO);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    static TextView texto(Activity a, LinearLayout col, String texto, float tamanho, int cor) {
        TextView t = new TextView(a);
        t.setText(texto);
        t.setTextSize(tamanho);
        t.setTextColor(cor);
        t.setPadding(0, dp(a, 6), 0, dp(a, 6));
        col.addView(t);
        return t;
    }

    static Button botao(Activity a, LinearLayout col, String texto, int cor, View.OnClickListener acao) {
        Button b = new Button(a);
        b.setText(texto);
        b.setAllCaps(false);
        b.setTextSize(17);
        b.setTextColor(Color.WHITE);
        b.setGravity(Gravity.CENTER);
        GradientDrawable fundo = new GradientDrawable();
        fundo.setColor(cor);
        fundo.setCornerRadius(dp(a, 14));
        b.setBackground(fundo);
        b.setPadding(dp(a, 16), dp(a, 14), dp(a, 16), dp(a, 14));
        b.setOnClickListener(acao);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(a, 12);
        col.addView(b, lp);
        return b;
    }
}
