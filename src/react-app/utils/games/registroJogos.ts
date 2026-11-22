/**
 * Jogos já jogáveis e o que a preparação precisa saber de cada um: modos (com o nome do modo quando se joga
 * sozinho), cenários, rótulos dos botões A/B no controle e o padrão da preparação. A Central, o Modo Tela e o
 * controle do celular leem daqui; um jogo novo entra com uma linha a mais.
 */
import type { Dificuldade } from "./bombas.ts";
import type { RodadasCopa } from "./copa.ts";

export interface ModoJogo {
  valor: string;
  rotulo: string;
  /** Nome do modo quando se joga sozinho (sem bots); sem ele, o modo some da lista para 1 jogador. */
  rotuloSolo?: string;
  /** Explicação curta do desafio sozinho. */
  regraSolo?: string;
  /** Precisa de número par (times). */
  par?: boolean;
}

export interface DefJogo {
  id: string;
  modos: ModoJogo[];
  cenarios: { valor: string; rotulo: string }[];
  rotuloCenario: string;
  botoes: { a: string; b: string };
}

export const JOGAVEIS: Record<string, DefJogo> = {
  bombas: {
    id: "bombas",
    modos: [
      { valor: "sobrevivencia", rotulo: "Sobrevivência", rotuloSolo: "Desafio (limpe as caixas)", regraSolo: "exploda todas as caixas antes do tempo, sem cair." },
      { valor: "times", rotulo: "Times", par: true },
      { valor: "moedas", rotulo: "Caça às Moedas", rotuloSolo: "Meta de moedas", regraSolo: "junte 10 moedas em 2 minutos." },
    ],
    cenarios: [{ valor: "fabrica", rotulo: "Fábrica" }, { valor: "gelo", rotulo: "Gelo" }, { valor: "vulcao", rotulo: "Vulcão" }],
    rotuloCenario: "Bioma",
    botoes: { a: "Bomba", b: "Ação" },
  },
  hexagonos: {
    id: "hexagonos",
    modos: [
      { valor: "queda", rotulo: "Queda", rotuloSolo: "Desafio (sobreviva 60 s)", regraSolo: "fique 60 segundos sem cair; o piso pisado cai." },
      { valor: "sumo", rotulo: "Sumô" },
    ],
    cenarios: [{ valor: "neon", rotulo: "Neon" }, { valor: "lava", rotulo: "Vulcão" }, { valor: "gelo", rotulo: "Gelo" }],
    rotuloCenario: "Cenário",
    botoes: { a: "Dash", b: "Pular" },
  },
  encaixe: {
    id: "encaixe",
    modos: [
      { valor: "versus", rotulo: "Versus" },
      { valor: "sprint", rotulo: "Sprint (40 linhas)", rotuloSolo: "Sprint (40 linhas)", regraSolo: "limpe 40 linhas antes de o topo encher." },
      { valor: "maratona", rotulo: "Maratona", rotuloSolo: "Maratona (50 linhas)", regraSolo: "chegue a 50 linhas; a velocidade sobe a cada 10." },
    ],
    cenarios: [{ valor: "noite", rotulo: "Noite neon" }, { valor: "arcade", rotulo: "Arcade" }, { valor: "oceano", rotulo: "Oceano" }],
    rotuloCenario: "Tema",
    botoes: { a: "Girar", b: "Guardar" },
  },
  duelo: {
    id: "duelo",
    modos: [
      { valor: "duelo", rotulo: "Duelo (todos juntos)", rotuloSolo: "Treino de reflexo", regraSolo: "5 sinais; acerte todos com média abaixo de 450 ms." },
      { valor: "torneio", rotulo: "Torneio (1 × 1)" },
    ],
    cenarios: [{ valor: "meiodia", rotulo: "Meio-dia" }, { valor: "poente", rotulo: "Pôr do sol" }, { valor: "lua", rotulo: "Lua cheia" }],
    rotuloCenario: "Cenário",
    botoes: { a: "Atirar", b: "—" },
  },
};

export const ehJogavel = (id: string) => id in JOGAVEIS;

/** Partida única ou Copa de 3, 5 ou 7 partidas. */
export type Formato = "unica" | RodadasCopa;

/** Preparação de uma partida; {@code bots} de 0 a 7 (sozinho, sem bots, também vale). */
export interface ConfigJogo { modo: string; cenario: string; bots: number; dificuldade: Dificuldade; vitorias: number; formato: Formato }

export function configPadrao(id: string): ConfigJogo {
  const d = JOGAVEIS[id] ?? JOGAVEIS.bombas;
  return { modo: d.modos[0].valor, cenario: d.cenarios[0].valor, bots: 3, dificuldade: "medio", vitorias: 2, formato: "unica" };
}

/** O modo que vale de verdade para a quantidade de jogadores (sozinho e times ímpar caem no primeiro modo). */
export function modoEfetivo(id: string, modo: string, total: number): string {
  const d = JOGAVEIS[id];
  if (!d) return modo;
  const m = d.modos.find(x => x.valor === modo) ?? d.modos[0];
  if (total === 1 && !m.rotuloSolo) return d.modos.find(x => x.rotuloSolo)?.valor ?? d.modos[0].valor;
  if (m.par && total % 2 === 1) return d.modos[0].valor;
  return m.valor;
}

export function rotuloDoModo(id: string, modo: string, total: number): string {
  const m = JOGAVEIS[id]?.modos.find(x => x.valor === modo);
  if (!m) return modo;
  return total === 1 && m.rotuloSolo ? m.rotuloSolo.replace(/ \(.*\)$/, "") : m.rotulo;
}
