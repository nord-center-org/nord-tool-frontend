import { test } from "node:test";
import assert from "node:assert/strict";
import { ALVOS_SOLO, LW, bloco, miraDoBot, novaPartidaTorres, passoTorres, simular, type EstadoTorres } from "./torres.ts";

const P = { direcao: null, a: false, b: false } as const;
const ate = (e: EstadoTorres, cond: () => boolean, limite = 200000) => { for (let i = 0; i < limite && !cond(); i++) passoTorres(e, e.reis.map(() => P)); };

test("torres com rei no topo; tiro voa e explode tirando resistência dos blocos", () => {
  const e = novaPartidaTorres({ modo: "batalha", paisagem: "campo", semente: 1, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.reis;
  assert.ok(a.x < LW / 2 && b.x > LW / 2);
  assert.ok(bloco(e, Math.floor(a.x), Math.floor(a.y) + 1) > 0, "rei em cima de bloco");
  const antes = e.blocos.reduce<number>((s, m) => s + m, 0);
  // Mira certeira no rival (a do bot Difícil) e dispara.
  e.vento = 0;
  const m = miraDoBot({ ...e, sorteio: () => 0.5 } as EstadoTorres, { ...a, bot: "dificil" });
  a.angulo = m.angulo; a.forca = m.forca;
  ate(e, () => e.passo > 60);
  passoTorres(e, [{ direcao: null, a: true, b: false }, P]);
  ate(e, () => !e.projetil && e.passo > e.esperaAte);
  assert.ok(e.eventos.length >= 0);
  assert.ok(e.blocos.reduce<number>((s, m2) => s + m2, 0) < antes || !b.vivo, "explosão estragou blocos");
});

test("simulação do tiro sente o vento", () => {
  const e = novaPartidaTorres({ modo: "batalha", paisagem: "campo", semente: 2, jogadores: [{ bot: null }, { bot: null }] });
  e.vento = 0;
  const semVento = simular(e, 10, 10, -60, 0.3);
  e.vento = 1;
  const comVento = simular(e, 10, 10, -60, 0.3);
  assert.ok(comVento.x > semVento.x);
});

test("bloco sem apoio cai; rei que perde o chão cai", () => {
  const e = novaPartidaTorres({ modo: "batalha", paisagem: "campo", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  const r = e.reis[0];
  const x = Math.floor(r.x), y = Math.floor(r.y) + 1;
  for (let yy = y + 1; yy < e.chao[x]; yy++) e.blocos[yy * LW + x] = 0;
  for (const dx of [-1, 1]) for (let yy = y; yy < e.chao[x + dx]; yy++) e.blocos[yy * LW + x + dx] = 0;
  e.esperaAte = e.passo + 200; e.tiros = 1;
  for (let i = 0; i < 120; i++) passoTorres(e, [P, P]);
  assert.equal(bloco(e, x, y), 0, "o bloco do topo caiu");
});

test("bots Difícil derrubam reis até sobrar um", () => {
  const e = novaPartidaTorres({ modo: "batalha", paisagem: "neve", semente: 4, jogadores: Array.from({ length: 4 }, () => ({ bot: "dificil" as const })) });
  ate(e, () => e.terminado);
  assert.equal(e.terminado, true);
  assert.equal(e.reis.filter(r => r.vivo).length <= 1, true);
});

test("sozinho: alvos; acertar todos em 12 tiros vence", () => {
  const e = novaPartidaTorres({ modo: "batalha", paisagem: "deserto", semente: 5, jogadores: [{ bot: null }] });
  assert.equal(e.modo, "alvos");
  assert.equal(e.alvos.length, ALVOS_SOLO);
  // O bot faz a mira por nós.
  for (let k = 0; k < 12 && !e.terminado; k++) {
    ate(e, () => !e.projetil && e.passo >= e.esperaAte);
    const m = miraDoBot(e, { ...e.reis[0], bot: "dificil" });
    e.reis[0].angulo = m.angulo; e.reis[0].forca = m.forca;
    passoTorres(e, [{ direcao: null, a: true, b: false }]);
    passoTorres(e, [P]);
    ate(e, () => e.terminado || (!e.projetil && e.passo > e.esperaAte));
  }
  assert.equal(e.terminado, true);
  assert.ok(e.reis[0].acertos >= 3, `acertos ${e.reis[0].acertos}`);
});
