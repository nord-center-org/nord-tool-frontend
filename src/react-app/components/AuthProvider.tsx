import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authService } from "@/react-app/services/AuthService";
import { notificacaoService } from "@/react-app/services/NotificacaoService";
import { EVENTO_SESSAO_ENCERRADA } from "@/react-app/services/apiClient";
import { AuthContext, type AuthContexto } from "@/react-app/hooks/useAuth";
import { gravarSessao, lerSessao, msAteRenovar, podeAcessar, sessaoValida, type Sessao } from "@/react-app/utils/sessao";
import { ponteAndroid } from "@/react-app/utils/appAndroid";
import { registrarNoApp, sessaoDoApp } from "@/react-app/services/sessaoApp";

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
 * No app Android a sessão não cai: sem atividade, no fim da sessão ou depois de um 401, o app abre uma sessão
 * nova com o token do aparelho; só volta ao login se o aparelho foi desconectado (senha trocada, saiu, 60 dias).
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
    // Sair de propósito desliga as notificações deste aparelho (a sessão que só expirou continua recebendo).
    void notificacaoService.esquecerEsteAparelho();
    try { ponteAndroid()?.sair(); } catch { /* app sem ponte */ }
    setSessaoEncerrada(false);
    aplicar(null);
  }, [aplicar]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const nova = await authService.login(email, senha);
    setSessaoEncerrada(false);
    ultimaAtividade.current = Date.now();
    aplicar(nova);
    registrarNoApp();
  }, [aplicar]);

  const definirSenha = useCallback(async (email: string, senhaProvisoria: string, novaSenha: string) => {
    const nova = await authService.definirSenha(email, senhaProvisoria, novaSenha);
    setSessaoEncerrada(false);
    ultimaAtividade.current = Date.now();
    aplicar(nova);
    registrarNoApp();
  }, [aplicar]);

  /** No app: tenta seguir pelo aparelho; sem ele, encerra como no navegador. */
  const continuarOuEncerrar = useCallback(async () => {
    const nova = await sessaoDoApp().catch(() => null);
    if (nova) { aplicar(nova); return; }
    setSessaoEncerrada(true);
    aplicar(null);
  }, [aplicar]);

  useEffect(() => {
    const encerrar = () => { void continuarOuEncerrar(); };
    window.addEventListener(EVENTO_SESSAO_ENCERRADA, encerrar);
    return () => window.removeEventListener(EVENTO_SESSAO_ENCERRADA, encerrar);
  }, [continuarOuEncerrar]);

  useEffect(() => {
    const marcar = () => { ultimaAtividade.current = Date.now(); };
    EVENTOS_ATIVIDADE.forEach(e => window.addEventListener(e, marcar, { passive: true }));
    return () => EVENTOS_ATIVIDADE.forEach(e => window.removeEventListener(e, marcar));
  }, []);

  useEffect(() => {
    if (!sessao) return;
    const agora = Date.now();
    const noApp = ponteAndroid() !== null;
    const expirar = setTimeout(() => { void continuarOuEncerrar(); }, Math.max(0, Date.parse(sessao.expiraEm) - agora));
    // No app renova sempre (mesmo parado), e pelo aparelho quando a sessão chega ao limite.
    const espera = msAteRenovar(sessao, agora) ?? (noApp ? Math.max(5_000, Date.parse(sessao.expiraEm) - agora - 120_000) : null);
    if (espera === null) return () => clearTimeout(expirar);

    const renovar = setTimeout(() => {
      if (noApp) {
        void sessaoDoApp().then(nova => nova ?? authService.refresh()).then(aplicar)
          .catch(() => { /* tenta de novo ao expirar */ });
        return;
      }
      if (ultimaAtividade.current <= agora) return;
      authService.refresh()
        .then(aplicar)
        .catch(() => { /* 401 já dispara o evento de sessão encerrada; outros erros: expira no horário */ });
    }, espera);
    return () => {
      clearTimeout(renovar);
      clearTimeout(expirar);
    };
  }, [sessao, aplicar, continuarOuEncerrar]);

  const valor = useMemo<AuthContexto>(() => ({
    usuario: sessao?.usuario ?? null,
    autenticado: sessao !== null,
    sessaoEncerrada,
    entrar,
    definirSenha,
    sair,
    atualizarSessao: aplicar,
    pode: (modulo, acao = "LEITURA") => podeAcessar(sessao?.usuario.permissoes, modulo, acao),
  }), [sessao, sessaoEncerrada, entrar, definirSenha, sair, aplicar]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
