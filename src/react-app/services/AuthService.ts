import type { LoginResponse, UsuarioLogado } from "@/shared/types";
import { apiFetch } from "./apiClient";
import { limparSessao, salvarSessao, type Sessao } from "./tokenStore";

export const authService = {
  async login(email: string, senha: string): Promise<Sessao> {
    const resposta = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), senha }),
    });
    return salvarSessao(resposta);
  },

  async refresh(): Promise<Sessao> {
    const resposta = await apiFetch<LoginResponse>("/auth/refresh", { method: "POST" });
    return salvarSessao(resposta);
  },

  me(): Promise<UsuarioLogado> {
    return apiFetch<UsuarioLogado>("/auth/me");
  },

  async alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    await apiFetch("/auth/alterar-senha", {
      method: "POST",
      body: JSON.stringify({ senhaAtual, novaSenha }),
    });
  },

  logout(): void {
    limparSessao();
  },
};
