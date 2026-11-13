/**
 * Instrumentos do Repertório: afinações, onde cada nota cai no braço (corda e casa), a digitação de uma linha de
 * baixo com o menor deslocamento da mão e formas de acorde no violão. Puro, testável em node.
 */
import { lerAcorde, mod12, notasDoAcorde, transporAcorde } from "./teoria.ts";
import type { Nota, SegmentoAcorde } from "./analise.ts";

export type IdInstrumento = "baixo4" | "baixo5" | "violao" | "teclado";

export interface Instrumento {
  id: IdInstrumento;
  nome: string;
  /** Cordas da mais grave para a mais aguda (MIDI soltas). Vazio no teclado. */
  cordas: number[];
  nomesCordas: string[];
  casas: number;
  /** Faixa de notas que o instrumento mostra (MIDI). */
  faixa: [number, number];
  /** O que cai na tela: a linha do baixo ou as notas dos acordes. */
  fonte: "baixo" | "acordes";
}

export const INSTRUMENTOS: Instrumento[] = [
  { id: "baixo4", nome: "Baixo (4 cordas)", cordas: [28, 33, 38, 43], nomesCordas: ["E", "A", "D", "G"], casas: 20, faixa: [28, 63], fonte: "baixo" },
  { id: "baixo5", nome: "Baixo (5 cordas)", cordas: [23, 28, 33, 38, 43], nomesCordas: ["B", "E", "A", "D", "G"], casas: 20, faixa: [23, 63], fonte: "baixo" },
  { id: "violao", nome: "Violão / guitarra", cordas: [40, 45, 50, 55, 59, 64], nomesCordas: ["E", "A", "D", "G", "B", "e"], casas: 15, faixa: [40, 79], fonte: "acordes" },
  { id: "teclado", nome: "Teclado", cordas: [], nomesCordas: [], casas: 0, faixa: [36, 84], fonte: "acordes" },
];
export const instrumento = (id: IdInstrumento) => INSTRUMENTOS.find(i => i.id === id) ?? INSTRUMENTOS[0];

export interface Posicao { corda: number; casa: number }

/** Todas as posições de uma nota no braço (corda 0 = a mais grave). */
export function posicoes(midi: number, cordas: number[], casas: number): Posicao[] {
  const r: Posicao[] = [];
  cordas.forEach((solta, corda) => { const casa = midi - solta; if (casa >= 0 && casa <= casas) r.push({ corda, casa }); });
  return r;
}

/** Leva a nota para dentro da faixa do instrumento, mudando de oitava se precisar. */
export function naFaixa(midi: number, faixa: [number, number]) {
  let m = midi;
  while (m < faixa[0]) m += 12;
  while (m > faixa[1]) m -= 12;
  return m;
}

/**
 * Digitação de uma sequência de notas (Viterbi): escolhe corda e casa de cada nota para a mão andar pouco,
 * preferindo as primeiras casas e cordas soltas quando ajudam.
 */
export function digitar(notas: number[], cordas: number[], casas = 20): Posicao[] {
  if (!notas.length) return [];
  const cand = notas.map(m => { const p = posicoes(m, cordas, casas); return p.length ? p : [{ corda: 0, casa: Math.max(0, m - cordas[0]) }]; });
  const custoPos = (p: Posicao) => (p.casa > 12 ? (p.casa - 12) * 0.6 : 0) + p.casa * 0.04;
  // a "mão" fica na casa; corda solta não move a mão
  const mover = (a: Posicao, b: Posicao) => (b.casa === 0 || a.casa === 0 ? 0.5 : Math.abs(b.casa - a.casa) * 1 + (Math.abs(b.casa - a.casa) > 4 ? 3 : 0)) + Math.abs(b.corda - a.corda) * 0.15;
  let custo = cand[0].map(custoPos);
  const volta: number[][] = [];
  for (let i = 1; i < notas.length; i++) {
    const novo: number[] = [], v: number[] = [];
    for (const b of cand[i]) {
      let melhor = Infinity, de = 0;
      cand[i - 1].forEach((a, k) => { const c = custo[k] + mover(a, b); if (c < melhor) { melhor = c; de = k; } });
      novo.push(melhor + custoPos(b));
      v.push(de);
    }
    custo = novo;
    volta.push(v);
  }
  let k = custo.indexOf(Math.min(...custo));
  const r: Posicao[] = new Array(notas.length);
  for (let i = notas.length - 1; i >= 0; i--) { r[i] = cand[i][k]; if (i > 0) k = volta[i - 1][k]; }
  return r;
}

/** Casa de cada corda num acorde (-1 = não toca). */
export type FormaAcorde = number[];

const cacheFormas = new Map<string, FormaAcorde | null>();

/**
 * Forma de acorde no violão: procura do braço para cima (casas 0–12, abertura de até 4 casas) uma forma com a
 * fundamental (ou o baixo invertido) na corda mais grave tocada e todas as notas do acorde; prefere mais cordas,
 * cordas soltas e as primeiras casas.
 */
export function formaDoAcorde(nome: string, cordas = INSTRUMENTOS[2].cordas): FormaAcorde | null {
  const chave = `${nome}|${cordas.join(",")}`;
  if (cacheFormas.has(chave)) return cacheFormas.get(chave) ?? null;
  const a = lerAcorde(nome);
  if (!a) { cacheFormas.set(chave, null); return null; }
  const notas = notasDoAcorde(a);
  const baixo = a.baixo ?? a.raiz;
  // sem as extensões mais "dispensáveis" (5ª pode faltar em acordes de 4+ notas)
  const essenciais = notas.filter(pc => !(notas.length >= 4 && pc === mod12(a.raiz + 7)));
  let melhor: { forma: FormaAcorde; nota: number } | null = null;
  const n = cordas.length;
  for (let base = 0; base <= 12; base++) {
    const opcoes = cordas.map(solta => {
      const r: number[] = [-1];
      for (let c = base; c <= base + 3; c++) if (notas.includes(mod12(solta + c)) && c > 0) r.push(c);
      if (notas.includes(mod12(solta))) r.push(0);
      return r;
    });
    const forma = new Array<number>(n).fill(-1);
    const busca = (i: number) => {
      if (i === n) {
        const tocadas = forma.map((c, k) => (c >= 0 ? cordas[k] + c : -1)).filter(x => x >= 0);
        if (tocadas.length < Math.min(4, n - 1)) return;
        const primeira = forma.findIndex(c => c >= 0);
        if (mod12(cordas[primeira] + forma[primeira]) !== baixo) return;
        // cordas tocadas contíguas (sem abafar no meio)
        const ultima = n - 1 - [...forma].reverse().findIndex(c => c >= 0);
        for (let k = primeira; k <= ultima; k++) if (forma[k] < 0) return;
        const pcs = new Set(tocadas.map(mod12));
        if (!essenciais.every(pc => pcs.has(pc))) return;
        const dedos = forma.filter(c => c > 0);
        const minDedo = Math.min(...dedos, 99);
        // dedos: casas distintas >0 (pestana conta como 1 na menor casa)
        const casasUsadas = new Set(dedos.filter(c => c !== minDedo)).size + (dedos.length ? 1 : 0);
        if (casasUsadas > 4) return;
        const maxCasa = Math.max(0, ...dedos);
        // corda solta só com a mão nas primeiras casas, e nunca "furando" uma pestana
        if (forma.includes(0) && maxCasa > 4) return;
        const naMenor = forma.flatMap((c, k) => (c === minDedo ? [k] : []));
        if (naMenor.length >= 2 && forma.some((c, k) => c === 0 && k > naMenor[0] && k < naMenor[naMenor.length - 1])) return;
        const nota = tocadas.length * 1.2 + forma.filter(c => c === 0).length * 0.6 - maxCasa * 0.5 - (n - 1 - ultima) * 0.5 - primeira * 0.2;
        if (!melhor || nota > melhor.nota) melhor = { forma: [...forma], nota };
        return;
      }
      for (const c of opcoes[i]) { forma[i] = c; busca(i + 1); }
      forma[i] = -1;
    };
    busca(0);
    if (melhor && base >= 5) break; // já achou nas primeiras posições
  }
  const r = (melhor as { forma: FormaAcorde } | null)?.forma ?? null;
  cacheFormas.set(chave, r);
  return r;
}

/** Notas (MIDI) para o teclado: o baixo na oitava 3 e o acorde perto da oitava 4. */
export function vozesNoTeclado(nome: string): number[] {
  const a = lerAcorde(nome);
  if (!a) return [];
  const baixo = 48 + (a.baixo ?? a.raiz);
  const acorde = a.intervalos.map(i => naFaixa(60 + a.raiz + i, [57, 79]));
  return [baixo, ...acorde.sort((x, y) => x - y)];
}

/** Teclas brancas e pretas de uma faixa (para desenhar o teclado). */
export const ehPreta = (midi: number) => [1, 3, 6, 8, 10].includes(mod12(midi));

// ---------------------------------------------------------------- o que cai na tela

export interface EventoQueda {
  inicio: number;
  fim: number;
  /** Braço: corda (0 = mais grave) e casa. */
  corda?: number;
  casa?: number;
  /** Teclado: a nota. */
  midi?: number;
  rotulo: string;
}

/**
 * Eventos que descem na tela para o instrumento escolhido, já no tom pedido (`semitons`):
 * - baixo: a linha do baixo, digitada no braço (até `casas`);
 * - violão: a forma de cada acorde;
 * - teclado: o baixo e as notas de cada acorde.
 */
export function eventosParaTocar(ins: Instrumento, notasBaixo: Nota[], acordes: SegmentoAcorde[], semitons: number, casas = ins.casas): EventoQueda[] {
  if (ins.fonte === "baixo") {
    const alturas = notasBaixo.map(n => naFaixa(n.midi + semitons, [ins.cordas[0], ins.cordas[ins.cordas.length - 1] + casas]));
    const pos = digitar(alturas, ins.cordas, casas);
    return notasBaixo.map((n, i) => ({ inicio: n.inicio, fim: n.fim, corda: pos[i].corda, casa: pos[i].casa, rotulo: String(alturas[i]) }));
  }
  const ev: EventoQueda[] = [];
  for (const seg of acordes) {
    if (seg.acorde === "N") continue;
    const nome = transporAcorde(seg.acorde, semitons);
    // um respiro no fim de cada acorde, para os blocos não grudarem
    const fim = Math.max(seg.inicio + 0.08, seg.fim - 0.06);
    if (ins.id === "teclado") {
      for (const m of vozesNoTeclado(nome)) ev.push({ inicio: seg.inicio, fim, midi: naFaixa(m, ins.faixa), rotulo: nome });
    } else {
      const forma = formaDoAcorde(nome, ins.cordas);
      forma?.forEach((casa, corda) => { if (casa >= 0 && casa <= casas) ev.push({ inicio: seg.inicio, fim, corda, casa, rotulo: nome }); });
    }
  }
  return ev.sort((a, b) => a.inicio - b.inicio);
}

// ---------------------------------------------------------------- mapa do braço (v4)

/**
 * v4: cor de cada nota no mapa do braço, pela letra (como nos mapas de notas impressos): C verde, D vermelho, E
 * amarelo, F azul, G rosa, A marrom, B grafite. O sustenido fica na cor da letra dele (C# verde); com bemol, na letra
 * escrita (Db vermelho), para a cor bater com o nome que aparece.
 */
export const CORES_DAS_LETRAS: Record<string, { fundo: string; texto: string }> = {
  C: { fundo: "#5fa83a", texto: "#ffffff" },
  D: { fundo: "#d83a34", texto: "#ffffff" },
  E: { fundo: "#f5bf1f", texto: "#3b2a00" },
  F: { fundo: "#2f8fc7", texto: "#ffffff" },
  G: { fundo: "#b5406f", texto: "#ffffff" },
  A: { fundo: "#8a5a3c", texto: "#ffffff" },
  B: { fundo: "#3f4247", texto: "#ffffff" },
};

export function corDaNota(nome: string) {
  return CORES_DAS_LETRAS[nome.charAt(0).toUpperCase()] ?? CORES_DAS_LETRAS.B;
}

/**
 * Quais casas o mapa mostra quando nem todas cabem: começa na 1 e só anda para baixo se uma nota tocando (ou a
 * próxima) cair além da última que cabe, deixando-a na última linha. Devolve a primeira casa e quantas mostrar.
 */
export function janelaDoMapa(casasTotal: number, cabem: number, casasEmUso: number[]) {
  const n = Math.max(1, Math.min(casasTotal, cabem));
  const maior = Math.max(0, ...casasEmUso);
  const inicio = maior > n ? Math.min(casasTotal - n + 1, maior - n + 1) : 1;
  return { inicio, n };
}
