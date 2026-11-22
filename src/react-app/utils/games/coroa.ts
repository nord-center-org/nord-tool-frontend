/**
 * Coroa Maldita: regras puras do pique-pega de plataforma em arena (vista de lado, 60 passos por segundo), 1 a 8.
 *
 * - Pulo (A) com pulo duplo no ar, investida (B) para o lado e pisão: cair na cabeça de alguém atordoa por meio
 *   segundo.
 * - Coroa: quem encosta em quem está com a coroa rouba (quem acabou de pegar fica protegido 1 s). Com a coroa se anda
 *   um pouco mais devagar. Vence quem somar mais tempo com ela em 90 s.
 * - Pega-Pega (batata quente): quem está com a bomba passa encostando; a cada 20 s ela explode e quem estiver com
 *   ela sai. O último que sobra vence.
 * - Sozinho: pegar 20 moedas em 60 s.
 */
import { rng, type Dificuldade, type Entrada } from "./bombas.ts";

export const LARG = 24;
export const ALT = 14;
const G = 0.018;
const PULO = -0.36;
const VMAX = 0.12;
const DURACAO = 90 * 60;
const BOMBA = 20 * 60;
export const META_MOEDAS = 20;
const TEMPO_SOLO = 60 * 60;

export type ModoCoroa = "coroa" | "pegapega" | "moedas";
export type Arena = "castelo" | "floresta" | "nuvens";
export interface Plataforma { x: number; y: number; w: number }

/** Plataformas de cada arena (o chão é a última). */
export const ARENAS: Record<Arena, Plataforma[]> = {
  castelo: [{ x: 2, y: 10.5, w: 5 }, { x: 17, y: 10.5, w: 5 }, { x: 9, y: 8, w: 6 }, { x: 1, y: 5.5, w: 4 }, { x: 19, y: 5.5, w: 4 }, { x: 9.5, y: 3.5, w: 5 }, { x: 0, y: ALT - 0.5, w: LARG }],
  floresta: [{ x: 4, y: 10, w: 4 }, { x: 16, y: 10, w: 4 }, { x: 10, y: 7.5, w: 4 }, { x: 2, y: 6, w: 3 }, { x: 19, y: 6, w: 3 }, { x: 7, y: 4, w: 3 }, { x: 14, y: 4, w: 3 }, { x: 0, y: ALT - 0.5, w: LARG }],
  nuvens: [{ x: 1, y: 11, w: 3 }, { x: 6, y: 9, w: 3 }, { x: 11, y: 10.5, w: 2 }, { x: 15, y: 9, w: 3 }, { x: 20, y: 11, w: 3 }, { x: 4, y: 5.5, w: 4 }, { x: 16, y: 5.5, w: 4 }, { x: 10, y: 3, w: 4 }, { x: 0, y: ALT - 0.5, w: LARG }],
};

export interface JogadorC {
  id: number; bot: Dificuldade | null;
  x: number; y: number; vx: number; vy: number;
  noChao: boolean; pulosAr: number; olhar: 1 | -1;
  investida: number; investidaAte: number; atordoadoAte: number;
  tempoCoroa: number; fora: boolean; moedas: number;
  aAnterior: boolean; bAnterior: boolean;
  /** Bot: quando decide de novo e o que quer fazer. */
  botProx: number; botDir: -1 | 0 | 1; botPula: boolean;
}

export type EventoCoroa =
  | { tipo: "pulo"; jogador: number }
  | { tipo: "investida"; jogador: number }
  | { tipo: "pisao"; jogador: number; em: number }
  | { tipo: "roubou"; jogador: number; de: number | null }
  | { tipo: "explodiu"; jogador: number }
  | { tipo: "moeda"; jogador: number; x: number; y: number }
  | { tipo: "fim"; vencedor: number | null };

export interface EstadoCoroa {
  modo: ModoCoroa;
  arena: Arena;
  jogadores: JogadorC[];
  dono: number | null;
  protegidoAte: number;
  coroa: { x: number; y: number };
  bombaAte: number;
  moedas: { x: number; y: number }[];
  passo: number;
  duracao: number;
  sorteio: () => number;
  eventos: EventoCoroa[];
  terminado: boolean;
  vencedor: number | null;
}

export function novaPartidaCoroa(o: { modo: ModoCoroa; arena: Arena; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoCoroa {
  const sorteio = rng(o.semente);
  const n = o.jogadores.length;
  const modo: ModoCoroa = n === 1 ? "moedas" : o.modo === "moedas" ? "coroa" : o.modo;
  const jogadores: JogadorC[] = o.jogadores.map((j, i) => ({
    id: i, bot: j.bot, x: 1.5 + (i * (LARG - 3)) / Math.max(1, n - 1), y: ALT - 0.5, vx: 0, vy: 0, noChao: true, pulosAr: 1, olhar: i % 2 ? -1 : 1,
    investida: 0, investidaAte: 0, atordoadoAte: 0, tempoCoroa: 0, fora: false, moedas: 0, aAnterior: false, bAnterior: false,
    botProx: 0, botDir: 0, botPula: false,
  }));
  const e: EstadoCoroa = {
    modo, arena: o.arena, jogadores, dono: null, protegidoAte: 0, coroa: { x: LARG / 2, y: 2.5 }, bombaAte: 0, moedas: [], passo: 0,
    duracao: modo === "moedas" ? TEMPO_SOLO : DURACAO, sorteio, eventos: [], terminado: false, vencedor: null,
  };
  if (modo === "pegapega") { e.dono = Math.floor(sorteio() * n); e.bombaAte = BOMBA; e.protegidoAte = 60; }
  if (modo === "moedas") for (let k = 0; k < 3; k++) novaMoeda(e);
  return e;
}

function novaMoeda(e: EstadoCoroa) {
  const p = ARENAS[e.arena][Math.floor(e.sorteio() * ARENAS[e.arena].length)];
  e.moedas.push({ x: p.x + 0.5 + e.sorteio() * (p.w - 1), y: p.y - 0.6 });
}

/** Física: gravidade, plataformas atravessáveis por baixo, paredes nas bordas. */
function fisica(e: EstadoCoroa, j: JogadorC, descer: boolean) {
  j.vy = Math.min(0.5, j.vy + G);
  j.x = Math.min(LARG - 0.3, Math.max(0.3, j.x + j.vx));
  const antes = j.y;
  j.y += j.vy;
  j.noChao = false;
  if (j.vy >= 0) {
    for (const p of ARENAS[e.arena]) {
      const chao = p.y === ALT - 0.5;
      if (j.x < p.x || j.x > p.x + p.w) continue;
      if (antes <= p.y + 0.001 && j.y >= p.y && (!descer || chao)) { j.y = p.y; j.vy = 0; j.noChao = true; j.pulosAr = 1; break; }
    }
  }
}

const toca = (a: JogadorC, b: JogadorC) => Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 0.9;

// ---------------------------------------------------------------- bots

function decidirBot(e: EstadoCoroa, j: JogadorC): { dir: -1 | 0 | 1; a: boolean; b: boolean; descer: boolean } {
  const nivel = j.bot ?? "medio";
  const reacao = nivel === "facil" ? 30 : nivel === "medio" ? 16 : 8;
  let alvo: { x: number; y: number } | null = null;
  let fugir = false;
  if (e.modo === "moedas") alvo = e.moedas[0] ?? null;
  else if (e.dono === null) alvo = e.coroa;
  else if (e.dono === j.id) {
    const caca = e.jogadores.filter(o => !o.fora && o.id !== j.id).sort((a, b) => Math.abs(a.x - j.x) - Math.abs(b.x - j.x))[0];
    if (e.modo === "coroa") { alvo = caca ?? null; fugir = true; }
    else alvo = caca ?? null; // Pega-Pega: quem está com a bomba corre atrás de alguém para passar
  } else {
    const dono = e.jogadores[e.dono];
    if (e.modo === "coroa") alvo = dono;
    else { alvo = dono; fugir = true; }
  }
  if (e.passo >= j.botProx && alvo) {
    j.botProx = e.passo + reacao + Math.floor(e.sorteio() * reacao);
    const dx = alvo.x - j.x;
    j.botDir = fugir ? (dx > 0 ? -1 : 1) : Math.abs(dx) < 0.3 ? 0 : dx > 0 ? 1 : -1;
    // Encostou na parede fugindo: vira e pula por cima.
    if (fugir && (j.x < 1.5 || j.x > LARG - 1.5)) { j.botDir = j.x < 1.5 ? 1 : -1; j.botPula = true; }
    else j.botPula = (!fugir && alvo.y < j.y - 1.2) || (fugir && e.sorteio() < 0.35) || e.sorteio() < 0.08;
  }
  const descer = !fugir && !!alvo && alvo.y > j.y + 1.2 && e.sorteio() < 0.5;
  const perto = alvo && Math.abs(alvo.x - j.x) < 2.5 && Math.abs(alvo.y - j.y) < 1;
  return { dir: j.botDir, a: j.botPula && (j.noChao || (j.vy > 0 && j.pulosAr > 0)), b: !fugir && !!perto && nivel !== "facil" && e.sorteio() < 0.05, descer };
}

// ---------------------------------------------------------------- passo

export function passoCoroa(e: EstadoCoroa, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  for (const j of e.jogadores) {
    if (j.fora) continue;
    j.investida = Math.max(0, j.investida - 1);
    let dir: -1 | 0 | 1 = 0, a = false, b = false, descer = false;
    if (j.bot) ({ dir, a, b, descer } = decidirBot(e, j));
    else {
      const ent = entradas[j.id] ?? { direcao: null, a: false, b: false };
      dir = ent.direcao === "esquerda" ? -1 : ent.direcao === "direita" ? 1 : 0;
      a = ent.a; b = ent.b; descer = ent.direcao === "baixo";
      if (ent.direcao === "cima") a = true;
    }
    const aBorda = a && !j.aAnterior, bBorda = b && !j.bAnterior;
    j.aAnterior = a; j.bAnterior = b;
    const atordoado = e.passo < j.atordoadoAte;
    const vmax = VMAX * (e.dono === j.id && e.modo === "coroa" ? 0.88 : 1);
    if (!atordoado) {
      if (dir) j.olhar = dir;
      if (e.passo < j.investidaAte) j.vx = j.olhar * 0.3;
      else j.vx += (dir * vmax - j.vx) * (j.noChao ? 0.25 : 0.12);
      if (aBorda && (j.noChao || j.pulosAr > 0)) {
        if (!j.noChao) j.pulosAr--;
        j.vy = PULO;
        e.eventos.push({ tipo: "pulo", jogador: j.id });
      }
      if (bBorda && j.investida === 0) { j.investida = 60; j.investidaAte = e.passo + 8; e.eventos.push({ tipo: "investida", jogador: j.id }); }
    } else j.vx *= 0.8;
    fisica(e, j, descer);
  }
  const ativos = e.jogadores.filter(j => !j.fora);
  // Pisão: cair em cima de alguém atordoa e quica.
  for (const j of ativos) for (const o of ativos) {
    if (j === o || j.vy <= 0.05) continue;
    if (Math.abs(j.x - o.x) < 0.5 && j.y > o.y - 1.1 && j.y < o.y - 0.6) {
      j.vy = PULO * 0.8; o.atordoadoAte = e.passo + 30;
      e.eventos.push({ tipo: "pisao", jogador: j.id, em: o.id });
    }
  }
  if (e.modo === "moedas") {
    const j = e.jogadores[0];
    for (const m of e.moedas) if (Math.abs(m.x - j.x) < 0.6 && Math.abs(m.y - (j.y - 0.5)) < 0.8) {
      j.moedas++; m.x = -99;
      e.eventos.push({ tipo: "moeda", jogador: j.id, x: m.x, y: m.y });
    }
    e.moedas = e.moedas.filter(m => m.x > -50);
    while (e.moedas.length < 3) novaMoeda(e);
    if (j.moedas >= META_MOEDAS) return terminar(e, 0);
    if (e.passo >= e.duracao) return terminar(e, null);
    return;
  }
  // Coroa no ar: quem encostar pega.
  if (e.dono === null) {
    const p = ativos.find(j => Math.abs(j.x - e.coroa.x) < 0.6 && Math.abs(j.y - 0.5 - e.coroa.y) < 0.9);
    if (p) { e.dono = p.id; e.protegidoAte = e.passo + 60; e.eventos.push({ tipo: "roubou", jogador: p.id, de: null }); }
  } else if (e.passo >= e.protegidoAte) {
    const dono = e.jogadores[e.dono];
    const ladrao = ativos.find(o => o.id !== dono.id && toca(o, dono));
    if (ladrao) {
      e.eventos.push({ tipo: "roubou", jogador: ladrao.id, de: dono.id });
      e.dono = ladrao.id;
      e.protegidoAte = e.passo + 60;
      dono.atordoadoAte = e.passo + 20;
    }
  }
  if (e.modo === "coroa") {
    if (e.dono !== null) e.jogadores[e.dono].tempoCoroa++;
    if (e.passo >= e.duracao) {
      const max = Math.max(...e.jogadores.map(j => j.tempoCoroa));
      const lideres = e.jogadores.filter(j => j.tempoCoroa === max);
      return terminar(e, lideres.length === 1 ? lideres[0].id : null);
    }
  } else if (e.passo >= e.bombaAte && e.dono !== null) {
    // Batata quente: a bomba explode, quem estava com ela sai e ela vai para alguém sorteado.
    const fora = e.jogadores[e.dono];
    fora.fora = true;
    e.eventos.push({ tipo: "explodiu", jogador: fora.id });
    const restam = e.jogadores.filter(j => !j.fora);
    if (restam.length <= 1) return terminar(e, restam[0]?.id ?? null);
    e.dono = restam[Math.floor(e.sorteio() * restam.length)].id;
    e.bombaAte = e.passo + BOMBA;
    e.protegidoAte = e.passo + 60;
  }
  // Pega-Pega: tempo de sobrevivência conta como pontos.
  if (e.modo === "pegapega") for (const j of ativos) if (j.id !== e.dono) j.tempoCoroa++;
}

function terminar(e: EstadoCoroa, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.eventos.push({ tipo: "fim", vencedor });
}

/** Pontos: 10 por segundo com a coroa (ou vivo no Pega-Pega), +300 para quem vence; sozinho, 50 por moeda. */
export const pontosCoroa = (e: EstadoCoroa, j: JogadorC) =>
  e.modo === "moedas" ? j.moedas * 50 + (e.vencedor === 0 ? 300 : 0) : Math.round(j.tempoCoroa / 6) + (e.vencedor === j.id ? 300 : 0);
