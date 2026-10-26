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

  /** Cria a conta (fica aguardando a aprovação do admin, sem nenhum acesso). */
  cadastrar(form: { nmNome: string; nmEmail: string; nrCelular: string; cdObra?: string; senha: string }): Promise<{ txMensagem: string }> {
    return apiFetch<{ txMensagem: string }>("/auth/cadastro", { method: "POST", body: JSON.stringify(form) });
  },

  /** Pede o link de nova senha por e-mail (a resposta é a mesma exista ou não o e-mail). */
  esqueciSenha(nmEmail: string): Promise<{ txMensagem: string }> {
    return apiFetch<{ txMensagem: string }>("/auth/esqueci-senha", { method: "POST", body: JSON.stringify({ nmEmail }) });
  },

  redefinirSenha(token: string, novaSenha: string): Promise<{ txMensagem: string }> {
    return apiFetch<{ txMensagem: string }>("/auth/redefinir-senha", { method: "POST", body: JSON.stringify({ token, novaSenha }) });
  },

  /** Depois do reset pelo admin: e-mail + senha provisória + senha nova; já devolve a sessão. */
  definirSenha(email: string, senhaProvisoria: string, novaSenha: string): Promise<Sessao> {
    return apiFetch<Sessao>("/auth/definir-senha", { method: "POST", body: JSON.stringify({ email, senhaProvisoria, novaSenha }) });
  },

  /** Troca o próprio e-mail (confirma com a senha atual); devolve um token novo. */
  alterarEmail(nmEmail: string, senhaAtual: string): Promise<Sessao> {
    return apiFetch<Sessao>("/auth/alterar-email", { method: "POST", body: JSON.stringify({ nmEmail, senhaAtual }) });
  },

  /** Troca a senha; o backend encerra as outras sessões e devolve um token novo para esta. */
  alterarSenha(senhaAtual: string, novaSenha: string): Promise<Sessao> {
    return apiFetch<Sessao>("/auth/alterar-senha", { method: "POST", body: JSON.stringify({ senhaAtual, novaSenha }) });
  },
};
