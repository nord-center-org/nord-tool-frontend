import { test } from "node:test";
import assert from "node:assert/strict";
import { classificacao, colocacoes, novaCopa, pontosDaColocacao, registrarPartida, resumoDaCopa, terminou } from "./copa.ts";
import { pontosBombas } from "./pontuacao.ts";

test("o vencedor é o 1º e os demais vão pelas vitórias, com empate dividindo a colocação", () => {
  assert.deepEqual(colocacoes([2, 0, 1, 0], 0), [1, 3, 2, 3]);
  assert.deepEqual(colocacoes([1, 2, 2], 2), [3, 2, 1]);
  assert.deepEqual(colocacoes([0, 0], null), [1, 1]);
});

test("régua de pontos por colocação", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 8].map(pontosDaColocacao), [10, 7, 5, 3, 2, 1]);
  assert.equal(pontosDaColocacao(0), 10);
  assert.equal(pontosDaColocacao(12), 1);
});

test("soma as partidas, desempata por 1º lugares e termina na rodada certa", () => {
  let c = novaCopa(3, ["Ana", "Bot 1", "Bot 2"]);
  c = registrarPartida(c, [1, 2, 3]);
  c = registrarPartida(c, [3, 1, 2]);
  assert.equal(terminou(c), false);
  c = registrarPartida(c, [2, 3, 1]);
  assert.equal(terminou(c), true);
  assert.equal(registrarPartida(c, [1, 2, 3]), c);
  const t = classificacao(c);
  // Todos com 22 pontos e um 1º lugar cada; um 2º cada: vale a ordem das vagas.
  assert.deepEqual(t.map(l => l.pontos), [22, 22, 22]);
  assert.deepEqual(t.map(l => l.vaga), [0, 1, 2]);
  assert.equal(t[0].posicao, 1);
});

test("quem ganha mais partidas lidera", () => {
  let c = novaCopa(5, ["Ana", "Bot"]);
  for (const p of [[1, 2], [1, 2], [2, 1]]) c = registrarPartida(c, p);
  const t = classificacao(c);
  assert.deepEqual([t[0].vaga, t[0].pontos, t[0].primeiros], [0, 27, 2]);
  assert.deepEqual([t[1].vaga, t[1].pontos, t[1].primeiros, t[1].posicao], [1, 24, 1, 2]);
  const r = resumoDaCopa(c, "bombas");
  assert.equal(r.jogo, "bombas");
  assert.equal(r.rodadas, 5);
  assert.deepEqual(r.classificacao.map(l => [l.nome, l.posicao]), [["Ana", 1], ["Bot", 2]]);
});

test("pontuação do Bombas pesa a dificuldade", () => {
  assert.equal(pontosBombas({ vitoriasRodada: 2, venceu: true, jogadores: 4, dificuldade: "dificil" }), (200 + 300 + 75) * 3);
  assert.equal(pontosBombas({ vitoriasRodada: 0, venceu: false, jogadores: 2, dificuldade: "facil" }), 25);
  assert.equal(pontosBombas({ vitoriasRodada: 1, venceu: false, jogadores: 2, dificuldade: null }), 250);
});
