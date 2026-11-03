import { createContext, useContext } from "react";
import type { Animacoes, PreferenciaTema, Tema, TemaGeral } from "../utils/tema";

export interface TemaContexto {
  preferencia: PreferenciaTema;
  /** O tema que a tela aberta está mostrando. */
  tema: Tema;
  /** O tema próprio da tela aberta (null = segue o geral). */
  temaDestaTela: Tema | null;
  definirGeral(geral: TemaGeral): void;
  definirAnimacoes(animacoes: Animacoes): void;
  /** O aparelho pede menos movimento (acessibilidade ou economia de bateria). */
  aparelhoPedeMenos: boolean;
  /** Tema próprio de uma tela (null volta a seguir o geral). Sem caminho, vale a tela aberta. */
  definirDaTela(tema: Tema | null, caminho?: string): void;
}

export const TemaContext = createContext<TemaContexto | null>(null);

export function useTema(): TemaContexto {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error("useTema precisa estar dentro de <TemaProvider>");
  return contexto;
}
