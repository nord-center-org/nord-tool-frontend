import { apiFetch } from "./apiClient";

export interface Fase {
  id: number;
  idObra: number;
  nmFase: string;
  cdFase: string | null;
  nrOrdem: number;
  inAtivo: boolean;
  nrVersao: number;
  idsUsuarios: number[];
}

export interface Obra {
  id: number;
  nmObra: string;
  /** Código que o novo usuário digita no cadastro. */
  cdAcesso: string;
  inAtivo: boolean;
  nrVersao: number;
  fases: Fase[];
}

export interface ObraForm { nmObra: string; cdAcesso: string; inAtivo: boolean; nrVersao?: number }
export interface FaseForm { nmFase: string; cdFase: string; nrOrdem: number; inAtivo: boolean; nrVersao?: number }

const BASE = "/administracao";
const json = (c: unknown) => JSON.stringify(c);

export const obraService = {
  listar: async () => (await apiFetch<Obra[]>(`${BASE}/obras`)) ?? [],
  criarObra: (f: ObraForm) => apiFetch<Obra>(`${BASE}/obras`, { method: "POST", body: json(f) }),
  alterarObra: (id: number, f: ObraForm) => apiFetch<Obra>(`${BASE}/obras/${id}`, { method: "PUT", body: json(f) }),
  criarFase: (idObra: number, f: FaseForm) => apiFetch<Fase>(`${BASE}/obras/${idObra}/fases`, { method: "POST", body: json(f) }),
  alterarFase: (id: number, f: FaseForm) => apiFetch<Fase>(`${BASE}/fases/${id}`, { method: "PUT", body: json(f) }),
  definirUsuarios: (idFase: number, idsUsuarios: number[]) =>
    apiFetch<Fase>(`${BASE}/fases/${idFase}/usuarios`, { method: "PUT", body: json({ idsUsuarios }) }),
};
