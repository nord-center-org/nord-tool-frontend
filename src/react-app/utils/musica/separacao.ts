/**
 * Separação aproximada das faixas no aparelho, sem IA: o espectro é dividido em harmônico × percussivo (filtro de
 * mediana, "HPSS"), o percussivo vira a bateria, o harmônico grave vira o baixo e o resto se divide entre a voz (o
 * que está no centro do estéreo) e os outros instrumentos. As quatro faixas somadas dão a música original.
 * Processa em fluxo (só ~17 quadros na memória). Puro, testável em node.
 */
import { fft, hann } from "./analise.ts";

export const FAIXAS = ["voz", "baixo", "bateria", "outros"] as const;
export type IdFaixa = (typeof FAIXAS)[number];
export const NOME_FAIXA: Record<IdFaixa, string> = { voz: "Voz", baixo: "Baixo", bateria: "Bateria", outros: "Outros" };

/** Mediana de `n` valores de `buf` (altera a ordem em `buf`). */
function mediana(buf: Float32Array, n: number) {
  const k = n >> 1;
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const piv = buf[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (buf[i] < piv) i++;
      while (buf[j] > piv) j--;
      if (i <= j) { const t = buf[i]; buf[i] = buf[j]; buf[j] = t; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else break;
  }
  return buf[k];
}

export interface FaixasSeparadas { sr: number; faixas: Record<IdFaixa, Int16Array> /* estéreo intercalado */ }

/**
 * Separa L/R (mesma taxa `sr`, idealmente 22050 Hz) nas quatro faixas, em Int16 estéreo intercalado.
 * `progresso` recebe 0–1.
 */
export function separar(L: Float32Array, R: Float32Array, sr: number, progresso?: (p: number) => void): FaixasSeparadas {
  const N = 2048, H = 512, NB = N / 2 + 1, K = 17, MEIO = K >> 1, KF = 17;
  const w = hann(N);
  const len = L.length;
  const total = Math.ceil(len / H) + 1;
  // é mono? (os dois canais quase iguais) — então a voz sai pela faixa de frequência, não pelo centro
  let dif = 0, soma = 0;
  for (let i = 0; i < len; i += 7) { dif += Math.abs(L[i] - R[i]); soma += Math.abs(L[i]) + Math.abs(R[i]); }
  const mono = soma === 0 || dif / soma < 0.02;

  const corte = new Float32Array(NB), voz = new Float32Array(NB);
  for (let k = 0; k < NB; k++) {
    const f = (k * sr) / N;
    corte[k] = f <= 160 ? 1 : f >= 280 ? 0 : (280 - f) / 120;
    voz[k] = f < 150 ? 0 : f < 250 ? (f - 150) / 100 : f < 6000 ? 1 : f < 9000 ? (9000 - f) / 3000 : 0;
  }

  // anel de quadros: espectros de L e R (re, im) e a magnitude média
  const anel = Array.from({ length: K }, () => ({ lr: new Float32Array(NB), li: new Float32Array(NB), rr: new Float32Array(NB), ri: new Float32Array(NB), mag: new Float32Array(NB), ok: false }));
  const re = new Float64Array(N), im = new Float64Array(N);
  const saida = Object.fromEntries(FAIXAS.map(f => [f, new Int16Array(len * 2)])) as Record<IdFaixa, Int16Array>;
  // acumuladores de sobreposição (uma janela) por faixa e canal
  const acum = Object.fromEntries(FAIXAS.map(f => [f, [new Float64Array(N), new Float64Array(N)]])) as Record<IdFaixa, Float64Array[]>;
  const tmp = new Float32Array(Math.max(K, KF));
  const NORMA = 1 / 1.5; // soma de hann² com 75% de sobreposição
  const mascaras = Object.fromEntries(FAIXAS.map(f => [f, new Float32Array(NB)])) as Record<IdFaixa, Float32Array>;

  const lerQuadro = (q: number) => {
    const slot = anel[q % K];
    if (q >= total) { slot.ok = false; return; }
    const ini = q * H - N / 2;
    for (let i = 0; i < N; i++) { const s = ini + i; const ok = s >= 0 && s < len; re[i] = ok ? L[s] * w[i] : 0; im[i] = ok ? R[s] * w[i] : 0; }
    fft(re, im);
    for (let k = 0; k < NB; k++) {
      const j = (N - k) % N;
      // separa os dois sinais reais da FFT complexa
      const lr = (re[k] + re[j]) / 2, li = (im[k] - im[j]) / 2;
      const rr = (im[k] + im[j]) / 2, ri = (re[j] - re[k]) / 2;
      slot.lr[k] = lr; slot.li[k] = li; slot.rr[k] = rr; slot.ri[k] = ri;
      slot.mag[k] = (Math.hypot(lr, li) + Math.hypot(rr, ri)) / 2;
    }
    slot.ok = true;
  };

  const processar = (c: number) => {
    const atual = anel[c % K];
    if (!atual.ok) return;
    for (let k = 0; k < NB; k++) {
      // harmônico: mediana no tempo; percussivo: mediana na frequência
      let n = 0;
      for (let d = -MEIO; d <= MEIO; d++) { const q = c + d; if (q < 0) continue; const s = anel[q % K]; if (s.ok && q < total) tmp[n++] = s.mag[k]; }
      const h = mediana(tmp, n);
      n = 0;
      for (let d = -(KF >> 1); d <= KF >> 1; d++) { const kk = k + d; if (kk >= 0 && kk < NB) tmp[n++] = atual.mag[kk]; }
      const p = mediana(tmp, n);
      const h2 = h * h, p2 = p * p;
      const mh = h2 + p2 > 1e-12 ? h2 / (h2 + p2) : 0.5;
      let centro: number;
      if (mono) centro = 0.7;
      else {
        const { lr, li, rr, ri } = { lr: atual.lr[k], li: atual.li[k], rr: atual.rr[k], ri: atual.ri[k] };
        const cruz = Math.hypot(lr * rr + li * ri, li * rr - lr * ri);
        const e = lr * lr + li * li + rr * rr + ri * ri;
        centro = e > 1e-12 ? (2 * cruz) / e : 0;
        centro = centro ** 8;
      }
      const vz = voz[k] * centro;
      mascaras.bateria[k] = 1 - mh;
      mascaras.baixo[k] = mh * corte[k];
      mascaras.voz[k] = mh * (1 - corte[k]) * vz;
      mascaras.outros[k] = mh * (1 - corte[k]) * (1 - vz);
    }
    const ini = c * H - N / 2;
    for (const f of FAIXAS) {
      const m = mascaras[f];
      // monta Z = Lm + i·Rm (espectro completo) e volta ao tempo numa IFFT só
      for (let k = 0; k < NB; k++) {
        const lr = atual.lr[k] * m[k], li = atual.li[k] * m[k], rr = atual.rr[k] * m[k], ri = atual.ri[k] * m[k];
        re[k] = lr - ri; im[k] = li + rr;
        if (k > 0 && k < N / 2) { const j = N - k; re[j] = lr + ri; im[j] = -li + rr; }
      }
      fft(re, im, true);
      const [aL, aR] = acum[f];
      for (let i = 0; i < N; i++) { aL[i] += re[i] * w[i] * NORMA; aR[i] += im[i] * w[i] * NORMA; }
      // as primeiras H amostras do acumulador estão prontas
      const out = saida[f];
      for (let i = 0; i < H; i++) {
        const s = ini + i;
        if (s >= 0 && s < len) {
          out[2 * s] = Math.max(-32768, Math.min(32767, Math.round(aL[i] * 32767)));
          out[2 * s + 1] = Math.max(-32768, Math.min(32767, Math.round(aR[i] * 32767)));
        }
      }
      aL.copyWithin(0, H); aL.fill(0, N - H);
      aR.copyWithin(0, H); aR.fill(0, N - H);
    }
  };

  for (let q = 0; q < total + MEIO; q++) {
    lerQuadro(q);
    const c = q - MEIO;
    if (c >= 0) processar(c);
    if (progresso && q % 100 === 0) progresso(q / (total + MEIO));
  }
  progresso?.(1);
  return { sr, faixas: saida };
}

/** WAV PCM 16 bits estéreo a partir de amostras intercaladas. */
export function wav16(amostras: Int16Array, sr: number, canais = 2): ArrayBuffer {
  const buf = new ArrayBuffer(44 + amostras.length * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, "RIFF"); v.setUint32(4, 36 + amostras.length * 2, true); txt(8, "WAVE");
  txt(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, canais, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * canais * 2, true); v.setUint16(32, canais * 2, true); v.setUint16(34, 16, true);
  txt(36, "data"); v.setUint32(40, amostras.length * 2, true);
  new Int16Array(buf, 44).set(amostras);
  return buf;
}

/** Intercala dois canais Float32 em Int16. */
export function intercalar(L: Float32Array, R: Float32Array): Int16Array {
  const out = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) {
    out[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767)));
    out[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767)));
  }
  return out;
}
