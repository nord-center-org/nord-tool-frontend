/** Regras puras do PDF do termo (sem dependências, testáveis em node). */

export const PDF_MAX_BYTES = 15 * 1024 * 1024;
export const PDF_MAX_PAGINAS = 40;

export function validarArquivoPdf(arquivo: { name: string; size: number }): void {
  if (!/\.pdf$/i.test(arquivo.name)) {
    throw new Error('Anexe um arquivo PDF.');
  }
  validarTamanhoPdf(arquivo.size);
}

export function validarTamanhoPdf(bytes: number): void {
  if (bytes > PDF_MAX_BYTES) {
    throw new Error('O PDF deve ter no máximo 15 MB.');
  }
}

export function validarPaginasPdf(nrPaginas: number): void {
  if (nrPaginas < 1) {
    throw new Error('O PDF não tem páginas.');
  }
  if (nrPaginas > PDF_MAX_PAGINAS) {
    throw new Error(`O PDF deve ter no máximo ${PDF_MAX_PAGINAS} páginas.`);
  }
}

/** Escala de renderização: no máximo 2x, limitada a ~1400 px de largura. */
export function escalaRender(larguraPagina: number): number {
  return Math.min(2, 1400 / larguraPagina);
}
