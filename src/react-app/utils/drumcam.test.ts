import { test } from "node:test";
import assert from "node:assert/strict";
import { enderecoDaCamera, esperaDoRele, lerMsgRele, mensagemParaCamera, pedidoDoPainel, ponteDrumcam, urlDoReleDrumcam } from "./drumcam.ts";

test("URL do relé a partir da base da API absoluta ou relativa", () => {
  assert.equal(urlDoReleDrumcam("https://api.x.com/api/v1/nord-tool/", "https://site", "a b"), "wss://api.x.com/api/v1/nord-tool/drumcam/ws?bilhete=a%20b");
  assert.equal(urlDoReleDrumcam("/api/v1/nord-tool", "http://127.0.0.1:5199", "k"), "ws://127.0.0.1:5199/api/v1/nord-tool/drumcam/ws?bilhete=k");
});

test("endereço da câmera digitado vira a URL do painel; lixo é recusado", () => {
  assert.equal(enderecoDaCamera("192.168.0.10"), "http://192.168.0.10:8080/");
  assert.equal(enderecoDaCamera(" http://192.168.0.10:8081/api "), "http://192.168.0.10:8081/");
  assert.equal(enderecoDaCamera("javascript:alert(1)"), null);
  assert.equal(enderecoDaCamera(""), null);
});

test("ponte do app: só com as três funções do Drumcam", () => {
  assert.equal(ponteDrumcam({}), null);
  assert.equal(ponteDrumcam({ NordAndroid: { drumcamCamera() {} } }), null);
  const p = ponteDrumcam({ NordAndroid: { drumcamCamera() {}, drumcamControlar() {}, drumcamAtiva: () => true } });
  assert.ok(p);
  assert.equal(p!.drumcamAtiva(), true);
});

test("pedido do painel é validado e vira a mensagem do relé", () => {
  assert.equal(pedidoDoPainel({ tipo: "x" }), null);
  assert.equal(pedidoDoPainel({ tipo: "drumcam-req", id: 1, m: "PATCH", c: "estado" }), null);
  assert.equal(pedidoDoPainel({ tipo: "drumcam-req", id: 1, m: "GET", c: "x".repeat(600) }), null);
  const p = pedidoDoPainel({ tipo: "drumcam-req", id: 3, m: "POST", c: "gravar" })!;
  assert.deepEqual(mensagemParaCamera("cam", 9, p), { t: "req", camera: "cam", id: 9, m: "POST", c: "gravar", b: "", tipo: "" });
});

test("mensagens do relé: câmeras, resposta e o resto", () => {
  assert.deepEqual(lerMsgRele('{"t":"cameras","lista":[{"id":"a","nome":"Igreja"},{"id":2}]}'), { t: "cameras", lista: [{ id: "a", nome: "Igreja" }] });
  assert.deepEqual(lerMsgRele('{"t":"resp","id":4,"s":200,"tipo":"application/json","b":"e30="}'), { t: "resp", id: 4, s: 200, tipo: "application/json", b: "e30=", erro: undefined });
  assert.equal(lerMsgRele("{").t, "outro");
  assert.equal(lerMsgRele('{"t":"ok"}').t, "ok");
  assert.equal(lerMsgRele("null").t, "outro");
});

test("espera da reconexão cresce até 30 s", () => {
  assert.equal(esperaDoRele(0), 2000);
  assert.equal(esperaDoRele(2), 8000);
  assert.equal(esperaDoRele(10), 30000);
});
