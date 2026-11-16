/**
 * Largura ideal de uma coluna da planilha (dois cliques na borda do cabeçalho, como no Excel/Google Sheets): o texto
 * mais largo da coluna mais uma folga. Puro: quem mede o texto é passado de fora (canvas no navegador).
 */

export interface TextoCelula { texto: string; negrito?: boolean; tamanho?: number /* pt */ }

export const FOLGA = 12;
export const MINIMA = 24;
export const MAXIMA = 800;

/** Coluna cuja borda direita fica mais perto de `x` (as bordas são acumuladas, como no editor: largura + 1). */
export function colunaDaBorda(larguras: number[], x: number): number {
  let soma = 0, melhor = -1, dist = Infinity;
  larguras.forEach((l, c) => {
    soma += l + 1;
    const d = Math.abs(soma - x);
    if (d < dist) { dist = d; melhor = c; }
  });
  return dist <= 8 ? melhor : -1;
}

/** Largura que cabe o texto mais largo (vazia: null, deixa como está). */
export function larguraIdeal(textos: TextoCelula[], medir: (t: TextoCelula) => number): number | null {
  let max = 0;
  for (const t of textos) {
    if (!t.texto) continue;
    // texto com quebra de linha: vale a linha mais longa
    for (const linha of t.texto.split("\n")) max = Math.max(max, medir({ ...t, texto: linha }));
  }
  if (!max) return null;
  return Math.min(MAXIMA, Math.max(MINIMA, Math.ceil(max + FOLGA)));
}

/** Correção: largura e altura padrão da planilha (coluna ou linha vazia volta a elas nos dois cliques). */
export const LARGURA_PADRAO = 73;
export const ALTURA_PADRAO = 19;

/**
 * Altura ideal de uma linha (dois cliques na borda do número da linha): a célula mais alta — tamanho da letra em pt
 * vezes as linhas de texto dela. Sem texto, volta à altura padrão.
 */
export function alturaIdeal(celulas: Array<{ texto: string; tamanho?: number }>): number {
  let max = 0;
  for (const c of celulas) {
    if (!c.texto) continue;
    const linhas = c.texto.split("\n").length;
    const px = (c.tamanho ?? 10) * (96 / 72);
    max = Math.max(max, Math.ceil(linhas * px * 1.2 + 3));
  }
  return max ? Math.min(400, Math.max(ALTURA_PADRAO, max)) : ALTURA_PADRAO;
}
