import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_TREINO_MS, TIROS_TREINO, direcaoContraOVento, novaPartidaDuelo, passoDuelo, pontosDuelo, type EstadoDuelo } from "./duelo.ts";
import type { Entrada } from "./bombas.ts";

const P: Entrada = { direcao: null, a: false, b: false };
const ate = (e: EstadoDuelo, cond: () => boolean, ent: (e: EstadoDuelo) => Entrada[] = () => [], limite = 2000) => {
  for (let i = 0; i < limite && !cond(); i++) passoDuelo(e, ent(e));
};
const atira = (e: EstadoDuelo, quem: number) => {
  const lista = e.atiradores.map(() => P);
  lista[quem] = { direcao: direcaoContraOVento(e.vento), a: true, b: false };
  passoDuelo(e, lista);
  passoDuelo(e, e.atiradores.map(() => P));
};

test("atirar antes do sinal queima a largada; o rival vence o duelo", () => {
  const e = novaPartidaDuelo({ modo: "duelo", semente: 1, jogadores: [{ bot: null }, { bot: null }] });
  passoDuelo(e, [P, P]);
  atira(e, 0);
  assert.equal(e.atiradores[0].queimou, true);
  ate(e, () => e.fase === "sinal");
  atira(e, 1);
  ate(e, () => e.terminado);
  assert.equal(e.vencedor, 1);
});

test("o mais rápido depois do sinal vence; vento exige a seta contra o vento", () => {
  let semente = 1;
  let e = novaPartidaDuelo({ modo: "duelo", semente, jogadores: [{ bot: null }, { bot: null }] });
  while (!e.vento) e = novaPartidaDuelo({ modo: "duelo", semente: ++semente, jogadores: [{ bot: null }, { bot: null }] });
  ate(e, () => e.fase === "sinal");
  // Atira sem compensar: erra e recarrega.
  passoDuelo(e, [{ direcao: null, a: true, b: false }, P]);
  assert.ok(e.eventos.some(ev => ev.tipo === "errou"));
  passoDuelo(e, [P, P]);
  atira(e, 1);
  ate(e, () => e.terminado);
  assert.equal(e.vencedor, 1);
  assert.ok(e.atiradores[1].reacoes[0] > 0);
  assert.equal(direcaoContraOVento("esquerda"), "direita");
  assert.equal(direcaoContraOVento(null), null);
});

test("fintas aparecem antes do sinal de verdade", () => {
  let achou = false;
  for (let s = 1; s < 40 && !achou; s++) {
    const e = novaPartidaDuelo({ modo: "duelo", semente: s, jogadores: [{ bot: null }, { bot: null }] });
    if (e.fintas.length) { achou = true; assert.ok(e.fintas.every(f => f.em < e.sinalEm)); }
  }
  assert.ok(achou);
});

test("treino sozinho: 5 sinais; média abaixo de 450 ms cumpre o desafio", () => {
  const e = novaPartidaDuelo({ modo: "duelo", semente: 3, jogadores: [{ bot: null }] });
  assert.equal(e.modo, "treino");
  for (let t = 0; t < TIROS_TREINO; t++) {
    ate(e, () => e.fase === "sinal");
    for (let k = 0; k < 12; k++) passoDuelo(e, [P]);
    atira(e, 0);
    ate(e, () => e.fase === "espera" || e.terminado);
  }
  ate(e, () => e.terminado);
  assert.equal(e.atiradores[0].reacoes.length, TIROS_TREINO);
  assert.ok(e.atiradores[0].reacoes.every(ms => ms < MEDIA_TREINO_MS));
  assert.equal(e.vencedor, 0);
  assert.ok(pontosDuelo(e.atiradores[0]) > 3000);
});

test("torneio: chaveamento 1 × 1 até sobrar o campeão", () => {
  const e = novaPartidaDuelo({ modo: "torneio", semente: 4, jogadores: Array.from({ length: 5 }, () => ({ bot: "medio" as const })) });
  assert.equal(e.atiradores.filter(a => a.noDuelo).length, 2);
  ate(e, () => e.terminado, () => [], 60 * 300);
  assert.equal(e.terminado, true);
  assert.notEqual(e.vencedor, null);
  assert.equal(e.atiradores.filter(a => a.fora).length, 4);
});

test("bots: o Difícil saca mais rápido que o Fácil", () => {
  const media = (dif: "facil" | "dificil") => {
    const tempos: number[] = [];
    for (let s = 1; s <= 30; s++) {
      const e = novaPartidaDuelo({ modo: "duelo", semente: s, jogadores: [{ bot: dif }, { bot: dif }] });
      ate(e, () => e.terminado, () => [], 2000);
      e.atiradores.forEach(a => tempos.push(...a.reacoes));
    }
    return tempos.reduce((a, b) => a + b, 0) / tempos.length;
  };
  assert.ok(media("dificil") < media("facil") - 100);
});
