import { apiBlob, apiFetch } from "./apiClient";
import type { StatusChamado } from "../utils/sac";

export interface Chamado {
  id: number;
  idUsuario: number;
  nmUsuario: string;
  nmTitulo: string;
  txDescricao: string;
  txTela: string | null;
  cdStatus: StatusChamado;
  txResposta: string | null;
  nmUsuarioResposta: string | null;
  dhCriacao: string;
  dhAtualizacao: string;
  imagens: number[];
  /** Resposta ou status novo que quem abriu ainda não viu. */
  inNovidade?: boolean;
  /** Quem respondeu (e o avatar dele, nas novidades). */
  idUsuarioResposta?: number | null;
  nmCargoResposta?: string | null;
  dsConfigResposta?: string | null;
}

export interface NovidadesSac {
  chamados: Chamado[];
  /** Só para o ADMIN do SAC: chamados de todo mundo ainda abertos. */
  abertos: number | null;
}

const BASE = "/sac";

export const sacService = {
  /** Meus chamados; com `todos`, os de todo mundo (ADMIN do SAC). */
  listar: async (todos = false) => (await apiFetch<Chamado[]>(`${BASE}/chamados${todos ? "?todos=true" : ""}`)) ?? [],
  abrir: (dados: { nmTitulo: string; txDescricao: string; txTela: string | null }, imagens: { blob: Blob; nome: string }[]) => {
    const corpo = new FormData();
    corpo.append("nmTitulo", dados.nmTitulo);
    corpo.append("txDescricao", dados.txDescricao);
    if (dados.txTela) corpo.append("txTela", dados.txTela);
    for (const i of imagens) corpo.append("imagens", i.blob, i.nome);
    return apiFetch<Chamado>(`${BASE}/chamados`, { method: "POST", body: corpo });
  },
  responder: (id: number, cdStatus: StatusChamado, txResposta: string | null) =>
    apiFetch<Chamado>(`${BASE}/chamados/${id}/resposta`, { method: "PUT", body: JSON.stringify({ cdStatus, txResposta }) }),
  excluir: (id: number) => apiFetch<void>(`${BASE}/chamados/${id}`, { method: "DELETE" }),
  imagem: (id: number) => apiBlob(`${BASE}/imagens/${id}`),
  novidades: async () => (await apiFetch<NovidadesSac>(`${BASE}/novidades`)) ?? { chamados: [], abertos: null },
  marcarVistos: (ids: number[]) => apiFetch<void>(`${BASE}/chamados/vistos`, { method: "PUT", body: JSON.stringify({ ids }) }),
};
