import { test } from "node:test";
import assert from "node:assert/strict";
import { O2_MAX, PEIXES, SUPERFICIE, TEMPO, novaPartidaPescaria, passoPescaria, type EstadoPescaria } from "./pescaria.ts";

const P = { direcao: null, a: false, b: false } as const;
const parado = (e: EstadoPescaria) => e.jogadores.map(() => P);

test("pescaria: peixe no anzol fica fisgado; puxar com calma traz o peixe e dá os pontos", () => {
  const e = novaPartidaPescaria({ modo: "pescaria", semente: 1, jogadores: [{ bot: null }] });
  const j = e.jogadores[0];
  e.peixes = [{ id: 500, tipo: "sardinha", x: j.x, y: j.anzolY, dir: 1, alvoY: j.anzolY, fisgado: null, puxaAte: 0, proximaBriga: 0, hp: 1, mordeEm: 0 }];
  passoPescaria(e, parado(e));
  assert.equal(j.peixe, 500);
  // Puxa só quando a linha está folgada o bastante.
  for (let i = 0; i < 3000 && j.peixe !== null; i++) passoPescaria(e, [{ direcao: null, a: j.tensao < 0.6, b: j.tensao > 0.9 }]);
  assert.equal(j.pontos, PEIXES.sardinha.pontos);
  assert.equal(j.capturas, 1);
});

test("pescaria: puxar sem parar enquanto o peixe briga arrebenta a linha; largar a linha deixa escapar", () => {
  const e = novaPartidaPescaria({ modo: "pescaria", semente: 2, jogadores: [{ bot: null }] });
  const j = e.jogadores[0];
  j.anzolY = 16;
  e.peixes = [{ id: 501, tipo: "tubarao", x: j.x, y: j.anzolY, dir: 1, alvoY: j.anzolY, fisgado: null, puxaAte: 0, proximaBriga: 0, hp: 4, mordeEm: 0 }];
  passoPescaria(e, parado(e));
  const ev: string[] = [];
  for (let i = 0; i < 3000 && j.peixe !== null; i++) { passoPescaria(e, [{ direcao: null, a: true, b: false }]); ev.push(...e.eventos.map(x => x.tipo)); }
  assert.ok(ev.includes("arrebentou"));
  e.peixes = [{ id: 502, tipo: "robalo", x: j.x, y: j.anzolY, dir: 1, alvoY: j.anzolY, fisgado: null, puxaAte: 0, proximaBriga: 9e9, hp: 1, mordeEm: 0 }];
  passoPescaria(e, parado(e));
  assert.equal(j.peixe, 502);
  const ev2: string[] = [];
  for (let i = 0; i < 400 && j.peixe !== null; i++) { passoPescaria(e, [{ direcao: null, a: false, b: true }]); ev2.push(...e.eventos.map(x => x.tipo)); }
  assert.ok(ev2.includes("escapou"));
});

test("mergulho: oxigênio acaba no fundo e enche na superfície; tesouro vira carga e só pontua entregue", () => {
  const e = novaPartidaPescaria({ modo: "mergulho", semente: 3, jogadores: [{ bot: null }] });
  const j = e.jogadores[0];
  e.peixes = [];
  const t = e.tesouros[0];
  j.x = t.x; j.y = t.y;
  passoPescaria(e, parado(e));
  assert.ok(j.carga >= t.valor);
  assert.equal(j.pontos, 0);
  assert.ok(j.oxigenio < O2_MAX);
  const carga = j.carga;
  for (let i = 0; i < 600 && j.y > SUPERFICIE + 0.3; i++) { e.peixes = []; passoPescaria(e, [{ direcao: "cima", a: false, b: false }]); }
  passoPescaria(e, parado(e));
  assert.ok(j.pontos >= carga);
  assert.equal(j.carga, 0);
  // Fica no fundo até afogar: perde a carga e volta à superfície.
  j.carga = 50; j.y = 18;
  const ev: string[] = [];
  for (let i = 0; i < 4000 && !ev.includes("afogou"); i++) { e.peixes = []; e.tesouros = []; passoPescaria(e, [{ direcao: "baixo", a: false, b: false }]); ev.push(...e.eventos.map(x => x.tipo)); }
  assert.ok(ev.includes("afogou"));
  assert.equal(j.carga, 0);
  assert.equal(j.y, SUPERFICIE);
});

test("mergulho: o arpão caça o peixe (atum leva 2) e vira carga", () => {
  const e = novaPartidaPescaria({ modo: "mergulho", semente: 4, jogadores: [{ bot: null }] });
  const j = e.jogadores[0];
  j.x = 10; j.y = 12; j.olhando = 1;
  e.peixes = [{ id: 600, tipo: "atum", x: 14, y: 12, dir: 1, alvoY: 12, fisgado: null, puxaAte: 0, proximaBriga: 0, hp: 2, mordeEm: 0 }];
  e.tesouros = [];
  for (let i = 0; i < 200 && e.peixes.some(p => p.id === 600); i++) { passoPescaria(e, [{ direcao: null, a: true, b: false }]); const p = e.peixes.find(q => q.id === 600); if (p) { p.x = 14; p.y = 12; } }
  assert.ok(!e.peixes.some(p => p.id === 600));
  assert.ok(j.carga >= PEIXES.atum.pontos);
});

test("só bots, de 1 a 8, nos dois modos: pontuam e a partida acaba no tempo", () => {
  for (const modo of ["pescaria", "mergulho"] as const) for (const n of [1, 4, 8]) {
    const e = novaPartidaPescaria({ modo, semente: 20 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    for (let i = 0; i < TEMPO + 5 && !e.terminado; i++) passoPescaria(e, parado(e));
    assert.ok(e.terminado);
    const total = e.jogadores.reduce((s, j) => s + j.pontos, 0);
    assert.ok(total > 50 * n, `${modo} ${n}: ${total} pontos`);
  }
});
