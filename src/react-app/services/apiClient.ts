import { API_BASE } from "../config/api";

interface ApiEnvelope {
  body?: unknown;
  txMensagem?: string;
  message?: string;
  error?: string;
}

/** Erro de HTTP da API, com o status (ex.: 409 = conflito de versão). */
export class ApiError extends Error {
  status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getAuthToken(): string | null {
  // Stub: preenchido na etapa de login (E05)
  try {
    return sessionStorage.getItem("@NordTool:auth_token");
  } catch {
    return null;
  }
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

async function lerErro(response: Response): Promise<ApiError> {
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
  return new ApiError(mensagem, response.status);
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const temBody = init?.body !== undefined && init?.body !== null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = montarHeaders(init, temBody && !isFormData);

  const response = await fetch(montarUrl(path), { ...init, headers });
  if (!response.ok) throw await lerErro(response);

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
  if (!response.ok) throw await lerErro(response);
  return response.blob();
}
