import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALTURA, ESCONDIDAS, LARGURA, LIXO, META_SPRINT, TIPOS, alturaDeQueda, ataqueDe, cabe, girar, melhorEncaixe, novaPartidaEncaixe, notaDaGrade, passoEncaixe,
  type EstadoEncaixe, type TipoPeca,
} from "./encaixe.ts";
import type { Entrada } from "./bombas.ts";

const P: Entrada = { direcao: null, a: false, b: false };
const press = (e: EstadoEncaixe, ent: Entrada, i = 0) => {
  const lista = e.tabuleiros.map(() => P);
  lista[i] = ent;
  passoEncaixe(e, lista);
  const solta = e.tabuleiros.map(() => P);
  passoEncaixe(e, solta);
};

test("saco de 7: as 7 peças aparecem a cada 7, e todos recebem a mesma sequência", () => {
  const e = novaPartidaEncaixe({ modo: "versus", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.tabuleiros;
  const seqA = [a.peca!.tipo, ...a.fila.slice(0, 6)];
  assert.deepEqual([...seqA].sort(), [...TIPOS].sort());
  assert.deepEqual([b.peca!.tipo, ...b.fila.slice(0, 6)], seqA);
});

test("queda rápida trava a peça no fundo e chama a próxima", () => {
  const e = novaPartidaEncaixe({ modo: "maratona", semente: 1, jogadores: [{ bot: null }] });
  const t = e.tabuleiros[0];
  const tipo = t.peca!.tipo;
  press(e, { direcao: "cima", a: false, b: false });
  assert.ok(t.grade[ALTURA + ESCONDIDAS - 1].some(c => c === TIPOS.indexOf(tipo) + 1), "peça no fundo");
  assert.ok(t.pontos > 0, "queda rápida pontua");
  assert.notEqual(t.peca, null);
});

test("girar com chute de parede encostado na parede", () => {
  const e = novaPartidaEncaixe({ modo: "maratona", semente: 1, jogadores: [{ bot: null }] });
  const t = e.tabuleiros[0];
  t.peca = { tipo: "I", rot: 1, x: -2, y: 5 };
  assert.ok(cabe(t.grade, "I", 1, -2, 5));
  assert.equal(girar(t), true, "gira mesmo colado na parede");
  assert.ok(cabe(t.grade, "I", t.peca.rot, t.peca.x, t.peca.y));
  t.peca = { tipo: "O", rot: 0, x: 3, y: 3 };
  assert.equal(girar(t), false, "O não gira");
});

test("segurar troca a peça e só uma vez por peça", () => {
  const e = novaPartidaEncaixe({ modo: "maratona", semente: 2, jogadores: [{ bot: null }] });
  const t = e.tabuleiros[0];
  const primeira = t.peca!.tipo;
  const segunda = t.fila[0];
  press(e, { direcao: null, a: false, b: true });
  assert.equal(t.guardada, primeira);
  assert.equal(t.peca!.tipo, segunda);
  press(e, { direcao: null, a: false, b: true });
  assert.equal(t.peca!.tipo, segunda, "não troca de novo antes de travar");
});

test("tabela de ataque do gênero", () => {
  assert.equal(ataqueDe(1, 0, false, false), 0);
  assert.equal(ataqueDe(2, 0, false, false), 1);
  assert.equal(ataqueDe(3, 0, false, false), 2);
  assert.equal(ataqueDe(4, 0, false, false), 4);
  assert.equal(ataqueDe(4, 0, true, false), 5, "seguida de 4 linhas");
  assert.equal(ataqueDe(1, 4, false, false), 2, "combo");
  assert.equal(ataqueDe(2, 0, false, true), 11, "limpou tudo");
});

function linhaQuase(buraco: number) {
  const l = Array(LARGURA).fill(LIXO);
  l[buraco] = 0;
  return l;
}

test("limpar 4 linhas manda lixo para o rival, que sobe quando ele encaixa sem limpar", () => {
  const e = novaPartidaEncaixe({ modo: "versus", semente: 4, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.tabuleiros;
  for (let y = 18; y < 22; y++) a.grade[y] = linhaQuase(9);
  a.grade[17][0] = LIXO; // sobra um bloco: não é "limpou tudo"
  a.peca = { tipo: "I", rot: 1, x: 7, y: 2 };
  press(e, { direcao: "cima", a: false, b: false }, 0);
  assert.equal(a.linhas, 4);
  assert.deepEqual(b.lixoPendente, [4]);
  press(e, { direcao: "cima", a: false, b: false }, 1);
  assert.equal(b.grade.slice(-4).filter(l => l.filter(c => c === LIXO).length === LARGURA - 1).length, 4, "4 linhas de lixo com um buraco");
});

test("topo cheio é nocaute e o último vivo vence", () => {
  const e = novaPartidaEncaixe({ modo: "versus", semente: 5, jogadores: [{ bot: null }, { bot: null }] });
  const a = e.tabuleiros[0];
  for (let y = 0; y < 22; y++) a.grade[y] = linhaQuase(y % 2 ? 0 : 9);
  for (let i = 0; i < 4 && !e.terminado; i++) press(e, { direcao: "cima", a: false, b: false }, 0);
  assert.equal(a.vivo, false);
  assert.equal(e.terminado, true);
  assert.equal(e.vencedor, 1);
});

test("heurística: prefere completar linha e evitar buraco", () => {
  const g = Array.from({ length: 22 }, () => Array(LARGURA).fill(0));
  for (let x = 0; x < 9; x++) g[21][x] = 1;
  const m = melhorEncaixe(g, "I", 0);
  const cells = [[m.x, 0]];
  assert.ok(cells.length > 0);
  // Encaixe vertical do I na coluna 9 limpa a linha.
  assert.equal(m.rot % 2, 1);
  const vazio = Array.from({ length: 22 }, () => Array(LARGURA).fill(0));
  const comBuraco = vazio.map(l => [...l]);
  comBuraco[21] = [1, 1, 1, 0, 1, 1, 1, 1, 1, 1];
  comBuraco[20] = [0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  assert.ok(notaDaGrade(comBuraco, 0) < notaDaGrade(vazio, 0));
});

test("Sprint: quem chega a 40 linhas vence; sozinho, Versus vira Maratona", () => {
  const e = novaPartidaEncaixe({ modo: "sprint", semente: 6, jogadores: [{ bot: null }, { bot: null }] });
  e.tabuleiros[1].linhas = META_SPRINT;
  passoEncaixe(e, [P, P]);
  assert.equal(e.vencedor, 1);
  assert.equal(novaPartidaEncaixe({ modo: "versus", jogadores: [{ bot: null }] }).modo, "maratona");
});

test("bots jogam sozinhos e limpam linhas (Difícil limpa mais que o Fácil)", () => {
  const linhas = (dif: "facil" | "dificil") => {
    const e = novaPartidaEncaixe({ modo: "maratona", semente: 9, jogadores: [{ bot: dif }] });
    for (let i = 0; i < 60 * 90 && !e.terminado; i++) passoEncaixe(e, []);
    return e.tabuleiros[0].linhas;
  };
  const d = linhas("dificil"), f = linhas("facil");
  assert.ok(d >= 10, `difícil limpou ${d}`);
  assert.ok(d >= f, `difícil ${d} ≥ fácil ${f}`);
});

test("fantasma mostra onde a peça cai", () => {
  const e = novaPartidaEncaixe({ modo: "maratona", semente: 7, jogadores: [{ bot: null }] });
  const t = e.tabuleiros[0];
  const y = alturaDeQueda(t);
  assert.ok(y > 15);
  assert.ok(!cabe(t.grade, t.peca!.tipo as TipoPeca, t.peca!.rot, t.peca!.x, y + 1));
});
