import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";

import { TemaContext, type TemaContexto } from "@/react-app/hooks/useTema";
import {
  chaveDaTela, comGeral, comTemaDaTela, lerPreferencia, salvarPreferencia, temaDaTela, type PreferenciaTema,
} from "@/react-app/utils/tema";

const armazenamento = () => (typeof window === "undefined" ? undefined : window.localStorage);
const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

/** Aplica o tema da tela aberta no <html> (classe nt-escuro + color-scheme) e guarda as escolhas. */
export default function TemaProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(() => lerPreferencia(armazenamento()));
  const [sistemaEscuro, setSistemaEscuro] = useState(() => window.matchMedia?.(CONSULTA_ESCURO).matches ?? false);
  const primeira = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia?.(CONSULTA_ESCURO);
    if (!mq) return;
    const mudou = () => setSistemaEscuro(mq.matches);
    mq.addEventListener("change", mudou);
    return () => mq.removeEventListener("change", mudou);
  }, []);

  const tema = temaDaTela(preferencia, pathname, sistemaEscuro);

  useEffect(() => {
    const raiz = document.documentElement;
    if (raiz.classList.contains("nt-escuro") === (tema === "escuro")) { primeira.current = false; return; }
    // Na troca, as cores mudam suave (menos no carregamento da página).
    if (!primeira.current) raiz.classList.add("nt-trocando-tema");
    raiz.classList.toggle("nt-escuro", tema === "escuro");
    raiz.style.colorScheme = tema === "escuro" ? "dark" : "light";
    primeira.current = false;
    const t = window.setTimeout(() => raiz.classList.remove("nt-trocando-tema"), 350);
    return () => window.clearTimeout(t);
  }, [tema]);

  const atualizar = useCallback((f: (p: PreferenciaTema) => PreferenciaTema) => {
    setPreferencia(p => {
      const nova = f(p);
      salvarPreferencia(armazenamento(), nova);
      return nova;
    });
  }, []);

  const valor = useMemo<TemaContexto>(() => ({
    preferencia,
    tema,
    temaDestaTela: preferencia.telas[chaveDaTela(pathname)] ?? null,
    definirGeral: geral => atualizar(p => comGeral(p, geral)),
    definirDaTela: (t, caminho) => atualizar(p => comTemaDaTela(p, caminho ?? pathname, t)),
  }), [preferencia, tema, pathname, atualizar]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}
