import { apiFetch } from "./apiClient";
import type { LinhaMapeamento, TipoMapeamento } from "../utils/mapeamentos";

export interface Mapeamento {
  id: number; cdTipo: TipoMapeamento; nmTitulo: string; nmLocal: string | null; dtMapeamento: string; pcTolerancia: number;
  txObservacao: string | null; cdStatus: "RASCUNHO" | "CONCLUIDO"; idFase: number | null; nmFase: string | null;
  idAutor: number; nmAutor: string | null; qtLinhas: number; nrVersao: number;
  /** Só no detalhe. */
  linhas?: Array<LinhaMapeamento & { id: number; nrOrdem: number }>;
}

export interface MapeamentoForm {
  cdTipo?: TipoMapeamento; nmTitulo: string; nmLocal: string | null; dtMapeamento: string; pcTolerancia?: number;
  txObservacao?: string | null; nrVersao?: number; linhas?: LinhaMapeamento[];
}

const BASE = "/mapeamentos";
const json = (c: unknown) => JSON.stringify(c);

export const mapeamentoService = {
  listar: async () => (await apiFetch<Mapeamento[]>(BASE)) ?? [],
  detalhar: (id: number) => apiFetch<Mapeamento>(`${BASE}/${id}`),
  /** idFase vai no cabeçalho X-Fase quando a pessoa participa de mais de uma fase. */
  criar: (f: MapeamentoForm, idFase?: number | null) =>
    apiFetch<Mapeamento>(BASE, { method: "POST", body: json(f), headers: idFase ? { "X-Fase": String(idFase) } : undefined }),
  alterar: (id: number, f: MapeamentoForm) => apiFetch<Mapeamento>(`${BASE}/${id}`, { method: "PUT", body: json(f) }),
  alterarStatus: (id: number, cdStatus: "RASCUNHO" | "CONCLUIDO", nrVersao: number) =>
    apiFetch<Mapeamento>(`${BASE}/${id}/status`, { method: "PUT", body: json({ cdStatus, nrVersao }) }),
  excluir: async (id: number, nrVersao: number) => { await apiFetch(`${BASE}/${id}?nrVersao=${nrVersao}`, { method: "DELETE" }); },
};
