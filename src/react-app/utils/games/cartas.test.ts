import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVISO_PASSOS, avisar, baralhoCompleto, comprarNaVez, escolherCor, jogar, novaPartidaCartas, passoCartas, podeJogar, pontosCartas, topo,
  type EstadoCartas,
} from "./cartas.ts";

const P = { direcao: null, a: false, b: false } as const;
const andar = (e: EstadoCartas, n: number) => { for (let i = 0; i < n; i++) passoCartas(e, e.jogadores.map(() => P)); };
const pronto = (e: EstadoCartas) => { while (e.passo < e.esperaAte) andar(e, 1); };
/** Põe a mesa num estado conhecido: topo, cor e mãos. */
function mesa(e: EstadoCartas, t: string, maos: string[][]) {
  e.descarte = [t];
  e.corAtual = t[0] as "r";
  maos.forEach((m, i) => { e.jogadores[i].mao = [...m]; });
  e.vez = 0;
  e.inicioVez = e.passo;
  e.etapa = "jogar";
  e.acumulado = 0;
  e.sentido = 1;
  pronto(e);
}

test("baralho de 108 e mãos de 7 (5 no Rápido); mesa começa com número", () => {
  assert.equal(baralhoCompleto().length, 108);
  const e = novaPartidaCartas({ modo: "classico", semente: 1, jogadores: [{ bot: null }, { bot: null }, { bot: null }] });
  assert.ok(e.jogadores.every(j => j.mao.length === 7));
  assert.match(topo(e), /^[rgby]\d$/);
  const r = novaPartidaCartas({ modo: "rapido", semente: 1, jogadores: [{ bot: null }, { bot: null }] });
  assert.ok(r.jogadores.every(j => j.mao.length === 5));
  const s = novaPartidaCartas({ modo: "classico", semente: 1, jogadores: [{ bot: null }] });
  assert.equal(s.jogadores.length, 4, "sozinho: 3 bots completam a mesa");
});

test("cor, número ou símbolo; +4 só sem carta da cor", () => {
  const e = novaPartidaCartas({ modo: "classico", semente: 2, jogadores: [{ bot: null }, { bot: null }] });
  mesa(e, "r5", [["g5", "b7", "w+4", "r1"], ["y1"]]);
  const j = e.jogadores[0];
  assert.equal(podeJogar(e, j, "g5"), true);
  assert.equal(podeJogar(e, j, "r1"), true);
  assert.equal(podeJogar(e, j, "b7"), false);
  assert.equal(podeJogar(e, j, "w+4"), false, "tem vermelho na mão");
  assert.equal(jogar(e, 0, "b7"), false);
});

test("Pular, Inverter e +2 no Clássico", () => {
  const e = novaPartidaCartas({ modo: "classico", semente: 3, jogadores: [{ bot: null }, { bot: null }, { bot: null }] });
  mesa(e, "r5", [["rP", "g1"], ["y1", "y2"], ["b1", "b2"]]);
  jogar(e, 0, "rP");
  assert.equal(e.vez, 2, "o 1 perdeu a vez");
  mesa(e, "r5", [["rI", "g1"], ["y1", "y2"], ["b1", "b2"]]);
  jogar(e, 0, "rI");
  assert.equal(e.sentido, -1);
  assert.equal(e.vez, 2);
  mesa(e, "r5", [["r+2", "g1"], ["y1", "y2"], ["b1", "b2"]]);
  jogar(e, 0, "r+2");
  assert.equal(e.jogadores[1].mao.length, 4);
  assert.equal(e.vez, 2);
});

test("coringa pede a cor; comprar pode jogar a comprada", () => {
  const e = novaPartidaCartas({ modo: "classico", semente: 4, jogadores: [{ bot: null }, { bot: null }] });
  mesa(e, "r5", [["wC", "g1"], ["y1", "y2"]]);
  jogar(e, 0, "wC");
  assert.equal(e.etapa, "cor");
  escolherCor(e, 0, "g");
  assert.equal(e.corAtual, "g");
  assert.equal(e.vez, 1);
  mesa(e, "r5", [["g1", "g2"], ["y1"]]);
  e.monte.push("r9");
  comprarNaVez(e, 0);
  assert.equal(e.etapa, "comprada");
  assert.equal(jogar(e, 0, "r9"), true);
});

test("Virada!: avisar a tempo evita a compra; esquecer compra 2", () => {
  const e = novaPartidaCartas({ modo: "classico", semente: 5, jogadores: [{ bot: null }, { bot: null }] });
  mesa(e, "r5", [["r1", "g1"], ["y1", "y2", "y3"]]);
  jogar(e, 0, "r1");
  andar(e, AVISO_PASSOS + 1);
  assert.equal(e.jogadores[0].mao.length, 3, "esqueceu: comprou 2");
  mesa(e, "r5", [["r1", "g1"], ["y1", "y2", "y3"]]);
  avisar(e, 0);
  jogar(e, 0, "r1");
  andar(e, AVISO_PASSOS + 1);
  assert.equal(e.jogadores[0].mao.length, 1);
});

test("Empilhamento Caótico: +2 acumula; 7 troca com quem tem menos; 0 gira as mãos", () => {
  const e = novaPartidaCartas({ modo: "caotico", semente: 6, jogadores: [{ bot: null }, { bot: null }, { bot: null }] });
  mesa(e, "r5", [["r+2", "g1"], ["y+2", "y1"], ["b1", "b2"]]);
  jogar(e, 0, "r+2");
  assert.equal(e.acumulado, 2);
  pronto(e);
  jogar(e, 1, "y+2");
  assert.equal(e.acumulado, 4);
  pronto(e);
  comprarNaVez(e, 2);
  assert.equal(e.jogadores[2].mao.length, 6);
  assert.equal(e.acumulado, 0);
  mesa(e, "r5", [["r7", "g1", "g2", "g3"], ["y1"], ["b1", "b2"]]);
  avisar(e, 1);
  jogar(e, 0, "r7");
  assert.deepEqual(e.jogadores[0].mao, ["y1"]);
  assert.equal(e.jogadores[1].mao.length, 3);
  mesa(e, "r5", [["r0", "g1"], ["y1"], ["b1", "b2"]]);
  jogar(e, 0, "r0");
  assert.deepEqual(e.jogadores[1].mao, ["g1"]);
  assert.deepEqual(e.jogadores[2].mao, ["y1"]);
});

test("bots jogam até alguém zerar; vencedor leva os pontos dos rivais", () => {
  for (const modo of ["classico", "caotico", "rapido"] as const) {
    const e = novaPartidaCartas({ modo, semente: 7, jogadores: Array.from({ length: 8 }, (_v, i) => ({ bot: (["facil", "medio", "dificil"] as const)[i % 3] })) });
    for (let i = 0; i < 400000 && !e.terminado; i++) passoCartas(e, []);
    assert.ok(e.terminado, modo);
    assert.equal(e.jogadores[e.vencedor!].mao.length, 0);
    const p = pontosCartas(e);
    assert.ok(p[e.vencedor!] > 0 && p.filter(x => x > 0).length === 1);
    const total = 108;
    assert.equal(e.monte.length + e.descarte.length + e.jogadores.reduce((s, j) => s + j.mao.length, 0), total, "nenhuma carta some");
  }
});
