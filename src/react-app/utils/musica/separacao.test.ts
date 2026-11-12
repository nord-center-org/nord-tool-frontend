import assert from "node:assert/strict";
import { test } from "node:test";

import { FAIXAS, intercalar, separar, wav16 } from "./separacao.ts";

test("as quatro faixas somadas voltam à música, e cada uma pega o que é dela", () => {
  const sr = 22050, n = sr * 3;
  const L = new Float32Array(n), R = new Float32Array(n);
  let semente = 1;
  const aleatorio = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647 - 0.5; };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const baixo = 0.3 * Math.sin(2 * Math.PI * 55 * t);
    const voz = 0.2 * Math.sin(2 * Math.PI * 440 * t + 3 * Math.sin(2 * Math.PI * 5 * t));
    const guitarra = 0.15 * Math.sin(2 * Math.PI * 660 * t);
    const bumbo = Math.exp(-(t % 0.5) * 60) * aleatorio();
    L[i] = baixo + voz + guitarra + bumbo; R[i] = baixo + voz + guitarra * 0.05 + bumbo;
  }
  const r = separar(L, R, sr);
  let erro = 0;
  for (let i = sr; i < n - sr / 2; i++) {
    const soma = FAIXAS.reduce((s, f) => s + r.faixas[f][2 * i], 0) / 32767;
    erro = Math.max(erro, Math.abs(soma - L[i]));
  }
  assert.ok(erro < 0.002, `erro ${erro}`);
  const energia = (a: Int16Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] / 32767) ** 2; return s / a.length; };
  assert.ok(energia(r.faixas.baixo) > energia(r.faixas.outros), "o grave foi para o baixo");
  assert.ok(energia(r.faixas.voz) > energia(r.faixas.outros), "o centro foi para a voz");
});

test("WAV de 16 bits", () => {
  const buf = wav16(intercalar(Float32Array.from([0, 1]), Float32Array.from([0, -1])), 22050);
  const v = new DataView(buf);
  assert.equal(buf.byteLength, 44 + 8);
  assert.equal(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)), "RIFF");
  assert.equal(v.getUint32(24, true), 22050);
  assert.equal(v.getInt16(44 + 4, true), 32767);
  assert.equal(v.getInt16(44 + 6, true), -32767);
});
