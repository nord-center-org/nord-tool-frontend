package br.com.nordtool.app.drumcam;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

import java.security.SecureRandom;
import java.util.Iterator;

/** Preferências do app, guardadas só no armazenamento privado de cada celular. */
final class Config {

    static final String MODO_CAMERA = "camera";
    static final String MODO_CONTROLE = "controle";

    private Config() {
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("drumcam", Context.MODE_PRIVATE);
    }

    static String modo(Context c) {
        return prefs(c).getString("modo", null);
    }

    static void modo(Context c, String modo) {
        prefs(c).edit().putString("modo", modo).apply();
    }

    /** PIN de 6 dígitos que o controle precisa para mandar na câmera (gerado uma vez). */
    static synchronized String pin(Context c) {
        String pin = prefs(c).getString("pin", null);
        if (pin == null) {
            pin = novoPin();
            prefs(c).edit().putString("pin", pin).apply();
        }
        return pin;
    }

    static synchronized String trocarPin(Context c) {
        String pin = novoPin();
        prefs(c).edit().putString("pin", pin).apply();
        return pin;
    }

    private static String novoPin() {
        return String.format(java.util.Locale.ROOT, "%06d", new SecureRandom().nextInt(1_000_000));
    }

    /**
     * Ajustes da câmera e do painel (orientação, qualidade, áudio, modelos de título, eventos usados...).
     * O painel guarda o que quiser aqui; o Java só lê as chaves da gravação.
     */
    static synchronized JSONObject ajustes(Context c) {
        try {
            return new JSONObject(prefs(c).getString("ajustes", "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    static synchronized JSONObject mesclarAjustes(Context c, JSONObject novos) throws JSONException {
        JSONObject atuais = ajustes(c);
        Iterator<String> chaves = novos.keys();
        while (chaves.hasNext()) {
            String chave = chaves.next();
            atuais.put(chave, novos.get(chave));
        }
        prefs(c).edit().putString("ajustes", atuais.toString()).apply();
        return atuais;
    }

    static String texto(Context c, String chave) {
        return prefs(c).getString(chave, null);
    }

    static void texto(Context c, String chave, String valor) {
        SharedPreferences.Editor e = prefs(c).edit();
        if (valor == null) e.remove(chave);
        else e.putString(chave, valor);
        e.apply();
    }
}
