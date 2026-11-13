import { apiBlob, apiFetch } from "./apiClient";
import type { MusicaConta, ProjetoConta } from "../utils/musica/repertorioConta";

export interface UsoRepertorio { bytesUsados: number; bytesCota: number; musicas: number; musicasMax: number; bytesPorArquivo: number }

const BASE = "/repertorio";
const json = (corpo: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(corpo) });

/** Repertório v7: músicas e criações do estúdio guardadas na conta. */
export const repertorioService = {
  listarMusicas: async () => (await apiFetch<MusicaConta[]>(`${BASE}/musicas`)) ?? [],
  abrirMusica: (chave: string) => apiFetch<MusicaConta>(`${BASE}/musicas/${encodeURIComponent(chave)}`),
  salvarMusica: (chave: string, corpo: object) => apiFetch<MusicaConta>(`${BASE}/musicas/${encodeURIComponent(chave)}`, json(corpo)),
  enviarAudio: (chave: string, audio: Blob, nome: string) => {
    const corpo = new FormData();
    corpo.append("arquivo", audio, nome);
    return apiFetch<MusicaConta>(`${BASE}/musicas/${encodeURIComponent(chave)}/audio`, { method: "PUT", body: corpo });
  },
  baixarAudio: (chave: string) => apiBlob(`${BASE}/musicas/${encodeURIComponent(chave)}/audio`),
  excluirMusica: (chave: string) => apiFetch<void>(`${BASE}/musicas/${encodeURIComponent(chave)}`, { method: "DELETE" }),
  uso: () => apiFetch<UsoRepertorio>(`${BASE}/uso`),
  listarProjetos: async () => (await apiFetch<ProjetoConta[]>(`${BASE}/projetos`)) ?? [],
  abrirProjeto: (chave: string) => apiFetch<ProjetoConta>(`${BASE}/projetos/${encodeURIComponent(chave)}`),
  salvarProjeto: (chave: string, corpo: object) => apiFetch<ProjetoConta>(`${BASE}/projetos/${encodeURIComponent(chave)}`, json(corpo)),
  excluirProjeto: (chave: string) => apiFetch<void>(`${BASE}/projetos/${encodeURIComponent(chave)}`, { method: "DELETE" }),
};
