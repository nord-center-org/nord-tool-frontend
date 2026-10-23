import { apiFetch } from "./apiClient";

export interface LinhaRanking { nrPosicao: number; idUsuario: number; nmNome: string; nrPontos: number; dhCriacao: string; flProprio: boolean }
export interface Placar { ranking: LinhaRanking[]; meuRecorde: LinhaRanking | null }

export const daviJobService = {
  placar: () => apiFetch<Placar>("/davi-job/placar"),
  registrar: (nrPontos: number) => apiFetch<Placar>("/davi-job/pontuacoes", { method: "POST", body: JSON.stringify({ nrPontos }) }),
};
