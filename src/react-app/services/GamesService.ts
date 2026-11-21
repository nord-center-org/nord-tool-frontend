import { apiFetch } from "./apiClient";

export interface GameTotais { nrPartidas: number; nrVitorias: number; nrRecorde: number; nrJogos: number; nrVitoriasDificil: number; nrVitoriasOito: number }
export interface GameRanking { idUsuario: number; nmNome: string; dsAvatar: string | null; nrPartidas: number; nrVitorias: number; nrRecorde: number }
export interface GameConquista { cdConquista: string; nmConquista: string; txDescricao: string; dhCriacao: string | null }
export interface GamePartida {
  id: number; cdJogo: string; cdModo: string; nrPontos: number; inVitoria: boolean; nrColocacao: number; nrJogadores: number;
  nrBots: number; cdDificuldade: string | null; nrDuracaoS: number; idCopa: number | null; dhCriacao: string;
}
export interface GameResumo { meus: GameTotais; ranking: GameRanking[]; conquistas: GameConquista[]; historico: GamePartida[] }
export interface GameRegistro { nrRecorde: number; inNovoRecorde: boolean; novas: GameConquista[] }
export interface GameCopa { id: number; nrRodadas: number; nrColocacao: number; txResultado: string; dhCriacao: string }

export interface NovaPartida {
  cdJogo: string; cdModo: string; nrPontos: number; inVitoria: boolean; nrColocacao: number; nrJogadores: number;
  nrBots: number; cdDificuldade: string | null; nrDuracaoS: number; idCopa?: number | null;
}

export const gamesService = {
  registrarPartida: (p: NovaPartida) => apiFetch<GameRegistro>("/games/partidas", { method: "POST", body: JSON.stringify(p) }),
  resumo: (jogo: string) => apiFetch<GameResumo>(`/games/resumo?jogo=${encodeURIComponent(jogo)}`),
  conquistas: async () => (await apiFetch<GameConquista[]>("/games/conquistas")) ?? [],
  favoritos: async () => (await apiFetch<string[]>("/games/favoritos")) ?? [],
  salvarFavoritos: (jogos: string[]) => apiFetch<string[]>("/games/favoritos", { method: "PUT", body: JSON.stringify({ jogos }) }),
  registrarCopa: (nrRodadas: number, nrColocacao: number, resultado: unknown) =>
    apiFetch<GameCopa>("/games/copas", { method: "POST", body: JSON.stringify({ nrRodadas, nrColocacao, txResultado: JSON.stringify(resultado) }) }),
  copas: async () => (await apiFetch<GameCopa[]>("/games/copas")) ?? [],
};
