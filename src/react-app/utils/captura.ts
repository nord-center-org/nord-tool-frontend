/** Regras puras do print delimitado que vai para a Lugia: retângulo da seleção, recorte e nome do arquivo. */

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Elementos marcados com este atributo (botões flutuantes, mascote) ficam fora do print. */
export const ATRIBUTO_SEM_PRINT = "data-sem-print";

/** Seleções menores que isto (px) são tratadas como clique sem arrastar. */
export const LADO_MINIMO = 12;

/** Retângulo a partir de dois cantos quaisquer (arrastar para qualquer direção). */
export function retanguloEntre(x0: number, y0: number, x1: number, y1: number): Retangulo {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), largura: Math.abs(x1 - x0), altura: Math.abs(y1 - y0) };
}

export function selecaoValida(r: Retangulo): boolean {
  return r.largura >= LADO_MINIMO && r.altura >= LADO_MINIMO;
}

/**
 * Converte a seleção (coordenadas da janela) para o recorte dentro da imagem renderizada do elemento.
 * `elemento` é a caixa do elemento na janela (pode começar acima do topo quando a tela está rolada) e `escala`
 * é a densidade da imagem (pixelRatio). Devolve null se a seleção não cobrir o elemento.
 */
export function recorteNoElemento(selecao: Retangulo, elemento: Retangulo, escala: number): Retangulo | null {
  const x0 = Math.max(selecao.x, elemento.x);
  const y0 = Math.max(selecao.y, elemento.y);
  const x1 = Math.min(selecao.x + selecao.largura, elemento.x + elemento.largura);
  const y1 = Math.min(selecao.y + selecao.altura, elemento.y + elemento.altura);
  if (x1 <= x0 || y1 <= y0) return null;
  return {
    x: Math.round((x0 - elemento.x) * escala),
    y: Math.round((y0 - elemento.y) * escala),
    largura: Math.round((x1 - x0) * escala),
    altura: Math.round((y1 - y0) * escala),
  };
}

/** Nome do arquivo: print-<tela>-<hora>.png, sem caracteres estranhos. */
export function nomePrint(caminho: string, quando: Date): string {
  const tela = caminho.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() || "inicio";
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  return `print-${tela}-${doisDigitos(quando.getHours())}${doisDigitos(quando.getMinutes())}${doisDigitos(quando.getSeconds())}.png`;
}
