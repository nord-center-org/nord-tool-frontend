import { API_BASE } from "../config/api";
import { lerSessao } from "../utils/sessao";

interface ApiEnvelope {
  body?: unknown;
  txMensagem?: string;
  message?: string;
  error?: string;
  cdErro?: string;
  idCorrelacao?: string;
}

/** Erro de HTTP da API, com o status (ex.: 409 = conflito de versão) e o código estável do backend. */
export class ApiError extends Error {
  status: number;
  cdErro?: string;

  constructor(mensagem: string, status: number, cdErro?: string) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.cdErro = cdErro;
  }
}

/** Disparado quando o backend recusa o token (expirado ou revogado): o AuthProvider volta para o login. */
export const EVENTO_SESSAO_ENCERRADA = "nord:sessao-encerrada";

function armazenamento(): Storage | undefined {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
}

export function getAuthToken(): string | null {
  return lerSessao(armazenamento())?.token ?? null;
}

function montarUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function idRequisicao(): string | null {
  try {
    return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
  } catch {
    return null;
  }
}

function montarHeaders(init?: RequestInit, json = false): Headers {
  const headers = new Headers(init?.headers);
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (json && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const id = idRequisicao();
  if (id && !headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", id);
  }
  return headers;
}

async function lerErro(response: Response): Promise<ApiError> {
  let mensagem = `Erro HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ""}`;
  let cdErro: string | undefined;
  let correlacao: string | undefined = response.headers.get("X-Request-Id") ?? undefined;
  const texto = await response.text().catch(() => "");
  if (texto.trim()) {
    try {
      const json = JSON.parse(texto) as ApiEnvelope;
      const detalhe = json.txMensagem || json.message || json.error;
      if (typeof detalhe === "string" && detalhe) mensagem = detalhe;
      else if (typeof json.body === "string" && json.body) mensagem = json.body;
      cdErro = json.cdErro;
      correlacao = json.idCorrelacao ?? correlacao;
    } catch {
      mensagem = texto;
    }
  }
  // Em falha interna, o código liga a mensagem que a pessoa vê ao registro no log do servidor.
  if (response.status >= 500 && correlacao) mensagem = `${mensagem} (código ${correlacao.slice(0, 8)})`;
  return new ApiError(mensagem, response.status, cdErro);
}

function avisarSeSessaoEncerrou(response: Response, path: string, comToken: boolean): void {
  if (response.status === 401 && comToken && !path.includes("/auth/login") && typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO_SESSAO_ENCERRADA));
  }
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const temBody = init?.body !== undefined && init?.body !== null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = montarHeaders(init, temBody && !isFormData);

  const response = await fetch(montarUrl(path), { ...init, headers });
  if (!response.ok) {
    avisarSeSessaoEncerrou(response, path, headers.has("Authorization"));
    throw await lerErro(response);
  }

  const texto = await response.text();
  if (!texto.trim()) return null as T;

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error(`Resposta inválida do servidor (HTTP ${response.status})`);
  }
  if (json && typeof json === "object" && "body" in json) {
    return ((json as ApiEnvelope).body ?? null) as T;
  }
  return json as T;
}

export async function apiBlob(path: string, init?: RequestInit): Promise<Blob> {
  const headers = montarHeaders(init);
  const response = await fetch(montarUrl(path), { ...init, headers });
  if (!response.ok) {
    avisarSeSessaoEncerrou(response, path, headers.has("Authorization"));
    throw await lerErro(response);
  }
  return response.blob();
}
