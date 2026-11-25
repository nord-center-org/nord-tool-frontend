import { test } from "node:test";
import assert from "node:assert/strict";
import { desserializar, lerPartida, lerQuadro, serializar } from "./espelho.ts";
import { novaPartida, passo, type Estado } from "./bombas.ts";

test("serializar/desserializar: Map, Set, funções e números estranhos", () => {
  const original = { m: new Map([[1, "a"], [2, "b"]]), s: new Set([3, 4]), f: () => 1, n: Number.NaN, l: [1, undefined, { x: 2 }], u: undefined };
  const ida = JSON.parse(JSON.stringify(serializar(original)));
  const volta = desserializar(ida) as Record<string, unknown>;
  assert.deepEqual(volta.m, new Map([[1, "a"], [2, "b"]]));
  assert.deepEqual(volta.s, new Set([3, 4]));
  assert.equal("f" in volta, false);
  assert.equal(volta.n, null);
  assert.deepEqual(volta.l, [1, null, { x: 2 }]);
  assert.equal("u" in volta, false);
  const perigoso = desserializar(JSON.parse('{"__proto__":{"x":1},"a":1}')) as Record<string, unknown>;
  assert.equal(({} as Record<string, unknown>).x, undefined);
  assert.equal(perigoso.a, 1);
});

test("estado das Bombas vai e volta pelo JSON (o celular desenha igual)", () => {
  const e = novaPartida({ modo: "sobrevivencia", bioma: "fabrica", jogadores: [{ nome: "A", bot: "medio" }, { nome: "B", bot: "medio" }], semente: 7 });
  for (let i = 0; i < 200; i++) passo(e, []);
  const volta = desserializar(JSON.parse(JSON.stringify(serializar({ ...e, escondidos: new Map() })))) as Estado;
  assert.deepEqual(volta.grade, e.grade);
  assert.deepEqual(volta.jogadores.map(j => [j.x, j.y, j.vivo]), e.jogadores.map(j => [j.x, j.y, j.vivo]));
  assert.equal(volta.escondidos.size, 0, "o que está nas caixas não vai para o celular");
});

test("quadro e partida recebidos são conferidos", () => {
  assert.equal(lerQuadro({ n: 1, m: { fase: "voando" } }), null);
  const q = lerQuadro({ n: 3, s: { a: 1 }, ev: [1, 2], m: { fase: "jogando", contagem: 0, vitorias: [1, 999, "x"], rodada: 2 } });
  assert.ok(q);
  assert.deepEqual(q?.m.vitorias, [1, 99, 0]);
  assert.equal(lerPartida({ jogo: "../x", vagas: [] }), null);
  const p = lerPartida({ jogo: "bombas", modo: "times", cenario: "gelo", vagas: [{ nome: "Ana", bot: null, avatar: {} }, { nome: "Bot", bot: "dificil" }, { bot: "hackear" }], eu: 7 });
  assert.equal(p?.eu, -1, "eu fora da lista não vale");
  assert.equal(p?.vagas[2].bot, null);
  assert.equal(p?.vagas[2].nome, "P3");
});

test("coop local pede joystick; partidas antigas continuam com espelho disponível", () => {
  const partida = { jogo: "bombas", vagas: [{ nome: "Ana", bot: null }], eu: 0 };
  assert.equal(lerPartida({ ...partida, soControle: true })?.soControle, true);
  assert.equal(lerPartida(partida)?.soControle, false);
  assert.equal(lerPartida({ ...partida, soControle: "true" })?.soControle, false);
});
