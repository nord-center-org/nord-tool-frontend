import { useSyncExternalStore } from "react";

import { NOTACAO_PADRAO, gravarNotacao, lerNotacao, type Notacao } from "@/react-app/utils/musica/notacao";

/** v15: a notação escolhida vale em todas as telas do Repertório ao mesmo tempo (e fica guardada no aparelho). */
const ouvintes = new Set<() => void>();
const armazenamento = () => { try { return window.localStorage; } catch { return undefined; } };
let atual: Notacao = typeof window === "undefined" ? NOTACAO_PADRAO : lerNotacao(armazenamento());

export function mudarNotacao(parcial: Partial<Notacao>) {
  atual = { ...atual, ...parcial };
  gravarNotacao(armazenamento(), atual);
  ouvintes.forEach(f => f());
}

export function useNotacao(): Notacao {
  return useSyncExternalStore(
    f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => atual,
    () => NOTACAO_PADRAO,
  );
}
