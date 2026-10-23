import assert from "node:assert/strict";
import { test } from "node:test";

import { TEMPO_MAXIMO, forcaDoRato, mensagemFinal, pontoDeNascer, tempoDepoisDePegar } from "./cacada.ts";

test("rato fica mais rápido a cada um pego, com limite", () => {
  assert.ok(forcaDoRato(5).velocidade > forcaDoRato(0).velocidade);
  assert.ok(forcaDoRato(5).pulo > forcaDoRato(0).pulo);
  assert.equal(forcaDoRato(500).velocidade, 165);
});

test("pegar dá tempo extra sem passar do máximo", () => {
  assert.equal(tempoDepoisDePegar(10), 13);
  assert.equal(tempoDepoisDePegar(44), TEMPO_MAXIMO);
});

test("novo rato nasce longe do gato", () => {
  const pontos = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 400, y: 200 }, { x: 380, y: 210 }, { x: 390, y: 190 }];
  const p = pontoDeNascer(pontos, { x: 0, y: 0 }, () => 0.99);
  assert.ok(p.x >= 380);
});

test("mensagem final", () => {
  assert.equal(mensagemFinal(5, 3), "NOVO RECORDE!");
  assert.equal(mensagemFinal(0, 3), "O rato escapou...");
  assert.equal(mensagemFinal(9, 20), "Mandou bem!");
  assert.equal(mensagemFinal(0, null), "Primeira partida!");
});
