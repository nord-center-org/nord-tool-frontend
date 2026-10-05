import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import type { PermissaoModulo, UsuarioLogado } from "@/shared/types";
import { authService } from "@/react-app/services/AuthService";
import { definirAoExpirar, lerSessao, limparSessao } from "@/react-app/services/tokenStore";

const INTERVALO_REFRESH_MS = 2 * 60 * 1000;
const INTERVALO_CHECAGEM_MS = 30 * 1000;
const EVENTOS_ATIVIDADE = ["click", "keydown", "touchstart"] as const;

export type MotivoSaida = "inatividade" | "sessao";

interface AuthContextValue {
  usuario: UsuarioLogado | null;
  permissoes: PermissaoModulo[];
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(() => lerSessao()?.usuario ?? null);
  const [carregando, setCarregando] = useState<boolean>(() => lerSessao() !== null);

  const localizacaoRef = useRef(location);
  localizacaoRef.current = location;
  const ultimaAtividade = useRef(Date.now());
  const ultimoRefresh = useRef(Date.now());

  const encerrar = useCallback((motivo?: MotivoSaida) => {
    limparSessao();
    setUsuario(null);
    const atual = localizacaoRef.current;
    if (atual.pathname !== "/login") {
      navigate("/login", { replace: true, state: { from: atual, motivo } });
    }
  }, [navigate]);

  // 401 em qualquer chamada da API volta para o login.
  useEffect(() => {
    definirAoExpirar(() => encerrar("sessao"));
    return () => definirAoExpirar(null);
  }, [encerrar]);

  // Confere a sessão guardada ao abrir o app.
  useEffect(() => {
    if (!lerSessao()) return;
    let ativo = true;
    authService.me()
      .then(dados => { if (ativo) setUsuario(dados); })
      .catch(() => { /* 401 já encerra a sessão via apiClient */ })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  // Renovação por atividade + logout por inatividade.
  useEffect(() => {
    if (!usuario) return;
    ultimaAtividade.current = Date.now();
    ultimoRefresh.current = Date.now();

    const aoInteragir = () => {
      const agora = Date.now();
      ultimaAtividade.current = agora;
      if (agora - ultimoRefresh.current >= INTERVALO_REFRESH_MS) {
        ultimoRefresh.current = agora;
        authService.refresh().catch(() => { /* 401 é tratado pelo apiClient */ });
      }
    };
    EVENTOS_ATIVIDADE.forEach(ev => window.addEventListener(ev, aoInteragir, { passive: true }));

    const timer = window.setInterval(() => {
      const limite = (lerSessao()?.inatividadeMinutos ?? 30) * 60 * 1000;
      if (Date.now() - ultimaAtividade.current > limite) encerrar("inatividade");
    }, INTERVALO_CHECAGEM_MS);

    return () => {
      EVENTOS_ATIVIDADE.forEach(ev => window.removeEventListener(ev, aoInteragir));
      window.clearInterval(timer);
    };
  }, [usuario, encerrar]);

  const login = useCallback(async (email: string, senha: string) => {
    const sessao = await authService.login(email, senha);
    setUsuario(sessao.usuario);
    setCarregando(false);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUsuario(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const valor = useMemo<AuthContextValue>(() => ({
    usuario,
    permissoes: usuario?.permissoes ?? [],
    carregando,
    login,
    logout,
  }), [usuario, carregando, login, logout]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
