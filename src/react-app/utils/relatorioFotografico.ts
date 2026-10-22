/** Regras puras do relatório fotográfico (sem React, testáveis em node). */

export type StatusRelatorio = "RASCUNHO" | "CONCLUIDO";
export type FotosPorPagina = 1 | 2 | 4 | 6;

export const LAYOUTS: FotosPorPagina[] = [1, 2, 4, 6];

export const ROTULO_STATUS: Record<StatusRelatorio, string> = {
  RASCUNHO: "Em preenchimento",
  CONCLUIDO: "Concluído",
};

export interface FotoRelatorio { id: number; idItem: number; nrOrdem: number; txLegenda: string | null }
export interface ItemRelatorio {
  id: number; nrOrdem: number; nmItem: string; txOrientacao: string | null; txResposta: string | null; fotos: FotoRelatorio[];
}

/** Área de desenho (origem no canto inferior esquerdo, como no PDF). */
export interface Celula { x: number; y: number; w: number; h: number }

/** Colunas × linhas de cada layout em A4 retrato. */
export function grade(n: FotosPorPagina): { colunas: number; linhas: number } {
  switch (n) {
    case 1: return { colunas: 1, linhas: 1 };
    case 2: return { colunas: 1, linhas: 2 };
    case 4: return { colunas: 2, linhas: 2 };
    case 6: return { colunas: 2, linhas: 3 };
  }
}

/**
 * Células de foto dentro da área útil (abaixo do cabeçalho). Cada célula reserva `legenda` pontos
 * embaixo para o texto; a foto usa o resto.
 */
export function celulas(n: FotosPorPagina, area: Celula, espaco = 12): Celula[] {
  const { colunas, linhas } = grade(n);
  const w = (area.w - espaco * (colunas - 1)) / colunas;
  const h = (area.h - espaco * (linhas - 1)) / linhas;
  const lista: Celula[] = [];
  for (let l = 0; l < linhas; l++) {
    for (let c = 0; c < colunas; c++) {
      lista.push({ x: area.x + c * (w + espaco), y: area.y + area.h - (l + 1) * h - l * espaco, w, h });
    }
  }
  return lista;
}

export interface FotoNaPagina { foto: FotoRelatorio; item: ItemRelatorio; numero: number }

/** Fotos na ordem dos itens e, dentro do item, na ordem das fotos; numeradas e divididas em páginas. */
export function paginarFotos(itens: ItemRelatorio[], n: FotosPorPagina): FotoNaPagina[][] {
  const todas: FotoNaPagina[] = [];
  [...itens].sort((a, b) => a.nrOrdem - b.nrOrdem || a.id - b.id).forEach(item => {
    [...item.fotos].sort((a, b) => a.nrOrdem - b.nrOrdem || a.id - b.id)
      .forEach(foto => todas.push({ foto, item, numero: todas.length + 1 }));
  });
  const paginas: FotoNaPagina[][] = [];
  for (let i = 0; i < todas.length; i += n) paginas.push(todas.slice(i, i + n));
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
