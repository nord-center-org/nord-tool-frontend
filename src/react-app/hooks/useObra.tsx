import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { contextoService } from "@/react-app/services/ContextoService";
import {
  FASES_LEGADAS, escolherObraInicial, fasesParaFiltro, lerObraAtual, salvarObraAtual,
  type FaseFiltro, type ObraContexto,
} from "@/react-app/utils/contextoObra";

interface ObraContextoValor {
  obras: ObraContexto[];
  idObra: number | null;
  obra: ObraContexto | null;
  /** Fases da obra atual para os filtros das telas. */
  fases: FaseFiltro[];
  carregando: boolean;
  trocarObra: (id: number) => void;
  recarregar: () => Promise<void>;
}

const ObraContext = createContext<ObraContextoValor>({
  obras: [], idObra: null, obra: null, fases: FASES_LEGADAS, carregando: false, trocarObra: () => undefined, recarregar: async () => undefined,
});

const armazenamento = () => (typeof window !== "undefined" ? window.localStorage : undefined);

/** Obra atual do app: vai no cabeçalho X-Obra de todas as chamadas (ver apiClient) e define as fases dos filtros. */
export function ObraProvider({ children }: { children: ReactNode }) {
  const [obras, setObras] = useState<ObraContexto[]>([]);
  const [idObra, setIdObra] = useState<number | null>(() => lerObraAtual(armazenamento()));
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await contextoService.minhasObras();
      setObras(lista);
      const escolhida = escolherObraInicial(lista, lerObraAtual(armazenamento()));
      salvarObraAtual(armazenamento(), escolhida);
      setIdObra(escolhida);
    } catch {
      setObras([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const trocarObra = useCallback((id: number) => {
    salvarObraAtual(armazenamento(), id);
    setIdObra(id);
  }, []);

  const valor = useMemo<ObraContextoValor>(() => ({
    obras, idObra, obra: obras.find(o => o.id === idObra) ?? null, fases: fasesParaFiltro(obras, idObra), carregando, trocarObra, recarregar,
  }), [obras, idObra, carregando, trocarObra, recarregar]);

  return <ObraContext.Provider value={valor}>{children}</ObraContext.Provider>;
}

export function useObra(): ObraContextoValor {
  return useContext(ObraContext);
}
