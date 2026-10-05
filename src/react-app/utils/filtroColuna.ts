export type DirecaoOrdenacao = 'asc' | 'desc';

export const VALOR_VAZIO = '—';

export const normalizarTexto = (valor: unknown) =>
  valor == null ? VALOR_VAZIO : String(valor).trim() || VALOR_VAZIO;

export const normalizarData = (valor: unknown) => {
  if (valor == null || valor === '') return null;
  const timestamp = valor instanceof Date ? valor.getTime() : new Date(String(valor)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

// Valores vazios sempre ficam por último, em qualquer direção.
export const compararValores = (valorA: unknown, valorB: unknown, direcao: DirecaoOrdenacao, data = false) => {
  const a = data ? normalizarData(valorA) : normalizarTexto(valorA).toLocaleLowerCase('pt-BR');
  const b = data ? normalizarData(valorB) : normalizarTexto(valorB).toLocaleLowerCase('pt-BR');
  if (a === null || a === VALOR_VAZIO) return b === null || b === VALOR_VAZIO ? 0 : 1;
  if (b === null || b === VALOR_VAZIO) return -1;
  const comparacao = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
  return direcao === 'asc' ? comparacao : -comparacao;
};

export interface ColunaFiltro<T> {
  /** Valor exibido/filtrado na coluna. */
  valor: (item: T) => unknown;
  /** Valor usado para ordenar (padrão: o próprio `valor`). */
  ordem?: (item: T) => unknown;
  /** Ordena por data real (timestamp). */
  data?: boolean;
}

export type ColunasFiltro<T, K extends string> = Record<K, ColunaFiltro<T>>;
export type FiltrosColuna<K extends string> = Partial<Record<K, string[]>>;
export interface OrdenacaoColuna<K extends string> { coluna: K; direcao: DirecaoOrdenacao }

export function valoresUnicos<T>(itens: T[], coluna: ColunaFiltro<T>): string[] {
  const valores = [...new Set(itens.map(item => normalizarTexto(coluna.valor(item))))];
  return valores.sort((a, b) => compararValores(a, b, 'asc'));
}

export function aplicarFiltrosColuna<T, K extends string>(
  itens: T[],
  colunas: ColunasFiltro<T, K>,
  filtros: FiltrosColuna<K>,
  ordenacao: OrdenacaoColuna<K> | null,
): T[] {
  const chaves = (Object.keys(filtros) as K[]).filter(chave => filtros[chave] !== undefined);
  let resultado = itens.filter(item => chaves.every(chave =>
    filtros[chave]!.includes(normalizarTexto(colunas[chave].valor(item)))));
  if (ordenacao) {
    const coluna = colunas[ordenacao.coluna];
    const ordem = coluna.ordem ?? coluna.valor;
    resultado = [...resultado].sort((a, b) => compararValores(ordem(a), ordem(b), ordenacao.direcao, coluna.data));
  }
  return resultado;
}
