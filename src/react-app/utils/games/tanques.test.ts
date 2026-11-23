import { test } from "node:test";
import assert from "node:assert/strict";
import { BLINDAGEM, CELULA, GRADE, celula, novaPartidaTanques, passoTanques, pontosTanques, solido, type EstadoTanques } from "./tanques.ts";

const P = { direcao: null, a: false, b: false } as const;
const parado = (e: EstadoTanques) => e.tanques.map(() => P);
const limpar = (e: EstadoTanques) => { for (let z = 1; z < GRADE - 1; z++) for (let x = 1; x < GRADE - 1; x++) e.grade[z * GRADE + x] = 0; };

test("arena simétrica com borda de pedra; os tanques nascem livres", () => {
  const e = novaPartidaTanques({ modo: "matamata", arena: "deserto", semente: 1, jogadores: Array.from({ length: 8 }, () => ({ bot: null })) });
  for (let i = 0; i < GRADE; i++) { assert.equal(celula(e, i, 0), 1); assert.equal(celula(e, 0, i), 1); }
  for (let z = 0; z < GRADE; z++) for (let x = 0; x < GRADE; x++) assert.equal(celula(e, x, z), celula(e, GRADE - 1 - x, z));
  for (const t of e.tanques) assert.equal(solido(e, t.x, t.z), false);
  assert.equal(new Set(e.tanques.map(t => `${t.x},${t.z}`)).size, 8);
});

test("anda, gira e não atravessa muro", () => {
  const e = novaPartidaTanques({ modo: "matamata", arena: "deserto", semente: 2, jogadores: [{ bot: null }, { bot: null }] });
  limpar(e);
  const t = e.tanques[0];
  t.x = 3; t.z = 3; t.ang = Math.PI; // de frente para a borda da esquerda
  for (let i = 0; i < 120; i++) passoTanques(e, [{ direcao: "cima", a: false, b: false }, P]);
  assert.ok(t.x >= CELULA + 0.7, "parou no muro");
  t.ang = 0;
  passoTanques(e, [{ direcao: "direita", a: false, b: false }, P]);
  assert.ok(t.ang > 0);
});

test("tiro ricocheteia no muro de pedra e, depois do ricochete, acerta até quem atirou", () => {
  const e = novaPartidaTanques({ modo: "matamata", arena: "deserto", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  limpar(e);
  const [a, b] = e.tanques;
  b.x = 38; b.z = 38;
  a.x = 5; a.z = 21; a.ang = Math.PI; a.torre = Math.PI; a.recarga = 0;
  const ev: string[] = [];
  for (let i = 0; i < 200; i++) { passoTanques(e, [{ direcao: null, a: i === 0, b: false }, P]); a.torre = Math.PI; ev.push(...e.eventos.map(x => x.tipo)); }
  assert.ok(ev.includes("ricochete"));
  assert.equal(a.blindagem, BLINDAGEM - 1, "o tiro voltou e acertou quem atirou");
});

test("caixote quebra com dois tiros; mina explode no inimigo e abre os caixotes", () => {
  const e = novaPartidaTanques({ modo: "matamata", arena: "deserto", semente: 4, jogadores: [{ bot: null }, { bot: null }] });
  limpar(e);
  const [a, b] = e.tanques;
  b.x = 38; b.z = 38;
  a.x = 5; a.z = 21; a.ang = 0; a.torre = 0;
  e.grade[10 * GRADE + 6] = 2;
  for (let k = 0; k < 2; k++) { a.recarga = 0; for (let i = 0; i < 100; i++) { passoTanques(e, [{ direcao: null, a: i === 0, b: false }, P]); a.torre = 0; } }
  assert.equal(celula(e, 6, 10), 0);
  // Mina de a no caminho de b.
  e.grade[5 * GRADE + 5] = 2;
  a.x = 11; a.z = 11;
  passoTanques(e, [{ direcao: null, a: false, b: true }, P]);
  assert.equal(e.minas.length, 1);
  for (let i = 0; i < 70; i++) passoTanques(e, parado(e));
  b.x = 11.5; b.z = 11;
  passoTanques(e, parado(e));
  assert.ok(e.eventos.some(x => x.tipo === "explosao"));
  assert.ok(b.blindagem < BLINDAGEM);
  assert.equal(celula(e, 5, 5), 0);
});

test("a torre mira sozinha no inimigo à vista", () => {
  const e = novaPartidaTanques({ modo: "matamata", arena: "deserto", semente: 5, jogadores: [{ bot: null }, { bot: null }] });
  limpar(e);
  const [a, b] = e.tanques;
  a.x = 10; a.z = 10; a.ang = 0; a.torre = 0;
  b.x = 10; b.z = 20;
  for (let i = 0; i < 60; i++) passoTanques(e, parado(e));
  assert.ok(Math.abs(a.torre - Math.PI / 2) < 0.05);
});

test("bots de 2 a 8, Mata-Mata e Times: a rodada acaba com vencedor; sozinho, os 10 alvos", () => {
  for (const modo of ["matamata", "times"] as const) for (const n of [2, 4, 8]) {
    const e = novaPartidaTanques({ modo, arena: "fabrica", semente: 30 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    for (let i = 0; i < e.meta + 5 && !e.terminado; i++) passoTanques(e, parado(e));
    assert.ok(e.terminado, `${modo} ${n}`);
    if (modo === "times") assert.ok(e.timeVencedor === 0 || e.timeVencedor === 1 || e.vencedor === null);
  }
  const solo = novaPartidaTanques({ modo: "matamata", arena: "neve", semente: 7, jogadores: [{ bot: "dificil" }] });
  assert.equal(solo.alvos.length, 10);
  for (let i = 0; i < solo.meta + 5 && !solo.terminado; i++) passoTanques(solo, parado(solo));
  assert.equal(solo.vencedor, 0);
  assert.equal(pontosTanques(solo)[0], 1000);
});
