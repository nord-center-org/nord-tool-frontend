import { test } from "node:test";
import assert from "node:assert/strict";
import { ENDERECO_APK, apiAbsoluta, mostrarBotaoAppAndroid, pedirSessaoAoApp, ponteAndroid, type PonteAndroid } from "./appAndroid.ts";

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

function janelaCom(resposta: ((id: string, w: Record<string, unknown>) => void) | null, temAparelho = true) {
  const w: Record<string, unknown> = {};
  const chamadas: string[] = [];
  const ponte: PonteAndroid = {
    registrar: (t, a) => { chamadas.push(`registrar:${t}:${a}`); },
    pedirSessao: id => { chamadas.push(`pedir:${id}`); resposta?.(id, w); },
    temAparelho: () => temAparelho,
    sair: () => { chamadas.push("sair"); },
  };
  w.NordAndroid = ponte;
  return { w, chamadas };
}

test("só reconhece a ponte do app v2 (o v1 só salvava downloads)", () => {
  assert.equal(ponteAndroid(undefined), null);
  assert.equal(ponteAndroid({}), null);
  assert.equal(ponteAndroid({ NordAndroid: { salvar() {}, falhou() {} } }), null);
  assert.ok(ponteAndroid(janelaCom(null).w));
});

test("pede a sessão ao app e devolve o JSON", async () => {
  const { w, chamadas } = janelaCom((id, j) => setTimeout(() => (j.__nordAndroidSessao as (i: string, s: string) => void)(id, JSON.stringify({ token: "t" })), 5));
  assert.deepEqual(await pedirSessaoAoApp(1000, w), { token: "t" });
  assert.equal(chamadas.length, 1);
  assert.equal(w.__nordAndroidSessao, undefined, "devolve o receptor anterior");
});

test("sem aparelho, desconectado, resposta inválida ou sem resposta: null", async () => {
  assert.equal(await pedirSessaoAoApp(1000, janelaCom(null, false).w), null);
  assert.equal(await pedirSessaoAoApp(1000, {}), null);
  const vazio = janelaCom((id, j) => (j.__nordAndroidSessao as (i: string, s: string) => void)(id, ""));
  assert.equal(await pedirSessaoAoApp(1000, vazio.w), null);
  const quebrado = janelaCom((id, j) => (j.__nordAndroidSessao as (i: string, s: string) => void)(id, "{x"));
  assert.equal(await pedirSessaoAoApp(1000, quebrado.w), null);
  assert.equal(await pedirSessaoAoApp(20, janelaCom(null).w), null);
});

test("dois pedidos ao mesmo tempo recebem cada um a sua resposta", async () => {
  const pendentes: string[] = [];
  const { w } = janelaCom(id => { pendentes.push(id); });
  const a = pedirSessaoAoApp(1000, w);
  const b = pedirSessaoAoApp(1000, w);
  const responder = w.__nordAndroidSessao as (i: string, s: string) => void;
  responder(pendentes[0], JSON.stringify({ token: "a" }));
  responder(pendentes[1], JSON.stringify({ token: "b" }));
  assert.deepEqual(await a, { token: "a" });
  assert.deepEqual(await b, { token: "b" });
});

test("URL absoluta da API para o serviço do app", () => {
  assert.equal(apiAbsoluta("https://api.exemplo.com/api/v1/nord-tool/", "https://app.exemplo.com/x"), "https://api.exemplo.com/api/v1/nord-tool");
  assert.equal(apiAbsoluta("/api/v1/nord-tool", "https://app.exemplo.com/x"), "https://app.exemplo.com/api/v1/nord-tool");
});
