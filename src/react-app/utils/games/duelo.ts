/**
 * Duelo ao Meio-Dia: regras puras do duelo de saque rápido (60 passos por segundo).
 *
 * - Cada duelo espera um tempo sorteado e então mostra "FOGO!". Atirar antes queima a largada (fora deste duelo).
 * - Fintas: sinais falsos aparecem antes do sinal de verdade (quem atira na finta também queima).
 * - Vento: quando há vento, o tiro só acerta segurando a seta contra o vento; errar faz recarregar (perde tempo).
 * - Duelo: todos ao mesmo tempo; vence o tiro certeiro mais rápido. Torneio: chaveamento 1 × 1 até o campeão.
 * - Sozinho: treino de reflexo com 5 sinais; acertar todos com média abaixo de 450 ms cumpre o desafio.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const PASSOS_POR_SEGUNDO = 60;
const MS = 1000 / PASSOS_POR_SEGUNDO;
export const TIROS_TREINO = 5;
export const MEDIA_TREINO_MS = 450;
const RECARGA = 30;
const JANELA_SINAL = 150;
const PAUSA_RESULTADO = 70;

export type ModoDuelo = "duelo" | "torneio" | "treino";
export type Vento = "esquerda" | "direita" | null;
export type Finta = "passaro" | "foguete" | "sino";

export interface Atirador {
  id: number;
  bot: Dificuldade | null;
  /** Em jogo neste duelo (no torneio, só a dupla da vez). */
  noDuelo: boolean;
  /** Eliminado do torneio. */
  fora: boolean;
  queimou: boolean;
  recarregaAte: number;
  /** Passo em que acertou (null = ainda não). */
  acertouEm: number | null;
  errosNoDuelo: number;
  /** Reações certeiras (ms) para os pontos e o treino. */
  reacoes: number[];
  aAnterior: boolean;
  /** Bot: quando vai atirar e se cai na finta. */
  botAtiraEm: number | null;
  botCaiNaFinta: boolean;
  botCompensa: boolean;
}

export type EventoDuelo =
  | { tipo: "finta"; finta: Finta }
  | { tipo: "sinal" }
  | { tipo: "queimou"; atirador: number }
  | { tipo: "errou"; atirador: number }
  | { tipo: "acertou"; atirador: number; ms: number; decisivo: boolean }
  | { tipo: "duelo"; dupla: number[] }
  | { tipo: "fimDuelo"; vencedor: number | null }
  | { tipo: "fim"; vencedor: number | null };

export interface EstadoDuelo {
  modo: ModoDuelo;
  atiradores: Atirador[];
  passo: number;
  fase: "espera" | "sinal" | "resultado";
  /** Passo do sinal de verdade e das fintas deste duelo. */
  sinalEm: number;
  fintas: { em: number; finta: Finta }[];
  vento: Vento;
  inicioDuelo: number;
  fimFaseEm: number;
  vencedorDuelo: number | null;
  /** Torneio: fila de quem ainda disputa (ordem do chaveamento). */
  chave: number[];
  /** Treino: quantos sinais já foram. */
  tiros: number;
  terminado: boolean;
  vencedor: number | null;
  eventos: EventoDuelo[];
  sortear: () => number;
}

export interface ConfiguracaoDuelo { modo: ModoDuelo; jogadores: { bot: Dificuldade | null }[]; semente?: number }

/** Reação dos bots (ms): média e variação; chance de cair na finta e de errar o vento. */
const BOT: Record<Dificuldade, { media: number; varia: number; finta: number; vento: number }> = {
  facil: { media: 520, varia: 120, finta: 0.15, vento: 0.25 },
  medio: { media: 370, varia: 70, finta: 0.06, vento: 0.1 },
  dificil: { media: 265, varia: 45, finta: 0.01, vento: 0.02 },
};

export const direcaoContraOVento = (v: Vento): Direcao | null => (v === "esquerda" ? "direita" : v === "direita" ? "esquerda" : null);

export function novaPartidaDuelo(c: ConfiguracaoDuelo): EstadoDuelo {
  const n = Math.max(1, Math.min(8, c.jogadores.length));
  const modo: ModoDuelo = n === 1 ? "treino" : c.modo === "treino" ? "duelo" : c.modo;
  const e: EstadoDuelo = {
    modo, passo: 0, fase: "espera", sinalEm: 0, fintas: [], vento: null, inicioDuelo: 0, fimFaseEm: 0, vencedorDuelo: null,
    chave: [], tiros: 0, terminado: false, vencedor: null, eventos: [],
    sortear: rng((c.semente ?? Math.floor(Math.random() * 2 ** 31)) >>> 0),
    atiradores: Array.from({ length: n }, (_, i) => ({
      id: i, bot: c.jogadores[i]?.bot ?? null, noDuelo: true, fora: false, queimou: false, recarregaAte: 0, acertouEm: null, errosNoDuelo: 0,
      reacoes: [], aAnterior: false, botAtiraEm: null, botCaiNaFinta: false, botCompensa: true,
    })),
  };
  if (modo === "torneio") {
    // Chaveamento sorteado; a dupla da vez sai da frente da fila.
    e.chave = e.atiradores.map(a => a.id);
    for (let i = e.chave.length - 1; i > 0; i--) {
      const k = Math.floor(e.sortear() * (i + 1));
      [e.chave[i], e.chave[k]] = [e.chave[k], e.chave[i]];
    }
  }
  novoDuelo(e);
  return e;
}

function novoDuelo(e: EstadoDuelo) {
  e.fase = "espera";
  e.inicioDuelo = e.passo;
  e.vencedorDuelo = null;
  // Espera de 2 a 6 s, com 0 a 2 fintas antes do sinal.
  e.sinalEm = e.passo + Math.round((2 + e.sortear() * 4) * PASSOS_POR_SEGUNDO);
  const nFintas = Math.floor(e.sortear() * 3);
  const tipos: Finta[] = ["passaro", "foguete", "sino"];
  e.fintas = Array.from({ length: nFintas }, () => ({
    em: e.inicioDuelo + Math.round((0.8 + e.sortear() * ((e.sinalEm - e.inicioDuelo) / PASSOS_POR_SEGUNDO - 1.2)) * PASSOS_POR_SEGUNDO),
    finta: tipos[Math.floor(e.sortear() * tipos.length)],
  })).filter(f => f.em < e.sinalEm - 20).sort((a, b) => a.em - b.em);
  const r = e.sortear();
  e.vento = r < 0.35 ? null : r < 0.675 ? "esquerda" : "direita";
  let dupla: number[] = [];
  if (e.modo === "torneio") dupla = e.chave.slice(0, 2);
  for (const a of e.atiradores) {
    a.noDuelo = e.modo === "torneio" ? dupla.includes(a.id) : !a.fora;
    a.queimou = false;
    a.acertouEm = null;
    a.errosNoDuelo = 0;
    a.recarregaAte = 0;
    a.botAtiraEm = null;
    if (a.bot) {
      const b = BOT[a.bot];
      a.botCaiNaFinta = e.fintas.length > 0 && e.sortear() < b.finta;
      a.botCompensa = e.sortear() >= b.vento;
      // Reação com distribuição aproximadamente normal (soma de três sorteios).
      const z = (e.sortear() + e.sortear() + e.sortear() - 1.5) * 2;
      a.botAtiraEm = e.sinalEm + Math.max(9, Math.round((b.media + z * b.varia) / MS));
    }
  }
  if (e.modo === "torneio") e.eventos.push({ tipo: "duelo", dupla });
}

const PARADO: Entrada = { direcao: null, a: false, b: false };

function entradaDoBot(e: EstadoDuelo, a: Atirador): Entrada {
  if (!a.bot || a.botAtiraEm === null) return PARADO;
  const finta = e.fintas.find(f => e.passo >= f.em && e.passo < f.em + 4);
  if (finta && a.botCaiNaFinta && e.fase === "espera") return { direcao: null, a: !a.aAnterior, b: false };
  if (e.fase !== "sinal" || e.passo < a.botAtiraEm) return PARADO;
  const contra = direcaoContraOVento(e.vento);
  const direcao = contra ? (a.botCompensa ? contra : (contra === "esquerda" ? "direita" : "esquerda")) : null;
  // Errou o vento: recarrega e tenta de novo, agora compensando.
  if (a.errosNoDuelo > 0) a.botCompensa = true;
  return { direcao, a: !a.aAnterior && e.passo >= a.recarregaAte, b: false };
}

/** Um passo; {@code entradas[i]} = controle do atirador i (bots pensam sozinhos). */
export function passoDuelo(e: EstadoDuelo, entradas: Entrada[]): EstadoDuelo {
  if (e.terminado) return e;
  e.eventos = [];
  e.passo++;
  if (e.fase === "resultado") {
    if (e.passo >= e.fimFaseEm) proximoDuelo(e);
    return e;
  }
  for (const f of e.fintas) if (f.em === e.passo) e.eventos.push({ tipo: "finta", finta: f.finta });
  if (e.fase === "espera" && e.passo >= e.sinalEm) {
    e.fase = "sinal";
    e.eventos.push({ tipo: "sinal" });
  }
  for (const a of e.atiradores) {
    if (!a.noDuelo || a.queimou || a.acertouEm !== null) { a.aAnterior = false; continue; }
    const ent = a.bot ? entradaDoBot(e, a) : entradas[a.id] ?? PARADO;
    const atirou = ent.a && !a.aAnterior;
    a.aAnterior = ent.a;
    if (!atirou) continue;
    if (e.fase === "espera") {
      a.queimou = true;
      e.eventos.push({ tipo: "queimou", atirador: a.id });
      continue;
    }
    if (e.passo < a.recarregaAte) continue;
    const contra = direcaoContraOVento(e.vento);
    if (contra && ent.direcao !== contra) {
      a.recarregaAte = e.passo + RECARGA;
      a.errosNoDuelo++;
      e.eventos.push({ tipo: "errou", atirador: a.id });
      continue;
    }
    a.acertouEm = e.passo;
    const ms = Math.round((e.passo - e.sinalEm) * MS);
    a.reacoes.push(ms);
    const primeiro = e.vencedorDuelo === null;
    if (primeiro) e.vencedorDuelo = a.id;
    e.eventos.push({ tipo: "acertou", atirador: a.id, ms, decisivo: primeiro });
  }
  const emJogo = e.atiradores.filter(a => a.noDuelo && !a.queimou);
  const todosResolveram = emJogo.every(a => a.acertouEm !== null);
  // Duelo e torneio terminam no primeiro acerto (o tiro decisivo); o treino espera o próprio tiro.
  const decidido = e.vencedorDuelo !== null && e.modo !== "treino";
  const esgotou = e.fase === "sinal" && e.passo >= e.sinalEm + JANELA_SINAL;
  if (decidido || !emJogo.length || (e.fase === "sinal" && (todosResolveram || esgotou))) {
    // Sem ninguém em jogo (todos queimaram) acaba na hora; no torneio, o rival de quem queimou vence.
    if (e.vencedorDuelo === null && e.modo === "torneio") {
      const dupla = e.atiradores.filter(a => a.noDuelo);
      const limpos = dupla.filter(a => !a.queimou);
      if (limpos.length === 1) e.vencedorDuelo = limpos[0].id;
    }
    e.fase = "resultado";
    e.fimFaseEm = e.passo + PAUSA_RESULTADO;
    e.eventos.push({ tipo: "fimDuelo", vencedor: e.vencedorDuelo });
  }
  return e;
}

function proximoDuelo(e: EstadoDuelo) {
  if (e.modo === "duelo") return terminar(e, e.vencedorDuelo);
  if (e.modo === "treino") {
    e.tiros++;
    if (e.tiros >= TIROS_TREINO) {
      const a = e.atiradores[0];
      const media = a.reacoes.length ? a.reacoes.reduce((s, r) => s + r, 0) / a.reacoes.length : Infinity;
      return terminar(e, a.reacoes.length === TIROS_TREINO && media < MEDIA_TREINO_MS ? 0 : null);
    }
    return novoDuelo(e);
  }
  // Torneio: quem perdeu sai; sem vencedor (os dois erraram ou queimaram), o duelo se repete.
  if (e.vencedorDuelo === null) return novoDuelo(e);
  const [a, b] = e.chave.slice(0, 2);
  const perdedor = a === e.vencedorDuelo ? b : a;
  e.atiradores[perdedor].fora = true;
  e.chave = [...e.chave.slice(2), e.vencedorDuelo];
  if (e.chave.length === 1) return terminar(e, e.chave[0]);
  novoDuelo(e);
}

function terminar(e: EstadoDuelo, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.eventos.push({ tipo: "fim", vencedor });
}

/** Pontos: cada acerto vale 1000 − a reação em ms (mínimo 50). */
export const pontosDuelo = (a: Atirador) => a.reacoes.reduce((s, ms) => s + Math.max(50, 1000 - ms), 0);
export const mediaReacao = (a: Atirador) => (a.reacoes.length ? Math.round(a.reacoes.reduce((s, r) => s + r, 0) / a.reacoes.length) : null);
