/**
 * Modo Copa (Games): uma série de 3, 5 ou 7 partidas com as mesmas vagas. Cada partida dá pontos pela
 * colocação (a régua das copas de jogos de festa: 1º leva mais, todos pontuam um pouco); quem somar mais
 * no fim é o campeão. Desempate: mais 1º lugares, depois mais 2º lugares, depois a ordem das vagas.
 */

export const RODADAS_COPA = [3, 5, 7] as const;
export type RodadasCopa = (typeof RODADAS_COPA)[number];

/** Pontos pela colocação (1º … 8º). */
export const PONTOS_COLOCACAO = [10, 7, 5, 3, 2, 1, 1, 1];

export interface Copa {
  rodadas: RodadasCopa;
  nomes: string[];
  /** Colocação de cada vaga em cada partida já jogada: partidas[n][vaga] = 1..N. */
  partidas: number[][];
}

export const novaCopa = (rodadas: RodadasCopa, nomes: string[]): Copa => ({ rodadas, nomes, partidas: [] });

/**
 * Colocação de cada vaga numa partida a partir das vitórias de rodada: quem venceu a partida é o 1º; os demais
 * pela quantidade de vitórias (empate divide a colocação, como num placar de competição: 1, 2, 2, 4).
 */
export function colocacoes(vitorias: number[], vencedor: number | null): number[] {
  const chave = (i: number) => (i === vencedor ? Number.MAX_SAFE_INTEGER : vitorias[i]);
  return vitorias.map((_, i) => 1 + vitorias.filter((__, k) => chave(k) > chave(i)).length);
}

export const pontosDaColocacao = (colocacao: number) => PONTOS_COLOCACAO[Math.min(PONTOS_COLOCACAO.length, Math.max(1, colocacao)) - 1];

export function registrarPartida(copa: Copa, colocacoesDaPartida: number[]): Copa {
  if (copa.partidas.length >= copa.rodadas) return copa;
  return { ...copa, partidas: [...copa.partidas, colocacoesDaPartida] };
}

export const terminou = (copa: Copa) => copa.partidas.length >= copa.rodadas;

export interface LinhaClassificacao {
  vaga: number;
  nome: string;
  pontos: number;
  primeiros: number;
  segundos: number;
  /** Posição na tabela (1 = líder). */
  posicao: number;
}

export function classificacao(copa: Copa): LinhaClassificacao[] {
  const linhas = copa.nomes.map((nome, vaga) => {
    const minhas = copa.partidas.map(p => p[vaga]);
    return {
      vaga, nome,
      pontos: minhas.reduce((s, c) => s + pontosDaColocacao(c), 0),
      primeiros: minhas.filter(c => c === 1).length,
      segundos: minhas.filter(c => c === 2).length,
      posicao: 0,
    };
  });
  linhas.sort((a, b) => b.pontos - a.pontos || b.primeiros - a.primeiros || b.segundos - a.segundos || a.vaga - b.vaga);
  return linhas.map((l, i) => ({ ...l, posicao: i + 1 }));
}

/** O que vai para a conta ao fim da Copa (o backend guarda como JSON). */
export function resumoDaCopa(copa: Copa, jogo: string) {
  return { jogo, rodadas: copa.rodadas, partidas: copa.partidas, classificacao: classificacao(copa).map(({ vaga, nome, pontos, posicao }) => ({ vaga, nome, pontos, posicao })) };
}
