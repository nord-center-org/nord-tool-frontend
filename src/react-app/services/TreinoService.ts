import { apiFetch } from "./apiClient";

export interface TreinoExercicio {
  id?: number; nrOrdem?: number; nmExercicio: string; nrSeries: number; txRepeticoes: string | null; vlCarga: number | null;
  nrDescansoSeg: number | null; txObservacao: string | null;
}
export interface Treino {
  id: number; nmTreino: string; txObservacao: string | null; txDias: string | null; nrOrdem: number; inAtivo: boolean; nrVersao: number;
  dtUltimaSessao: string | null; qtSessoes: number; exercicios: TreinoExercicio[];
}
export interface TreinoForm {
  nmTreino: string; txObservacao: string | null; txDias: string | null; inAtivo: boolean; nrVersao?: number; exercicios: TreinoExercicio[];
}
export interface SessaoExercicio { idExercicio: number | null; nmExercicio: string; txRepeticoes: string | null; vlCarga: number | null; inFeito: boolean }
export interface TreinoSessao {
  id: number; idTreino: number | null; nmTreino: string; dtSessao: string; nrDuracaoMin: number | null; txObservacao: string | null;
  exercicios: SessaoExercicio[];
}
export interface SessaoForm {
  idTreino: number; dtSessao: string; nrDuracaoMin: number | null; txObservacao: string | null; atualizarCargas: boolean;
  exercicios: SessaoExercicio[];
}

const BASE = "/treinos";
const json = (c: unknown) => JSON.stringify(c);

export const treinoService = {
  listar: async () => (await apiFetch<Treino[]>(BASE)) ?? [],
  criar: (f: TreinoForm) => apiFetch<Treino>(BASE, { method: "POST", body: json(f) }),
  alterar: (id: number, f: TreinoForm) => apiFetch<Treino>(`${BASE}/${id}`, { method: "PUT", body: json(f) }),
  excluir: async (id: number, nrVersao: number) => { await apiFetch(`${BASE}/${id}?nrVersao=${nrVersao}`, { method: "DELETE" }); },
  sessoes: async (limite = 30) => (await apiFetch<TreinoSessao[]>(`${BASE}/sessoes?limite=${limite}`)) ?? [],
  registrar: (f: SessaoForm) => apiFetch<TreinoSessao>(`${BASE}/sessoes`, { method: "POST", body: json(f) }),
  excluirSessao: async (id: number) => { await apiFetch(`${BASE}/sessoes/${id}`, { method: "DELETE" }); },
};
