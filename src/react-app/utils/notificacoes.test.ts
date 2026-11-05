import assert from "node:assert/strict";
import { test } from "node:test";

import { chaveParaBytes, lerPreferencias, nomeDoAparelho, PREFERENCIAS_PADRAO, rotuloAntecedencia, suporteDoAparelho } from "./notificacoes.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

test("chave VAPID em base64url vira os 65 bytes do ponto P-256", () => {
  const chave = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
  const bytes = chaveParaBytes(chave);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 0x04);
  assert.equal(Buffer.from(bytes).toString("base64url"), chave);
});

test("nome do aparelho mostra sistema e navegador", () => {
  assert.equal(nomeDoAparelho(IPHONE), "iPhone · Safari");
  assert.equal(nomeDoAparelho(ANDROID), "Android · Chrome");
  assert.equal(nomeDoAparelho(IPAD, 5), "iPad · Safari");
  assert.equal(nomeDoAparelho("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0"), "Windows · Edge");
});

test("no iPhone só dá para ativar com o app na Tela de Início", () => {
  assert.equal(suporteDoAparelho({ userAgent: IPHONE, temServiceWorker: true, temPush: false, instalado: false }), "instalar-ios");
  assert.equal(suporteDoAparelho({ userAgent: IPHONE, temServiceWorker: true, temPush: true, instalado: true }), "ok");
  assert.equal(suporteDoAparelho({ userAgent: ANDROID, temServiceWorker: true, temPush: true, instalado: false }), "ok");
  assert.equal(suporteDoAparelho({ userAgent: ANDROID, temServiceWorker: false, temPush: false, instalado: false }), "sem-suporte");
});

test("preferências do servidor são completadas e a antecedência fica entre 0 e 120", () => {
  assert.deepEqual(lerPreferencias(null), PREFERENCIAS_PADRAO);
  const p = lerPreferencias({ inPrazo: false, nrAntecedenciaMin: 999, inSac: "não" });
  assert.equal(p.inPrazo, false);
  assert.equal(p.inSac, true);
  assert.equal(p.nrAntecedenciaMin, 120);
});

test("rótulos da antecedência", () => {
  assert.equal(rotuloAntecedencia(0), "Na hora");
  assert.equal(rotuloAntecedencia(15), "15 min antes");
  assert.equal(rotuloAntecedencia(60), "1 hora antes");
  assert.equal(rotuloAntecedencia(120), "2 horas antes");
});
