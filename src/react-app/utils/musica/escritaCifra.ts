/**
 * Repertório v10 — "Escrever cifra": com a música tocando, a pessoa aperta os acordes na hora em que entram e
 * (se colou a letra) marca o começo de cada linha. Daqui sai a cifra no formato do Cifra Club (acordes em cima da
 * sílaba certa) e o tempo de cada linha, para a cifra rolar sozinha. Puro, testável em node.
 */
import { lerCifra, blocosComTempo } from "./cifra.ts";
import { mod12, nomeDaNota, usaBemol, type Tom } from "./teoria.ts";

export interface MarcaAcorde { tempo: number; acorde: string }

export interface EscritaCifra {
  /** A letra colada (uma linha por verso; linha vazia separa estrofes). */
  letra: string;
  /** Onde cada linha de letra (não vazia, na ordem) começa na música (s); null = ainda não marcada. */
  inicios: (number | null)[];
  /** Acordes apertados, com o tempo (s) em que entraram. */
  acordes: MarcaAcorde[];
}

export const ESCRITA_VAZIA: EscritaCifra = { letra: "", inicios: [], acordes: [] };

/** As linhas da letra que contam (as não vazias), na ordem. */
export const linhasDaLetra = (letra: string) => letra.replace(/\r\n?/g, "\n").split("\n").map(l => l.replace(/\s+$/, "")).filter(l => l.trim());

/** Os acordes do campo harmônico do tom (maior: I ii iii IV V vi vii°; menor: i ii° III iv v VI VII) e o V7. */
export function campoHarmonico(tom: Tom): string[] {
  const bemol = usaBemol(tom.tonica, tom.menor);
  const n = (i: number) => nomeDaNota(mod12(tom.tonica + i), bemol);
  if (tom.menor) return [`${n(0)}m`, `${n(2)}dim`, n(3), `${n(5)}m`, `${n(7)}m`, n(8), n(10), `${n(7)}7`];
  return [n(0), `${n(2)}m`, `${n(4)}m`, n(5), n(7), `${n(9)}m`, `${n(11)}dim`, `${n(7)}7`];
}

/** Os tipos de acorde do "outro acorde". */
export const TIPOS_ACORDE: Array<{ sufixo: string; nome: string }> = [
  { sufixo: "", nome: "Maior" }, { sufixo: "m", nome: "Menor" }, { sufixo: "7", nome: "7" }, { sufixo: "m7", nome: "m7" },
  { sufixo: "7M", nome: "7M" }, { sufixo: "sus4", nome: "sus4" }, { sufixo: "dim", nome: "dim" }, { sufixo: "5", nome: "5" },
];

/** Encaixa o tempo na batida mais próxima, se estiver a menos de `folga` s dela. */
export function noTempo(t: number, batidas: number[], folga = 0.2): number {
  let melhor = t, dist = folga;
  for (const b of batidas) { const d = Math.abs(b - t); if (d < dist) { dist = d; melhor = b; } }
  return Math.round(melhor * 1000) / 1000;
}

/** Acrescenta um acorde (mantém em ordem; um acorde no mesmo instante substitui o anterior). */
export function marcarAcorde(acordes: MarcaAcorde[], tempo: number, acorde: string): MarcaAcorde[] {
  return [...acordes.filter(a => Math.abs(a.tempo - tempo) > 0.05), { tempo, acorde }].sort((a, b) => a.tempo - b.tempo);
}

/** Linha de acordes com cada um na coluna pedida, sem encostar no anterior. */
function linhaDeAcordesNasColunas(itens: Array<{ col: number; nome: string }>): string {
  let s = "", fim = -1;
  for (const it of itens) {
    const col = Math.max(it.col, fim + 1);
    s = s.padEnd(col, " ") + it.nome;
    fim = col + it.nome.length;
  }
  return s;
}

/** A linha de acordes de um verso que começa em `inicio` e vai até `fim` (vazia se nenhum acorde caiu nele). */
export function acordesDaLinha(acordes: MarcaAcorde[], texto: string, inicio: number, fim: number, nome: (a: string) => string = a => a): string {
  const dur = Math.max(0.5, fim - inicio);
  const largura = Math.max(texto.length, 8);
  const desta = acordes.filter(a => a.tempo >= inicio && a.tempo < fim);
  return linhaDeAcordesNasColunas(desta.map(a => ({ col: Math.round(((a.tempo - inicio) / dur) * largura), nome: nome(a.acorde) })));
}

/** Os acordes antes do primeiro verso marcado (a introdução; ou todos, sem letra marcada). */
export function acordesDaIntro(e: EscritaCifra): MarcaAcorde[] {
  const n = linhasDaLetra(e.letra).length;
  const primeiro = e.inicios.slice(0, n).find(v => v !== null && v !== undefined) ?? Infinity;
  return e.acordes.filter(a => a.tempo < primeiro);
}

/**
 * Monta a cifra: os acordes antes da primeira linha marcada (ou todos, sem letra) viram linhas de acordes (quatro por
 * linha) numa seção [Intro]; cada linha marcada da letra recebe os acordes que caíram no trecho dela, na coluna
 * proporcional ao tempo; linhas ainda não marcadas entram só com a letra. Devolve o texto e o tempo de cada bloco
 * (na ordem dos blocos que `lerCifra` vai ler do texto).
 */
export function montarCifra(e: EscritaCifra, duracao: number): { texto: string; tempos: (number | null)[] } {
  const versos = linhasDaLetra(e.letra);
  const marcados = versos.map((texto, i) => ({ texto, inicio: e.inicios[i] ?? null }));
  const saida: string[] = [];
  const temposDosBlocos: (number | null)[] = [];

  // introdução (ou a música toda, sem letra marcada): quatro acordes por linha
  const intro = acordesDaIntro(e);
  if (intro.length) {
    saida.push(versos.length ? "[Intro]" : "[Acordes]");
    for (let i = 0; i < intro.length; i += 4) {
      const grupo = intro.slice(i, i + 4);
      saida.push(grupo.map(a => a.acorde.padEnd(6)).join(" ").trimEnd());
      temposDosBlocos.push(grupo[0].tempo);
    }
    if (versos.length) saida.push("");
  }

  // estrofes: a linha vazia da letra separa
  const original = e.letra.replace(/\r\n?/g, "\n").split("\n");
  let iVerso = 0;
  for (const bruta of original) {
    if (!bruta.trim()) { if (saida.length && saida[saida.length - 1] !== "") saida.push(""); continue; }
    const v = marcados[iVerso];
    const proximo = marcados.slice(iVerso + 1).find(x => x.inicio !== null)?.inicio ?? duracao;
    iVerso++;
    if (v.inicio === null) { saida.push(v.texto); temposDosBlocos.push(null); continue; }
    const linha = acordesDaLinha(e.acordes, v.texto, v.inicio, proximo);
    if (linha) saida.push(linha);
    saida.push(v.texto);
    temposDosBlocos.push(v.inicio);
  }
  const texto = saida.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // alinha os tempos aos blocos que a cifra vai ter (seções sem acordes não têm tempo)
  const cifra = lerCifra(texto);
  const comTempo = new Set(blocosComTempo(cifra));
  const tempos: (number | null)[] = [];
  let k = 0;
  cifra.blocos.forEach((_, i) => { tempos.push(comTempo.has(i) ? temposDosBlocos[k++] ?? null : null); });
  return { texto, tempos };
}

/** Lê a escrita guardada (com tolerância a dado velho ou quebrado). */
export function lerEscrita(bruto: unknown): EscritaCifra {
  if (!bruto || typeof bruto !== "object") return { ...ESCRITA_VAZIA };
  const o = bruto as Record<string, unknown>;
  const letra = typeof o.letra === "string" ? o.letra.slice(0, 20_000) : "";
  const inicios = Array.isArray(o.inicios) ? o.inicios.slice(0, 2000).map(v => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null)) : [];
  const acordes = Array.isArray(o.acordes) ? o.acordes.slice(0, 5000).flatMap((a): MarcaAcorde[] => {
    if (!a || typeof a !== "object") return [];
    const x = a as Record<string, unknown>;
    return typeof x.tempo === "number" && Number.isFinite(x.tempo) && x.tempo >= 0 && typeof x.acorde === "string" && x.acorde.length <= 12 ? [{ tempo: x.tempo, acorde: x.acorde }] : [];
  }).sort((a, b) => a.tempo - b.tempo) : [];
  return { letra, inicios, acordes };
}
