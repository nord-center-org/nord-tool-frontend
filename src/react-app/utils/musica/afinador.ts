/**
 * Repertório v20 — reconhecer a nota do baixo pelo microfone (como um afinador). Puro, testável em node.
 *
 * O som chega pelo microfone do celular, muitas vezes de uma caixinha pequena, que quase não reproduz a fundamental
 * do baixo (41 Hz no Mi solto). Por isso a altura sai do PERÍODO da onda (YIN), não do pico do espectro: mesmo sem a
 * fundamental, a onda se repete no período da nota. Para ficar leve no celular, o sinal é reduzido para ~12 kHz antes
 * (o baixo não passa de ~400 Hz). Uma nota só aparece depois de se repetir em leituras seguidas, para não piscar.
 */
import { frequenciaParaMidi } from "./teoria.ts";

export interface Leitura { frequencia: number; clareza: number }

/** Volume (RMS) do bloco, de 0 a 1. */
export function nivelRms(amostras: Float32Array): number {
  let s = 0;
  for (let i = 0; i < amostras.length; i++) s += amostras[i] * amostras[i];
  return Math.sqrt(s / Math.max(1, amostras.length));
}

/** Reduz a taxa por um fator inteiro com média (filtro simples contra o "aliasing"). */
export function reduzir(amostras: Float32Array, fator: number): Float32Array {
  if (fator <= 1) return amostras;
  const n = Math.floor(amostras.length / fator), r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < fator; k++) s += amostras[i * fator + k];
    r[i] = s / fator;
  }
  return r;
}

/**
 * Frequência fundamental pelo YIN (de Cheveigné e Kawahara): diferença da onda com ela mesma atrasada, normalizada;
 * o primeiro atraso abaixo do limiar é o período. Devolve null quando não há nota clara.
 */
export function detectarFrequencia(amostras: Float32Array, taxa: number, fMin = 28, fMax = 450, limiar = 0.15): Leitura | null {
  const fator = Math.max(1, Math.floor(taxa / 12000));
  const x = reduzir(amostras, fator), t = taxa / fator;
  const tauMin = Math.max(2, Math.floor(t / fMax)), tauMax = Math.min(Math.floor(x.length / 2), Math.ceil(t / fMin));
  if (tauMax <= tauMin + 2) return null;
  const w = x.length - tauMax;
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < w; j++) { const v = x[j] - x[j + tau]; s += v * v; }
    d[tau] = s;
  }
  // Diferença normalizada pela média acumulada.
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let soma = 0;
  for (let tau = 1; tau <= tauMax; tau++) { soma += d[tau]; cmnd[tau] = soma ? (d[tau] * tau) / soma : 1; }
  let escolhido = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmnd[tau] < limiar) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      escolhido = tau;
      break;
    }
  }
  if (escolhido < 0) {
    // Sem nada abaixo do limiar: aceita o melhor mínimo se ainda for razoável.
    let melhor = tauMin;
    for (let tau = tauMin; tau <= tauMax; tau++) if (cmnd[tau] < cmnd[melhor]) melhor = tau;
    if (cmnd[melhor] > 0.35) return null;
    escolhido = melhor;
  }
  // Interpolação parabólica para sair do inteiro.
  let tauFino = escolhido;
  if (escolhido > 1 && escolhido < tauMax) {
    const a = cmnd[escolhido - 1], b = cmnd[escolhido], c = cmnd[escolhido + 1], den = a - 2 * b + c;
    if (den) tauFino = escolhido + (a - c) / (2 * den);
  }
  const frequencia = t / tauFino;
  if (frequencia < fMin * 0.97 || frequencia > fMax * 1.03) return null;
  return { frequencia, clareza: Math.max(0, Math.min(1, 1 - cmnd[escolhido])) };
}

/**
 * Fix (só o baixo): a leitura só vale se parecer baixo. O som que chega é comparado antes e depois de um filtro que
 * deixa passar só o grave (até ~420 Hz): voz, bateria, palmas e barulho têm a maior parte da energia acima disso.
 * Também precisa de volume no grave, de uma nota clara (período bem definido) e de cair dentro do braço do baixo.
 */
export const PROPORCAO_GRAVE_MINIMA = 0.5;
export const CLAREZA_MINIMA = 0.8;
export function pareceBaixo(o: { rmsGrave: number; rmsCheio: number; limiar: number; clareza: number; midi: number; faixa: [number, number] }): boolean {
  if (o.rmsGrave < o.limiar) return false;
  if (o.rmsCheio > 0 && o.rmsGrave / o.rmsCheio < PROPORCAO_GRAVE_MINIMA) return false;
  if (o.clareza < CLAREZA_MINIMA) return false;
  return o.midi >= o.faixa[0] && o.midi <= o.faixa[1];
}

/** Nota mais perto da frequência e quantos cents ela está acima (+) ou abaixo (−) dessa nota. */
export function notaDaFrequencia(f: number, la = 440): { midi: number; cents: number } {
  const m = frequenciaParaMidi(f) + 12 * Math.log2(440 / la);
  const midi = Math.round(m);
  return { midi, cents: Math.round((m - midi) * 100) };
}

/** Como dizer a afinação para quem está aprendendo. */
export function textoDaAfinacao(cents: number): { texto: string; afinado: boolean } {
  const a = Math.abs(cents);
  if (a <= 5) return { texto: "Afinado", afinado: true };
  if (a <= 15) return { texto: cents > 0 ? "Um pouco alto" : "Um pouco baixo", afinado: false };
  return { texto: cents > 0 ? "Alto (aperte menos ou afrouxe a corda)" : "Baixo (aperte a corda)", afinado: false };
}

/** Oitava no padrão científico (C4 = dó central): E1 é o Mi solto do baixo de 4 cordas. */
export const oitavaDoMidi = (midi: number) => Math.floor(midi / 12) - 1;

/**
 * Segura a nota que aparece na tela: uma nota nova só entra depois de `confirmar` leituras seguidas iguais (ou quase:
 * oitavas acima/abaixo de uma leitura isolada contam como a mesma), e some só depois de `soltarMs` sem som.
 */
export class Estabilizador {
  private ultimas: number[] = [];
  private atual: { midi: number; cents: number; frequencia: number } | null = null;
  private desde = 0;
  private confirmar: number;
  private soltarMs: number;
  constructor(confirmar = 3, soltarMs = 1500) { this.confirmar = confirmar; this.soltarMs = soltarMs; }

  /** Uma leitura (ou null, silêncio) no instante `agora` (ms). Devolve a nota a mostrar (ou null). */
  passo(leitura: { midi: number; cents: number; frequencia: number } | null, agora: number) {
    if (!leitura) {
      this.ultimas = [];
      if (this.atual && agora - this.desde > this.soltarMs) this.atual = null;
      return this.atual;
    }
    this.ultimas.push(leitura.midi);
    if (this.ultimas.length > this.confirmar) this.ultimas.shift();
    const iguais = this.ultimas.filter(m => m === leitura.midi).length;
    if (this.atual && leitura.midi === this.atual.midi) {
      // Mesma nota: suaviza os cents (o ponteiro não treme).
      this.atual = { midi: leitura.midi, cents: Math.round(this.atual.cents * 0.6 + leitura.cents * 0.4), frequencia: leitura.frequencia };
      this.desde = agora;
    } else if (iguais >= this.confirmar || (!this.atual && iguais >= Math.min(2, this.confirmar))) {
      this.atual = { ...leitura };
      this.desde = agora;
    }
    return this.atual;
  }

  limpar() { this.ultimas = []; this.atual = null; }
}
