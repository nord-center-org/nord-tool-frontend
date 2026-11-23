import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Qualidade } from "@/react-app/utils/drumcamAoVivo";
import { ConexaoCamera } from "./conexaoCamera";
import { ReleDrumcam, type CameraNaLista, type EstadoRele } from "./rele";

interface Contexto {
  rele: ReleDrumcam | null;
  estado: EstadoRele;
  cameras: CameraNaLista[];
  conexao(id: string, qualidade: Qualidade): ConexaoCamera | null;
  soltar(id: string): void;
  /** Registra (ou tira, com null) o uso de uma conexão por uma tela, com a qualidade de que ela precisa. */
  usar(id: string, chave: number, qualidade: Qualidade | null): void;
}
const Ctx = createContext<Contexto | null>(null);

const ORDEM_QUALIDADE: Qualidade[] = ["baixa", "media", "alta"];

/**
 * Um relé (papel "controle") e as conexões com as câmeras ao vivo, divididas entre o estúdio e o monitoramento.
 * Cada tela pede a conexão com a qualidade de que precisa; vale a maior pedida, e quem para de usar devolve.
 */
export function ProvedorAoVivo({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoRele>("conectando");
  const [cameras, setCameras] = useState<CameraNaLista[]>([]);
  const [rele, setRele] = useState<ReleDrumcam | null>(null);
  const conexoes = useRef(new Map<string, { c: ConexaoCamera; usos: Map<number, Qualidade> }>());

  useEffect(() => {
    const r = new ReleDrumcam("controle", "", {
      estado: setEstado,
      cameras: lista => {
        setCameras(lista);
        // Câmera que saiu: a conexão fecha.
        for (const [id, x] of conexoes.current) if (!lista.some(c => c.id === id)) { x.c.fechar(); conexoes.current.delete(id); }
      },
      sinal: (de, dados) => void conexoes.current.get(de)?.c.sinal(dados),
    });
    setRele(r);
    const mapa = conexoes.current;
    return () => { for (const x of mapa.values()) x.c.fechar(); mapa.clear(); r.fechar(); };
  }, []);

  const valor = useMemo<Contexto>(() => ({
    rele, estado, cameras,
    conexao(id, qualidade) {
      if (!rele) return null;
      let x = conexoes.current.get(id);
      if (!x) { x = { c: new ConexaoCamera(rele, id, qualidade), usos: new Map() }; conexoes.current.set(id, x); }
      return x.c;
    },
    soltar(id) {
      const x = conexoes.current.get(id);
      if (x && x.usos.size === 0) { x.c.fechar(); conexoes.current.delete(id); }
    },
    usar(id, chave, q) {
      const x = conexoes.current.get(id);
      if (!x) return;
      if (q) x.usos.set(chave, q); else x.usos.delete(chave);
      if (x.usos.size === 0) return;
      // Vale a maior qualidade pedida entre as telas que usam a câmera.
      const maior = [...x.usos.values()].sort((a, b) => ORDEM_QUALIDADE.indexOf(b) - ORDEM_QUALIDADE.indexOf(a))[0];
      void x.c.mudarQualidade(maior);
    },
  }), [rele, estado, cameras]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAoVivo() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAoVivo fora do ProvedorAoVivo");
  return c;
}

let proximaChave = 1;

/** Conexão com uma câmera, na qualidade pedida; re-renderiza quando a imagem ou o estado mudam. */
export function useConexao(id: string | null, qualidade: Qualidade): ConexaoCamera | null {
  const ctx = useAoVivo();
  const chave = useRef(0);
  if (!chave.current) chave.current = proximaChave++;
  const conexao = id ? ctx.conexao(id, qualidade) : null;
  useEffect(() => {
    if (!id || !conexao) return;
    const k = chave.current;
    ctx.usar(id, k, qualidade);
    return () => { ctx.usar(id, k, null); setTimeout(() => ctx.soltar(id), 2_000); };
  }, [id, conexao, qualidade, ctx]);
  useSyncExternalStore(
    f => (conexao ? conexao.aoMudar(f) : () => undefined),
    () => (conexao ? `${conexao.situacao}|${conexao.stream?.id ?? ""}|${JSON.stringify(conexao.estado)}|${conexao.zoomDigital}` : ""),
  );
  return conexao;
}
