import assert from "node:assert/strict";
import { test } from "node:test";

import { VERSAO_ANALISE, afinarInicio, analiseDesatualizada, analisar, detectarTom, fft, notasDeNome } from "./analise.ts";

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
  assert.equal(r.versao, VERSAO_ANALISE);
  assert.equal(analiseDesatualizada(r), false);
  assert.equal(analiseDesatualizada({ ...r, versao: undefined }), true, "análise antiga (v1, sem versão) é refeita");
  assert.equal(analiseDesatualizada(null), true);
  assert.equal(r.tom.tonica, 0); assert.equal(r.tom.menor, false);
  assert.ok(Math.abs(r.bpm - 120) < 3, `bpm ${r.bpm}`);
  const em = (t: number) => r.acordes.find(a => t >= a.inicio && t < a.fim)?.acorde;
  assert.deepEqual([1, 3, 5, 7, 9, 11].map(em), ["C", "G", "Am", "F", "C", "G"]);
  const baixoEm = (t: number) => { const n = r.notasBaixo.find(x => t >= x.inicio && t < x.fim); return n ? `${NOMES[n.midi % 12]}${Math.floor(n.midi / 12) - 1}` : null; };
  assert.deepEqual([0.1, 2.1, 4.1, 6.1].map(baixoEm), ["C2", "G2", "A2", "F2"]);
  assert.ok(r.notasBaixo.length > 40, `colcheias viram notas separadas (${r.notasBaixo.length})`);
  const certas = r.notasBaixo.filter(n => { const bar = Math.floor(((n.inicio + n.fim) / 2) / 2) % 4; return n.midi === [36, 43, 45, 41][bar]; });
  assert.ok(certas.length / r.notasBaixo.length > 0.95, `quase todas as notas do baixo certas (${certas.length}/${r.notasBaixo.length})`);
});

test("bateria sozinha não vira nota de baixo", () => {
  const sr = 11025, s = new Float32Array(sr * 8);
  let semente = 3;
  const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647 - 0.5; };
  for (let i = 0; i < s.length; i++) {
    const t = i / sr, tk = t % 0.5, tc = (t + 0.25) % 1;
    s[i] = 0.6 * Math.exp(-tk * 25) * Math.sin(2 * Math.PI * 55 * tk * (1 + 2 * Math.exp(-tk * 40))) + 0.3 * Math.exp(-tc * 30) * rnd();
  }
  const r = analisar(s, sr);
  assert.ok(r.notasBaixo.length <= 2, `notas inventadas: ${r.notasBaixo.length}`);
});

// ---------------------------------------------------------------- correção: notas picotadas e troca de notas

const freq = (m: number) => 440 * 2 ** ((m - 69) / 12);
const nomeDe = (m: number) => `${NOMES[m % 12]}${Math.floor(m / 12) - 1}`;
/** Uma linha de baixo: [início, fim, midi, envelope] — "sustenta" (nota segurada) ou "pluck" (cai depois do ataque). */
function linha(sr: number, segundos: number, notas: Array<[number, number, number]>, opcoes: { bumbo?: boolean; sustenta?: boolean } = {}) {
  const s = new Float32Array(sr * segundos);
  for (const [ini, fim, m] of notas) {
    for (let i = Math.floor(ini * sr); i < Math.min(s.length, Math.floor(fim * sr)); i++) {
      const t = i / sr, local = t - ini;
      const env = (opcoes.sustenta ? 1 : Math.exp(-local * 2.5)) * Math.min(1, local / 0.005) * Math.min(1, (fim - t) / 0.01);
      for (let h = 1; h <= 4; h++) s[i] += (0.35 / h) * env * Math.sin(2 * Math.PI * freq(m) * h * t);
    }
  }
  if (opcoes.bumbo) for (let i = 0; i < s.length; i++) { const tk = (i / sr) % 0.5; s[i] += 0.6 * Math.exp(-tk * 30) * Math.sin(2 * Math.PI * 60 * tk); }
  return s;
}

test("correção: nota segurada com o bumbo por cima é uma nota só", () => {
  const sr = 11025;
  const r = analisar(linha(sr, 6, [[0.3, 2.3, 40], [2.5, 4.5, 43]], { bumbo: true, sustenta: true }), sr);
  const e = r.notasBaixo.filter(n => n.midi === 40), g = r.notasBaixo.filter(n => n.midi === 43);
  assert.equal(e.length, 1, `E2 picotado em ${e.length}: ${e.map(n => `${n.inicio.toFixed(2)}-${n.fim.toFixed(2)}`).join(" ")}`);
  assert.equal(g.length, 1, `G2 picotado em ${g.length}`);
  assert.ok(e[0].fim - e[0].inicio > 1.6, `E2 dura quase 2 s (${(e[0].fim - e[0].inicio).toFixed(2)})`);
});

test("correção: notas curtas trocando rápido saem cada uma com a sua altura", () => {
  const sr = 11025;
  const seq = [40, 43, 45, 47, 45, 43, 40, 38, 40, 43, 45, 47];
  const r = analisar(linha(sr, 5, seq.map((m, i): [number, number, number] => [0.5 + i * 0.25, 0.5 + (i + 1) * 0.25 - 0.01, m])), sr);
  const em = (t: number) => r.notasBaixo.find(n => t >= n.inicio && t < n.fim)?.midi;
  const certas = seq.filter((m, i) => em(0.5 + i * 0.25 + 0.12) === m).length;
  assert.ok(certas >= seq.length - 1, `trocas certas ${certas}/${seq.length}: ${seq.map((_, i) => em(0.5 + i * 0.25 + 0.12)).map(m => (m ? nomeDe(m) : "-")).join(" ")}`);
});

test("correção: troca de nota sem ataque novo (ligado) divide no lugar certo", () => {
  const sr = 11025;
  // C2 de 0,3 a 1,5 s emendado em D2 de 1,5 a 2,7 s, sem ataque no meio
  const s = new Float32Array(sr * 4);
  for (let i = Math.floor(0.3 * sr); i < Math.floor(2.7 * sr); i++) {
    const t = i / sr, m = t < 1.5 ? 36 : 38;
    const env = Math.min(1, (t - 0.3) / 0.005) * Math.min(1, (2.7 - t) / 0.01);
    for (let h = 1; h <= 4; h++) s[i] += (0.35 / h) * env * Math.sin(2 * Math.PI * freq(m) * h * t);
  }
  const r = analisar(s, sr);
  const c = r.notasBaixo.find(n => n.midi === 36), d = r.notasBaixo.find(n => n.midi === 38);
  assert.ok(c && d, `achou C2 e D2: ${r.notasBaixo.map(n => `${nomeDe(n.midi)}@${n.inicio.toFixed(2)}`).join(" ")}`);
  assert.ok(Math.abs(d.inicio - 1.5) < 0.12, `D2 começa perto de 1,5 s (${d.inicio.toFixed(2)})`);
});

test("correção: trocas no meio de acordes e bateria", () => {
  const sr = 11025, beat = 60 / 141;
  // baixo em semínimas com acorde e bumbo/caixa, como numa música (141 BPM, G – D – Em – C)
  const prog: Array<[number[], number[]]> = [[[55, 59, 62], [43, 43, 47, 50]], [[50, 54, 57], [38, 38, 42, 45]], [[52, 55, 59], [40, 40, 43, 47]], [[48, 52, 55], [36, 36, 40, 43]]];
  const total = 4 * 4 * 2;
  const s = new Float32Array(Math.ceil(sr * beat * (total + 2)));
  const esperado: Array<[number, number]> = [];
  for (let k = 0; k < total; k++) {
    const [acorde, baixos] = prog[Math.floor(k / 4) % 4];
    const m = baixos[k % 4], ini = 0.2 + k * beat;
    esperado.push([ini + beat / 2, m]);
    for (let i = Math.floor(ini * sr); i < Math.floor((ini + beat * 0.95) * sr); i++) {
      const t = i / sr, local = t - ini, env = Math.exp(-local * 3) * Math.min(1, local / 0.005);
      for (let h = 1; h <= 4; h++) s[i] += (0.35 / h) * env * Math.sin(2 * Math.PI * freq(m) * h * t);
      for (const a of acorde) s[i] += 0.06 * Math.sin(2 * Math.PI * freq(a) * t);
      s[i] += 0.5 * Math.exp(-local * 30) * Math.sin(2 * Math.PI * 60 * local);
    }
  }
  const r = analisar(s, sr);
  const em = (t: number) => r.notasBaixo.find(n => t >= n.inicio && t < n.fim)?.midi;
  const certas = esperado.filter(([t, m]) => em(t) === m).length;
  assert.ok(certas / esperado.length >= 0.9, `trocas certas ${certas}/${esperado.length}: ${esperado.map(([t]) => em(t)).map(m => (m ? nomeDe(m) : "-")).join(" ")}`);
  // cada troca de altura começa perto da hora certa (o bloco cai na hora em que se toca)
  const erros: number[] = [];
  for (let k = 1; k < esperado.length; k++) {
    if (esperado[k][1] === esperado[k - 1][1]) continue;
    const ini = esperado[k][0] - beat / 2;
    const n = r.notasBaixo.find(x => x.midi === esperado[k][1] && Math.abs(x.inicio - ini) < beat / 2);
    erros.push(n ? Math.abs(n.inicio - ini) : 1);
  }
  erros.sort((a, b) => a - b);
  const mediana = erros[erros.length >> 1];
  assert.ok(mediana < 0.025, `trocas na hora certa (mediana ${(mediana * 1000).toFixed(0)} ms, pior ${(erros[erros.length - 1] * 1000).toFixed(0)} ms)`);
});

test("correção: o início da nota vai para a metade da subida da energia", () => {
  const e = Float32Array.from([1, 1, 1, 2, 5, 9, 10, 10, 9]);
  assert.equal(afinarInicio(e, 3, 100), 5, "o primeiro acima da metade (5,5) entre 1 e 10");
  assert.equal(afinarInicio(Float32Array.from([3, 3, 3, 3]), 1, 100), 1, "sem subida, fica onde estava");
});
