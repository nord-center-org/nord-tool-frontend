package br.com.nordtool.app;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Dados do app no armazenamento privado do celular (outros apps não leem): o token do aparelho, a URL da API e até
 * onde a caixa de notificações já foi lida.
 */
final class Armazenamento {

    private static final String ARQUIVO = "nordtool";
    private final SharedPreferences prefs;

    Armazenamento(Context contexto) {
        prefs = contexto.getApplicationContext().getSharedPreferences(ARQUIVO, Context.MODE_PRIVATE);
    }

    String token() { return prefs.getString("token", null); }

    String api() { return prefs.getString("api", null); }

    boolean temAparelho() { return token() != null && api() != null; }

    void guardar(String token, String api) {
        prefs.edit().putString("token", token).putString("api", api).putLong("ultimo", -1).apply();
    }

    void esquecer() { prefs.edit().remove("token").remove("ultimo").apply(); }

    long ultimo() { return prefs.getLong("ultimo", -1); }

    void ultimo(long valor) { prefs.edit().putLong("ultimo", valor).apply(); }

    boolean pediuBateria() { return prefs.getBoolean("pediuBateria", false); }

    void pediuBateria(boolean valor) { prefs.edit().putBoolean("pediuBateria", valor).apply(); }
}
