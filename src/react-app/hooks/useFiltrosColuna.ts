import { useCallback, useState } from 'react';
import type { FiltrosColuna, OrdenacaoColuna, DirecaoOrdenacao } from '../utils/filtroColuna';

/** Estado dos filtros de coluna (valores selecionados) e da ordenação. */
export function useFiltrosColuna<K extends string>(
  filtrosIniciais: FiltrosColuna<K> = {},
  ordenacaoInicial: OrdenacaoColuna<K> | null = null,
) {
  const [filtros, setFiltros] = useState<FiltrosColuna<K>>(filtrosIniciais);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoColuna<K> | null>(ordenacaoInicial);

  const aplicarFiltro = useCallback((coluna: K, valores: string[] | null) => {
    setFiltros(atual => {
      const proximo = { ...atual };
      if (valores === null) delete proximo[coluna];
      else proximo[coluna] = valores;
      return proximo;
    });
  }, []);

  const ordenar = useCallback((coluna: K, direcao: DirecaoOrdenacao) => {
    setOrdenacao({ coluna, direcao });
  }, []);

  const limpar = useCallback(() => {
    setFiltros({});
    setOrdenacao(null);
  }, []);

  return { filtros, ordenacao, aplicarFiltro, ordenar, limpar };
}
