/**
 * Sincronia da letra com o áudio: alinha a sequência de acordes da cifra com os acordes reconhecidos no áudio
 * (alinhamento global com pontas livres, testando os 12 tons, para cifra escrita em outro tom ou com capotraste) e dá
 * o tempo de início de cada linha. Linhas sem acorde ficam no meio das vizinhas. Puro, testável em node.
 */
import { blocosComTempo, type Cifra } from "./cifra.ts";
import { lerAcorde, mod12 } from "./teoria.ts";
import type { SegmentoAcorde } from "./analise.ts";

interface Simples { raiz: number; menor: boolean; notas: number[] }

function simples(nome: string): Simples | null {
  const a = lerAcorde(nome);
  if (!a) return null;
  return { raiz: a.raiz, menor: a.menor, notas: a.intervalos.map(i => mod12(a.raiz + i)) };
}

function parecido(cifra: Simples, audio: Simples, desloc: number) {
  const raiz = mod12(cifra.raiz + desloc);
  if (raiz === audio.raiz) return cifra.menor === audio.menor ? 2 : 1;
  // relativo / inversão: a raiz do áudio é nota do acorde da cifra
  if (cifra.notas.some(n => mod12(n + desloc) === audio.raiz)) return 0.2;
  return -1;
}

export interface ResultadoSincronia {
  /** Tempo (s) de início de cada bloco da cifra; null nos blocos que não têm tempo (tabs, info). */
  tempos: (number | null)[];
  /** Semitons entre a cifra e o áudio (a cifra soa `deslocamento` acima do que está escrito). */
  deslocamento: number;
  /** Quantos acordes da cifra casaram com o áudio (0–1). */
  acerto: number;
}

/** Tempos de cada linha da cifra a partir dos acordes do áudio. */
export function sincronizar(cifra: Cifra, segmentos: SegmentoAcorde[], duracao: number): ResultadoSincronia {
  const comTempo = blocosComTempo(cifra);
  const tempos: (number | null)[] = cifra.blocos.map(() => null);
  if (!comTempo.length) return { tempos, deslocamento: 0, acerto: 0 };
  // sequência da cifra: cada acorde lembra o bloco
  const A: { s: Simples; bloco: number }[] = [];
  for (const i of comTempo) for (const a of cifra.blocos[i].acordes) { const s = simples(a.nome); if (s) A.push({ s, bloco: i }); }
  // sequência do áudio (sem "N" e sem repetições seguidas)
  const B: { s: Simples; t: number }[] = [];
  for (const seg of segmentos) {
    if (seg.acorde === "N") continue;
    const s = simples(seg.acorde);
    if (!s) continue;
    const ult = B[B.length - 1];
    if (ult && ult.s.raiz === s.raiz && ult.s.menor === s.menor) continue;
    B.push({ s, t: seg.inicio });
  }
  const primeiroSom = segmentos.find(s => s.acorde !== "N")?.inicio ?? 0;
  let deslocamento = 0, acerto = 0;
  const tempoDoAcorde = new Map<number, number>(); // índice em A → tempo
  if (A.length && B.length) {
    let melhor: { score: number; desloc: number; pares: [number, number][] } | null = null;
    for (let d = 0; d < 12; d++) {
      const r = alinhar(A.map(x => x.s), B.map(x => x.s), d);
      if (!melhor || r.score > melhor.score) melhor = { ...r, desloc: d };
    }
    if (melhor) {
      deslocamento = melhor.desloc > 6 ? melhor.desloc - 12 : melhor.desloc;
      let bons = 0;
      for (const [i, j] of melhor.pares) {
        if (parecido(A[i].s, B[j].s, melhor.desloc) >= 1) bons++;
        tempoDoAcorde.set(i, B[j].t);
      }
      acerto = bons / A.length;
    }
  }
  // tempo do bloco = tempo do primeiro acorde dele que casou
  if (acerto >= 0.25) {
    A.forEach((x, i) => { const t = tempoDoAcorde.get(i); if (t !== undefined && tempos[x.bloco] === null) tempos[x.bloco] = t; });
  }
  preencherEntre(tempos, comTempo, cifra, primeiroSom, duracao);
  return { tempos, deslocamento, acerto };
}

/** Needleman–Wunsch com pontas livres no áudio (introdução e final instrumentais não custam). */
function alinhar(A: Simples[], B: Simples[], desloc: number) {
  const n = A.length, m = B.length, LACUNA = -0.6;
  const S = new Float64Array((n + 1) * (m + 1));
  const T = new Uint8Array((n + 1) * (m + 1)); // 0 diagonal, 1 pula A, 2 pula B
  const id = (i: number, j: number) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) { S[id(i, 0)] = i * LACUNA; T[id(i, 0)] = 1; }
  for (let j = 1; j <= m; j++) { S[id(0, j)] = 0; T[id(0, j)] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const d = S[id(i - 1, j - 1)] + parecido(A[i - 1], B[j - 1], desloc);
      const a = S[id(i - 1, j)] + LACUNA;
      // pular acordes do áudio (repetições, solos) custa pouco
      const b = S[id(i, j - 1)] + (i === n ? 0 : LACUNA * 0.5);
      if (d >= a && d >= b) { S[id(i, j)] = d; T[id(i, j)] = 0; } else if (a >= b) { S[id(i, j)] = a; T[id(i, j)] = 1; } else { S[id(i, j)] = b; T[id(i, j)] = 2; }
    }
  }
  const pares: [number, number][] = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const t = T[id(i, j)];
    if (t === 0) { if (parecido(A[i - 1], B[j - 1], desloc) > 0) pares.push([i - 1, j - 1]); i--; j--; } else if (t === 1) i--; else j--;
  }
  return { score: S[id(n, m)], pares: pares.reverse() };
}

/** Linhas sem tempo ficam entre as vizinhas (proporcional ao tamanho do texto); garante ordem crescente. */
function preencherEntre(tempos: (number | null)[], comTempo: number[], cifra: Cifra, inicio: number, duracao: number) {
  // mantém só tempos crescentes (um acorde casado fora de ordem vira "sem tempo")
  let ult = -Infinity;
  for (const i of comTempo) { const t = tempos[i]; if (t !== null && t <= ult) tempos[i] = null; else if (t !== null) ult = t; }
  const peso = (i: number) => Math.max(1, cifra.blocos[i].texto.trim().length / 8 + cifra.blocos[i].acordes.length);
  const fim = Math.max(inicio + 1, duracao * 0.97);
  let k = 0;
  while (k < comTempo.length) {
    if (tempos[comTempo[k]] !== null) { k++; continue; }
    let j = k;
    while (j < comTempo.length && tempos[comTempo[j]] === null) j++;
    const t0 = k > 0 ? (tempos[comTempo[k - 1]] as number) : inicio;
    const t1 = j < comTempo.length ? (tempos[comTempo[j]] as number) : fim;
    // pesos: a linha anterior (já com tempo) também ocupa parte do intervalo
    const pesos = [k > 0 ? peso(comTempo[k - 1]) : 0, ...comTempo.slice(k, j).map(peso)];
    const total = pesos.reduce((a, b) => a + b, 0) + (j < comTempo.length ? 0 : peso(comTempo[j - 1]));
    let acum = pesos[0];
    for (let x = k; x < j; x++) {
      tempos[comTempo[x]] = t0 + ((t1 - t0) * acum) / total;
      acum += pesos[x - k + 1];
    }
    k = j;
  }
}

/** Índice do bloco que está tocando no tempo t (o último que já começou); -1 antes do primeiro. */
export function blocoNoTempo(tempos: (number | null)[], t: number): number {
  let atual = -1;
  for (let i = 0; i < tempos.length; i++) { const x = tempos[i]; if (x !== null && x <= t) atual = i; }
  return atual;
}
