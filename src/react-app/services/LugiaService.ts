import { LUGIA_BASE } from "../config/api";
import { apiFetch, ApiError, getAuthToken } from "./apiClient";
import { criarLeitorSse, urlLugia, type MensagemTela, type ModeloIa } from "../utils/lugia";

export interface ConversaResumo {
  id: number;
  titulo: string;
  atualizadaEm: string;
}

export interface AnexoEnvio {
  nome: string;
  mime: string;
  base64: string;
}

export interface CallbacksChat {
  onConversa?: (id: number) => void;
  onTexto: (delta: string) => void;
  onFim?: (motivo: string) => void;
  onErro: (mensagem: string) => void;
}

const url = (caminho: string) => urlLugia(LUGIA_BASE, caminho, typeof window === "undefined" ? "" : window.location.origin);

/** A Lugia só aparece quando há URL configurada no build (ou o proxy do Vite em dev). */
export const lugiaDisponivel = () => LUGIA_BASE !== "";

/** Lê um arquivo como base64 puro (sem o prefixo data:). */
export function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).replace(/^data:[^;]+;base64,/, ""));
    leitor.onerror = () => reject(leitor.error ?? new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

export const lugiaService = {
  modelos: () => apiFetch<{ modelos: ModeloIa[]; nivel: string }>(url("/modelos")),
  conversas: async () => (await apiFetch<{ conversas: ConversaResumo[] }>(url("/conversas"))).conversas,
  mensagens: async (id: number) => (await apiFetch<{ mensagens: MensagemTela[] }>(url(`/conversas/${id}`))).mensagens,
  renomear: (id: number, titulo: string) =>
    apiFetch<void>(url(`/conversas/${id}`), { method: "PATCH", body: JSON.stringify({ titulo }) }),
  excluir: (id: number) => apiFetch<void>(url(`/conversas/${id}`), { method: "DELETE" }),

  /** Envia a mensagem e lê a resposta em tempo real (SSE sobre POST, por isso fetch e não EventSource). */
  async conversar(
    pedido: { idConversa?: number; modelo: string; texto: string; anexos: AnexoEnvio[] },
    callbacks: CallbacksChat,
    sinal?: AbortSignal,
  ): Promise<void> {
    const token = getAuthToken();
    const resposta = await fetch(url("/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(pedido),
      signal: sinal,
    });
    if (!resposta.ok || !resposta.body) {
      const corpo = (await resposta.json().catch(() => null)) as { txMensagem?: string } | null;
      throw new ApiError(corpo?.txMensagem ?? `Erro HTTP ${resposta.status}`, resposta.status);
    }
    const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
    const lerSse = criarLeitorSse();
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      for (const { evento, dados } of lerSse(value)) {
        const json = JSON.parse(dados) as Record<string, unknown>;
        if (evento === "conversa") callbacks.onConversa?.(Number(json.id));
        else if (evento === "texto") callbacks.onTexto(String(json.delta ?? ""));
        else if (evento === "fim") callbacks.onFim?.(String(json.motivo ?? ""));
        else if (evento === "erro") callbacks.onErro(String(json.mensagem ?? "Falha ao responder."));
      }
    }
  },
};
