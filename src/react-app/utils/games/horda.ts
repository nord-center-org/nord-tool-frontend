/**
 * Horda Zumbi: regras puras da sobrevivência cooperativa vista de cima (60 passos por segundo), de 1 a 8 jogadores.
 *
 * - Todos juntos contra ondas de zumbis cada vez maiores. Uma casa no meio do mapa tem 4 portas com barricadas de
 *   tábuas: os zumbis quebram as tábuas para entrar, e quem segura B perto da porta repõe tábua por tábua (e ganha).
 * - Cada abate rende dinheiro e pontos. Nas bancadas da casa (B em cima) dá para comprar arma melhor, vida e dano.
 * - Zerou a vida, cai: um aliado segurando B perto levanta (2 s). Ninguém levantou em 30 s, fica fora até a próxima
 *   onda. Todos no chão: fim de jogo.
 * - Ondas: sobreviver até a onda 10 (sozinho, 5). Resgate: levar os 3 sobreviventes até o centro da casa.
 *   Chefe: 3 ondas e depois um zumbi gigante que investe e chama reforços.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const LARGURA = 36;
export const ALTURA = 22;
export const CASA = { x0: 12, y0: 7, x1: 24, y1: 15 };
const ESPESSURA = 0.4;
const VAO = 1.1;
export const PORTAS = [
  { x: 18, y: CASA.y0, eixo: "h" as const }, { x: 18, y: CASA.y1, eixo: "h" as const },
  { x: CASA.x0, y: 11, eixo: "v" as const }, { x: CASA.x1, y: 11, eixo: "v" as const },
];
export const TABUAS_MAX = 5;
export const BANCADAS = [
  { tipo: "arma" as const, x: 14, y: 9 }, { tipo: "vida" as const, x: 22, y: 9 }, { tipo: "dano" as const, x: 18, y: 13.2 },
];
export const META_ONDAS = 10;
export const META_ONDAS_SOLO = 5;
const RAIO = 0.35;
const SANGRA = 30 * 60;
const REVIVER = 120;
const CONSERTO = 30;
const INTERVALO = 10 * 60;

export type ModoHorda = "ondas" | "resgate" | "chefe";
export type Arma = "pistola" | "espingarda" | "rifle";
export type TipoZumbi = "normal" | "corredor" | "bruto" | "chefe";
export type Bancada = (typeof BANCADAS)[number]["tipo"];

export const ARMAS: Record<Arma, { cadencia: number; dano: number; balas: number; abertura: number; nome: string }> = {
  pistola: { cadencia: 16, dano: 1, balas: 1, abertura: 0, nome: "Pistola" },
  espingarda: { cadencia: 40, dano: 1, balas: 6, abertura: 0.5, nome: "Espingarda" },
  rifle: { cadencia: 6, dano: 1, balas: 1, abertura: 0.06, nome: "Rifle" },
};
export const PRECO: Record<Bancada, number> = { arma: 500, vida: 300, dano: 400 };
const PONTOS_ABATE: Record<TipoZumbi, number> = { normal: 60, corredor: 80, bruto: 150, chefe: 2000 };

export interface JogadorH {
  id: number;
  bot: Dificuldade | null;
  x: number; y: number;
  mira: { x: number; y: number };
  hp: number; hpMax: number;
  estado: "vivo" | "caido" | "fora";
  sangraAte: number;
  arma: Arma;
  danoMult: number;
  recarga: number;
  dinheiro: number;
  pontos: number;
  abates: number;
  /** O que está fazendo segurando B: consertar uma porta, levantar alguém ou nada. */
  acao: { tipo: "consertar" | "reviver"; alvo: number; desde: number } | null;
  bAnterior: boolean;
}
export interface Zumbi { id: number; tipo: TipoZumbi; x: number; y: number; hp: number; hpMax: number; atacaEm: number; investida: { vx: number; vy: number; ate: number } | null; chamaEm: number }
export interface Bala { x: number; y: number; vx: number; vy: number; vida: number; dono: number; dano: number }
export interface Civil { id: number; x: number; y: number; hp: number; salvo: boolean }

export type EventoHorda =
  | { tipo: "tiro"; jogador: number; arma: Arma }
  | { tipo: "acerto"; x: number; y: number }
  | { tipo: "abate"; x: number; y: number; zumbi: TipoZumbi; jogador: number }
  | { tipo: "ferido"; jogador: number }
  | { tipo: "caiu"; jogador: number }
  | { tipo: "levantou"; jogador: number; por: number }
  | { tipo: "fora"; jogador: number }
  | { tipo: "tabua"; porta: number; tabuas: number; quebrou: boolean }
  | { tipo: "compra"; jogador: number; item: Bancada }
  | { tipo: "semDinheiro"; jogador: number }
  | { tipo: "onda"; onda: number }
  | { tipo: "chefe" }
  | { tipo: "salvo"; civil: number }
  | { tipo: "civilMorreu"; civil: number }
  | { tipo: "fim"; venceu: boolean };

export interface EstadoHorda {
  modo: ModoHorda;
  jogadores: JogadorH[];
  zumbis: Zumbi[];
  balas: Bala[];
  tabuas: number[];
  civis: Civil[];
  onda: number;
  fase: "intervalo" | "onda";
  faseAte: number;
  paraSurgir: number;
  proximoSurgir: number;
  meta: number;
  passo: number;
  proximoId: number;
  sorteio: () => number;
  eventos: EventoHorda[];
  terminado: boolean;
  /** Venceram juntos? (o "vencedor" da rodada é quem fez mais pontos). */
  venceram: boolean;
  vencedor: number | null;
}

export const naCasa = (x: number, y: number) => x > CASA.x0 && x < CASA.x1 && y > CASA.y0 && y < CASA.y1;

/** Paredes da casa (retângulos), com o vão de cada porta. */
export const PAREDES: [number, number, number, number][] = (() => {
  const l: [number, number, number, number][] = [];
  const e = ESPESSURA / 2;
  for (const y of [CASA.y0, CASA.y1]) { l.push([CASA.x0 - e, y - e, 18 - VAO, y + e], [18 + VAO, y - e, CASA.x1 + e, y + e]); }
  for (const x of [CASA.x0, CASA.x1]) { l.push([x - e, CASA.y0 - e, x + e, 11 - VAO], [x - e, 11 + VAO, x + e, CASA.y1 + e]); }
  return l;
})();

const caixaPorta = (p: number): [number, number, number, number] => {
  const d = PORTAS[p];
  return d.eixo === "h" ? [d.x - VAO, d.y - 0.25, d.x + VAO, d.y + 0.25] : [d.x - 0.25, d.y - VAO, d.x + 0.25, d.y + VAO];
};

function bate(x: number, y: number, r: number, caixas: [number, number, number, number][]) {
  return caixas.some(([a, b, c, d]) => x + r > a && x - r < c && y + r > b && y - r < d);
}

/** Anda com colisão nas paredes (eixo por eixo, para deslizar); zumbis também param nas barricadas. */
function andar(e: EstadoHorda, ent: { x: number; y: number }, dx: number, dy: number, zumbi: boolean) {
  const caixas = zumbi ? [...PAREDES, ...e.tabuas.map((t, i) => (t > 0 ? caixaPorta(i) : null)).filter((c): c is [number, number, number, number] => !!c)] : PAREDES;
  const nx = Math.min(LARGURA - RAIO, Math.max(RAIO, ent.x + dx));
  if (!bate(nx, ent.y, RAIO, caixas)) ent.x = nx;
  const ny = Math.min(ALTURA - RAIO, Math.max(RAIO, ent.y + dy));
  if (!bate(ent.x, ny, RAIO, caixas)) ent.y = ny;
}

export function novaPartidaHorda(o: { modo: ModoHorda; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoHorda {
  const sorteio = rng(o.semente);
  const n = o.jogadores.length;
  const jogadores: JogadorH[] = o.jogadores.map((j, i) => {
    const ang = (i / n) * Math.PI * 2;
    return {
      id: i, bot: j.bot, x: 18 + Math.cos(ang) * 2, y: 11 + Math.sin(ang) * 1.4, mira: { x: 0, y: -1 }, hp: 100, hpMax: 100,
      estado: "vivo", sangraAte: 0, arma: "pistola", danoMult: 1, recarga: 0, dinheiro: 0, pontos: 0, abates: 0, acao: null, bAnterior: false,
    };
  });
  const e: EstadoHorda = {
    modo: o.modo, jogadores, zumbis: [], balas: [], tabuas: PORTAS.map(() => TABUAS_MAX), civis: [], onda: 0, fase: "intervalo",
    faseAte: 3 * 60, paraSurgir: 0, proximoSurgir: 0, meta: n === 1 ? META_ONDAS_SOLO : META_ONDAS, passo: 0, proximoId: 1, sorteio,
    eventos: [], terminado: false, venceram: false, vencedor: null,
  };
  if (o.modo === "resgate") {
    e.civis = [[2, 2], [LARGURA - 2, ALTURA - 2], [LARGURA - 2, 2]].map(([x, y]) => ({ id: e.proximoId++, x, y, hp: 3, salvo: false }));
  }
  return e;
}

const vivos = (e: EstadoHorda) => e.jogadores.filter(j => j.estado === "vivo");
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const VETOR: Record<Direcao, { x: number; y: number }> = { cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 }, esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 } };

function comecarOnda(e: EstadoHorda) {
  e.onda++;
  e.fase = "onda";
  const n = e.jogadores.length;
  const chefe = e.modo === "chefe" && e.onda === 4;
  e.paraSurgir = chefe ? 4 : Math.round((5 + e.onda * 3) * (0.6 + 0.4 * n));
  e.proximoSurgir = e.passo + 30;
  // Quem ficou fora volta no começo da onda.
  for (const j of e.jogadores) if (j.estado !== "vivo") { j.estado = "vivo"; j.hp = Math.round(j.hpMax / 2); j.x = 18; j.y = 11; j.acao = null; }
  e.eventos.push({ tipo: "onda", onda: e.onda });
  if (chefe) {
    const p = borda(e);
    e.zumbis.push({ id: e.proximoId++, tipo: "chefe", x: p.x, y: p.y, hp: Math.round(80 * (0.6 + 0.4 * n)), hpMax: Math.round(80 * (0.6 + 0.4 * n)), atacaEm: 0, investida: null, chamaEm: e.passo + 600 });
    e.eventos.push({ tipo: "chefe" });
  }
}

function borda(e: EstadoHorda) {
  const s = e.sorteio();
  const t = e.sorteio();
  if (s < 0.25) return { x: t * LARGURA, y: 0.6 };
  if (s < 0.5) return { x: t * LARGURA, y: ALTURA - 0.6 };
  if (s < 0.75) return { x: 0.6, y: t * ALTURA };
  return { x: LARGURA - 0.6, y: t * ALTURA };
}

function surgir(e: EstadoHorda, tipoForcado?: TipoZumbi, perto?: { x: number; y: number }) {
  const r = e.sorteio();
  const tipo: TipoZumbi = tipoForcado ?? (e.onda >= 5 && r < 0.12 ? "bruto" : e.onda >= 3 && r < 0.35 ? "corredor" : "normal");
  const base = 1 + e.onda * 0.5;
  const hp = Math.round(tipo === "bruto" ? base * 4 : tipo === "corredor" ? Math.max(1, base * 0.6) : base);
  const p = perto ? { x: perto.x + (e.sorteio() - 0.5) * 3, y: perto.y + (e.sorteio() - 0.5) * 3 } : borda(e);
  e.zumbis.push({ id: e.proximoId++, tipo, x: Math.min(LARGURA - 1, Math.max(1, p.x)), y: Math.min(ALTURA - 1, Math.max(1, p.y)), hp, hpMax: hp, atacaEm: 0, investida: null, chamaEm: 0 });
}

const VELOCIDADE: Record<TipoZumbi, number> = { normal: 0.03, corredor: 0.06, bruto: 0.022, chefe: 0.026 };

/** Para onde o zumbi anda: direto no alvo, ou pela porta mais perto quando a casa está no caminho. */
function rumo(z: Zumbi, alvo: { x: number; y: number }): { x: number; y: number; porta: number | null } {
  const zDentro = naCasa(z.x, z.y), aDentro = naCasa(alvo.x, alvo.y);
  if (zDentro === aDentro) {
    if (zDentro) return { ...alvo, porta: null };
    // Os dois fora: se a casa está no meio, contorna pelo canto mais perto.
    const meio = { x: (z.x + alvo.x) / 2, y: (z.y + alvo.y) / 2 };
    if (naCasa(meio.x, meio.y) && dist(z, alvo) > 2) {
      const cantos = [[CASA.x0 - 1, CASA.y0 - 1], [CASA.x1 + 1, CASA.y0 - 1], [CASA.x0 - 1, CASA.y1 + 1], [CASA.x1 + 1, CASA.y1 + 1]];
      const c = cantos.map(([x, y]) => ({ x, y })).sort((a, b) => dist(z, a) + dist(a, alvo) - (dist(z, b) + dist(b, alvo)))[0];
      return { ...c, porta: null };
    }
    return { ...alvo, porta: null };
  }
  const p = PORTAS.map((d, i) => ({ i, d: Math.hypot(d.x - z.x, d.y - z.y) })).sort((a, b) => a.d - b.d)[0].i;
  const d = PORTAS[p];
  const fora = d.eixo === "h" ? { x: d.x, y: d.y + (d.y === CASA.y0 ? -0.9 : 0.9) } : { x: d.x + (d.x === CASA.x0 ? -0.9 : 0.9), y: d.y };
  const dentro = d.eixo === "h" ? { x: d.x, y: d.y + (d.y === CASA.y0 ? 0.9 : -0.9) } : { x: d.x + (d.x === CASA.x0 ? 0.9 : -0.9), y: d.y };
  const entrada = zDentro ? dentro : fora;
  if (dist(z, entrada) > 0.5 && dist(z, d) > 0.8) return { ...entrada, porta: p };
  return { ...(zDentro ? fora : dentro), porta: p };
}

function ferir(e: EstadoHorda, j: JogadorH, dano: number) {
  if (j.estado !== "vivo") return;
  j.hp -= dano;
  e.eventos.push({ tipo: "ferido", jogador: j.id });
  if (j.hp <= 0) {
    j.hp = 0;
    j.estado = "caido";
    j.sangraAte = e.passo + SANGRA;
    j.acao = null;
    e.eventos.push({ tipo: "caiu", jogador: j.id });
  }
}

function passoZumbis(e: EstadoHorda) {
  const alvos = [...vivos(e), ...e.civis.filter(c => !c.salvo && c.hp > 0)];
  for (const z of e.zumbis) {
    if (!alvos.length) break;
    const alvo = alvos.reduce((a, b) => (dist(z, b) < dist(z, a) ? b : a));
    // Chefe: investida de tempos em tempos e chama reforços.
    if (z.tipo === "chefe") {
      if (!z.investida && e.passo % 300 === 0 && dist(z, alvo) < 12) {
        const d = Math.max(0.01, dist(z, alvo));
        z.investida = { vx: ((alvo.x - z.x) / d) * 0.13, vy: ((alvo.y - z.y) / d) * 0.13, ate: e.passo + 40 };
      }
      if (e.passo >= z.chamaEm) { z.chamaEm = e.passo + 600; for (let k = 0; k < 4; k++) surgir(e, "normal", z); }
    }
    if (z.investida) {
      andar(e, z, z.investida.vx, z.investida.vy, true);
      if (e.passo >= z.investida.ate) z.investida = null;
    } else {
      const r = rumo(z, alvo);
      // Barricada no caminho: bate nas tábuas (o chefe arranca todas de uma vez).
      if (r.porta !== null && e.tabuas[r.porta] > 0 && dist(z, PORTAS[r.porta]) < 1.3) {
        if (e.passo >= z.atacaEm) {
          z.atacaEm = e.passo + 60;
          e.tabuas[r.porta] = z.tipo === "chefe" ? 0 : e.tabuas[r.porta] - 1;
          e.eventos.push({ tipo: "tabua", porta: r.porta, tabuas: e.tabuas[r.porta], quebrou: true });
        }
        continue;
      }
      const d = Math.max(0.01, Math.hypot(r.x - z.x, r.y - z.y));
      const v = VELOCIDADE[z.tipo] + Math.min(0.015, e.onda * 0.0012);
      andar(e, z, ((r.x - z.x) / d) * v, ((r.y - z.y) / d) * v, true);
    }
    // Mordida.
    const raio = z.tipo === "chefe" ? 1.1 : z.tipo === "bruto" ? 0.75 : 0.6;
    if (dist(z, alvo) < raio && e.passo >= z.atacaEm) {
      z.atacaEm = e.passo + 45;
      if ("estado" in alvo) ferir(e, alvo as JogadorH, z.tipo === "chefe" ? 35 : z.tipo === "bruto" ? 22 : 12);
      else {
        const c = alvo as Civil;
        c.hp--;
        if (c.hp <= 0) e.eventos.push({ tipo: "civilMorreu", civil: c.id });
      }
    }
  }
  // Zumbis não se amontoam no mesmo ponto.
  for (let i = 0; i < e.zumbis.length; i++) for (let k = i + 1; k < e.zumbis.length; k++) {
    const a = e.zumbis[i], b = e.zumbis[k];
    const d = dist(a, b);
    if (d > 0 && d < 0.6) { const f = (0.6 - d) / 2 / d; andar(e, a, (a.x - b.x) * f, (a.y - b.y) * f, true); andar(e, b, (b.x - a.x) * f, (b.y - a.y) * f, true); }
  }
}

/** Mira assistida: com o botão de tiro, puxa para o zumbi mais perto dentro de um cone na frente. */
function miraAssistida(e: EstadoHorda, j: JogadorH, cone = 0.6): { x: number; y: number } {
  let melhor: Zumbi | null = null;
  for (const z of e.zumbis) {
    const dx = z.x - j.x, dy = z.y - j.y, d = Math.hypot(dx, dy);
    if (d > 11 || d < 0.01) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (dx * j.mira.x + dy * j.mira.y) / d)));
    if (ang < cone && (!melhor || d < dist(j, melhor))) melhor = z;
  }
  if (!melhor) return j.mira;
  const d = dist(j, melhor);
  return { x: (melhor.x - j.x) / d, y: (melhor.y - j.y) / d };
}

function atirar(e: EstadoHorda, j: JogadorH, dir: { x: number; y: number }) {
  const a = ARMAS[j.arma];
  j.recarga = a.cadencia;
  const base = Math.atan2(dir.y, dir.x);
  for (let k = 0; k < a.balas; k++) {
    const ang = base + (a.balas > 1 ? (k / (a.balas - 1) - 0.5) * a.abertura : (e.sorteio() - 0.5) * a.abertura);
    e.balas.push({ x: j.x + Math.cos(ang) * 0.4, y: j.y + Math.sin(ang) * 0.4, vx: Math.cos(ang) * 0.55, vy: Math.sin(ang) * 0.55, vida: 26, dono: j.id, dano: a.dano * j.danoMult });
  }
  e.eventos.push({ tipo: "tiro", jogador: j.id, arma: j.arma });
}

function passoBalas(e: EstadoHorda) {
  for (const b of e.balas) {
    for (let s = 0; s < 2 && b.vida > 0; s++) {
      b.x += b.vx / 2; b.y += b.vy / 2;
      if (bate(b.x, b.y, 0.05, PAREDES)) { b.vida = 0; break; }
      const z = e.zumbis.find(q => q.hp > 0 && dist(q, b) < (q.tipo === "chefe" ? 1 : q.tipo === "bruto" ? 0.55 : 0.42));
      if (z) {
        z.hp -= b.dano;
        b.vida = 0;
        e.eventos.push({ tipo: "acerto", x: b.x, y: b.y });
        if (z.hp <= 0) {
          const j = e.jogadores[b.dono];
          const pts = PONTOS_ABATE[z.tipo];
          j.pontos += pts; j.dinheiro += pts; j.abates++;
          e.eventos.push({ tipo: "abate", x: z.x, y: z.y, zumbi: z.tipo, jogador: j.id });
        }
      }
    }
    b.vida--;
  }
  e.balas = e.balas.filter(b => b.vida > 0);
  e.zumbis = e.zumbis.filter(z => z.hp > 0);
}

/** Segurar B: consertar a porta mais perto, levantar o aliado caído ou comprar na bancada. */
function interagir(e: EstadoHorda, j: JogadorH, b: boolean) {
  const borda = b && !j.bAnterior;
  j.bAnterior = b;
  if (!b) { j.acao = null; return; }
  const caido = e.jogadores.find(o => o.id !== j.id && o.estado === "caido" && dist(o, j) < 1.3);
  if (caido) {
    if (!j.acao || j.acao.tipo !== "reviver" || j.acao.alvo !== caido.id) j.acao = { tipo: "reviver", alvo: caido.id, desde: e.passo };
    if (e.passo - j.acao.desde >= REVIVER) {
      caido.estado = "vivo"; caido.hp = Math.round(caido.hpMax / 2); j.acao = null;
      j.pontos += 100; j.dinheiro += 100;
      e.eventos.push({ tipo: "levantou", jogador: caido.id, por: j.id });
    }
    return;
  }
  const porta = PORTAS.findIndex(p => dist(p, j) < 1.6);
  if (porta >= 0 && e.tabuas[porta] < TABUAS_MAX && !e.zumbis.some(z => dist(z, PORTAS[porta]) < 0.9)) {
    if (!j.acao || j.acao.tipo !== "consertar" || j.acao.alvo !== porta) j.acao = { tipo: "consertar", alvo: porta, desde: e.passo };
    if (e.passo - j.acao.desde >= CONSERTO) {
      e.tabuas[porta]++; j.pontos += 10; j.dinheiro += 10; j.acao.desde = e.passo;
      e.eventos.push({ tipo: "tabua", porta, tabuas: e.tabuas[porta], quebrou: false });
    }
    return;
  }
  j.acao = null;
  const bancada = BANCADAS.find(c => dist(c, j) < 1);
  if (bancada && borda) comprar(e, j, bancada.tipo);
}

export function comprar(e: EstadoHorda, j: JogadorH, item: Bancada): boolean {
  const preco = item === "arma" ? (j.arma === "pistola" ? 500 : j.arma === "espingarda" ? 900 : Infinity) : PRECO[item];
  if (j.dinheiro < preco || (item === "vida" && j.hp >= j.hpMax && j.hpMax >= 200)) { e.eventos.push({ tipo: "semDinheiro", jogador: j.id }); return false; }
  j.dinheiro -= preco;
  if (item === "arma") j.arma = j.arma === "pistola" ? "espingarda" : "rifle";
  else if (item === "vida") { j.hpMax = Math.min(200, j.hpMax + 25); j.hp = j.hpMax; }
  else j.danoMult = Math.round((j.danoMult + 0.25) * 100) / 100;
  e.eventos.push({ tipo: "compra", jogador: j.id, item });
  return true;
}

// ---------------------------------------------------------------- bots

const MIRA_BOT: Record<Dificuldade, number> = { facil: 0.35, medio: 0.15, dificil: 0.04 };
const REACAO_BOT: Record<Dificuldade, number> = { facil: 1.8, medio: 1.3, dificil: 1 };

/** O que o bot quer: para onde andar, se atira (e para onde) e se segura B. */
export function decisaoDoBot(e: EstadoHorda, j: JogadorH): { mover: { x: number; y: number }; atirar: { x: number; y: number } | null; b: boolean } {
  const nivel = j.bot ?? "medio";
  const parado = { x: 0, y: 0 };
  const zs = e.zumbis.map(z => ({ z, d: dist(z, j) })).sort((a, b) => a.d - b.d);
  const perto = zs[0];
  let mover = parado;
  let b = false;
  const ir = (alvo: { x: number; y: number }) => { const d = Math.max(0.01, dist(j, alvo)); return d < 0.3 ? parado : { x: (alvo.x - j.x) / d, y: (alvo.y - j.y) / d }; };
  const caido = e.jogadores.find(o => o.estado === "caido" && o.id !== j.id);
  if (caido && (!perto || perto.d > 2.5)) { mover = dist(caido, j) < 1 ? parado : ir(caido); b = dist(caido, j) < 1.2; }
  else if (perto && perto.d < 2.6) { mover = { x: (j.x - perto.z.x) / perto.d, y: (j.y - perto.z.y) / perto.d }; }
  else {
    // Sem perigo: conserta a porta mais quebrada, compra o que dá ou volta para perto do centro.
    const porta = PORTAS.map((p, i) => ({ i, p })).filter(({ i, p }) => e.tabuas[i] < TABUAS_MAX && !e.zumbis.some(z => dist(z, p) < 2)).sort((a, b2) => e.tabuas[a.i] - e.tabuas[b2.i])[0];
    const desejo: Bancada | null = j.arma !== "rifle" && j.dinheiro >= (j.arma === "pistola" ? 500 : 900) ? "arma" : j.dinheiro >= 700 ? "dano" : j.hp < j.hpMax * 0.5 && j.dinheiro >= 300 ? "vida" : null;
    if (porta && (e.fase === "intervalo" || e.tabuas[porta.i] <= 2)) {
      const dentro = { x: porta.p.eixo === "h" ? porta.p.x : porta.p.x + (porta.p.x === CASA.x0 ? 0.9 : -0.9), y: porta.p.eixo === "h" ? porta.p.y + (porta.p.y === CASA.y0 ? 0.9 : -0.9) : porta.p.y };
      mover = ir(dentro); b = dist(j, porta.p) < 1.5;
    } else if (desejo) {
      const c = BANCADAS.find(x => x.tipo === desejo)!;
      mover = ir(c); b = dist(j, c) < 0.9 && e.passo % 20 === 0;
    } else if (e.modo === "resgate" && e.civis.some(c => !c.salvo && c.hp > 0) && j.id % 2 === 0) {
      const c = e.civis.filter(x => !x.salvo && x.hp > 0).sort((a, b2) => dist(a, j) - dist(b2, j))[0];
      mover = dist(c, j) < 1.5 ? ir({ x: 18, y: 11 }) : ir(c);
    } else mover = dist(j, { x: 18, y: 11 }) > 2 ? ir({ x: 18 + (j.id % 3 - 1) * 1.5, y: 11 + ((j.id >> 1) % 2) * 1.2 - 0.6 }) : parado;
  }
  let atirar: { x: number; y: number } | null = null;
  if (perto && perto.d < 9 * (1 / REACAO_BOT[nivel] + 0.3)) {
    const ang = Math.atan2(perto.z.y - j.y, perto.z.x - j.x) + (e.sorteio() - 0.5) * MIRA_BOT[nivel] * 2;
    atirar = { x: Math.cos(ang), y: Math.sin(ang) };
  }
  return { mover, atirar, b };
}

// ---------------------------------------------------------------- passo

export function passoHorda(e: EstadoHorda, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  // Ondas: intervalo → onda (surgindo aos poucos) → intervalo.
  if (e.fase === "intervalo" && e.passo >= e.faseAte) comecarOnda(e);
  if (e.fase === "onda" && e.paraSurgir > 0 && e.passo >= e.proximoSurgir && e.zumbis.length < 26) {
    if (!(e.modo === "chefe" && e.onda === 4)) surgir(e);
    e.paraSurgir--;
    e.proximoSurgir = e.passo + Math.max(14, 60 - e.onda * 4);
  }
  for (const j of e.jogadores) {
    if (j.estado === "caido" && e.passo >= j.sangraAte) { j.estado = "fora"; e.eventos.push({ tipo: "fora", jogador: j.id }); }
    if (j.estado !== "vivo") continue;
    j.recarga = Math.max(0, j.recarga - 1);
    if (j.bot) {
      const d = decisaoDoBot(e, j);
      andar(e, j, d.mover.x * 0.075, d.mover.y * 0.075, false);
      if (d.atirar) { j.mira = d.atirar; if (j.recarga === 0) atirar(e, j, d.atirar); }
      else if (d.mover.x || d.mover.y) j.mira = d.mover;
      interagir(e, j, d.b);
      continue;
    }
    const ent = entradas[j.id] ?? { direcao: null, a: false, b: false };
    const lento = j.acao ? 0.4 : 1;
    if (ent.direcao) { const v = VETOR[ent.direcao]; j.mira = v; andar(e, j, v.x * 0.08 * lento, v.y * 0.08 * lento, false); }
    if (ent.a && j.recarga === 0) atirar(e, j, miraAssistida(e, j));
    interagir(e, j, ent.b);
  }
  passoZumbis(e);
  passoBalas(e);
  // Resgate: sobreviventes seguem quem estiver perto e são salvos no centro da casa.
  for (const c of e.civis) {
    if (c.salvo || c.hp <= 0) continue;
    const guia = vivos(e).filter(j => dist(j, c) < 3).sort((a, b) => dist(a, c) - dist(b, c))[0];
    if (guia && dist(guia, c) > 0.9) { const d = dist(guia, c); andar(e, c, ((guia.x - c.x) / d) * 0.07, ((guia.y - c.y) / d) * 0.07, false); }
    if (dist(c, { x: 18, y: 11 }) < 1.6) {
      c.salvo = true;
      for (const j of vivos(e)) { j.pontos += 300; j.dinheiro += 300; }
      e.eventos.push({ tipo: "salvo", civil: c.id });
    }
  }
  // Fim da onda.
  if (e.fase === "onda" && e.paraSurgir === 0 && e.zumbis.length === 0) {
    for (const j of e.jogadores) if (j.estado !== "vivo") { j.estado = "vivo"; j.hp = Math.round(j.hpMax / 2); j.acao = null; }
    if (e.modo === "ondas" && e.onda >= e.meta) return terminar(e, true);
    if (e.modo === "chefe" && e.onda >= 4) return terminar(e, true);
    e.fase = "intervalo";
    e.faseAte = e.passo + INTERVALO;
  }
  if (e.modo === "resgate") {
    const restam = e.civis.filter(c => !c.salvo && c.hp > 0).length;
    if (restam === 0) return terminar(e, e.civis.some(c => c.salvo));
  }
  if (!vivos(e).length) terminar(e, false);
}

function terminar(e: EstadoHorda, venceram: boolean) {
  e.terminado = true;
  e.venceram = venceram;
  // Juntos: a rodada fica com quem mais pontuou (o MVP) quando vencem; sozinho, vence ou não.
  e.vencedor = venceram ? e.jogadores.reduce((a, b) => (b.pontos > a.pontos ? b : a)).id : null;
  e.eventos.push({ tipo: "fim", venceu: venceram });
}

/** Pontos para o recorde: os do jogo, mais 500 para todos quando vencem. */
export const pontosHorda = (e: EstadoHorda, j: JogadorH) => j.pontos + (e.venceram ? 500 : 0) + Math.max(0, e.onda - 1) * 50;
