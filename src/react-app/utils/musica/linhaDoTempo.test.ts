import assert from "node:assert/strict";
import { test } from "node:test";

import { lerCifra } from "./cifra.ts";
import { acordesEmOrdem, empurrar, moverSo, picos, temposDasLinhas, temposDosAcordes, temposPadrao, temposValidos } from "./linhaDoTempo.ts";
import { segmentosDaCifra } from "./seguirCifra.ts";

const CIFRA = lerCifra("[Intro] G  D\n\nG       D\nLevanta a parede\nEm      C\nAssenta o tijolo\n");

test("v17: os acordes na ordem do texto", () => {
  assert.deepEqual(acordesEmOrdem(CIFRA).map(a => a.nome), ["G", "D", "G", "D", "Em", "C"]);
});

test("v17: as horas saem das linhas; sem tempo, ficam entre os vizinhos", () => {
  const blocos = CIFRA.blocos.length;
  const tempos = Array.from({ length: blocos }, () => null as number | null);
  const iLevanta = CIFRA.blocos.findIndex(b => b.texto.startsWith("Levanta"));
  const iAssenta = CIFRA.blocos.findIndex(b => b.texto.startsWith("Assenta"));
  tempos[iLevanta] = 10; tempos[iAssenta] = 18;
  const ts = temposPadrao(CIFRA, tempos, 30);
  assert.equal(ts[2], 10);
  assert.equal(ts[4], 18);
  assert.ok(ts[3] > 10 && ts[3] < 18, "o D no meio da linha");
  assert.ok(ts[0] < ts[1] && ts[1] < ts[2], "os da intro, sem tempo, antes da primeira linha");
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i] > ts[i - 1], "sempre em ordem");
});

test("v17: arrastar empurra os seguintes; só este fica entre os vizinhos", () => {
  const ts = [1, 2, 3, 4];
  assert.deepEqual(empurrar(ts, 1, 2.5, 10), [1, 2.5, 3.5, 4.5]);
  assert.deepEqual(empurrar(ts, 1, 0, 10), [1, 1.05, 2.05, 3.05], "não passa do anterior");
  assert.deepEqual(empurrar(ts, 2, 9, 5), [1, 2, 4, 5], "o último não sai da música");
  assert.deepEqual(moverSo(ts, 1, 3.5, 10), [1, 2.95, 3, 4]);
  assert.deepEqual(moverSo(ts, 0, -3, 10), [0, 2, 3, 4]);
});

test("v17: as horas guardadas valem enquanto batem com a cifra", () => {
  assert.ok(temposValidos([1, 2, 3, 4, 5, 6], 6));
  assert.ok(!temposValidos([1, 2], 6), "a cifra mudou: volta ao das linhas");
  const ts = temposDosAcordes(CIFRA, CIFRA.blocos.map(() => null), 30, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ts, [1, 2, 3, 4, 5, 6]);
  const linhas = temposDasLinhas(CIFRA, ts, CIFRA.blocos.map(() => 99));
  assert.equal(linhas[CIFRA.blocos.findIndex(b => b.texto.startsWith("Levanta"))], 3, "a linha começa no primeiro acorde dela");
});

test("v17: o instrumento segue as horas da linha do tempo", () => {
  const seg = segmentosDaCifra(CIFRA, CIFRA.blocos.map(() => null), 30, 0, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(seg.map(s => [s.inicio, s.acorde]), [[1, "G"], [2, "D"], [3, "G"], [4, "D"], [5, "Em"], [6, "C"]]);
  assert.equal(seg[5].fim, 30);
});

test("v17: a forma de onda em fatias, normalizada", () => {
  const a = new Float32Array(400), b = new Float32Array(400);
  a[10] = 0.5; b[150] = -0.25; a[399] = 0.1;
  const p = picos([a, b], 400, 4); // 4 fatias de 100 amostras
  assert.deepEqual(Array.from(p).map(v => Math.round(v * 100) / 100), [1, 0.5, 0, 0.2]);
  assert.equal(picos([], 400).length, 0);
});
