/**
 * Repertório v12 — a imagem da cifra para compartilhar: aqui só o plano (o que vai em cada linha, o tamanho da letra,
 * uma ou duas colunas e o tamanho da imagem); o desenho no canvas fica em `components/repertorio/desenhoCifra.ts`.
 * Puro, testável em node.
 */
import { acordesDaLinha } from "./cifra.ts";

export type TipoItem = "secao" | "acordes" | "letra" | "espaco";
export interface ItemImagem { tipo: TipoItem; texto: string; /** em "secao": acordes que vêm na mesma linha */ resto?: string }

export interface PlanoImagem {
  largura: number;
  altura: number;
  /** Tamanho da fonte (px) da cifra. */
  fonte: number;
  colunas: ItemImagem[][];
  larguraColuna: number;
}

/** Medidas do desenho (px). */
export const MEDIDAS = { margem: 64, cabecalho: 250, rodape: 96, entreColunas: 64, larguraUma: 1080, larguraDuas: 1920, alturaMax: 1920, proporcaoLetra: 0.6 };

/** As linhas da cifra, prontas para desenhar (a linha "Tom:" vai para o cabeçalho; linhas vazias seguidas viram uma). */
export function itensDaCifra(texto: string): ItemImagem[] {
  const itens: ItemImagem[] = [];
  for (const bruta of texto.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    const linha = bruta.replace(/\s+$/, "");
    if (!linha.trim()) { if (itens.length && itens[itens.length - 1].tipo !== "espaco") itens.push({ tipo: "espaco", texto: "" }); continue; }
    if (/^\s*tom\s*:/i.test(linha)) continue;
    const secao = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(linha);
    if (secao) { itens.push({ tipo: "secao", texto: secao[1].trim(), ...(secao[2].trim() ? { resto: secao[2] } : {}) }); continue; }
    itens.push({ tipo: acordesDaLinha(linha) ? "acordes" : "letra", texto: linha });
  }
  while (itens.length && itens[itens.length - 1].tipo === "espaco") itens.pop();
  return itens;
}

/** Altura de um item, em múltiplos do tamanho da fonte. */
export const alturaItem = (t: TipoItem) => (t === "espaco" ? 0.8 : t === "secao" ? 2 : t === "acordes" ? 1.25 : 1.45);

const larguraEmLetras = (it: ItemImagem) => (it.tipo === "secao" ? it.texto.length + 4 + (it.resto?.length ?? 0) : it.texto.length);

/** Fonte que faz a linha mais comprida caber na coluna (entre 15 e 30 px). */
function fonteQueCabe(itens: ItemImagem[], larguraColuna: number): number {
  const maior = Math.max(20, ...itens.map(larguraEmLetras));
  return Math.max(15, Math.min(30, Math.floor(larguraColuna / (maior * MEDIDAS.proporcaoLetra))));
}

const alturaDe = (itens: ItemImagem[], fonte: number) => itens.reduce((s, it) => s + alturaItem(it.tipo) * fonte, 0);

/** Divide em duas colunas no espaço entre estrofes mais perto do meio (ou no meio, se não houver). */
export function dividirEmDuas(itens: ItemImagem[]): [ItemImagem[], ItemImagem[]] {
  const total = alturaDe(itens, 1);
  let acumulado = 0, melhor = Math.ceil(itens.length / 2), dist = Infinity;
  itens.forEach((it, i) => {
    acumulado += alturaItem(it.tipo);
    if (it.tipo === "espaco") { const d = Math.abs(acumulado - total / 2); if (d < dist) { dist = d; melhor = i + 1; } }
  });
  const a = itens.slice(0, melhor), b = itens.slice(melhor);
  while (a.length && a[a.length - 1].tipo === "espaco") a.pop();
  while (b.length && b[0].tipo === "espaco") b.shift();
  return [a, b];
}

/** Uma coluna (1080 px) se couber até 1920 px de altura; senão, duas colunas (1920 px de largura). */
export function planoDaImagem(texto: string): PlanoImagem {
  const { margem, cabecalho, rodape, entreColunas, larguraUma, larguraDuas, alturaMax } = MEDIDAS;
  const itens = itensDaCifra(texto);
  const larguraColuna1 = larguraUma - 2 * margem;
  const fonte1 = fonteQueCabe(itens, larguraColuna1);
  const altura1 = Math.ceil(cabecalho + alturaDe(itens, fonte1) + rodape + margem / 2);
  if (altura1 <= alturaMax || itens.length < 24) {
    return { largura: larguraUma, altura: Math.max(altura1, 720), fonte: fonte1, colunas: [itens], larguraColuna: larguraColuna1 };
  }
  const colunas = dividirEmDuas(itens);
  const larguraColuna = (larguraDuas - 2 * margem - entreColunas) / 2;
  const fonte = fonteQueCabe(itens, larguraColuna);
  const altura = Math.ceil(cabecalho + Math.max(...colunas.map(c => alturaDe(c, fonte))) + rodape + margem / 2);
  return { largura: larguraDuas, altura: Math.max(altura, 720), fonte, colunas, larguraColuna };
}

/** Nome do arquivo da imagem: "cifra-cancao-da-obra.png". */
export function nomeDaImagem(titulo: string): string {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `cifra-${base || "musica"}.png`;
}
