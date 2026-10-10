import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authService } from "@/react-app/services/AuthService";
import { EVENTO_SESSAO_ENCERRADA } from "@/react-app/services/apiClient";
import { AuthContext, type AuthContexto } from "@/react-app/hooks/useAuth";
import { gravarSessao, lerSessao, msAteRenovar, podeAcessar, sessaoValida, type Sessao } from "@/react-app/utils/sessao";

function armazenamento(): Storage | undefined {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
}

const EVENTOS_ATIVIDADE = ["pointerdown", "keydown", "scroll"] as const;

/**
 * Sessão do usuário (token em sessionStorage, por aba). Renova o token antes de expirar enquanto houver
 * atividade; sem atividade deixa expirar. Um 401 da API (token expirado ou revogado) encerra a sessão.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    const salva = lerSessao(armazenamento());
    return sessaoValida(salva, Date.now()) ? salva : null;
  });
  const [sessaoEncerrada, setSessaoEncerrada] = useState(false);
  const ultimaAtividade = useRef(Date.now());

  const aplicar = useCallback((nova: Sessao | null) => {
    gravarSessao(armazenamento(), nova);
    setSessao(nova);
  }, []);

  const sair = useCallback(() => {
    setSessaoEncerrada(false);
    aplicar(null);
  }, [aplicar]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const nova = await authService.login(email, senha);
    setSessaoEncerrada(false);
    ultimaAtividade.current = Date.now();
    aplicar(nova);
  }, [aplicar]);

  useEffect(() => {
    const encerrar = () => {
      setSessaoEncerrada(true);
      aplicar(null);
    };
    window.addEventListener(EVENTO_SESSAO_ENCERRADA, encerrar);
    return () => window.removeEventListener(EVENTO_SESSAO_ENCERRADA, encerrar);
  }, [aplicar]);

  useEffect(() => {
    const marcar = () => { ultimaAtividade.current = Date.now(); };
    EVENTOS_ATIVIDADE.forEach(e => window.addEventListener(e, marcar, { passive: true }));
    return () => EVENTOS_ATIVIDADE.forEach(e => window.removeEventListener(e, marcar));
  }, []);

  useEffect(() => {
    if (!sessao) return;
    const agora = Date.now();
    const expirar = setTimeout(() => {
      setSessaoEncerrada(true);
      aplicar(null);
    }, Math.max(0, Date.parse(sessao.expiraEm) - agora));
    const espera = msAteRenovar(sessao, agora);
    if (espera === null) return () => clearTimeout(expirar);

    const renovar = setTimeout(() => {
      if (ultimaAtividade.current <= agora) return;
      authService.refresh()
        .then(aplicar)
        .catch(() => { /* 401 já dispara o evento de sessão encerrada; outros erros: expira no horário */ });
    }, espera);
    return () => {
      clearTimeout(renovar);
      clearTimeout(expirar);
    };
  }, [sessao, aplicar]);

  const valor = useMemo<AuthContexto>(() => ({
    usuario: sessao?.usuario ?? null,
    autenticado: sessao !== null,
    sessaoEncerrada,
    entrar,
    sair,
    atualizarSessao: aplicar,
    pode: (modulo, acao = "LEITURA") => podeAcessar(sessao?.usuario.permissoes, modulo, acao),
  }), [sessao, sessaoEncerrada, entrar, sair, aplicar]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
