import { apiFetch } from "./apiClient";
import type { Sessao, UsuarioSessao } from "../utils/sessao";

/** Endpoints de /auth no backend (login público; os demais exigem o token). */
export const authService = {
  login(email: string, senha: string): Promise<Sessao> {
    return apiFetch<Sessao>("/auth/login", { method: "POST", body: JSON.stringify({ email, senha }) });
  },

  refresh(): Promise<Sessao> {
    return apiFetch<Sessao>("/auth/refresh", { method: "POST" });
  },

  me(): Promise<UsuarioSessao> {
    return apiFetch<UsuarioSessao>("/auth/me");
  },

  /** Troca a senha; o backend encerra as outras sessões e devolve um token novo para esta. */
  alterarSenha(senhaAtual: string, novaSenha: string): Promise<Sessao> {
    return apiFetch<Sessao>("/auth/alterar-senha", { method: "POST", body: JSON.stringify({ senhaAtual, novaSenha }) });
  },
};
