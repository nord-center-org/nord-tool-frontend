import { test } from "node:test";
import assert from "node:assert/strict";
import { ALTURA, LARGURA, TEMPO, cabeNoPrato, type Item, celulaEm, idx, novaPartidaCozinha, passoCozinha, pontosCozinha, type Cozinheiro, type EstadoCozinha } from "./cozinha.ts";
import type { Direcao } from "./bombas.ts";

const P = { direcao: null, a: false, b: false } as const;
/** Põe o cozinheiro no chão (x, z) virado para `dir`. */
const em = (s: Cozinheiro, x: number, z: number, dir: Direcao) => { s.x = x + 0.5; s.z = z + 0.5; s.dir = dir; s.aAnterior = false; };
const A = (e: EstadoCozinha) => { passoCozinha(e, [{ direcao: null, a: true, b: false }]); passoCozinha(e, [P]); };
const B = (e: EstadoCozinha, n: number) => { for (let i = 0; i < n; i++) passoCozinha(e, [{ direcao: null, a: false, b: true }]); };
const mao = (s: Cozinheiro) => s.mao as Item | null;
const solo = (semente = 1) => novaPartidaCozinha({ modo: "coop", tema: "bistro", semente, jogadores: [{ bot: null }] });

test("planta: estações certas e todos nascem no chão", () => {
  const e = novaPartidaCozinha({ modo: "coop", tema: "bistro", semente: 1, jogadores: Array.from({ length: 8 }, () => ({ bot: null })) });
  assert.equal(e.largura, LARGURA);
  const tipos = new Set(e.celulas.map(c => c.tipo));
  for (const t of ["caixa", "tabua", "fogao", "pia", "retorno", "pilha", "entrega", "lixeira"]) assert.ok(tipos.has(t as never), t);
  for (const s of e.cozinheiros) assert.equal(celulaEm(e, Math.floor(s.x), Math.floor(s.z))!.tipo, "chao");
  const d = novaPartidaCozinha({ modo: "duelo", tema: "food", semente: 1, jogadores: Array.from({ length: 4 }, () => ({ bot: null })) });
  assert.equal(d.cozinhas, 2);
  assert.ok(d.cozinheiros.every(s => Math.floor(s.x / LARGURA) === s.time));
  assert.equal(d.celulas.length, LARGURA * 2 * ALTURA);
});

test("prato só aceita o que leva a uma receita", () => {
  assert.ok(cabeNoPrato([], "alface"));
  assert.ok(cabeNoPrato(["alface"], "tomate"));
  assert.ok(cabeNoPrato(["pao", "carne"], "alface"));
  assert.equal(cabeNoPrato(["sopa"], "pao"), false);
  assert.equal(cabeNoPrato(["tomate"], "tomate"), false);
});

test("salada do começo ao fim: pega, corta, monta, entrega e o prato volta sujo para lavar", () => {
  const e = solo();
  e.pedidos = []; e.proximoPedido = [1e9];
  e.pedidos.push({ id: 99, receita: "salada", cozinha: 0, criado: 0, prazo: 3600 });
  const s = e.cozinheiros[0];
  // Prato da pilha (5,2) apoiado no balcão (4,2).
  em(s, 5, 1, "baixo"); A(e); assert.equal(s.mao?.k, "prato");
  em(s, 3, 2, "direita"); A(e); assert.equal(e.celulas[idx(e, 4, 2)].item?.k, "prato");
  for (const [cx, ing] of [[2, "alface"], [1, "tomate"]] as const) {
    em(s, cx, 1, "cima"); A(e); assert.equal(mao(s)?.k === "ing" && (mao(s) as { ing: string }).ing, ing);
    em(s, 1, 1, "esquerda"); A(e); // tábua (0,1)
    B(e, 89); assert.ok((e.celulas[idx(e, 0, 1)].item as { corte: number }).corte < 1);
    B(e, 2); A(e); assert.equal((mao(s) as { corte: number }).corte, 1);
    em(s, 3, 2, "direita"); A(e);
  }
  const prato = e.celulas[idx(e, 4, 2)].item;
  assert.deepEqual(prato?.k === "prato" && prato.itens, ["alface", "tomate"]);
  A(e); assert.equal(s.mao?.k, "prato");
  em(s, 10, 1, "cima"); A(e); // entrega (10,0)
  assert.equal(e.pedidos.length, 0);
  assert.ok(e.pontos[0] >= 20);
  for (let i = 0; i < 301; i++) passoCozinha(e, [P]);
  const retorno = e.celulas[idx(e, 12, 2)];
  assert.equal(retorno.pratos, 1);
  const pilha = e.celulas[idx(e, 5, 2)].pratos;
  em(s, 11, 2, "direita"); A(e); assert.equal(s.mao?.k, "sujos");
  em(s, 11, 3, "direita"); A(e); B(e, 80);
  assert.equal(e.celulas[idx(e, 5, 2)].pratos, pilha + 1);
});

test("frigideira esquecida queima, pega fogo, espalha e o extintor apaga", () => {
  const e = solo(2);
  e.proximoPedido = [1e9];
  const f = e.celulas[idx(e, 8, 0)];
  assert.equal(f.item?.k, "frigideira");
  Object.assign(f.item!, { carne: true, coz: 0 });
  const ev: string[] = [];
  for (let i = 0; i < 300 * 2.4 + 5; i++) { passoCozinha(e, [P]); ev.push(...e.eventos.map(x => x.tipo)); }
  assert.ok(ev.includes("pronto") && ev.includes("queimou") && ev.includes("fogo"));
  assert.ok(f.fogo > 0);
  for (let i = 0; i < 240 * 4; i++) passoCozinha(e, [P]);
  assert.ok(e.celulas.filter(c => c.fogo > 0).length > 1, "espalhou");
  const s = e.cozinheiros[0];
  em(s, 7, 1, "baixo"); A(e); assert.equal(s.mao?.k, "extintor"); // extintor em (7,2)
  for (let guarda = 0; guarda < 4000 && e.celulas.some(c => c.fogo > 0); guarda++) {
    const alvo = e.celulas.findIndex(c => c.fogo > 0), ax = alvo % e.largura, az = Math.floor(alvo / e.largura);
    // Fica numa célula de chão vizinha e borrifa.
    const viz = ([[0, 1, "cima"], [0, -1, "baixo"], [1, 0, "esquerda"], [-1, 0, "direita"]] as const).find(([dx, dz]) => celulaEm(e, ax + dx, az + dz)?.tipo === "chao");
    if (!viz) { e.celulas[alvo].fogo = 0; continue; }
    em(s, ax + viz[0], az + viz[1], viz[2]); B(e, 1);
  }
  assert.ok(e.celulas.every(c => c.fogo === 0));
});

test("pedido vencido tira 10 e zera o combo", () => {
  const e = solo(3);
  e.proximoPedido = [1e9]; e.pontos[0] = 50; e.combo[0] = 3;
  e.pedidos.push({ id: 1, receita: "sopa", cozinha: 0, criado: 0, prazo: e.passo + 2 });
  passoCozinha(e, [P]); passoCozinha(e, [P]);
  assert.equal(e.pontos[0], 40);
  assert.equal(e.combo[0], 0);
});

test("bots cozinham as quatro receitas no Cooperativo e no Duelo, de 1 a 8", () => {
  for (const [modo, n] of [["coop", 1], ["coop", 3], ["coop", 8], ["duelo", 2], ["duelo", 8]] as const) {
    const e = novaPartidaCozinha({ modo, tema: "navio", semente: 20 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    const feitas = new Set<string>();
    while (!e.terminado) { passoCozinha(e, []); for (const ev of e.eventos) if (ev.tipo === "entrega") feitas.add(ev.receita); }
    assert.equal(e.passo, TEMPO);
    assert.equal(feitas.size, 4, `${modo} ${n}: ${[...feitas]}`);
    assert.ok(e.pontos.every(p => p >= e.meta), `${modo} ${n}: ${e.pontos} meta ${e.meta}`);
    assert.equal(pontosCozinha(e).length, n);
    if (modo === "coop") assert.notEqual(e.vencedor, null);
  }
});
