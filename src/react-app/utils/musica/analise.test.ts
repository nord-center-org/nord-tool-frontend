import assert from "node:assert/strict";
import { test } from "node:test";

import { analisar, detectarTom, fft, notasDeNome } from "./analise.ts";

const NOMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** C – G – Am – F a 120 BPM: acordes, baixo em colcheias (C2 G2 A2 F2) e bumbo em cada batida. */
function musicaDeTeste(sr: number, segundos: number) {
  const beat = 0.5;
  const prog = [[48, 52, 55, 36], [43, 47, 50, 43], [45, 48, 52, 45], [41, 45, 48, 41]];
  const f = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const s = new Float32Array(sr * segundos);
  for (let i = 0; i < s.length; i++) {
    const t = i / sr;
    const [a, b, c, baixo] = prog[Math.floor(t / 2) % 4];
    let v = 0;
    for (const m of [a, b, c, a + 12]) v += 0.08 * Math.sin(2 * Math.PI * f(m) * t);
    const env = Math.exp(-(t % (beat / 2)) * 6);
    for (let h = 1; h <= 4; h++) v += (0.35 / h) * env * Math.sin(2 * Math.PI * f(baixo) * h * t);
    const tk = t % beat;
    v += 0.6 * Math.exp(-tk * 30) * Math.sin(2 * Math.PI * 60 * tk);
    s[i] = v;
  }
  return s;
}

test("FFT volta ao sinal original", () => {
  const re = Float64Array.from({ length: 16 }, (_, i) => Math.sin(i)), im = new Float64Array(16);
  const orig = Array.from(re);
  fft(re, im); fft(re, im, true);
  re.forEach((v, i) => assert.ok(Math.abs(v - orig[i]) < 1e-9));
});

test("tom pelos perfis", () => {
  const cMaior = [5, 0, 3, 0, 4, 3, 0, 5, 0, 3, 0, 1];
  assert.deepEqual({ ...detectarTom(cMaior), confianca: 0 }, { tonica: 0, menor: false, confianca: 0 });
  const aMenor = [3, 0, 2, 0, 4, 2, 0, 1, 1, 5, 0, 2];
  const t = detectarTom(aMenor);
  assert.equal(t.tonica, 9); assert.equal(t.menor, true);
  assert.deepEqual(notasDeNome("F#m"), [6, 9, 1]);
});

test("análise completa: tom, BPM, acordes e baixo", () => {
  const sr = 11025;
  const r = analisar(musicaDeTeste(sr, 16), sr);
  assert.equal(r.tom.tonica, 0); assert.equal(r.tom.menor, false);
  assert.ok(Math.abs(r.bpm - 120) < 3, `bpm ${r.bpm}`);
  const em = (t: number) => r.acordes.find(a => t >= a.inicio && t < a.fim)?.acorde;
  assert.deepEqual([1, 3, 5, 7, 9, 11].map(em), ["C", "G", "Am", "F", "C", "G"]);
  const baixoEm = (t: number) => { const n = r.notasBaixo.find(x => t >= x.inicio && t < x.fim); return n ? `${NOMES[n.midi % 12]}${Math.floor(n.midi / 12) - 1}` : null; };
  assert.deepEqual([0.1, 2.1, 4.1, 6.1].map(baixoEm), ["C2", "G2", "A2", "F2"]);
  assert.ok(r.notasBaixo.length > 40, `colcheias viram notas separadas (${r.notasBaixo.length})`);
});
