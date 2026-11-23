import { test } from "node:test";
import assert from "node:assert/strict";
import { JOGAVEIS, configPadrao, ehJogavel, modoEfetivo, rotuloDoModo } from "./registroJogos.ts";
import { JOGOS } from "./catalogo.ts";

test("todo jogo disponível no catálogo está no registro (e vice-versa)", () => {
  const disponiveis = JOGOS.filter(j => j.disponivel).map(j => j.id).sort();
  assert.deepEqual(Object.keys(JOGAVEIS).sort(), disponiveis);
  assert.equal(ehJogavel("bombas"), true);
  assert.equal(ehJogavel("jogo-inexistente"), false);
});

test("todo jogo jogável tem um modo para jogar sozinho", () => {
  for (const d of Object.values(JOGAVEIS)) assert.ok(d.modos.some(m => m.rotuloSolo), d.id);
});

test("modo efetivo: sozinho vai para o modo solo; times ímpar vira o primeiro modo", () => {
  assert.equal(modoEfetivo("hexagonos", "sumo", 1), "queda");
  assert.equal(modoEfetivo("hexagonos", "sumo", 3), "sumo");
  assert.equal(modoEfetivo("bombas", "times", 3), "sobrevivencia");
  assert.equal(modoEfetivo("bombas", "times", 4), "times");
  assert.equal(modoEfetivo("bombas", "moedas", 1), "moedas");
  assert.equal(modoEfetivo("outro", "x", 2), "x");
  assert.equal(rotuloDoModo("hexagonos", "queda", 1), "Desafio");
  assert.equal(rotuloDoModo("hexagonos", "sumo", 4), "Sumô");
  assert.equal(rotuloDoModo("bombas", "zzz", 2), "zzz");
});

test("preparação padrão por jogo", () => {
  assert.deepEqual(configPadrao("hexagonos"), { modo: "queda", cenario: "neon", bots: 3, dificuldade: "medio", vitorias: 2, formato: "unica" });
  assert.equal(configPadrao("desconhecido").modo, "sobrevivencia");
});
