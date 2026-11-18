import { test } from "node:test";
import assert from "node:assert/strict";
import { ENDERECO_APK, mostrarBotaoAppAndroid } from "./appAndroid.ts";

test("mostra o botão no Android e no computador", () => {
  assert.equal(mostrarBotaoAppAndroid("Mozilla/5.0 (Linux; Android 14; SM-S911B) Chrome/130 Mobile"), true);
  assert.equal(mostrarBotaoAppAndroid("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"), true);
  assert.equal(mostrarBotaoAppAndroid(undefined), true);
});

test("esconde dentro do próprio app e no iPhone/iPad", () => {
  assert.equal(mostrarBotaoAppAndroid("Mozilla/5.0 (Linux; Android 14; wv) Chrome/130 NordToolAndroid/1.0"), false);
  assert.equal(mostrarBotaoAppAndroid("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), false);
  assert.equal(mostrarBotaoAppAndroid("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"), false);
});

test("o APK fica no próprio site", () => {
  assert.equal(ENDERECO_APK, "/app/nordtool.apk");
});
