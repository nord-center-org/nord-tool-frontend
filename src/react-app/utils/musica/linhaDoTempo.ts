/**
 * Repertório v17 — a linha do tempo dos acordes: cada acorde da cifra (na ordem do texto) ganha a hora exata em que
 * entra. Arrastar um acorde leva junto todos os que vêm depois (como numa linha do tempo de edição de vídeo), ou só
 * ele, entre os vizinhos. Sem horas guardadas, elas saem das linhas (como na v11: a coluna dentro da linha).
 * Puro, testável em node.
 */
import type { Cifra } from "./cifra.ts";
import { lerAcorde } from "./teoria.ts";

/** Distância mínima entre dois acordes (s). */
export const FOLGA = 0.05;

export interface AcordeNaOrdem { bloco: number; nome: string }

/** Os acordes da cifra na ordem do texto (só os que são acordes). */
export function acordesEmOrdem(cifra: Cifra): AcordeNaOrdem[] {
  return cifra.blocos.flatMap((b, bloco) => b.acordes.filter(a => lerAcorde(a.nome)).map(a => ({ bloco, nome: a.nome })));
}

const finito = (t: number | null | undefined): t is number => t !== null && t !== undefined && Number.isFinite(t);

/**
 * A hora de cada acorde pelas linhas: dentro de uma linha com tempo, pela coluna até a próxima linha com tempo; os de
 * linhas sem tempo ficam espalhados entre os vizinhos que têm. Sempre em ordem e dentro da música.
 */
export function temposPadrao(cifra: Cifra, tempos: (number | null)[], duracao: number): number[] {
  const inicios = tempos.filter(finito).sort((a, b) => a - b);
  const r: (number | null)[] = [];
  cifra.blocos.forEach((b, i) => {
    const validos = b.acordes.filter(a => lerAcorde(a.nome));
    if (!validos.length) return;
    const t = tempos[i];
    if (!finito(t)) { validos.forEach(() => r.push(null)); return; }
    const fim = Math.min(duracao, inicios.find(x => x > t) ?? duracao);
    const ultimo = b.acordes[b.acordes.length - 1];
    const largura = Math.max(b.texto.length, ultimo.col + ultimo.nome.length, 8);
    for (const a of validos) r.push(t + (a.col / largura) * Math.max(0, fim - t));
  });
  // os sem tempo: entre o anterior e o próximo conhecidos (ou o começo e o fim da música)
  for (let i = 0; i < r.length; i++) {
    if (r[i] !== null) continue;
    let j = i;
    while (j < r.length && r[j] === null) j++;
    const antes = i > 0 ? (r[i - 1] as number) : 0;
    const depois = j < r.length ? (r[j] as number) : Math.max(antes, duracao);
    for (let k = i; k < j; k++) r[k] = antes + ((depois - antes) * (k - i + (i > 0 ? 1 : 0))) / (j - i + (i > 0 ? 1 : 0));
    i = j;
  }
  return arrumar(r as number[], duracao);
}

/** Em ordem, com a folga entre eles e dentro de [0, duração]. */
export function arrumar(ts: number[], duracao: number): number[] {
  const r = ts.map(t => Math.max(0, Math.min(duracao, t)));
  for (let i = 1; i < r.length; i++) if (r[i] < r[i - 1] + FOLGA) r[i] = r[i - 1] + FOLGA;
  return r.map(t => Math.round(t * 1000) / 1000);
}

/** As horas guardadas valem se batem com os acordes da cifra (a cifra pode ter mudado depois). */
export function temposValidos(guardados: number[] | null | undefined, n: number): guardados is number[] {
  return !!guardados && guardados.length === n && n > 0 && guardados.every(t => Number.isFinite(t));
}

/** As horas em uso: as guardadas, se ainda valem, ou as das linhas. */
export function temposDosAcordes(cifra: Cifra, tempos: (number | null)[], duracao: number, guardados?: number[] | null): number[] {
  const n = acordesEmOrdem(cifra).length;
  return temposValidos(guardados, n) ? arrumar(guardados, duracao) : temposPadrao(cifra, tempos, duracao);
}

/**
 * Leva o acorde `k` para `novo` e empurra os seguintes junto (a mesma distância). Não passa do anterior nem deixa o
 * último sair da música.
 */
export function empurrar(ts: number[], k: number, novo: number, duracao: number): number[] {
  if (k < 0 || k >= ts.length) return ts;
  const min = k > 0 ? ts[k - 1] + FOLGA : 0;
  const max = Math.max(min, duracao - (ts[ts.length - 1] - ts[k]));
  const delta = Math.max(min, Math.min(max, novo)) - ts[k];
  return ts.map((t, i) => (i >= k ? Math.round((t + delta) * 1000) / 1000 : t));
}

/** Leva só o acorde `k`, entre o anterior e o próximo. */
export function moverSo(ts: number[], k: number, novo: number, duracao: number): number[] {
  if (k < 0 || k >= ts.length) return ts;
  const min = k > 0 ? ts[k - 1] + FOLGA : 0;
  const max = k + 1 < ts.length ? ts[k + 1] - FOLGA : duracao;
  const r = [...ts];
  r[k] = Math.round(Math.max(min, Math.min(max, novo)) * 1000) / 1000;
  return r;
}

/**
 * O começo de cada linha acompanha o primeiro acorde dela (para a letra em destaque e o rolar seguirem a linha do
 * tempo); linhas sem acorde mantêm o tempo que tinham.
 */
export function temposDasLinhas(cifra: Cifra, ts: number[], atuais: (number | null)[]): (number | null)[] {
  const ordem = acordesEmOrdem(cifra);
  const primeiro = new Map<number, number>();
  ordem.forEach((a, k) => { if (!primeiro.has(a.bloco) && ts[k] !== undefined) primeiro.set(a.bloco, ts[k]); });
  return cifra.blocos.map((_, i) => primeiro.get(i) ?? atuais[i] ?? null);
}

/** A forma de onda: o pico (0–1) de cada fatia de 1/`porSegundo` s, juntando os canais. */
export function picos(canais: Float32Array[], sr: number, porSegundo = 100): Float32Array {
  const n = canais[0]?.length ?? 0, passo = Math.max(1, Math.round(sr / porSegundo));
  const r = new Float32Array(Math.ceil(n / passo));
  for (const c of canais) {
    for (let i = 0; i < n; i++) {
      const v = Math.abs(c[i]), k = (i / passo) | 0;
      if (v > r[k]) r[k] = v;
    }
  }
  let max = 0;
  for (const v of r) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < r.length; i++) r[i] /= max;
  return r;
}
