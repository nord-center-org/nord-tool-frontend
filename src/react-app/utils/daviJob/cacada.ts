/** Regras do minigame "Caça ao rato" (puras, testáveis). */

export const TEMPO_INICIAL = 30;
export const BONUS_POR_RATO = 3;
export const TEMPO_MAXIMO = 45;

/** Quanto mais ratos pegos, mais rápido e mais longe o rato pula. */
export function forcaDoRato(pegos: number) {
  return {
    velocidade: Math.min(165, 82 + pegos * 8),
    pulo: Math.min(335, 296 + pegos * 3),
    alcance: Math.min(110, 74 + pegos * 3),
  };
}

export const tempoDepoisDePegar = (restante: number) => Math.min(TEMPO_MAXIMO, restante + BONUS_POR_RATO);

/** Onde o próximo rato nasce: o ponto mais longe do gato (com um pouco de sorte para variar). */
export function pontoDeNascer<T extends { x: number; y: number }>(pontos: T[], gato: { x: number; y: number }, sorteio: () => number): T {
  const ordenados = [...pontos].sort((a, b) => Math.hypot(b.x - gato.x, b.y - gato.y) - Math.hypot(a.x - gato.x, a.y - gato.y));
  return ordenados[Math.floor(sorteio() * Math.min(3, ordenados.length))];
}

export function mensagemFinal(pontos: number, recordeAnterior: number | null): string {
  if (recordeAnterior === null || pontos > recordeAnterior) return pontos > 0 ? "NOVO RECORDE!" : "Primeira partida!";
  if (pontos === 0) return "O rato escapou...";
  if (pontos >= 15) return "Caçador lendário!";
  if (pontos >= 8) return "Mandou bem!";
  return "Boa! Tente de novo!";
}
