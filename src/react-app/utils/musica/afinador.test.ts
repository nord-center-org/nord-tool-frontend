import { test } from "node:test";
import assert from "node:assert/strict";
import { Estabilizador, detectarFrequencia, nivelRms, notaDaFrequencia, oitavaDoMidi, reduzir, textoDaAfinacao } from "./afinador.ts";
import { midiParaFrequencia } from "./teoria.ts";

const TAXA = 48000;
/** Nota de baixo de mentira: harmônicos com pesos, sem ou com a fundamental, e um pouco de ruído. */
function nota(f: number, opcoes: { semFundamental?: boolean; ruido?: number; n?: number } = {}) {
  const n = opcoes.n ?? 4096, r = new Float32Array(n);
  let s = 3;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const pesos = opcoes.semFundamental ? [0, 0.8, 0.6, 0.4, 0.3] : [1, 0.7, 0.4, 0.25, 0.15];
  for (let i = 0; i < n; i++) {
    let v = 0;
    pesos.forEach((p, k) => { v += p * Math.sin(2 * Math.PI * f * (k + 1) * i / TAXA + k); });
    r[i] = 0.3 * v + (opcoes.ruido ?? 0) * rnd();
  }
  return r;
}

test("reconhece as cordas soltas do baixo de 4 e 5 cordas", () => {
  for (const midi of [23, 28, 33, 38, 43]) {
    const l = detectarFrequencia(nota(midiParaFrequencia(midi)), TAXA);
    assert.ok(l, `midi ${midi}`);
    assert.equal(notaDaFrequencia(l.frequencia).midi, midi, `midi ${midi}: ${l.frequencia.toFixed(1)} Hz`);
    assert.ok(Math.abs(notaDaFrequencia(l.frequencia).cents) <= 3, `afinado ${notaDaFrequencia(l.frequencia).cents}`);
  }
});

test("caixinha de som sem a fundamental: ainda acha a nota certa, não a oitava de cima", () => {
  for (const midi of [28, 31, 36, 40, 45, 52, 60]) {
    const l = detectarFrequencia(nota(midiParaFrequencia(midi), { semFundamental: true, ruido: 0.05 }), TAXA);
    assert.ok(l, `midi ${midi}`);
    assert.equal(notaDaFrequencia(l.frequencia).midi, midi, `midi ${midi}: ${l.frequencia.toFixed(1)} Hz`);
  }
});

test("mede os cents de uma nota desafinada", () => {
  const f = midiParaFrequencia(33) * 2 ** (20 / 1200); // Lá 20 cents acima
  const l = detectarFrequencia(nota(f), TAXA)!;
  const r = notaDaFrequencia(l.frequencia);
  assert.equal(r.midi, 33);
  assert.ok(Math.abs(r.cents - 20) <= 3, `${r.cents}`);
  assert.equal(notaDaFrequencia(440 * 2 ** (-45 / 1200)).cents, -45);
});

test("ruído puro não vira nota", () => {
  let s = 9;
  const r = new Float32Array(4096).map(() => { s = (s * 48271) % 2147483647; return s / 2147483647 - 0.5; });
  assert.equal(detectarFrequencia(r, TAXA), null);
});

test("funciona em 44,1 kHz também", () => {
  const n = new Float32Array(4096);
  for (let i = 0; i < n.length; i++) n[i] = Math.sin(2 * Math.PI * 55 * i / 44100) + 0.5 * Math.sin(2 * Math.PI * 110 * i / 44100);
  assert.equal(notaDaFrequencia(detectarFrequencia(n, 44100)!.frequencia).midi, 33);
});

test("texto da afinação, oitava, nível e redução", () => {
  assert.deepEqual(textoDaAfinacao(3), { texto: "Afinado", afinado: true });
  assert.equal(textoDaAfinacao(-10).texto, "Um pouco baixo");
  assert.equal(textoDaAfinacao(30).afinado, false);
  assert.equal(oitavaDoMidi(28), 1);
  assert.equal(oitavaDoMidi(60), 4);
  assert.ok(Math.abs(nivelRms(new Float32Array([1, -1, 1, -1])) - 1) < 1e-9);
  assert.deepEqual([...reduzir(new Float32Array([1, 3, 5, 7]), 2)], [2, 6]);
});

test("estabilizador: só troca a nota depois de leituras seguidas e segura no silêncio", () => {
  const e = new Estabilizador(3, 1000);
  const l = (midi: number, cents = 0) => ({ midi, cents, frequencia: midiParaFrequencia(midi) });
  assert.equal(e.passo(l(28), 0), null, "uma leitura só não basta");
  assert.equal(e.passo(l(28), 50)?.midi, 28, "duas leituras na primeira nota");
  assert.equal(e.passo(l(40), 100)?.midi, 28, "uma leitura diferente isolada (oitava) não troca");
  assert.equal(e.passo(l(28, 10), 150)?.cents, 4, "mesma nota suaviza os cents");
  e.passo(l(33), 200); e.passo(l(33), 250);
  assert.equal(e.passo(l(33), 300)?.midi, 33, "três seguidas trocam");
  assert.equal(e.passo(null, 900)?.midi, 33, "segura a nota um tempo no silêncio");
  assert.equal(e.passo(null, 1400), null, "e depois some");
});
