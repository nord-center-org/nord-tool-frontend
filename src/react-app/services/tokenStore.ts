import type { LoginResponse, UsuarioLogado } from "@/shared/types";

// Sessão guardada em memória + sessionStorage (nunca em localStorage).
const CHAVE_SESSAO = "@NordTool:auth_sessao";

export interface Sessao {
  token: string;
  expiraEm: string;
  inatividadeMinutos: number;
  usuario: UsuarioLogado;
}

let sessaoMemoria: Sessao | null = null;
let aoExpirar: (() => void) | null = null;

function lerStorage(): Sessao | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as Sessao) : null;
  } catch {
    return null;
  }
}

export function lerSessao(): Sessao | null {
  if (!sessaoMemoria) sessaoMemoria = lerStorage();
  return sessaoMemoria;
}

export function getAuthToken(): string | null {
  return lerSessao()?.token ?? null;
}

export function salvarSessao(resposta: LoginResponse): Sessao {
  const sessao: Sessao = {
    token: resposta.token,
    expiraEm: resposta.expiraEm,
    inatividadeMinutos: resposta.inatividadeMinutos,
    usuario: resposta.usuario,
  };
  sessaoMemoria = sessao;
  try {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  } catch {
    // sem sessionStorage: segue só em memória
  }
  return sessao;
}

export function limparSessao(): void {
  sessaoMemoria = null;
  try {
    sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // ignora
  }
}

/** O AuthContext registra aqui o que fazer quando a API responde 401. */
export function definirAoExpirar(callback: (() => void) | null): void {
  aoExpirar = callback;
}

export function notificarSessaoExpirada(): void {
  aoExpirar?.();
}
