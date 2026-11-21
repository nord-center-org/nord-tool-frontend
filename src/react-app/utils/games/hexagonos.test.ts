import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALTURA_CAMADA, CAI_APOS, DURACAO_SOLO, ENTRADA_PARADA, INTERVALO_BORDA, hexNoPonto, novaPartidaHex, passoHex, pisoEm, posicaoDoHex, type ConfiguracaoHex,
} from "./hexagonos.ts";

const config = (n: number, modo: "queda" | "sumo" = "queda", bot: "facil" | "medio" | "dificil" | null = null): ConfiguracaoHex => ({
  modo, semente: 11, jogadores: Array.from({ length: n }, (_, i) => ({ nome: `P${i + 1}`, bot: i === 0 ? null : bot })),
});

test("hexágono no ponto é o inverso da posição do hexágono", () => {
  for (const [q, r] of [[0, 0], [2, -1], [-3, 2], [5, -5], [-4, 0]]) {
    const p = posicaoDoHex(q, r);
    assert.deepEqual(hexNoPonto(p.x + 0.2, p.z - 0.2), { q, r });
  }
});

test("Queda: 3 camadas; arena maior com mais de 4 jogadores", () => {
  const e = novaPartidaHex(config(4));
  assert.equal(e.camadas, 3);
  assert.equal(e.pisos.length, 91 * 3);
  assert.equal(novaPartidaHex(config(8)).pisos.length, 127 * 3);
  const s = novaPartidaHex(config(2, "sumo"));
  assert.equal(s.camadas, 1);
  assert.equal(novaPartidaHex(config(1, "sumo")).modo, "queda", "sozinho é sempre Queda");
});

test("piso pisado racha e cai; quem está em cima vai para a camada de baixo e some na última", () => {
  const e = novaPartidaHex(config(1));
  const j = e.jogadores[0];
  passoHex(e, [ENTRADA_PARADA]);
  const piso = pisoEm(e, j.x, j.z, 0);
  assert.ok(piso && piso.pisadoEm !== null, "pisou");
  for (let i = 0; i < CAI_APOS + 1; i++) passoHex(e, [ENTRADA_PARADA]);
  assert.equal(pisoEm(e, j.x, j.z, 0), null, "caiu");
  for (let i = 0; i < 120 && j.y > -ALTURA_CAMADA + 0.01; i++) passoHex(e, [ENTRADA_PARADA]);
  assert.equal(j.y, -ALTURA_CAMADA, "pousou na camada de baixo");
  // Parado em cada camada, cai tudo e sai da arena.
  for (let i = 0; i < 600 && j.vivo; i++) passoHex(e, [ENTRADA_PARADA]);
  assert.equal(j.vivo, false);
  assert.equal(e.terminado, true);
  assert.equal(e.vencedor, null);
});

test("andar, pular e dash", () => {
  const e = novaPartidaHex(config(1));
  const j = e.jogadores[0];
  const x0 = j.x;
  for (let i = 0; i < 10; i++) passoHex(e, [{ direcao: "direita", a: false, b: false }]);
  assert.ok(j.x > x0 + 0.3, "andou para a direita");
  passoHex(e, [{ direcao: null, a: false, b: true }]);
  assert.ok(e.eventos.some(ev => ev.tipo === "pulo"));
  passoHex(e, [ENTRADA_PARADA]);
  assert.ok(j.y > 0, "no ar");
  const e2 = novaPartidaHex(config(1));
  passoHex(e2, [{ direcao: "esquerda", a: true, b: false }]);
  assert.ok(e2.eventos.some(ev => ev.tipo === "dash"));
  assert.ok(e2.jogadores[0].vx < -8, "arrancada");
  passoHex(e2, [{ direcao: "esquerda", a: false, b: false }]);
  passoHex(e2, [{ direcao: "esquerda", a: true, b: false }]);
  assert.ok(!e2.eventos.some(ev => ev.tipo === "dash"), "dash tem recarga");
});

test("dash empurra quem está na frente", () => {
  const e = novaPartidaHex(config(2, "sumo"));
  const [a, b] = e.jogadores;
  a.x = 0; a.z = 0; b.x = 0.9; b.z = 0;
  passoHex(e, [{ direcao: "direita", a: true, b: false }, ENTRADA_PARADA]);
  for (let i = 0; i < 4; i++) passoHex(e, [{ direcao: "direita", a: false, b: false }, ENTRADA_PARADA]);
  assert.ok(b.vx > 4, "empurrado com força");
});

test("sozinho: sobreviver 60 s vence", () => {
  const e = novaPartidaHex(config(1));
  const j = e.jogadores[0];
  // Mantém o piso embaixo sempre inteiro (como se fosse andando para piso novo).
  for (let i = 0; i < DURACAO_SOLO + 2 && !e.terminado; i++) {
    for (const p of e.pisos) { p.pisadoEm = null; p.caiuEm = null; }
    passoHex(e, [ENTRADA_PARADA]);
  }
  assert.equal(j.vivo, true);
  assert.equal(e.vencedor, 0);
});

test("Sumô: a borda desmorona com o tempo", () => {
  const e = novaPartidaHex(config(2, "sumo"));
  const antes = e.pisos.filter(p => p.caiuEm === null).length;
  for (let i = 0; i < INTERVALO_BORDA + 80; i++) passoHex(e, [ENTRADA_PARADA, ENTRADA_PARADA]);
  assert.ok(e.pisos.filter(p => p.caiuEm === null).length < antes);
});

test("bots disputam até sobrar um, sem travar", () => {
  for (const dif of ["facil", "medio", "dificil"] as const) {
    const e = novaPartidaHex({ modo: "queda", semente: 5, jogadores: Array.from({ length: 6 }, (_, i) => ({ nome: `B${i}`, bot: dif })) });
    for (let i = 0; i < e.duracao + 5 && !e.terminado; i++) passoHex(e, []);
    assert.equal(e.terminado, true, dif);
  }
  // Fácil não dá dash; Médio e Difícil partem para cima de quem está perto.
  const dashes = (dif: "facil" | "medio" | "dificil") => {
    let n = 0;
    for (let sem = 1; sem <= 3; sem++) {
      const e = novaPartidaHex({ modo: "sumo", semente: sem, jogadores: Array.from({ length: 8 }, (_, i) => ({ nome: `B${i}`, bot: dif })) });
      for (let i = 0; i < 1800 && !e.terminado; i++) { passoHex(e, []); n += e.eventos.filter(ev => ev.tipo === "dash").length; }
    }
    return n;
  };
  assert.equal(dashes("facil"), 0);
  assert.ok(dashes("dificil") > 0);
  assert.ok(dashes("medio") > 0);
});
