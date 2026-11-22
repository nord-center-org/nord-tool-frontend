import { test } from "node:test";
import assert from "node:assert/strict";
import { BANCADAS, PORTAS, TABUAS_MAX, comprar, naCasa, novaPartidaHorda, passoHorda, pontosHorda, type EstadoHorda } from "./horda.ts";

const P = { direcao: null, a: false, b: false } as const;
const ate = (e: EstadoHorda, cond: () => boolean, ent: () => { direcao: null; a: boolean; b: boolean }[] = () => e.jogadores.map(() => P), limite = 60000) => {
  for (let i = 0; i < limite && !cond(); i++) passoHorda(e, ent());
};

test("começa na casa, com tábuas cheias; a 1ª onda chega e os zumbis surgem fora", () => {
  const e = novaPartidaHorda({ modo: "ondas", semente: 1, jogadores: [{ bot: null }, { bot: null }] });
  assert.ok(e.jogadores.every(j => naCasa(j.x, j.y)));
  assert.deepEqual(e.tabuas, PORTAS.map(() => TABUAS_MAX));
  ate(e, () => e.zumbis.length > 0);
  assert.equal(e.onda, 1);
  assert.ok(e.zumbis.every(z => !naCasa(z.x, z.y)));
});

test("zumbis quebram as tábuas para entrar; segurar B na porta repõe", () => {
  const e = novaPartidaHorda({ modo: "ondas", semente: 2, jogadores: [{ bot: null }] });
  ate(e, () => e.tabuas.some(t => t < TABUAS_MAX), undefined, 20000);
  const porta = e.tabuas.findIndex(t => t < TABUAS_MAX);
  assert.ok(porta >= 0, "alguma tábua caiu");
  // Tira os zumbis de perto e conserta.
  e.zumbis = [];
  const j = e.jogadores[0];
  const p = PORTAS[porta];
  j.x = p.eixo === "h" ? p.x : p.x + (p.x === 12 ? 0.9 : -0.9);
  j.y = p.eixo === "h" ? p.y + (p.y === 7 ? 0.9 : -0.9) : p.y;
  const antes = e.tabuas[porta];
  for (let i = 0; i < 40; i++) passoHorda(e, [{ direcao: null, a: false, b: true }]);
  assert.equal(e.tabuas[porta], antes + 1);
  assert.ok(j.dinheiro >= 10);
});

test("atirar mata zumbi e dá dinheiro; bancada compra arma melhor", () => {
  const e = novaPartidaHorda({ modo: "ondas", semente: 3, jogadores: [{ bot: null }] });
  const j = e.jogadores[0];
  e.zumbis.push({ id: 99, tipo: "normal", x: j.x + 3, y: j.y, hp: 1, hpMax: 1, atacaEm: 0, investida: null, chamaEm: 0 });
  j.mira = { x: 1, y: 0 };
  for (let i = 0; i < 20; i++) passoHorda(e, [{ direcao: null, a: true, b: false }]);
  assert.equal(j.abates, 1);
  assert.equal(j.dinheiro, 60);
  j.dinheiro = 600;
  assert.equal(comprar(e, j, "arma"), true);
  assert.equal(j.arma, "espingarda");
  assert.equal(comprar(e, j, "arma"), false, "sem dinheiro para o rifle");
  const c = BANCADAS.find(b => b.tipo === "vida")!;
  j.x = c.x; j.y = c.y; j.dinheiro = 300;
  passoHorda(e, [{ direcao: null, a: false, b: true }]);
  assert.equal(j.hpMax, 125);
});

test("caiu: aliado segurando B levanta; ninguém de pé = fim", () => {
  const e = novaPartidaHorda({ modo: "ondas", semente: 4, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.jogadores;
  a.hp = 0; a.estado = "caido"; a.sangraAte = 99999;
  b.x = a.x + 0.5; b.y = a.y;
  for (let i = 0; i < 125; i++) passoHorda(e, [P, { direcao: null, a: false, b: true }]);
  assert.equal(a.estado, "vivo");
  assert.ok(e.eventos.length >= 0);
  a.estado = "caido"; b.estado = "caido"; a.sangraAte = b.sangraAte = 99999;
  passoHorda(e, [P, P]);
  assert.equal(e.terminado, true);
  assert.equal(e.venceram, false);
});

test("bots sobrevivem às ondas: 4 Difícil chegam pelo menos na onda 4", () => {
  const e = novaPartidaHorda({ modo: "ondas", semente: 5, jogadores: Array.from({ length: 4 }, () => ({ bot: "dificil" as const })) });
  ate(e, () => e.terminado || e.onda >= 5, () => [], 200000);
  assert.ok(e.onda >= 4, `onda ${e.onda}`);
  assert.ok(e.jogadores.some(j => j.abates > 10));
});

test("Chefe: na 4ª onda vem o chefe; Resgate: salvar os sobreviventes vence", () => {
  const e = novaPartidaHorda({ modo: "chefe", semente: 6, jogadores: [{ bot: null }] });
  e.onda = 3; e.fase = "intervalo"; e.faseAte = e.passo + 1;
  passoHorda(e, [P]);
  assert.equal(e.onda, 4);
  assert.ok(e.zumbis.some(z => z.tipo === "chefe"));
  const r = novaPartidaHorda({ modo: "resgate", semente: 7, jogadores: [{ bot: null }] });
  assert.equal(r.civis.length, 3);
  for (const c of r.civis) { c.x = 18; c.y = 11.5; }
  passoHorda(r, [P]);
  assert.equal(r.terminado, true);
  assert.equal(r.venceram, true);
  assert.ok(pontosHorda(r, r.jogadores[0]) >= 900 + 500);
});
