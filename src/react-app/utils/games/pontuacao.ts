import type { Dificuldade } from "./bombas.ts";

/** Peso dos bots na pontuação: ganhar do Difícil vale mais. */
export const PESO_DIFICULDADE: Record<Dificuldade, number> = { facil: 1, medio: 2, dificil: 3 };

/**
 * Pontos de uma partida de Bombas Táticas para o recorde da pessoa: 100 por rodada vencida, 300 por vencer a
 * partida, 25 por adversário, tudo multiplicado pelo peso da dificuldade dos bots (sem bots, peso 2).
 */
export function pontosBombas(p: { vitoriasRodada: number; venceu: boolean; jogadores: number; dificuldade: Dificuldade | null }): number {
  const base = p.vitoriasRodada * 100 + (p.venceu ? 300 : 0) + Math.max(0, p.jogadores - 1) * 25;
  return base * (p.dificuldade ? PESO_DIFICULDADE[p.dificuldade] : 2);
}
