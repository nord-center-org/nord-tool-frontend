import { test } from "node:test";
import assert from "node:assert/strict";
import { SETORES, VOLTAS, novaPartidaEspacial, passoEspacial, pontosEspacial } from "./espacial.ts";

const P = { direcao: null, a: false, b: false } as const;

test("inércia: acelerar ganha velocidade e a nave segue andando sem acelerar", () => {
  const e = novaPartidaEspacial({ modo: "corrida", setor: "nebulosa", semente: 1, jogadores: [{ bot: null }] });
  const n = e.naves[0];
  for (let i = 0; i < 30; i++) passoEspacial(e, [{ direcao: null, a: true, b: false }]);
  const v = Math.hypot(n.vx, n.vy);
  assert.ok(v > 0.1);
  const x = n.y;
  for (let i = 0; i < 10; i++) passoEspacial(e, [P]);
  assert.notEqual(n.y, x, "continua andando");
});

test("bater no planeta explode e a nave volta depois", () => {
  const e = novaPartidaEspacial({ modo: "asteroides", setor: "nebulosa", semente: 2, jogadores: [{ bot: null }, { bot: null }] });
  const n = e.naves[0], p = SETORES.nebulosa.planetas[0];
  n.x = p.x + p.r + 0.1; n.y = p.y; n.vx = -0.2; n.vy = 0;
  passoEspacial(e, [P, P]);
  assert.ok(e.eventos.some(ev => ev.tipo === "explodiu"));
  assert.ok(n.explodidaAte > e.passo);
});

test("laser atordoa outra nave; quebra rocha grande em duas menores", () => {
  const e = novaPartidaEspacial({ modo: "asteroides", setor: "aneis", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.naves;
  e.rochas = [];
  a.x = 2; a.y = 2; a.ang = 0; a.vx = a.vy = 0; b.x = 4; b.y = 2; b.vx = b.vy = 0;
  passoEspacial(e, [{ direcao: null, a: false, b: true }, P]);
  for (let i = 0; i < 6; i++) passoEspacial(e, [P, P]);
  assert.ok(b.atordoadaAte > e.passo, "atordoada");
  e.rochas = [{ id: 99, x: 5, y: 6, vx: 0, vy: 0, r: 1.1 }];
  a.x = 2; a.y = 6; a.ang = 0; a.vx = a.vy = 0; a.recarga = 0; b.x = 30; b.y = 16;
  passoEspacial(e, [{ direcao: null, a: false, b: false }, P]);
  passoEspacial(e, [{ direcao: null, a: false, b: true }, P]);
  for (let i = 0; i < 8; i++) passoEspacial(e, [P, P]);
  assert.ok(e.rochas.filter(r => r.r < 1).length >= 2, "partiu");
  assert.ok(a.pontos >= 20);
});

test("corrida: bots completam as voltas e o primeiro vence", () => {
  const e = novaPartidaEspacial({ modo: "corrida", setor: "nebulosa", semente: 4, jogadores: Array.from({ length: 4 }, () => ({ bot: "dificil" as const })) });
  for (let i = 0; i < 4 * 60 * 60 && !e.terminado; i++) passoEspacial(e, []);
  assert.equal(e.terminado, true);
  assert.ok(e.chegada.length >= 1, `chegaram ${e.chegada.length}`);
  assert.equal(e.vencedor, e.chegada[0]);
  assert.ok(e.naves[e.chegada[0]].volta >= VOLTAS);
  assert.ok(pontosEspacial(e, e.naves[e.chegada[0]]) > 800);
});

test("coleta: cristais contam e a partida acaba em 90 s", () => {
  const e = novaPartidaEspacial({ modo: "coleta", setor: "binario", semente: 5, jogadores: [{ bot: "medio" }, { bot: "dificil" }] });
  for (let i = 0; i < 90 * 60 + 2 && !e.terminado; i++) passoEspacial(e, []);
  assert.equal(e.terminado, true);
  assert.ok(e.naves.some(n => n.cristais > 3));
});
