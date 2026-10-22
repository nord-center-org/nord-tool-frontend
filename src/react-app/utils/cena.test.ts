import assert from "node:assert/strict";
import { test } from "node:test";

import { FRASES, centralizar, fraseDoToque, horaSaoPaulo, mensagemDaData, periodoDoDia, saudacao } from "./cena.ts";

test("período e saudação", () => {
  assert.equal(periodoDoDia(4), "noite");
  assert.equal(periodoDoDia(5), "manha");
  assert.equal(periodoDoDia(12), "tarde");
  assert.equal(periodoDoDia(18), "noite");
  assert.equal(saudacao("manha", "Ana Souza"), "Bom dia, Ana!");
  assert.equal(saudacao("noite", "  "), "Boa noite!");
  assert.equal(horaSaoPaulo(new Date("2026-10-22T15:30:00Z")), 12);
});

test("mensagens das datas", () => {
  assert.match(mensagemDaData("natal") ?? "", /Natal/);
  assert.equal(mensagemDaData(null), null);
});

test("frase muda a cada toque", () => {
  assert.notEqual(fraseDoToque(3, 0), fraseDoToque(3, 1));
  assert.ok(FRASES.includes(fraseDoToque(-5, 99)));
});

test("usuário vai para o centro", () => {
  assert.deepEqual(centralizar(["eu", "a", "b", "c", "d"], 0), ["a", "b", "eu", "c", "d"]);
  assert.deepEqual(centralizar(["a", "eu", "b"], 1), ["a", "eu", "b"]);
  assert.deepEqual(centralizar(["eu"], 0), ["eu"]);
  assert.deepEqual(centralizar(["a"], 5), ["a"]);
});
