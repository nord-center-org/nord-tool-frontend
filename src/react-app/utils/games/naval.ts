/**
 * Guerra Naval: regras puras da batalha naval por turnos (60 passos por segundo), de 1 a 8 frotas.
 *
 * - Grade 10 × 10 por frota com 5 navios (5, 4, 3, 3 e 2) sorteados sem se encostar (nem na diagonal).
 * - Na sua vez, mire numa frota rival e atire: água, acerto ou "afundou!" (o navio afundado é anunciado).
 * - Clássico: um tiro por vez. Salva: tantos tiros quantos navios você ainda tem de pé.
 * - Especiais: além do tiro, cada um tem um sonar (conta as partes intactas de navio num 3 × 3) e um bombardeio
 *   em cruz (5 casas), cada um uma vez por partida; usar um especial gasta a vez.
 * - Com 5 ou mais frotas, cada uma tem 4 navios (4, 3, 3 e 2), para a partida não se arrastar.
 * - Quem perde a frota inteira está fora; vence a última frota de pé. Se a batalha passar de 6 minutos, vence
 *   quem tiver mais partes de navio intactas (no empate, quem acertou mais).
 * - Sozinho (Caçada): afunde a frota escondida em até 60 tiros.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const N = 10;
export const FROTA = [5, 4, 3, 3, 2] as const;
export const FROTA_REDUZIDA = [4, 3, 3, 2] as const;
export const NOMES_NAVIOS = ["Porta-aviões", "Encouraçado", "Cruzador", "Submarino", "Destróier"] as const;
const NOMES_REDUZIDA = ["Encouraçado", "Cruzador", "Submarino", "Destróier"] as const;
export const LIMITE_BATALHA = 6 * 60 * 60;
export const LIMITE_CACADA = 60;
export const TEMPO_VEZ = 20 * 60;
const PAUSA_TIRO = 30;
const PAUSA_VEZ = 12;
const DAS = 12;
const ARR = 4;

export type ModoNaval = "classico" | "salva" | "especiais" | "cacada";
export type Arma = "tiro" | "sonar" | "cruz";
/** 0 desconhecida, 1 água, 2 acerto, 3 parte de navio afundado. */
export type Casa = 0 | 1 | 2 | 3;

export interface Navio { nome: string; tam: number; casas: number[]; acertos: number; afundado: boolean }

export interface Frota {
  /** Jogador dono (null = a frota escondida da Caçada). */
  dono: number | null;
  navios: Navio[];
  tiros: Casa[];
  /** Leituras do sonar: centro e quantas partes intactas havia no 3 × 3. */
  sonar: { c: number; n: number }[];
  viva: boolean;
}

export interface Jogador {
  id: number;
  bot: Dificuldade | null;
  /** Índice da frota dele (null na Caçada). */
  frota: number | null;
  especiais: { sonar: number; cruz: number };
  acertos: number;
  afundou: number;
  tiros: number;
}

export type EventoNaval =
  | { tipo: "vez"; jogador: number }
  | { tipo: "agua"; frota: number; casa: number; jogador: number }
  | { tipo: "acerto"; frota: number; casa: number; jogador: number }
  | { tipo: "afundou"; frota: number; navio: number; nome: string; jogador: number }
  | { tipo: "eliminada"; frota: number; jogador: number }
  | { tipo: "sonar"; frota: number; casa: number; n: number; jogador: number }
  | { tipo: "invalido"; jogador: number }
  | { tipo: "fim"; vencedor: number | null };

export interface EstadoNaval {
  modo: ModoNaval;
  jogadores: Jogador[];
  frotas: Frota[];
  passo: number;
  vez: number;
  /** Tiros que ainda faltam nesta vez (Salva). */
  tirosNaVez: number;
  inicioVez: number;
  /** Passo até o qual a vez fica parada (animação do tiro). */
  esperaAte: number;
  cursor: { frota: number; x: number; y: number };
  arma: Arma;
  /** Repetição da seta segurada. */
  dirAnterior: Direcao | null;
  dirDesde: number;
  aAnterior: boolean;
  bAnterior: boolean;
  /** Plano do bot da vez: casa alvo, arma e quando atirar. */
  planoBot: { frota: number; casa: number; arma: Arma; em: number } | null;
  sorteio: () => number;
  eventos: EventoNaval[];
  terminado: boolean;
  vencedor: number | null;
}

const xy = (c: number) => [c % N, Math.floor(c / N)] as const;
const ci = (x: number, y: number) => y * N + x;
const dentro = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N;

/** Sorteia os 5 navios sem sobreposição e sem se encostarem (nem na diagonal). */
export function sortearFrota(sorteio: () => number, reduzida = false): Navio[] {
  const tamanhos: readonly number[] = reduzida ? FROTA_REDUZIDA : FROTA;
  const nomes: readonly string[] = reduzida ? NOMES_REDUZIDA : NOMES_NAVIOS;
  for (;;) {
    const ocupado = new Set<number>();
    const navios: Navio[] = [];
    let ok = true;
    for (const [k, tam] of tamanhos.entries()) {
      let colocado = false;
      for (let t = 0; t < 200 && !colocado; t++) {
        const hor = sorteio() < 0.5;
        const x0 = Math.floor(sorteio() * (hor ? N - tam + 1 : N));
        const y0 = Math.floor(sorteio() * (hor ? N : N - tam + 1));
        const casas = Array.from({ length: tam }, (_, k) => ci(x0 + (hor ? k : 0), y0 + (hor ? 0 : k)));
        const livre = casas.every(c => {
          const [x, y] = xy(c);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dentro(x + dx, y + dy) && ocupado.has(ci(x + dx, y + dy))) return false;
          return true;
        });
        if (livre) {
          casas.forEach(c => ocupado.add(c));
          navios.push({ nome: nomes[k], tam, casas, acertos: 0, afundado: false });
          colocado = true;
        }
      }
      if (!colocado) { ok = false; break; }
    }
    if (ok) return navios;
  }
}

function novaFrota(dono: number | null, sorteio: () => number, reduzida = false): Frota {
  return { dono, navios: sortearFrota(sorteio, reduzida), tiros: Array<Casa>(N * N).fill(0), sonar: [], viva: true };
}

export function novaPartidaNaval(o: { modo: ModoNaval; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoNaval {
  const sorteio = rng(o.semente);
  const modo: ModoNaval = o.jogadores.length === 1 ? "cacada" : o.modo === "cacada" ? "classico" : o.modo;
  const frotas: Frota[] = modo === "cacada" ? [novaFrota(null, sorteio)] : o.jogadores.map((_j, i) => novaFrota(i, sorteio, o.jogadores.length >= 5));
  const especiais = modo === "especiais" ? { sonar: 1, cruz: 1 } : { sonar: 0, cruz: 0 };
  const jogadores: Jogador[] = o.jogadores.map((j, i) => ({
    id: i, bot: j.bot, frota: modo === "cacada" ? null : i, especiais: { ...especiais }, acertos: 0, afundou: 0, tiros: 0,
  }));
  const e: EstadoNaval = {
    modo, jogadores, frotas, passo: 0, vez: Math.floor(sorteio() * jogadores.length), tirosNaVez: 1, inicioVez: 0, esperaAte: 0,
    cursor: { frota: 0, x: 4, y: 4 }, arma: "tiro", dirAnterior: null, dirDesde: 0, aAnterior: false, bAnterior: false,
    planoBot: null, sorteio, eventos: [], terminado: false, vencedor: null,
  };
  if (modo === "cacada") e.vez = 0;
  comecarVez(e, e.vez);
  return e;
}

/** Navios de pé da frota do jogador (para a Salva). */
export const naviosDePe = (f: Frota) => f.navios.filter(n => !n.afundado).length;

/** Frotas em que o jogador pode atirar, na ordem da tela. */
export function alvosDe(e: EstadoNaval, jogador: number): number[] {
  const propria = e.jogadores[jogador].frota;
  return e.frotas.map((_f, i) => i).filter(i => i !== propria && e.frotas[i].viva);
}

function comecarVez(e: EstadoNaval, jogador: number) {
  e.vez = jogador;
  e.inicioVez = e.passo;
  const j = e.jogadores[jogador];
  e.tirosNaVez = e.modo === "salva" && j.frota !== null ? naviosDePe(e.frotas[j.frota]) : 1;
  e.arma = "tiro";
  e.planoBot = null;
  const alvos = alvosDe(e, jogador);
  if (!alvos.includes(e.cursor.frota)) e.cursor = { frota: alvos[0] ?? 0, x: 4, y: 4 };
  e.eventos.push({ tipo: "vez", jogador });
}

function proximaVez(e: EstadoNaval) {
  const n = e.jogadores.length;
  for (let k = 1; k <= n; k++) {
    const j = e.jogadores[(e.vez + k) % n];
    if (j.frota === null || e.frotas[j.frota].viva) { comecarVez(e, j.id); return; }
  }
}

/** Resolve um tiro numa casa; devolve false se a casa já tinha sido atingida. */
function atirarCasa(e: EstadoNaval, fi: number, c: number, quem: number): boolean {
  const f = e.frotas[fi];
  if (f.tiros[c] !== 0) return false;
  const j = e.jogadores[quem];
  j.tiros++;
  const ni = f.navios.findIndex(n => n.casas.includes(c));
  if (ni < 0) {
    f.tiros[c] = 1;
    e.eventos.push({ tipo: "agua", frota: fi, casa: c, jogador: quem });
    return true;
  }
  const nav = f.navios[ni];
  nav.acertos++;
  f.tiros[c] = 2;
  j.acertos++;
  e.eventos.push({ tipo: "acerto", frota: fi, casa: c, jogador: quem });
  if (nav.acertos === nav.tam) {
    nav.afundado = true;
    nav.casas.forEach(k => { f.tiros[k] = 3; });
    j.afundou++;
    e.eventos.push({ tipo: "afundou", frota: fi, navio: ni, nome: nav.nome, jogador: quem });
    if (f.navios.every(n => n.afundado)) {
      f.viva = false;
      e.eventos.push({ tipo: "eliminada", frota: fi, jogador: quem });
    }
  }
  return true;
}

/** Partes de navio ainda intactas no 3 × 3 em volta da casa. */
function lerSonar(f: Frota, c: number): number {
  const [x, y] = xy(c);
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dentro(x + dx, y + dy)) continue;
    const k = ci(x + dx, y + dy);
    if (f.tiros[k] === 0 && f.navios.some(nv => nv.casas.includes(k))) n++;
  }
  return n;
}

export const casasDaCruz = (c: number) => {
  const [x, y] = xy(c);
  return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => dentro(x + dx, y + dy)).map(([dx, dy]) => ci(x + dx, y + dy));
};

/** Dispara a arma escolhida; devolve se a jogada valeu (gasta tiro/vez). */
export function disparar(e: EstadoNaval, quem: number, fi: number, c: number, arma: Arma): boolean {
  if (e.terminado || quem !== e.vez || !alvosDe(e, quem).includes(fi)) return false;
  const j = e.jogadores[quem];
  const f = e.frotas[fi];
  let valeu = false;
  if (arma === "tiro") valeu = atirarCasa(e, fi, c, quem);
  else if (arma === "sonar" && j.especiais.sonar > 0) {
    j.especiais.sonar--;
    const n = lerSonar(f, c);
    f.sonar.push({ c, n });
    e.eventos.push({ tipo: "sonar", frota: fi, casa: c, n, jogador: quem });
    valeu = true;
  } else if (arma === "cruz" && j.especiais.cruz > 0 && casasDaCruz(c).some(k => f.tiros[k] === 0)) {
    j.especiais.cruz--;
    for (const k of casasDaCruz(c)) if (e.frotas[fi].viva) atirarCasa(e, fi, k, quem);
    valeu = true;
  }
  if (!valeu) { e.eventos.push({ tipo: "invalido", jogador: quem }); return false; }
  e.esperaAte = e.passo + PAUSA_TIRO;
  e.tirosNaVez = arma === "tiro" ? e.tirosNaVez - 1 : 0;
  e.planoBot = null;
  verificarFim(e);
  if (!e.terminado && (e.tirosNaVez <= 0 || alvosDe(e, quem).length === 0)) e.tirosNaVez = 0;
  return true;
}

function verificarFim(e: EstadoNaval) {
  if (e.modo === "cacada") {
    const j = e.jogadores[0];
    if (!e.frotas[0].viva) fim(e, 0);
    else if (j.tiros >= LIMITE_CACADA) fim(e, null);
    return;
  }
  const vivas = e.jogadores.filter(j => j.frota !== null && e.frotas[j.frota].viva);
  if (vivas.length <= 1) fim(e, vivas[0]?.id ?? null);
}

/** Partes de navio ainda intactas da frota. */
export const partesIntactas = (f: Frota) => f.navios.reduce((s, n) => s + n.tam - n.acertos, 0);

/** Tempo da batalha esgotado: vence quem tem mais partes intactas; no empate, quem acertou mais (persistindo, sem vencedor). */
function fimPorPartes(e: EstadoNaval) {
  const vivos = e.jogadores.filter(j => j.frota !== null && e.frotas[j.frota].viva);
  const nota = (j: Jogador) => partesIntactas(e.frotas[j.frota!]) * 1000 + j.acertos;
  const max = Math.max(...vivos.map(nota));
  const empatados = vivos.filter(j => nota(j) === max);
  fim(e, empatados.length === 1 ? empatados[0].id : null);
}

function fim(e: EstadoNaval, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.eventos.push({ tipo: "fim", vencedor });
}

/** Pontos: 10 por acerto, 50 por navio afundado, 200 para quem vence; na Caçada, +15 por tiro que sobrou. */
export function pontosNaval(e: EstadoNaval, j: Jogador): number {
  let p = j.acertos * 10 + j.afundou * 50;
  if (e.vencedor === j.id) p += e.modo === "cacada" ? 200 + (LIMITE_CACADA - j.tiros) * 15 : 200;
  return p;
}

// ---------------------------------------------------------------- bots

/** Tamanhos dos navios que ainda não afundaram (é público: o afundado é anunciado). */
const restantes = (f: Frota) => f.navios.filter(n => !n.afundado).map(n => n.tam);

/** Casas desconhecidas vizinhas de acertos ainda não afundados, preferindo seguir a linha de dois acertos. */
export function candidatasAlvo(f: Frota): number[] {
  const acertos = f.tiros.map((t, c) => (t === 2 ? c : -1)).filter(c => c >= 0);
  if (!acertos.length) return [];
  const linha: number[] = [];
  const viz: number[] = [];
  for (const c of acertos) {
    const [x, y] = xy(c);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!dentro(nx, ny) || f.tiros[ci(nx, ny)] !== 0) continue;
      const k = ci(nx, ny);
      // Do outro lado há outro acerto alinhado? Então é a linha do navio.
      const ox = x - dx, oy = y - dy;
      if (dentro(ox, oy) && f.tiros[ci(ox, oy)] === 2) linha.push(k);
      else viz.push(k);
    }
  }
  return linha.length ? [...new Set(linha)] : [...new Set(viz)];
}

/** Mapa de probabilidade: em quantas posições possíveis dos navios restantes cada casa desconhecida entra. */
export function densidade(f: Frota): number[] {
  const d = Array<number>(N * N).fill(0);
  const bloqueada = (c: number) => f.tiros[c] === 1 || f.tiros[c] === 3 || f.sonar.some(s => s.n === 0 && vizinha3(s.c, c));
  for (const tam of restantes(f)) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const hor of [true, false]) {
      if (hor ? x + tam > N : y + tam > N) continue;
      const casas = Array.from({ length: tam }, (_, k) => ci(x + (hor ? k : 0), y + (hor ? 0 : k)));
      if (casas.some(bloqueada)) continue;
      for (const c of casas) if (f.tiros[c] === 0) d[c]++;
    }
  }
  for (const s of f.sonar) if (s.n > 0) for (let c = 0; c < N * N; c++) if (d[c] && vizinha3(s.c, c)) d[c] *= 3;
  return d;
}

function vizinha3(a: number, b: number) {
  const [ax, ay] = xy(a), [bx, by] = xy(b);
  return Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1;
}

const ATRASO_BOT: Record<Dificuldade, number> = { facil: 45, medio: 34, dificil: 26 };

/** Escolhe a jogada do bot: frota, casa e arma. */
export function planoDoBot(e: EstadoNaval, quem: number): { frota: number; casa: number; arma: Arma } {
  const j = e.jogadores[quem];
  const nivel = j.bot ?? "medio";
  const alvos = alvosDe(e, quem);
  const sorte = e.sorteio;
  const escolher = <T,>(l: T[]) => l[Math.floor(sorte() * l.length)];
  // Algum alvo com acerto pendente? Termina de afundar (o Fácil só às vezes lembra).
  const comAcerto = alvos.filter(fi => e.frotas[fi].tiros.includes(2));
  if (comAcerto.length && (nivel !== "facil" || sorte() < 0.55)) {
    const fi = escolher(comAcerto);
    const cand = candidatasAlvo(e.frotas[fi]);
    if (cand.length) return { frota: fi, casa: escolher(cand), arma: "tiro" };
  }
  if (nivel === "facil") {
    const fi = escolher(alvos);
    const livres = e.frotas[fi].tiros.map((t, c) => (t === 0 ? c : -1)).filter(c => c >= 0);
    return { frota: fi, casa: escolher(livres), arma: "tiro" };
  }
  if (nivel === "medio") {
    const fi = escolher(alvos);
    const f = e.frotas[fi];
    let livres = f.tiros.map((t, c) => (t === 0 && (xy(c)[0] + xy(c)[1]) % 2 === 0 ? c : -1)).filter(c => c >= 0);
    if (!livres.length) livres = f.tiros.map((t, c) => (t === 0 ? c : -1)).filter(c => c >= 0);
    const arma: Arma = j.especiais.cruz > 0 && j.tiros > 8 && sorte() < 0.3 ? "cruz" : "tiro";
    return { frota: fi, casa: escolher(livres), arma };
  }
  // Difícil: a casa mais provável entre todos os alvos; especiais quando rendem.
  let melhor = { frota: alvos[0], casa: 0, v: -1 };
  for (const fi of alvos) {
    const d = densidade(e.frotas[fi]);
    d.forEach((v, c) => { const r = v + sorte() * 0.5; if (r > melhor.v) melhor = { frota: fi, casa: c, v: r }; });
  }
  let arma: Arma = "tiro";
  if (j.especiais.sonar > 0 && j.tiros >= 4) arma = "sonar";
  else if (j.especiais.cruz > 0 && j.tiros >= 10) arma = "cruz";
  return { frota: melhor.frota, casa: melhor.casa, arma };
}

// ---------------------------------------------------------------- passo

function moverCursor(e: EstadoNaval, d: Direcao) {
  const alvos = alvosDe(e, e.vez);
  const k = Math.max(0, alvos.indexOf(e.cursor.frota));
  const c = e.cursor;
  if (d === "cima") c.y = Math.max(0, c.y - 1);
  else if (d === "baixo") c.y = Math.min(N - 1, c.y + 1);
  else if (d === "esquerda") {
    if (c.x > 0) c.x--;
    else if (alvos.length > 1) { c.frota = alvos[(k - 1 + alvos.length) % alvos.length]; c.x = N - 1; }
  } else if (c.x < N - 1) c.x++;
  else if (alvos.length > 1) { c.frota = alvos[(k + 1) % alvos.length]; c.x = 0; }
}

function trocar(e: EstadoNaval) {
  const j = e.jogadores[e.vez];
  if (e.modo === "especiais") {
    const ordem: Arma[] = ["tiro", "sonar", "cruz"];
    for (let k = 1; k <= 3; k++) {
      const a = ordem[(ordem.indexOf(e.arma) + k) % 3];
      if (a === "tiro" || j.especiais[a] > 0) { e.arma = a; return; }
    }
    return;
  }
  const alvos = alvosDe(e, e.vez);
  if (alvos.length > 1) e.cursor.frota = alvos[(Math.max(0, alvos.indexOf(e.cursor.frota)) + 1) % alvos.length];
}

/** Um passo (1/60 s). Só a pessoa da vez comanda: setas miram (segurar repete), A dispara, B troca arma/frota. */
export function passoNaval(e: EstadoNaval, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  if (e.modo !== "cacada" && e.passo >= LIMITE_BATALHA) { fimPorPartes(e); return; }
  if (e.passo < e.esperaAte) return;
  if (e.tirosNaVez <= 0) {
    if (e.passo < e.esperaAte + PAUSA_VEZ) return;
    proximaVez(e);
    return;
  }
  const j = e.jogadores[e.vez];
  if (j.bot) {
    if (!e.planoBot) {
      const p = planoDoBot(e, j.id);
      e.planoBot = { ...p, em: e.passo + ATRASO_BOT[j.bot] + Math.floor(e.sorteio() * 12) };
      e.cursor.frota = p.frota;
      e.arma = p.arma;
    }
    const p = e.planoBot;
    // O cursor anda até a casa escolhida, para a tela mostrar a mira.
    if (e.passo % 3 === 0) {
      const [tx, ty] = xy(p.casa);
      if (e.cursor.x !== tx) e.cursor.x += Math.sign(tx - e.cursor.x);
      else if (e.cursor.y !== ty) e.cursor.y += Math.sign(ty - e.cursor.y);
    }
    if (e.passo >= p.em) {
      const [tx, ty] = xy(p.casa);
      e.cursor.x = tx; e.cursor.y = ty;
      if (!disparar(e, j.id, p.frota, p.casa, p.arma) && !disparar(e, j.id, p.frota, p.casa, "tiro")) e.planoBot = null;
    }
    return;
  }
  const ent = entradas[e.vez] ?? { direcao: null, a: false, b: false };
  if (ent.direcao) {
    if (ent.direcao !== e.dirAnterior) { moverCursor(e, ent.direcao); e.dirDesde = e.passo; }
    else if (e.passo - e.dirDesde >= DAS && (e.passo - e.dirDesde - DAS) % ARR === 0) moverCursor(e, ent.direcao);
  }
  e.dirAnterior = ent.direcao;
  if (ent.b && !e.bAnterior) trocar(e);
  e.bAnterior = ent.b;
  if (ent.a && !e.aAnterior) disparar(e, e.vez, e.cursor.frota, ci(e.cursor.x, e.cursor.y), e.arma);
  e.aAnterior = ent.a;
  // Tempo da vez estourou: tiro automático numa casa livre.
  if (!e.terminado && e.tirosNaVez > 0 && e.passo - e.inicioVez >= TEMPO_VEZ * (e.modo === "salva" ? 2 : 1)) {
    const f = e.frotas[e.cursor.frota];
    const livres = f.tiros.map((t, c) => (t === 0 ? c : -1)).filter(c => c >= 0);
    disparar(e, e.vez, e.cursor.frota, livres[Math.floor(e.sorteio() * livres.length)], "tiro");
  }
}

export const casaDoCursor = (e: EstadoNaval) => ci(e.cursor.x, e.cursor.y);
export { xy as coordenadas };
