import { API_BASE } from "../config/api";
import { getAuthToken, limparSessao, notificarSessaoExpirada } from "./tokenStore";

export { getAuthToken };

interface ApiEnvelope {
  body?: unknown;
  txMensagem?: string;
  message?: string;
  error?: string;
}

function montarUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
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
  return headers;
}

// 401 fora do login = sessão inválida/expirada: limpa a sessão e volta para /login.
function tratarNaoAutorizado(response: Response, path: string): void {
  if (response.status === 401 && !path.includes("/auth/login")) {
    limparSessao();
    notificarSessaoExpirada();
  }
}

async function lerErro(response: Response): Promise<Error> {
  let mensagem = `Erro HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ""}`;
  const texto = await response.text().catch(() => "");
  if (texto.trim()) {
    try {
      const json = JSON.parse(texto) as ApiEnvelope;
      const detalhe = json.txMensagem || json.message || json.error;
      if (typeof detalhe === "string" && detalhe) mensagem = detalhe;
      else if (typeof json.body === "string" && json.body) mensagem = json.body;
    } catch {
      mensagem = texto;
    }
  }
  return new Error(mensagem);
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const temBody = init?.body !== undefined && init?.body !== null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = montarHeaders(init, temBody && !isFormData);

  const response = await fetch(montarUrl(path), { ...init, headers });
  if (!response.ok) {
    tratarNaoAutorizado(response, path);
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
  const response = await fetch(montarUrl(path), { ...init, headers: montarHeaders(init) });
  if (!response.ok) {
    tratarNaoAutorizado(response, path);
    throw await lerErro(response);
  }
  return response.blob();
}
