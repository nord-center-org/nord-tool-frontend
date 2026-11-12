/**
 * Análise do áudio no aparelho (sem servidor): espectro, tom (perfis de Krumhansl), BPM e batidas (fluxo espectral +
 * programação dinâmica), acordes por batida (cromagrama + Viterbi) e a linha do baixo (soma de harmônicos com o
 * acorde como pista). Recebe o áudio mono já reduzido (ex.: 11025 Hz). Puro, testável em node.
 */
import { NOTAS_SUSTENIDO, mod12, midiParaFrequencia, usaBemol, NOTAS_BEMOL, type Tom } from "./teoria.ts";

// ---------------------------------------------------------------- FFT

const tabelas = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>();
function tabela(n: number) {
  let t = tabelas.get(n);
  if (t) return t;
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2), rev = new Uint32Array(n);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = -Math.sin((2 * Math.PI * i) / n); }
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1); rev[i] = r; }
  t = { cos, sin, rev };
  tabelas.set(n, t);
  return t;
}

/** FFT complexa no lugar (n potência de 2). `inversa` divide por n. */
export function fft(re: Float64Array, im: Float64Array, inversa = false) {
  const n = re.length;
  const { cos, sin, rev } = tabela(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  const sinal = inversa ? -1 : 1;
  for (let tam = 2; tam <= n; tam <<= 1) {
    const meio = tam >> 1, passo = n / tam;
    for (let i = 0; i < n; i += tam) {
      for (let j = 0, k = 0; j < meio; j++, k += passo) {
        const c = cos[k], s = sin[k] * sinal;
        const a = i + j, b = a + meio;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  if (inversa) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

const hanns = new Map<number, Float64Array>();
export function hann(n: number) {
  let w = hanns.get(n);
  if (!w) { w = new Float64Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); hanns.set(n, w); }
  return w;
}

/** Magnitudes (n/2+1 por quadro) de cada quadro, centrado em i*salto. */
export function espectrograma(sinal: Float32Array, janela: number, salto: number, aoQuadro?: (q: number, total: number) => void): Float32Array[] {
  const w = hann(janela);
  const total = Math.max(1, Math.ceil(sinal.length / salto));
  const re = new Float64Array(janela), im = new Float64Array(janela);
  const quadros: Float32Array[] = [];
  for (let q = 0; q < total; q++) {
    const ini = q * salto - janela / 2;
    for (let i = 0; i < janela; i++) { const k = ini + i; re[i] = k >= 0 && k < sinal.length ? sinal[k] * w[i] : 0; im[i] = 0; }
    fft(re, im);
    const mag = new Float32Array(janela / 2 + 1);
    for (let b = 0; b <= janela / 2; b++) mag[b] = Math.hypot(re[b], im[b]);
    quadros.push(mag);
    if (aoQuadro && q % 200 === 0) aoQuadro(q, total);
  }
  return quadros;
}

// ---------------------------------------------------------------- cromagrama e tom

/** Energia por classe de nota (12) de cada quadro, de 80 Hz a 2 kHz (só os picos do espectro). */
export function cromagrama(quadros: Float32Array[], sr: number, janela: number): Float32Array[] {
  const nb = janela / 2 + 1;
  const classe = new Int8Array(nb).fill(-1), peso = new Float32Array(nb);
  for (let b = 1; b < nb; b++) {
    const f = (b * sr) / janela;
    if (f < 80 || f > 2000) continue;
    const m = 69 + 12 * Math.log2(f / 440);
    const r = Math.round(m);
    const desvio = Math.abs(m - r);
    // só as raias perto do centro da nota (evita borrar entre semitons vizinhos)
    if (desvio > 0.35) continue;
    classe[b] = mod12(r);
    peso[b] = 1 - desvio * 2;
  }
  return quadros.map(mag => {
    // só os picos do espectro, acima de 1% do maior (o vazamento entre raias vira ruído de fundo)
    let max = 0;
    for (let k = 0; k < nb; k++) if (classe[k] >= 0 && mag[k] > max) max = mag[k];
    const c = new Float32Array(12);
    if (!max) return c;
    for (let k = 1; k < nb - 1; k++) {
      if (classe[k] < 0 || mag[k] < max * 0.01 || mag[k] < mag[k - 1] || mag[k] < mag[k + 1]) continue;
      c[classe[k]] += Math.sqrt(mag[k] / max) * peso[k];
    }
    return c;
  });
}

const PERFIL_MAIOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const PERFIL_MENOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlacao(a: ArrayLike<number>, b: ArrayLike<number>) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Tom pela soma do cromagrama comparada aos 24 perfis (12 maiores e 12 menores); `confianca` 0–1. */
export function detectarTom(croma: ArrayLike<number>): Tom & { confianca: number } {
  const notas: { tom: Tom; r: number }[] = [];
  for (let t = 0; t < 12; t++) {
    const rot = (p: number[]) => Array.from({ length: 12 }, (_, i) => p[mod12(i - t)]);
    notas.push({ tom: { tonica: t, menor: false }, r: correlacao(croma, rot(PERFIL_MAIOR)) });
    notas.push({ tom: { tonica: t, menor: true }, r: correlacao(croma, rot(PERFIL_MENOR)) });
  }
  notas.sort((a, b) => b.r - a.r);
  const [a, b] = notas;
  return { ...a.tom, confianca: Math.max(0, Math.min(1, (a.r - b.r) * 5 + a.r * 0.5)) };
}

export function somaCroma(croma: Float32Array[], pesos?: ArrayLike<number>) {
  const s = new Float64Array(12);
  croma.forEach((c, i) => { const p = pesos ? pesos[i] : 1; for (let k = 0; k < 12; k++) s[k] += c[k] * p; });
  return s;
}

// ---------------------------------------------------------------- andamento e batidas

/** Força de ataque por quadro: fluxo espectral positivo (log), sem a média local. */
export function forcaDeAtaque(quadros: Float32Array[], ateBin = Infinity): Float32Array {
  const n = quadros.length;
  const o = new Float32Array(n);
  for (let q = 1; q < n; q++) {
    const a = quadros[q], b = quadros[q - 1];
    const lim = Math.min(a.length, ateBin);
    let s = 0;
    for (let k = 1; k < lim; k++) { const d = Math.log1p(100 * a[k]) - Math.log1p(100 * b[k]); if (d > 0) s += d; }
    o[q] = s;
  }
  // tira a média local (~1 s para cada lado) e o que fica negativo
  const r = 20;
  const out = new Float32Array(n);
  let soma = 0;
  for (let i = 0; i < Math.min(n, r); i++) soma += o[i];
  for (let i = 0; i < n; i++) {
    if (i + r < n) soma += o[i + r];
    if (i - r - 1 >= 0) soma -= o[i - r - 1];
    const cont = Math.min(n - 1, i + r) - Math.max(0, i - r) + 1;
    out[i] = Math.max(0, o[i] - soma / cont);
  }
  let max = 0;
  for (const v of out) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
  return out;
}

/** BPM pela autocorrelação da força de ataque, com preferência suave por volta de 110 BPM. */
export function detectarBpm(ataque: Float32Array, quadrosPorSegundo: number, min = 55, max = 210): number {
  const lagMin = Math.floor((60 * quadrosPorSegundo) / max), lagMax = Math.ceil((60 * quadrosPorSegundo) / min);
  const n = ataque.length;
  const ac = new Float64Array(lagMax + 2);
  for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += ataque[i] * ataque[i - lag];
    ac[lag] = s / (n - lag);
  }
  let melhor = lagMin, melhorV = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const bpm = (60 * quadrosPorSegundo) / lag;
    // pulso: soma o atraso e o dobro dele (ajuda a não pegar meio tempo)
    const v = (ac[lag] + 0.5 * (2 * lag <= lagMax + 1 ? ac[Math.min(lagMax + 1, 2 * lag)] : 0)) * Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.9) ** 2);
    if (v > melhorV) { melhorV = v; melhor = lag; }
  }
  // refino parabólico
  const a = ac[melhor - 1], b = ac[melhor], c = ac[melhor + 1];
  const den = a - 2 * b + c;
  const lagFino = den < 0 ? melhor + (0.5 * (a - c)) / den : melhor;
  return Math.round(((60 * quadrosPorSegundo) / lagFino) * 10) / 10;
}

/** Batidas (em quadros) por programação dinâmica (Ellis, 2007): ataques fortes num passo perto do período. */
export function acompanharBatidas(ataque: Float32Array, periodo: number, rigidez = 100): number[] {
  const n = ataque.length;
  if (!n || periodo < 2) return [];
  const pont = new Float64Array(n), ant = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    let melhor = 0, de = -1;
    const ini = Math.max(0, Math.round(t - 2 * periodo)), fim = t - Math.round(periodo / 2);
    for (let p = ini; p <= fim; p++) {
      const v = pont[p] - rigidez * Math.log((t - p) / periodo) ** 2;
      if (v > melhor || de < 0) { melhor = v; de = p; }
    }
    pont[t] = ataque[t] + (de >= 0 ? melhor : 0);
    ant[t] = de;
  }
  // começa da melhor pontuação no último período
  let t = n - 1;
  for (let k = Math.max(0, n - Math.round(periodo)); k < n; k++) if (pont[k] > pont[t]) t = k;
  const batidas: number[] = [];
  while (t >= 0) { batidas.push(t); t = ant[t]; }
  return batidas.reverse();
}

// ---------------------------------------------------------------- acordes

export interface SegmentoAcorde { inicio: number; fim: number; acorde: string }

const MOLDES: { nome: (r: number, bemol: boolean) => string; v: Float32Array }[] = [];
for (let r = 0; r < 12; r++) {
  for (const [sufixo, iv] of [["", [0, 4, 7]], ["m", [0, 3, 7]]] as const) {
    const v = new Float32Array(12);
    iv.forEach((i, k) => { v[mod12(r + i)] = k === 0 ? 1.2 : 1; });
    MOLDES.push({ nome: (_r, bemol) => `${(bemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO)[r]}${sufixo}`, v });
  }
}

const cosseno = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < 12; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
};

/**
 * Acordes (maiores e menores) por trecho entre batidas. Viterbi com custo de troca para não pular a cada batida;
 * trecho fraco vira "N" (sem acorde). `tempos` são os inícios dos trechos em segundos (o último é o fim da música).
 */
export function detectarAcordes(croma: Float32Array[], tempoDoQuadro: (q: number) => number, tempos: number[], energia: Float32Array, tom?: Tom): SegmentoAcorde[] {
  const bemol = tom ? usaBemol(tom.tonica, tom.menor) : false;
  const n = tempos.length - 1;
  if (n < 1) return [];
  // média do cromagrama em cada trecho
  const medias: Float32Array[] = [], forca: number[] = [];
  let q = 0;
  for (let i = 0; i < n; i++) {
    const m = new Float32Array(12);
    let cont = 0, e = 0;
    while (q < croma.length && tempoDoQuadro(q) < tempos[i]) q++;
    let k = q;
    while (k < croma.length && tempoDoQuadro(k) < tempos[i + 1]) { for (let c = 0; c < 12; c++) m[c] += croma[k][c]; e += energia[k]; cont++; k++; }
    // tira o "fundo" comum (realça as notas do acorde)
    let min = Infinity;
    for (let c = 0; c < 12; c++) if (m[c] < min) min = m[c];
    for (let c = 0; c < 12; c++) m[c] -= min;
    medias.push(m);
    forca.push(cont ? e / cont : 0);
  }
  const ordenada = [...forca].sort((a, b) => a - b);
  const limiteSilencio = ordenada[Math.floor(ordenada.length * 0.5)] * 0.12;
  const S = MOLDES.length + 1; // último estado = N
  const pont = (i: number, s: number) => (s === MOLDES.length ? (forca[i] < limiteSilencio ? 1 : 0.35) : forca[i] < limiteSilencio ? 0 : cosseno(medias[i], MOLDES[s].v));
  const TROCA = 0.12;
  let atual = new Float64Array(S), prox = new Float64Array(S);
  const de: Uint8Array[] = [];
  for (let s = 0; s < S; s++) atual[s] = pont(0, s);
  for (let i = 1; i < n; i++) {
    const volta = new Uint8Array(S);
    let melhorS = 0;
    for (let s = 1; s < S; s++) if (atual[s] > atual[melhorS]) melhorS = s;
    for (let s = 0; s < S; s++) {
      const fica = atual[s], troca = atual[melhorS] - TROCA;
      if (fica >= troca) { prox[s] = fica + pont(i, s); volta[s] = s; } else { prox[s] = troca + pont(i, s); volta[s] = melhorS; }
    }
    de.push(volta);
    [atual, prox] = [prox, atual];
  }
  let s = 0;
  for (let k = 1; k < S; k++) if (atual[k] > atual[s]) s = k;
  const caminho = new Array<number>(n);
  caminho[n - 1] = s;
  for (let i = n - 1; i > 0; i--) { s = de[i - 1][s]; caminho[i - 1] = s; }
  const segs: SegmentoAcorde[] = [];
  for (let i = 0; i < n; i++) {
    const nome = caminho[i] === MOLDES.length ? "N" : MOLDES[caminho[i]].nome(0, bemol);
    const ult = segs[segs.length - 1];
    if (ult && ult.acorde === nome) ult.fim = tempos[i + 1];
    else segs.push({ inicio: tempos[i], fim: tempos[i + 1], acorde: nome });
  }
  return segs;
}

// ---------------------------------------------------------------- linha do baixo

export interface Nota { inicio: number; fim: number; midi: number; forca: number }

/** Magnitude numa frequência qualquer (interpolação linear entre raias). */
function magEm(mag: Float32Array, f: number, sr: number, janela: number) {
  const b = (f * janela) / sr;
  const i = Math.floor(b);
  if (i < 0 || i + 1 >= mag.length) return 0;
  return mag[i] + (mag[i + 1] - mag[i]) * (b - i);
}

/** Força de ataque no grave (35–250 Hz) com janela curta, para saber onde cada nota do baixo começa. */
export function ataquesNoGrave(sinal: Float32Array, sr: number, salto = 128): { forca: Float32Array; energia: Float32Array; porSegundo: number; tempo: (i: number) => number } {
  const J = 1024;
  const w = hann(J);
  const n = Math.max(1, Math.ceil(sinal.length / salto));
  const b0 = Math.max(1, Math.floor((35 * J) / sr)), b1 = Math.ceil((250 * J) / sr);
  const re = new Float64Array(J), im = new Float64Array(J);
  const ant = new Float64Array(b1 + 1);
  const forca = new Float32Array(n), energia = new Float32Array(n);
  for (let q = 0; q < n; q++) {
    const ini = q * salto - J / 2;
    for (let i = 0; i < J; i++) { const k = ini + i; re[i] = k >= 0 && k < sinal.length ? sinal[k] * w[i] : 0; im[i] = 0; }
    fft(re, im);
    let f = 0, e = 0;
    for (let b = b0; b <= b1; b++) {
      const m = Math.hypot(re[b], im[b]);
      e += m * m;
      const v = Math.log1p(100 * m);
      if (q > 0 && v > ant[b]) f += v - ant[b];
      ant[b] = v;
    }
    forca[q] = f;
    energia[q] = Math.sqrt(e);
  }
  return { forca, energia, porSegundo: sr / salto, tempo: i => (i * salto) / sr };
}

/** Picos da força de ataque acima de média + k·desvio (janela de ~1 s), com distância mínima entre eles. */
export function picos(forca: Float32Array, porSegundo: number, k = 1.2, minimoSeg = 0.09): number[] {
  const n = forca.length, r = Math.round(porSegundo / 2), dist = Math.round(minimoSeg * porSegundo);
  const r2: number[] = [];
  let ult = -Infinity;
  for (let i = 1; i < n - 1; i++) {
    if (forca[i] < forca[i - 1] || forca[i] < forca[i + 1]) continue;
    let soma = 0, soma2 = 0, c = 0;
    for (let j = Math.max(0, i - r); j < Math.min(n, i + r); j++) { soma += forca[j]; soma2 += forca[j] * forca[j]; c++; }
    const media = soma / c, desvio = Math.sqrt(Math.max(0, soma2 / c - media * media));
    if (forca[i] < media + k * desvio || forca[i] <= 0) continue;
    if (i - ult < dist) { if (forca[i] > forca[ult]) { r2[r2.length - 1] = i; ult = i; } continue; }
    r2.push(i); ult = i;
  }
  return r2;
}

/**
 * Notas do baixo, em três passos:
 * 1. onde cada nota começa: picos do ataque no grave (janela curta, ~12 ms);
 * 2. qual é a nota de cada trecho: votação no miolo do trecho, somando a força de E1 a E3 (MIDI 28–52) pela
 *    fundamental e pelos primeiros harmônicos (janela longa, que separa bem as notas graves); a nota do acorde do
 *    momento ganha bônus e, se outra nota ganha por pouco, fica a do acorde;
 * 3. limpeza: trecho fraco ou sem uma nota clara é descartado, e repetições sem ataque forte (só o bumbo) se juntam.
 */
export function linhaDoBaixo(
  quadros: Float32Array[], sr: number, janela: number, salto: number,
  notasDoMomento?: (t: number) => number[] | null, raizDoMomento?: (t: number) => number | null,
  grade?: number[], ataques?: { inicios: number[]; forca: number[]; energia?: Float32Array; porSegundo?: number },
): Nota[] {
  const MIN = 28, MAX = 52;
  const nc = MAX - MIN + 1;
  const freqs = Array.from({ length: nc }, (_, i) => midiParaFrequencia(MIN + i));
  const n = quadros.length;
  const tempo = (q: number) => (q * salto) / sr;
  // só a parte que sustenta: mediana no tempo (9 quadros, ~0,4 s) por raia tira bumbo, caixa e palhetadas
  const bA = Math.floor((35 * janela) / sr), bB = Math.ceil((300 * janela) / sr);
  const bMax = Math.min(quadros[0]?.length ?? 0, Math.ceil((3.2 * freqs[nc - 1] * janela) / sr) + 2);
  const harmonico = sustentado(quadros, bMax, 4);
  // força de cada nota candidata em cada quadro, e a energia do grave
  const saliencia: Float32Array[] = [];
  const energia = new Float32Array(n);
  for (let q = 0; q < n; q++) {
    const mag = harmonico[q];
    let e = 0;
    for (let b = bA; b <= bB; b++) e += mag[b] * mag[b];
    energia[q] = Math.sqrt(e);
    const v = new Float32Array(nc);
    for (let i = 0; i < nc; i++) {
      const f = freqs[i];
      const f1 = magEm(mag, f, sr, janela), f2 = magEm(mag, 2 * f, sr, janela), f3 = magEm(mag, 3 * f, sr, janela);
      // a fundamental precisa existir (sem ela, é harmônico de outra coisa: guitarra, teclado) e precisa ter
      // harmônicos (seno puro e grave é bumbo, não corda)
      v[i] = f1 < 0.2 * f2 || f2 + f3 < 0.12 * f1 ? 0 : f1 + 0.5 * f2 + 0.25 * f3;
    }
    saliencia.push(v);
  }
  const ordE = Float32Array.from(energia).sort();
  const energiaRef = ordE[Math.floor(n * 0.9)] || 1;
  // inícios: ataques no grave (ou, sem eles, as mudanças de nota quadro a quadro)
  const duracao = tempo(n);
  let inicios = ataques?.inicios.slice() ?? [];
  const forcaAtaque = ataques?.forca.slice() ?? [];
  if (!inicios.length) {
    let ant = -1;
    for (let q = 0; q < n; q++) {
      let m = -1, mv = 0;
      saliencia[q].forEach((x, i) => { if (x > mv) { mv = x; m = i; } });
      if (energia[q] > energiaRef * 0.15 && m !== ant) { inicios.push(tempo(q)); forcaAtaque.push(1); }
      ant = energia[q] > energiaRef * 0.15 ? m : -1;
    }
  }
  // a primeira nota pode começar junto com a música (não há "subida" no quadro 0)
  if (!inicios.length || inicios[0] > 0.05) { inicios.unshift(0); forcaAtaque.unshift(Infinity); }
  inicios = inicios.filter(t => t < duracao);
  // sustentação no grave (janela curta): bumbo e caixa somem em ~0,1 s, a nota do baixo continua
  const envelope = ataques?.energia, ps = ataques?.porSegundo ?? 1;
  const refCurta = envelope ? Float32Array.from(envelope).sort()[Math.floor(envelope.length * 0.9)] || 1 : 1;
  const sustenta = (ini: number, fim: number) => {
    if (!envelope) return true;
    const a = ini + Math.min(0.12, (fim - ini) * 0.5), b = Math.min(fim, ini + 0.3);
    let soma = 0, c = 0;
    for (let i = Math.floor(a * ps); i <= Math.ceil(b * ps) && i < envelope.length; i++) { soma += envelope[i]; c++; }
    return c > 0 && soma / c >= refCurta * 0.2;
  };
  const notas: Nota[] = [];
  for (let k = 0; k < inicios.length; k++) {
    const ini = inicios[k];
    const fim = Math.min(k + 1 < inicios.length ? inicios[k + 1] : duracao, ini + 4);
    if (fim - ini < 0.08) continue;
    // miolo do trecho (a janela longa borra as pontas); trecho curto usa o meio
    const meio = (ini + fim) / 2;
    const a = fim - ini > 0.3 ? ini + 0.12 : meio - 0.02, b = fim - ini > 0.3 ? fim - 0.08 : meio + 0.02;
    const voto = new Float64Array(nc);
    let e = 0, cont = 0;
    for (let q = Math.max(0, Math.floor((a * sr) / salto)); q <= Math.min(n - 1, Math.ceil((b * sr) / salto)); q++) {
      const v = saliencia[q];
      for (let i = 0; i < nc; i++) voto[i] += v[i];
      e += energia[q]; cont++;
    }
    if (!cont) continue;
    e /= cont;
    if (e < energiaRef * 0.12) continue; // silêncio ou só resto de outra coisa
    if (!sustenta(ini, fim)) continue; // batida (bumbo, caixa), não nota
    const notasAcorde = notasDoMomento?.(meio) ?? null, raiz = raizDoMomento?.(meio) ?? null;
    let melhor = -1, mv = 0, segundo = 0, melhorAcorde = -1, mvAcorde = 0;
    for (let i = 0; i < nc; i++) {
      const pc = mod12(MIN + i);
      let v = voto[i];
      if (raiz !== null && pc === raiz) v *= 1.3;
      else if (notasAcorde?.includes(pc)) v *= 1.1;
      if (v > mv) { segundo = mv; mv = v; melhor = i; } else if (v > segundo) segundo = v;
      if (notasAcorde?.includes(pc) && v > mvAcorde) { mvAcorde = v; melhorAcorde = i; }
    }
    if (melhor < 0 || mv <= 0) continue;
    // fora do acorde só se ganhar com folga (nota de passagem de verdade); senão fica a do acorde
    if (notasAcorde && !notasAcorde.includes(mod12(MIN + melhor)) && melhorAcorde >= 0 && mv < mvAcorde * 1.35) melhor = melhorAcorde;
    // sem nota clara (várias empatadas) e fraco: é ruído
    if (segundo > mv * 0.92 && e < energiaRef * 0.3) continue;
    notas.push({ inicio: ini, fim, midi: MIN + melhor, forca: Math.min(1, e / energiaRef) });
  }
  // repetição sem ataque forte (bumbo por cima da mesma nota) vira uma nota só
  const fA = [...forcaAtaque].sort((x, y) => x - y);
  const ataqueForte = fA[Math.floor(fA.length * 0.2)] ?? 0;
  const juntas: Nota[] = [];
  for (const x of notas) {
    const ult = juntas[juntas.length - 1];
    const idx = inicios.indexOf(x.inicio);
    const forte = idx >= 0 && idx < forcaAtaque.length ? forcaAtaque[idx] >= ataqueForte : true;
    if (ult && ult.midi === x.midi && Math.abs(ult.fim - x.inicio) < 0.02 && !forte) { ult.fim = x.fim; ult.forca = Math.max(ult.forca, x.forca); continue; }
    juntas.push({ ...x });
  }
  for (const x of juntas) {
    x.forca = Math.round(x.forca * 100) / 100;
    if (grade?.length) { const g = maisPerto(grade, x.inicio); if (Math.abs(g - x.inicio) < 0.05) x.inicio = g; }
    // nota que soa até a próxima: corta um respiro para os blocos não grudarem
    x.fim = Math.max(x.inicio + 0.06, x.fim - 0.02);
  }
  for (let i = 0; i + 1 < juntas.length; i++) if (juntas[i].fim > juntas[i + 1].inicio) juntas[i].fim = juntas[i + 1].inicio;
  return juntas.filter(x => x.fim - x.inicio >= 0.06);
}

/** Mediana no tempo (2·meio+1 quadros) de cada raia até `bMax`: o que sustenta fica, o que é batida some. */
function sustentado(quadros: Float32Array[], bMax: number, meio: number): Float32Array[] {
  const n = quadros.length;
  const out = quadros.map(() => new Float32Array(bMax));
  const tmp: number[] = [];
  for (let b = 0; b < bMax; b++) {
    for (let q = 0; q < n; q++) {
      tmp.length = 0;
      for (let k = Math.max(0, q - meio); k <= Math.min(n - 1, q + meio); k++) tmp.push(quadros[k][b]);
      tmp.sort((x, y) => x - y);
      out[q][b] = Math.min(quadros[q][b], tmp[tmp.length >> 1]);
    }
  }
  return out;
}

function maisPerto(ordenado: number[], v: number) {
  let lo = 0, hi = ordenado.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ordenado[m] < v) lo = m + 1; else hi = m; }
  const a = ordenado[lo], b = ordenado[Math.max(0, lo - 1)];
  return Math.abs(a - v) < Math.abs(b - v) ? a : b;
}

/** Grade de colcheias (meio tempo) a partir das batidas. */
export function gradeDeColcheias(batidas: number[]) {
  const g: number[] = [];
  for (let i = 0; i < batidas.length; i++) {
    g.push(batidas[i]);
    if (i + 1 < batidas.length) g.push((batidas[i] + batidas[i + 1]) / 2);
  }
  return g;
}

// ---------------------------------------------------------------- tudo junto

/**
 * Versão do analisador. Suba sempre que a análise mudar de um jeito que valha refazer as músicas já guardadas
 * (o player refaz sozinho quando a versão guardada é menor). 2 = nova linha do baixo (Repertório v2).
 */
export const VERSAO_ANALISE = 2;

/** A análise guardada é de uma versão anterior do analisador? */
export const analiseDesatualizada = (a: { versao?: number } | null | undefined) => !a || (a.versao ?? 1) < VERSAO_ANALISE;

export interface ResultadoAnalise {
  /** Versão do analisador que gerou (as da v1 não têm: valem 1). */
  versao?: number;
  duracao: number;
  tom: Tom & { confianca: number };
  bpm: number;
  batidas: number[];
  acordes: SegmentoAcorde[];
  notasBaixo: Nota[];
}

/** Análise completa do áudio mono (taxa `sr`, idealmente 11025 Hz). `progresso` recebe 0–1. */
export function analisar(sinal: Float32Array, sr: number, progresso?: (p: number, etapa: string) => void): ResultadoAnalise {
  const duracao = sinal.length / sr;
  const J = 4096, S = 512;
  progresso?.(0.02, "Lendo as frequências");
  const quadros = espectrograma(sinal, J, S, (q, t) => progresso?.(0.02 + 0.4 * (q / t), "Lendo as frequências"));
  const tempoDoQuadro = (q: number) => (q * S) / sr;
  progresso?.(0.45, "Procurando o tom");
  const croma = cromagrama(quadros, sr, J);
  const tom = detectarTom(somaCroma(croma));
  progresso?.(0.5, "Medindo o andamento");
  // ataques com resolução melhor (janela menor)
  const JA = 1024, SA = 256;
  const qa = espectrograma(sinal, JA, SA);
  const ataque = forcaDeAtaque(qa);
  const qps = sr / SA;
  const bpm = detectarBpm(ataque, qps);
  const batidasQ = acompanharBatidas(ataque, (60 * qps) / bpm);
  const batidas = batidasQ.map(q => Math.round(((q * SA) / sr) * 1000) / 1000);
  progresso?.(0.65, "Reconhecendo os acordes");
  const energia = new Float32Array(quadros.length);
  quadros.forEach((m, i) => { let e = 0; for (let k = 0; k < m.length; k++) e += m[k] * m[k]; energia[i] = Math.sqrt(e); });
  const tempos = [0, ...batidas.filter(b => b > 0.05), duracao];
  const acordes = detectarAcordes(croma, tempoDoQuadro, tempos, energia, tom);
  progresso?.(0.8, "Tirando as notas do baixo");
  const acordeEm = (t: number) => acordes.find(a => t >= a.inicio && t < a.fim) ?? null;
  const grave = ataquesNoGrave(sinal, sr);
  const iPicos = picos(grave.forca, sr / 128, 0.6);
  const notasBaixo = linhaDoBaixo(quadros, sr, J, S,
    t => { const a = acordeEm(t); return a && a.acorde !== "N" ? notasDeNome(a.acorde) : null; },
    t => { const a = acordeEm(t); return a && a.acorde !== "N" ? notasDeNome(a.acorde)[0] : null; },
    gradeDeColcheias(batidas),
    { inicios: iPicos.map(grave.tempo), forca: iPicos.map(i => grave.forca[i]), energia: grave.energia, porSegundo: grave.porSegundo });
  progresso?.(1, "Pronto");
  return { versao: VERSAO_ANALISE, duracao, tom, bpm, batidas, acordes, notasBaixo };
}

/** Classes das notas de um acorde simples reconhecido ("C", "F#m", "Bbm"): [raiz, terça, quinta]. */
export function notasDeNome(nome: string): number[] {
  const m = /^([A-G])([#b]?)(m?)$/.exec(nome);
  if (!m) return [];
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as "C"] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const r = mod12(base);
  return [r, mod12(r + (m[3] ? 3 : 4)), mod12(r + 7)];
}
