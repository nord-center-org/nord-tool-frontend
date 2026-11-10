import { apiFetch } from "./apiClient";

export interface Cubicagem {
  id: number; nmTitulo: string; nrPerda: number; nrVersao: number; dhCriacao: string; dhAlteracao: string;
  /** Só na lista. */
  qtPecas?: number;
  /** Só com a cubicagem aberta (lista do JSON salvo). */
  pecas?: unknown;
}

const BASE = "/cubicagens";
const json = (c: unknown) => JSON.stringify(c);

export const cubicagemService = {
  listar: async () => (await apiFetch<Cubicagem[]>(BASE)) ?? [],
  abrir: (id: number) => apiFetch<Cubicagem>(`${BASE}/${id}`),
  criar: (nmTitulo: string, nrPerda = 0, pecas: unknown[] = []) => apiFetch<Cubicagem>(BASE, { method: "POST", body: json({ nmTitulo, nrPerda, pecas }) }),
  salvar: (id: number, nmTitulo: string, nrPerda: number, pecas: unknown[], nrVersao: number) =>
    apiFetch<Cubicagem>(`${BASE}/${id}`, { method: "PUT", body: json({ nmTitulo, nrPerda, pecas, nrVersao }) }),
  excluir: async (id: number) => { await apiFetch(`${BASE}/${id}`, { method: "DELETE" }); },
};
