/** Regras puras do relatório fotográfico (sem React, testáveis em node). */

export type StatusRelatorio = "RASCUNHO" | "CONCLUIDO";
export const ROTULO_STATUS: Record<StatusRelatorio, string> = {
  RASCUNHO: "Em preenchimento",
  CONCLUIDO: "Concluído",
};

export interface FotoRelatorio { id: number; idItem: number; nrOrdem: number; txLegenda: string | null; idImagem?: number }
export interface ItemRelatorio {
  id: number; nrOrdem: number; nmItem: string; txOrientacao: string | null; txResposta: string | null; fotos: FotoRelatorio[];
}

export type Orientacao = "retrato" | "paisagem";
/** Onde fica o texto da foto: embaixo (legenda) ou à direita (item, legenda e observação). */
export type PosicaoTexto = "abaixo" | "direita";

/** Retângulo relativo (0 a 1) dentro da área útil da página, com origem no canto superior esquerdo. */
export interface CelulaLayout { x: number; y: number; w: number; h: number; texto: PosicaoTexto }

export interface LayoutPagina { codigo: string; nome: string; orientacao: Orientacao; celulas: CelulaLayout[] }

const linhas = (n: number, texto: PosicaoTexto): CelulaLayout[] =>
  Array.from({ length: n }, (_, i) => ({ x: 0, y: i / n, w: 1, h: 1 / n, texto }));
const gradeDe = (colunas: number, nLinhas: number): CelulaLayout[] =>
  Array.from({ length: colunas * nLinhas }, (_, i) => ({
    x: (i % colunas) / colunas, y: Math.floor(i / colunas) / nLinhas, w: 1 / colunas, h: 1 / nLinhas, texto: "abaixo" as const,
  }));

/** Layouts de página do PDF (mesmos códigos validados no backend). */
export const LAYOUTS: LayoutPagina[] = [
  { codigo: "R1", nome: "1 foto grande", orientacao: "retrato", celulas: linhas(1, "abaixo") },
  { codigo: "R2L", nome: "2 fotos com texto ao lado", orientacao: "retrato", celulas: linhas(2, "direita") },
  { codigo: "R3L", nome: "3 fotos com texto ao lado", orientacao: "retrato", celulas: linhas(3, "direita") },
  { codigo: "R4L", nome: "4 fotos com texto ao lado", orientacao: "retrato", celulas: linhas(4, "direita") },
  { codigo: "R2", nome: "2 fotos empilhadas", orientacao: "retrato", celulas: linhas(2, "abaixo") },
  { codigo: "R2M", nome: "Foto com texto + foto larga", orientacao: "retrato", celulas: [
    { x: 0, y: 0, w: 1, h: 0.5, texto: "direita" }, { x: 0, y: 0.5, w: 1, h: 0.5, texto: "abaixo" },
  ] },
  { codigo: "R4", nome: "4 fotos em grade", orientacao: "retrato", celulas: gradeDe(2, 2) },
  { codigo: "R6", nome: "6 fotos em grade", orientacao: "retrato", celulas: gradeDe(2, 3) },
  { codigo: "R8", nome: "8 fotos em grade", orientacao: "retrato", celulas: gradeDe(2, 4) },
  { codigo: "P1L", nome: "Paisagem: 1 foto com texto ao lado", orientacao: "paisagem", celulas: linhas(1, "direita") },
  { codigo: "P2", nome: "Paisagem: 2 fotos lado a lado", orientacao: "paisagem", celulas: gradeDe(2, 1) },
  { codigo: "P3", nome: "Paisagem: 3 fotos lado a lado", orientacao: "paisagem", celulas: gradeDe(3, 1) },
  { codigo: "P4", nome: "Paisagem: 4 fotos lado a lado", orientacao: "paisagem", celulas: gradeDe(4, 1) },
  { codigo: "P6", nome: "Paisagem: 6 fotos em grade", orientacao: "paisagem", celulas: gradeDe(3, 2) },
];

/** Layout pelo código; código antigo ou desconhecido cai no de 2 fotos empilhadas. */
export function layoutPorCodigo(codigo: string | null | undefined): LayoutPagina {
  return LAYOUTS.find(l => l.codigo === codigo) ?? LAYOUTS.find(l => l.codigo === "R2")!;
}

export const fotosDoLayout = (codigo: string | null | undefined) => layoutPorCodigo(codigo).celulas.length;

/** Área de desenho (origem no canto inferior esquerdo, como no PDF). */
export interface Celula { x: number; y: number; w: number; h: number }

/**
 * Células absolutas do layout dentro da área útil (coordenadas do PDF: y cresce para cima).
 * `espaco` separa células vizinhas sem sobrar nas bordas da área.
 */
export function celulas(layout: LayoutPagina, area: Celula, espaco = 12): (Celula & { texto: PosicaoTexto })[] {
  return layout.celulas.map(c => {
    const esquerda = c.x > 1e-9 ? espaco / 2 : 0;
    const direita = c.x + c.w < 1 - 1e-9 ? espaco / 2 : 0;
    const topo = c.y > 1e-9 ? espaco / 2 : 0;
    const base = c.y + c.h < 1 - 1e-9 ? espaco / 2 : 0;
    const w = c.w * area.w - esquerda - direita;
    const h = c.h * area.h - topo - base;
    return { x: area.x + c.x * area.w + esquerda, y: area.y + area.h - c.y * area.h - topo - h, w, h, texto: c.texto };
  });
}

export interface FotoNaPagina { foto: FotoRelatorio; item: ItemRelatorio; numero: number }

/**
 * Fotos na ordem dos itens e, dentro do item, na ordem das fotos; numeradas e divididas em páginas.
 * Cada item começa numa página nova (um item nunca divide página com outro).
 */
export function paginarFotos(itens: ItemRelatorio[], n: number): FotoNaPagina[][] {
  const paginas: FotoNaPagina[][] = [];
  let numero = 0;
  [...itens].sort((a, b) => a.nrOrdem - b.nrOrdem || a.id - b.id).forEach(item => {
    const fotos = [...item.fotos].sort((a, b) => a.nrOrdem - b.nrOrdem || a.id - b.id)
      .map(foto => ({ foto, item, numero: ++numero }));
    for (let i = 0; i < fotos.length; i += n) paginas.push(fotos.slice(i, i + n));
  });
  return paginas;
}

/** Legenda impressa embaixo da foto: "3. Fachada norte — trinca na platibanda". */
export function legendaImpressa(f: FotoNaPagina): string {
  const legenda = f.foto.txLegenda?.trim();
  return `${f.numero}. ${f.item.nmItem}${legenda ? ` — ${legenda}` : ""}`;
}

/** Quanto do relatório foi respondido: itens com foto ou observação. */
export function progresso(itens: ItemRelatorio[]): { respondidos: number; total: number } {
  const respondidos = itens.filter(i => i.fotos.length > 0 || Boolean(i.txResposta?.trim())).length;
  return { respondidos, total: itens.length };
}

/** Nome do PDF sem caracteres que atrapalham o sistema de arquivos. */
export function nomeArquivoPdf(titulo: string, data: string): string {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `Relatorio-${base || "fotografico"}-${data}.pdf`;
}

/** Filtro da lista: título, local, modelo, fase ou autor. */
export function combinaBusca(r: { nmTitulo: string; nmLocal?: string | null; nmModelo?: string | null; nmFase?: string | null; nmAutor?: string | null }, busca: string): boolean {
  const termos = busca.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;
  const alvo = [r.nmTitulo, r.nmLocal, r.nmModelo, r.nmFase, r.nmAutor].filter(Boolean).join(" ")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return termos.every(t => alvo.includes(t));
}
