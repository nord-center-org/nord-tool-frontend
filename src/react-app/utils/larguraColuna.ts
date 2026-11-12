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
