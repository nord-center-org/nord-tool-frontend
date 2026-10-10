import { createContext, useContext } from "react";
import type { Acao, Modulo, Sessao, UsuarioSessao } from "../utils/sessao";

export interface AuthContexto {
  usuario: UsuarioSessao | null;
  autenticado: boolean;
  /** true quando a sessão terminou sozinha (expirou ou foi revogada), para avisar na tela de login. */
  sessaoEncerrada: boolean;
  entrar(email: string, senha: string): Promise<void>;
  sair(): void;
  /** Substitui a sessão (ex.: após trocar a senha, o backend devolve um token novo). */
  atualizarSessao(sessao: Sessao): void;
  pode(modulo: Modulo, acao?: Acao): boolean;
}

export const AuthContext = createContext<AuthContexto | null>(null);

export function useAuth(): AuthContexto {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return contexto;
}
