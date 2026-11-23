import { test } from "node:test";
import assert from "node:assert/strict";
import { POSTOS, RUA, centro, cruzamento, novaPartidaCaos, passoCaos, pontosCaos, type EstadoCaos } from "./caos.ts";

const P = { direcao: null, a: false, b: false } as const;
const parado = (e: EstadoCaos) => e.carros.map(() => P);
const dentroDePredio = (e: EstadoCaos, x: number, z: number) => e.predios.some(p => x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1);

test("cidade em grade: prédios fora das ruas e carros nascendo na rua", () => {
  const e = novaPartidaCaos({ modo: "corrida", cidade: "centro", semente: 1, jogadores: Array.from({ length: 8 }, () => ({ bot: null })) });
  assert.ok(e.predios.length > 20);
  for (const p of e.predios) assert.ok(p.x0 >= RUA / 2 - 0.01 && p.z0 >= RUA / 2 - 0.01);
  for (const c of e.carros) assert.equal(dentroDePredio(e, c.x, c.z), false);
  assert.equal(e.postos.length, POSTOS);
});

test("acelera sozinho, ↓ freia e o prédio segura o carro", () => {
  const e = novaPartidaCaos({ modo: "corrida", cidade: "centro", semente: 2, jogadores: [{ bot: null }] });
  const c = e.carros[0];
  const p0 = cruzamento(1, 1);
  c.x = p0.x; c.z = p0.z; c.ang = Math.PI / 4; // na diagonal, direto num prédio
  for (let i = 0; i < 300; i++) { passoCaos(e, parado(e)); assert.equal(dentroDePredio(e, c.x, c.z), false); }
  c.ang = Math.PI / 2; c.x = p0.x; c.z = p0.z; c.vel = 0.3;
  for (let i = 0; i < 60; i++) passoCaos(e, [{ direcao: "baixo", a: false, b: false }]);
  assert.ok(c.vel < 0);
});

test("Fuga: a estrela sobe a cada 30 s com mais viaturas; parado com viatura colada é preso", () => {
  const e = novaPartidaCaos({ modo: "fuga", cidade: "noite", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  const antes = e.cidadaos.length;
  for (let i = 0; i < 30 * 60 + 1; i++) { passoCaos(e, parado(e)); for (const c of e.carros) { c.fora = false; c.presoPor = 0; } }
  assert.equal(e.estrelas, 2);
  assert.ok(e.cidadaos.length > antes);
  const c = e.carros[0], pol = e.cidadaos[0];
  for (let i = 0; i < 200 && !c.fora; i++) { pol.x = c.x + 1.5; pol.z = c.z; pol.vel = 0; c.vel = 0; passoCaos(e, [{ direcao: "baixo", a: false, b: false }, P]); c.vel = 0; }
  assert.ok(c.fora, "preso");
});

test("Entrega: pega a encomenda passando por cima e entrega no destino", () => {
  const e = novaPartidaCaos({ modo: "entregas", cidade: "porto", semente: 4, jogadores: [{ bot: null }] });
  const c = e.carros[0], k = e.encomendas[0];
  c.x = k.x; c.z = k.z; c.vel = 0;
  passoCaos(e, [{ direcao: "baixo", a: false, b: false }]);
  assert.equal(c.carga, k.id);
  c.x = k.dx; c.z = k.dz; c.vel = 0;
  passoCaos(e, [{ direcao: "baixo", a: false, b: false }]);
  assert.equal(c.entregas, 1);
  assert.ok(c.pontos >= 50);
});

test("Derby: batida tira lataria e quem fica sem lataria sai", () => {
  const e = novaPartidaCaos({ modo: "derby", cidade: "centro", semente: 5, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.carros;
  a.x = centro.x - 3; a.z = centro.z; a.ang = 0; b.x = centro.x + 3; b.z = centro.z; b.ang = Math.PI;
  for (let i = 0; i < 120; i++) passoCaos(e, parado(e));
  assert.ok(a.lataria < 100 && b.lataria < 100);
  // Lataria no fim: a próxima batida tira o carro.
  b.lataria = 1; a.x = b.x - 2.5; a.z = b.z; a.ang = 0; a.vel = 0.4;
  for (let i = 0; i < 30 && !e.terminado; i++) passoCaos(e, parado(e));
  assert.ok(b.fora);
  assert.equal(e.vencedor, 0);
});

test("bots nos quatro modos, de 1 a 8: a partida acaba e pontua", () => {
  for (const modo of ["fuga", "entregas", "derby", "corrida"] as const) for (const n of [1, 4, 8]) {
    const e = novaPartidaCaos({ modo, cidade: "centro", semente: 40 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    for (let i = 0; i < 60 * 300 && !e.terminado; i++) passoCaos(e, parado(e));
    assert.ok(e.terminado, `${modo} ${n}`);
    assert.equal(pontosCaos(e).length, n);
    if (modo === "corrida" && n > 1) assert.ok(e.carros.some(c => c.posto === POSTOS), `corrida ${n}: alguém chegou`);
    if (modo === "entregas") assert.ok(e.carros.some(c => c.entregas > 0), `entregas ${n}`);
  }
});
