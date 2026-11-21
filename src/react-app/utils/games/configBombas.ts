import type { Bioma, Dificuldade, Modo } from "./bombas.ts";
import type { RodadasCopa } from "./copa.ts";

/** Partida única ou Copa de 3, 5 ou 7 partidas. */
export type Formato = "unica" | RodadasCopa;

/** Preparação do Bombas Táticas; {@code bots} de 0 a 7 (sozinho, sem bots, também vale). */
export interface ConfigBombas { modo: Modo; bioma: Bioma; bots: number; dificuldade: Dificuldade; vitorias: number; formato: Formato }

export const CONFIG_PADRAO: ConfigBombas = { modo: "sobrevivencia", bioma: "fabrica", bots: 3, dificuldade: "medio", vitorias: 2, formato: "unica" };
