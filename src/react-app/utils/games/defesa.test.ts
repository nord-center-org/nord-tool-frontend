import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, ESTRADA, PONTOS_OBRA, TORRES, VIDA_BASE, distEstrada, novaPartidaDefesa, passoDefesa, pontosDefesa, precoMelhoria, usar, type EstadoDefesa } from "./defesa.ts";

const P = { direcao: null, a: false, b: false } as const;
const parado = (e: EstadoDefesa) => e.jogadores.map(() => P);
const ate = (e: EstadoDefesa, cond: () => boolean, limite = 120000) => { for (let i = 0; i < limite && !cond(); i++) passoDefesa(e, parado(e)); };

test("pontos de obra ficam ao lado da estrada, sem encostar nela; a estrada termina na base", () => {
  for (const p of PONTOS_OBRA) {
    const d = distEstrada(p.x, p.y);
    assert.ok(d > 1.2 && d < 3.2, `ponto ${p.x},${p.y} a ${d.toFixed(2)} da estrada`);
  }
  assert.deepEqual(ESTRADA[ESTRADA.length - 1], BASE);
});

test("sem torres, os inimigos chegam na base e a vida dela cai até o fim de jogo", () => {
  const e = novaPartidaDefesa({ modo: "cooperativo", semente: 1, jogadores: [{ bot: null }] });
  ate(e, () => e.terminado);
  assert.ok(e.terminado);
  assert.equal(e.vidaBase, 0);
  assert.equal(e.venceram, false);
  assert.equal(e.vencedor, null);
});

test("B no ponto de obra ergue a torre escolhida e depois melhora; fora dele troca a escolha", () => {
  const e = novaPartidaDefesa({ modo: "cooperativo", semente: 2, jogadores: [{ bot: null }] });
  const j = e.jogadores[0];
  j.x = 1; j.y = 18;
  const antes = j.escolha;
  usar(e, j);
  assert.notEqual(j.escolha, antes);
  j.escolha = "flecha";
  Object.assign(j, PONTOS_OBRA[0]);
  const ouro = e.ouro;
  usar(e, j);
  assert.equal(e.torres.length, 1);
  assert.equal(e.ouro, ouro - TORRES.flecha.preco);
  usar(e, j);
  assert.equal(e.torres[0].nivel, 2);
  assert.equal(e.ouro, ouro - TORRES.flecha.preco - precoMelhoria(1));
  e.ouro = 0;
  usar(e, j);
  assert.equal(e.torres[0].nivel, 2, "sem ouro não melhora");
  assert.ok(e.eventos.some(ev => ev.tipo === "semOuro"));
});

test("torre derruba o inimigo que passa e o ouro vai para o time; cristal coletado também", () => {
  const e = novaPartidaDefesa({ modo: "cooperativo", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  e.torres.push({ ponto: 0, tipo: "flecha", nivel: 3, dono: 1, recarga: 0, mira: 0 });
  e.inimigos.push({ id: 900, tipo: "normal", x: 3, y: 4, trecho: 0, hp: 2, hpMax: 2, lentoAte: 0 });
  const ouro = e.ouro;
  for (let i = 0; i < 120 && e.inimigos.length; i++) passoDefesa(e, parado(e));
  assert.equal(e.inimigos.length, 0);
  assert.ok(e.ouro > ouro);
  assert.equal(e.jogadores[1].abates, 1);
  const c = e.cristais[0];
  const j = e.jogadores[0];
  j.x = c.x; j.y = c.y;
  const antes = e.ouro;
  passoDefesa(e, parado(e));
  assert.ok(e.ouro >= antes + c.valor);
  assert.equal(j.coletas, 1);
});

test("só bots, de 1 a 8: constroem torres e aguentam ondas; no cooperativo a 8 terminam com MVP", () => {
  for (const n of [1, 4, 8]) {
    const e = novaPartidaDefesa({ modo: "cooperativo", semente: 10 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    ate(e, () => e.terminado, 200000);
    assert.ok(e.torres.length >= 4, `${n} bots construíram ${e.torres.length} torres`);
    assert.ok(e.onda >= 4, `${n} bots chegaram à onda ${e.onda}`);
    if (e.venceram) assert.notEqual(e.vencedor, null);
    assert.ok(pontosDefesa(e, e.jogadores[0]) > 0);
    assert.ok(e.vidaBase <= VIDA_BASE);
  }
});

test("Infinito: a cada 5 ondas vem um chefão e o fim fica com quem mais pontuou", () => {
  const e = novaPartidaDefesa({ modo: "infinito", semente: 5, jogadores: [{ bot: "medio" }, { bot: "medio" }] });
  let chefe = false;
  for (let i = 0; i < 300000 && !e.terminado; i++) { passoDefesa(e, parado(e)); if (e.eventos.some(ev => ev.tipo === "onda" && ev.chefe)) chefe = true; }
  assert.ok(e.terminado);
  assert.ok(chefe, "veio chefão");
  assert.ok(e.onda >= 5);
  assert.notEqual(e.vencedor, null);
});
