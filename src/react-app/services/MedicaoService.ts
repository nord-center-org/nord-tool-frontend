import type { Medicao, MedicaoLista } from "@/shared/types";
import { apiFetch } from "./apiClient";

const BASE = "/medicoes";

export interface MedicaoForm {
  nrMedicao: number;
  cdContrato: string;
  nmRazaoSocial: string;
  nrContrato: string;
  /** yyyy-MM-dd */
  dtMedicao: string;
  vlMedicao: number;
  txMemorial?: string;
  /** Vazio na criação = Pendente. */
  cdStatus?: string;
  /** Obrigatório na edição. */
  nrVersao?: number;
}

const json = (corpo: unknown): RequestInit["body"] => JSON.stringify(corpo);

export const medicaoService = {
  listar: async (): Promise<MedicaoLista> => {
    const lista = await apiFetch<MedicaoLista>(BASE);
    return { medicoes: lista?.medicoes ?? [], status: lista?.status ?? [] };
  },
  criar: (form: MedicaoForm) => apiFetch<Medicao>(BASE, { method: "POST", body: json(form) }),
  alterar: (id: number, form: MedicaoForm) => apiFetch<Medicao>(`${BASE}/${id}`, { method: "PUT", body: json(form) }),
  alterarStatus: (id: number, cdStatus: string, nrVersao: number) =>
    apiFetch<Medicao>(`${BASE}/${id}/status`, { method: "PUT", body: json({ cdStatus, nrVersao }) }),
  excluir: async (id: number, nrVersao: number) => {
    await apiFetch(`${BASE}/${id}?nrVersao=${nrVersao}`, { method: "DELETE" });
  },
};
