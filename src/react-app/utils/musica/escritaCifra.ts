/**
 * Repertório v10 — "Escrever cifra": com a música tocando, a pessoa aperta os acordes na hora em que entram e
 * (se colou a letra) marca o começo de cada linha. Daqui sai a cifra no formato do Cifra Club (acordes em cima da
 * sílaba certa) e o tempo de cada linha, para a cifra rolar sozinha. Puro, testável em node.
 */
import { lerCifra, blocosComTempo } from "./cifra.ts";
import { mod12, nomeDaNota, transporAcorde, usaBemol, type Tom } from "./teoria.ts";

export interface MarcaAcorde { tempo: number; acorde: string }
/** v11: acorde posto à mão em cima de uma sílaba (linha da letra, sem contar as vazias, e coluna). */
export interface AcordeFixo { linha: number; col: number; acorde: string }

export interface EscritaCifra {
  /** A letra colada (uma linha por verso; linha vazia separa estrofes). */
  letra: string;
  /** Onde cada linha de letra (não vazia, na ordem) começa na música (s); null = ainda não marcada. */
  inicios: (number | null)[];
  /** Acordes apertados, com o tempo (s) em que entraram. */
  acordes: MarcaAcorde[];
  /** v11: acordes postos em cima das sílabas (clicando na letra). */
  fixos?: AcordeFixo[];
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

/** v11: um acorde de um verso — veio de uma marca no tempo (`marca`) ou foi posto na sílaba (`fixo`). */
export interface ItemLinha { col: number; acorde: string; marca: number | null; fixo: number | null }

/** Onde o verso `i` começa e termina na música (null se ainda não tem o começo marcado). */
export function trechoDoVerso(e: EscritaCifra, i: number, nVersos: number, duracao: number): { inicio: number; fim: number } | null {
  const inicio = e.inicios[i] ?? null;
  if (inicio === null) return null;
  const fim = e.inicios.slice(i + 1, nVersos).find(v => v !== null && v !== undefined) ?? duracao;
  return { inicio, fim: Math.max(inicio + 0.5, fim) };
}

/**
 * v11: os acordes de um verso, na ordem das colunas — os marcados no tempo (na coluna proporcional ao tempo, se o
 * verso tem começo) e os postos na sílaba (na coluna escolhida). Um posto na sílaba vale mais que um do tempo na
 * mesma coluna.
 */
export function itensDaLinha(e: EscritaCifra, i: number, versos: string[], duracao: number): ItemLinha[] {
  const itens: ItemLinha[] = [];
  const t = trechoDoVerso(e, i, versos.length, duracao);
  const fixos = (e.fixos ?? []).flatMap((f, k) => (f.linha === i ? [{ col: f.col, acorde: f.acorde, marca: null, fixo: k }] : []));
  if (t) {
    const largura = Math.max(versos[i]?.length ?? 0, 8);
    e.acordes.forEach((a, k) => {
      if (a.tempo < t.inicio || a.tempo >= t.fim) return;
      const col = Math.round(((a.tempo - t.inicio) / (t.fim - t.inicio)) * largura);
      if (!fixos.some(f => f.col === col)) itens.push({ col, acorde: a.acorde, marca: k, fixo: null });
    });
  }
  return [...itens, ...fixos].sort((a, b) => a.col - b.col);
}

/** v11: as colunas onde os acordes ficam de fato (um não encosta no anterior). */
export function colunasSemEncostar(itens: Array<{ col: number; nome: string }>): number[] {
  let fim = -1;
  return itens.map(it => { const col = Math.max(it.col, fim + 1); fim = col + it.nome.length; return col; });
}

/** v11: põe um acorde em cima da sílaba (troca o que já estava nessa coluna da linha). */
export function porNaSilaba(e: EscritaCifra, linha: number, col: number, acorde: string): EscritaCifra {
  const fixos = (e.fixos ?? []).filter(f => !(f.linha === linha && f.col === col));
  fixos.push({ linha, col, acorde });
  fixos.sort((a, b) => a.linha - b.linha || a.col - b.col);
  return { ...e, fixos };
}

/** v11: tira um acorde de um verso (seja marca no tempo, seja posto na sílaba). */
export function tirarItem(e: EscritaCifra, it: Pick<ItemLinha, "marca" | "fixo">): EscritaCifra {
  if (it.fixo !== null) return { ...e, fixos: (e.fixos ?? []).filter((_, k) => k !== it.fixo) };
  if (it.marca !== null) return { ...e, acordes: e.acordes.filter((_, k) => k !== it.marca) };
  return e;
}

/** v11: troca os acordes de um verso pelos de `novos` (marcas no tempo), tirando os que estavam nele. */
export function trocarAcordesDoVerso(e: EscritaCifra, i: number, nVersos: number, duracao: number, novos: MarcaAcorde[]): EscritaCifra {
  const t = trechoDoVerso(e, i, nVersos, duracao);
  if (!t) return e;
  const fora = e.acordes.filter(a => a.tempo < t.inicio || a.tempo >= t.fim);
  const dentro = novos.filter(a => a.tempo >= t.inicio && a.tempo < t.fim);
  return { ...e, acordes: [...fora, ...dentro].sort((a, b) => a.tempo - b.tempo), fixos: (e.fixos ?? []).filter(f => f.linha !== i) };
}

/** v11: troca o texto do verso `i` (contando só as linhas não vazias) mantendo o resto da letra. */
export function trocarVerso(letra: string, i: number, novo: string): string {
  let k = -1;
  return letra.replace(/\r\n?/g, "\n").split("\n").map(l => (l.trim() && ++k === i ? novo : l)).join("\n");
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
    iVerso++;
    const itens = itensDaLinha(e, iVerso - 1, versos, duracao);
    if (itens.length) saida.push(linhaDeAcordesNasColunas(itens.map(it => ({ col: it.col, nome: it.acorde }))));
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

/** v11: sobe ou desce o tom de tudo o que foi escrito (marcas no tempo e acordes nas sílabas). */
export function transporEscrita(e: EscritaCifra, semitons: number, bemol?: boolean): EscritaCifra {
  if (!semitons) return e;
  const t = (a: string) => transporAcorde(a, semitons, bemol);
  return { ...e, acordes: e.acordes.map(a => ({ ...a, acorde: t(a.acorde) })), ...(e.fixos ? { fixos: e.fixos.map(f => ({ ...f, acorde: t(f.acorde) })) } : {}) };
}

/** v11: tempo escrito "1:02.5" (ou "62.5", "62,5") em segundos; null se não der para ler. */
export function lerTempo(texto: string): number | null {
  const m = /^\s*(?:(\d+):)?(\d+(?:[.,]\d+)?)\s*$/.exec(texto);
  if (!m) return null;
  const s = (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2].replace(",", "."));
  return Number.isFinite(s) ? Math.round(s * 10) / 10 : null;
}

/** v11: segundos como "1:02.5". */
export function escreverTempo(s: number): string {
  const t = Math.max(0, Math.round(s * 10) / 10);
  const min = Math.floor(t / 60), seg = t - min * 60;
  return `${min}:${seg < 10 ? "0" : ""}${seg.toFixed(1)}`;
}

/** v11: a cifra de um trecho escolhido do verso: o verso passa a começar no começo do trecho e recebe os acordes dele. */
export function cifraNoTrecho(e: EscritaCifra, i: number, nVersos: number, duracao: number, inicio: number, novos: MarcaAcorde[]): EscritaCifra {
  const inicios = Array.from({ length: nVersos }, (_, k) => e.inicios[k] ?? null);
  inicios[i] = Math.round(inicio * 1000) / 1000;
  return trocarAcordesDoVerso({ ...e, inicios }, i, nVersos, duracao, novos.map(a => ({ ...a, tempo: Math.max(inicio, a.tempo) })));
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
  const fixos = Array.isArray(o.fixos) ? o.fixos.slice(0, 5000).flatMap((a): AcordeFixo[] => {
    if (!a || typeof a !== "object") return [];
    const x = a as Record<string, unknown>;
    return Number.isInteger(x.linha) && Number.isInteger(x.col) && (x.linha as number) >= 0 && (x.col as number) >= 0 && (x.col as number) <= 500
      && typeof x.acorde === "string" && x.acorde.length > 0 && x.acorde.length <= 12 ? [{ linha: x.linha as number, col: x.col as number, acorde: x.acorde }] : [];
  }) : [];
  return fixos.length ? { letra, inicios, acordes, fixos } : { letra, inicios, acordes };
}
