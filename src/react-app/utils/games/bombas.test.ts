import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENTRADA_VAZIA, PAVIO, alcance, aplicar, celula, espiral, idx, largadas, mapaDePerigo, novaPartida, passo, type Configuracao, type Estado,
} from "./bombas.ts";

const quatro = (bot: "facil" | "medio" | "dificil" | null = null): Configuracao => ({
  modo: "sobrevivencia", bioma: "fabrica", semente: 42,
  jogadores: [{ nome: "P1", bot }, { nome: "P2", bot: "medio" }, { nome: "P3", bot: "medio" }, { nome: "P4", bot: "medio" }],
});

function limpar(e: Estado) {
  for (let i = 0; i < e.grade.length; i++) if (e.grade[i] === "caixa") e.grade[i] = "chao";
}

test("mapa clássico: borda e pilares fixos, largadas livres, 15x13 até 4 e 17x15 até 8", () => {
  const e = novaPartida(quatro());
  assert.equal(e.largura, 15);
  assert.equal(e.altura, 13);
  assert.equal(celula(e, 0, 5), "pilar");
  assert.equal(celula(e, 2, 2), "pilar");
  for (const j of e.jogadores) {
    assert.equal(celula(e, j.x, j.y), "chao");
    assert.ok(celula(e, j.x + 1, j.y) !== "caixa" || celula(e, j.x - 1, j.y) !== "caixa");
  }
  const oito = novaPartida({ ...quatro(), jogadores: Array.from({ length: 8 }, (_, i) => ({ nome: `P${i + 1}`, bot: "medio" as const })) });
  assert.equal(oito.largura, 17);
  assert.equal(new Set(oito.jogadores.map(j => `${j.x},${j.y}`)).size, 8);
  assert.ok(largadas(17, 15).every(([x, y]) => x % 2 === 1 && y % 2 === 1), "largadas fora dos pilares");
});

test("mesma semente, mesmo mapa", () => {
  assert.deepEqual(novaPartida(quatro()).grade, novaPartida(quatro()).grade);
});

test("chama em cruz para no pilar e na primeira caixa", () => {
  const e = novaPartida(quatro());
  limpar(e);
  e.grade[idx(e, 3, 1)] = "caixa";
  e.grade[idx(e, 4, 1)] = "caixa";
  const casas = alcance(e, 1, 1, 5);
  assert.ok(casas.some(c => c.x === 3 && c.y === 1), "atinge a primeira caixa");
  assert.ok(!casas.some(c => c.x === 4 && c.y === 1), "não passa da caixa");
  assert.ok(!casas.some(c => c.x === 0), "não atravessa a borda");
});

test("bomba explode no pavio, destrói caixa e mata quem está na chama", () => {
  const e = novaPartida(quatro());
  limpar(e);
  e.grade[idx(e, 3, 1)] = "caixa";
  const p1 = e.jogadores[0];
  passo(e, [{ direcao: null, a: true, b: false }]);
  assert.equal(e.bombas.length, 1);
  // P1 fica parado em cima da bomba
  for (let i = 0; i < PAVIO + 2; i++) passo(e, [ENTRADA_VAZIA]);
  assert.equal(celula(e, 3, 1), "chao", "caixa destruída");
  assert.equal(p1.vivo, false, "quem ficou na chama morre");
});

test("reação em cadeia: a chama detona a outra bomba no mesmo passo", () => {
  const e = novaPartida(quatro());
  limpar(e);
  e.jogadores.forEach(j => (j.vivo = j.id !== 0 ? j.vivo : false));
  e.bombas.push({ id: 90, dono: 1, x: 5, y: 1, fogo: 2, pavio: 1, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: 5, destinoY: 1, origemX: 5, origemY: 1 });
  e.bombas.push({ id: 91, dono: 1, x: 7, y: 1, fogo: 2, pavio: 999, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: 7, destinoY: 1, origemX: 7, origemY: 1 });
  passo(e, []);
  assert.equal(e.bombas.length, 0);
  assert.ok(e.chamas.some(c => c.x === 9 && c.y === 1), "a segunda bomba explodiu");
});

test("escudo segura um golpe; power-ups aplicam", () => {
  const e = novaPartida(quatro());
  const j = e.jogadores[0];
  aplicar(e, j, "bomba"); aplicar(e, j, "fogo"); aplicar(e, j, "patins"); aplicar(e, j, "escudo"); aplicar(e, j, "chute");
  assert.deepEqual([j.bombas, j.fogo, j.chute, j.escudo], [2, 3, true, true]);
  assert.ok(j.velocidade > 3.6);
  aplicar(e, j, "fogoTotal");
  assert.equal(j.fogo, 10);
  aplicar(e, j, "caveira");
  assert.ok(j.maldicao);
  limpar(e);
  e.chamas.push({ x: j.x, y: j.y, ate: e.passo + 10, centro: true, eixo: "c" });
  passo(e, []);
  assert.equal(j.vivo, true, "o escudo segurou");
  assert.equal(j.escudo, false);
});

test("chute: andar contra a bomba a faz deslizar até o obstáculo", () => {
  const e = novaPartida(quatro());
  limpar(e);
  const j = e.jogadores[0];
  j.chute = true;
  e.bombas.push({ id: 5, dono: 1, x: 2, y: 1, fogo: 1, pavio: 9999, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: 2, destinoY: 1, origemX: 2, origemY: 1 });
  for (let i = 0; i < 120; i++) passo(e, [{ direcao: i < 2 ? "direita" : null, a: false, b: false }]);
  assert.ok(e.bombas[0].x > 4, `deslizou (x=${e.bombas[0].x})`);
});

test("mapa de perigo marca o alcance antes de explodir", () => {
  const e = novaPartida(quatro());
  limpar(e);
  const p = mapaDePerigo(e, { x: 5, y: 1, fogo: 2 });
  assert.equal(p[idx(e, 7, 1)], PAVIO);
  assert.equal(p[idx(e, 9, 1)], Infinity);
});

test("espiral da morte súbita cobre todo o interior", () => {
  const s = espiral(15, 13);
  assert.equal(new Set(s.map(([x, y]) => `${x},${y}`)).size, 13 * 11);
});

for (const dif of ["facil", "medio", "dificil"] as const) {
  test(`partida só de bots (${dif}) termina sem erro e com vencedor ou empate`, () => {
    const e = novaPartida({ ...quatro(dif), jogadores: quatro(dif).jogadores.map(j => ({ ...j, bot: dif })), segundos: 90 });
    let n = 0;
    while (!e.terminado && n++ < 90 * 60 + 10) passo(e, []);
    assert.ok(e.terminado);
    assert.ok(e.passo <= 90 * 60);
  });
}

test("bots difíceis sobrevivem mais que os fáceis (média de 6 partidas)", () => {
  let vitoriasDificil = 0;
  for (let s = 1; s <= 6; s++) {
    const e = novaPartida({ modo: "sobrevivencia", bioma: "gelo", semente: s * 101, segundos: 120,
      jogadores: [{ nome: "D1", bot: "dificil" }, { nome: "F1", bot: "facil" }, { nome: "D2", bot: "dificil" }, { nome: "F2", bot: "facil" }] });
    while (!e.terminado) passo(e, []);
    if (e.vencedor === 0 || e.vencedor === 2) vitoriasDificil++;
  }
  assert.ok(vitoriasDificil >= 3, `difíceis venceram ${vitoriasDificil} de 6`);
});

test("modo moedas: termina no tempo e quem tem mais moedas vence", () => {
  const e = novaPartida({ ...quatro("medio"), modo: "moedas", segundos: 40, jogadores: quatro("medio").jogadores.map(j => ({ ...j, bot: "medio" as const })) });
  while (!e.terminado) passo(e, []);
  const max = Math.max(...e.jogadores.map(j => j.moedas));
  if (e.vencedor !== null) assert.equal(e.jogadores[e.vencedor].moedas, max);
});

test("modo times: termina quando sobra um time", () => {
  const e = novaPartida({ ...quatro("medio"), modo: "times", segundos: 120, jogadores: quatro("medio").jogadores.map(j => ({ ...j, bot: "dificil" as const })) });
  while (!e.terminado) passo(e, []);
  if (e.timeVencedor !== null) assert.ok(e.jogadores.filter(j => j.vivo).every(j => j.time === e.timeVencedor));
});

test("sozinho: Desafio vence ao limpar todas as caixas e perde ao cair ou no fim do tempo", async () => {
  const solo: Configuracao = { modo: "sobrevivencia", bioma: "fabrica", semente: 7, jogadores: [{ nome: "Eu", bot: null }] };
  const e = novaPartida(solo);
  assert.equal(e.jogadores.length, 1);
  assert.ok(e.grade.includes("caixa"));
  passo(e, [ENTRADA_VAZIA]);
  assert.equal(e.terminado, false, "com caixas no mapa, continua");
  e.grade = e.grade.map(c => (c === "caixa" ? "chao" : c));
  passo(e, [ENTRADA_VAZIA]);
  assert.equal(e.terminado, true);
  assert.equal(e.vencedor, 0);

  const caiu = novaPartida(solo);
  caiu.jogadores[0].vivo = false;
  passo(caiu, [ENTRADA_VAZIA]);
  assert.equal(caiu.terminado, true);
  assert.equal(caiu.vencedor, null);

  const tempo = novaPartida({ ...solo, segundos: 1 });
  for (let i = 0; i < 61 && !tempo.terminado; i++) passo(tempo, [ENTRADA_VAZIA]);
  assert.equal(tempo.terminado, true);
  assert.equal(tempo.vencedor, null);
});

test("sozinho na Caça às Moedas: vence quem bate a meta", async () => {
  const { META_MOEDAS_SOLO } = await import("./bombas.ts");
  const solo: Configuracao = { modo: "moedas", bioma: "gelo", semente: 3, segundos: 1, jogadores: [{ nome: "Eu", bot: null }] };
  const pouco = novaPartida(solo);
  for (let i = 0; i < 61 && !pouco.terminado; i++) passo(pouco, [ENTRADA_VAZIA]);
  assert.equal(pouco.vencedor, null);
  const meta = novaPartida(solo);
  meta.jogadores[0].moedas = META_MOEDAS_SOLO;
  for (let i = 0; i < 61 && !meta.terminado; i++) passo(meta, [ENTRADA_VAZIA]);
  assert.equal(meta.vencedor, 0);
});
