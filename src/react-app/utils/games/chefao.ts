/**
 * Chefão Colossal: regras puras do cooperativo contra um chefe gigante (60 passos por segundo), de 1 a 8 jogadores,
 * numa arena 2D vista de cima.
 *
 * - Setas andam; A atira (mira sozinha: lacaio colado, pilares do escudo, lacaios por perto, o chefe); B dá uma esquiva
 *   rápida e invulnerável (recarga de 1,5 s).
 * - Todo ataque do chefe é avisado antes (área marcada no chão) e só então machuca: martelo em área, raio em linha,
 *   onda em anel com uma brecha, investida e rajada de balas. Cada fase (100%, 66%, 33% da vida) traz padrões novos,
 *   mais rápidos, e na última o chefe chama lacaios.
 * - Escudo: no começo de cada fase o chefe se protege com 3 pilares; enquanto algum pilar estiver de pé, o tiro no
 *   chefe não causa dano.
 * - 4 corações por pessoa; caído, um aliado parado perto por 2 s levanta (com 2 corações). Sozinho, 3 vidas.
 * - Cooperativo: derrubem o chefe antes de todos caírem (6 min). Competitivo: todos contra o chefe, mas vence quem
 *   causar mais dano (caído volta sozinho em 5 s e perde pontos). Boss Rush: três chefes seguidos, cada um mais forte.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export type ModoChefao = "coop" | "competitivo" | "rush";
export type TipoChefe = "golem" | "hidra" | "maquina";

export const LARGURA = 32;
export const ALTURA = 20;
export const TEMPO = 6 * 60 * 60;
export const CORACOES = 4;
const VEL = 0.12;
const RAIO = 0.4;
const ESQUIVA = 10;
const INVULNERAVEL = 18;
const RECARGA_ESQUIVA = 90;
const CADENCIA = 10;
const VEL_TIRO = 0.55;
const LEVANTAR = 120;
const VOLTA_COMPETITIVO = 300;
const RAIO_CHEFE = 2.3;
const RAIO_PILAR = 0.8;
const ORDEM: TipoChefe[] = ["golem", "hidra", "maquina"];
const VEL_ANEL = 0.16;

export interface Heroi {
  id: number; bot: Dificuldade | null;
  x: number; y: number; dir: Direcao;
  coracoes: number; caido: boolean; levantar: number; voltaEm: number; vidas: number;
  esquivaAte: number; invulneravelAte: number; recargaEsquiva: number; dashX: number; dashY: number;
  recarga: number; bAnterior: boolean;
  dano: number; pontos: number;
}
export type TipoPerigo = "martelo" | "raio" | "anel" | "investida";
export interface Perigo { tipo: TipoPerigo; x: number; y: number; r: number; ang: number; largura: number; dispara: number; fim: number; brecha: number }
export interface Bala { x: number; y: number; vx: number; vy: number; inimiga: boolean; dono: number }
export interface Pilar { x: number; y: number; vida: number; max: number }
export interface Lacaio { x: number; y: number; vida: number }
export interface Chefe {
  tipo: TipoChefe; x: number; y: number; vida: number; max: number; fase: number;
  proximoAtaque: number; alvoX: number; alvoY: number; investindo: { ate: number; vx: number; vy: number } | null; indice: number;
}

export type EventoChefao =
  | { tipo: "tiro"; jogador: number }
  | { tipo: "acertou"; x: number; y: number; escudo: boolean }
  | { tipo: "pilar"; x: number; y: number }
  | { tipo: "fase"; fase: number }
  | { tipo: "aviso"; perigo: TipoPerigo }
  | { tipo: "golpe"; perigo: TipoPerigo | "bala" | "lacaio" | "corpo"; jogador: number }
  | { tipo: "caiu" | "levantou" | "esquiva"; jogador: number }
  | { tipo: "derrotado"; chefe: TipoChefe; proximo: TipoChefe | null }
  | { tipo: "fim" };

export interface EstadoChefao {
  modo: ModoChefao;
  herois: Heroi[];
  chefe: Chefe;
  pilares: Pilar[];
  lacaios: Lacaio[];
  balas: Bala[];
  perigos: Perigo[];
  passo: number;
  sorteio: () => number;
  eventos: EventoChefao[];
  terminado: boolean;
  venceram: boolean;
  vencedor: number | null;
  derrotados: number;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const ang = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const DIRS: Record<Direcao, [number, number]> = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] };

const vidaChefe = (n: number, indice: number) => Math.round(260 * (1 + 0.45 * (n - 1)) * (1 + 0.25 * indice));

export function novaPartidaChefao(o: { modo: ModoChefao; chefe: TipoChefe; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoChefao {
  const n = o.jogadores.length;
  const modo: ModoChefao = n === 1 && o.modo === "competitivo" ? "coop" : o.modo;
  const herois: Heroi[] = o.jogadores.map((j, i) => ({
    id: i, bot: j.bot, x: LARGURA / 2 + ((i % 4) - 1.5) * 3, y: ALTURA - 3 - Math.floor(i / 4) * 1.5, dir: "cima",
    coracoes: CORACOES, caido: false, levantar: 0, voltaEm: 0, vidas: n === 1 ? 3 : 0,
    esquivaAte: 0, invulneravelAte: 0, recargaEsquiva: 0, dashX: 0, dashY: 0, recarga: 0, bAnterior: false, dano: 0, pontos: 0,
  }));
  const e: EstadoChefao = {
    modo, herois, chefe: novoChefe(o.chefe, n, 0), pilares: [], lacaios: [], balas: [], perigos: [],
    passo: 0, sorteio: rng(o.semente), eventos: [], terminado: false, venceram: false, vencedor: null, derrotados: 0,
  };
  erguerEscudo(e);
  return e;
}

function novoChefe(tipo: TipoChefe, n: number, indice: number): Chefe {
  const max = vidaChefe(n, indice);
  return { tipo, x: LARGURA / 2, y: 6, vida: max, max, fase: 1, proximoAtaque: 150, alvoX: LARGURA / 2, alvoY: 6, investindo: null, indice };
}

function erguerEscudo(e: EstadoChefao) {
  const n = e.herois.length;
  const max = Math.round(22 * (1 + 0.35 * (n - 1)));
  e.pilares = [{ x: 4, y: 4 }, { x: LARGURA - 4, y: 4 }, { x: LARGURA / 2, y: ALTURA - 2.5 }].map(p => ({ ...p, vida: max, max }));
}
export const escudo = (e: EstadoChefao) => e.pilares.some(p => p.vida > 0);

// ---------------------------------------------------------------- ataques

function ataqueDoChefe(e: EstadoChefao) {
  const c = e.chefe, r = e.sorteio;
  const vivos = e.herois.filter(h => !h.caido);
  if (!vivos.length) return;
  const alvo = vivos[Math.floor(r() * vivos.length)];
  // Aviso mais curto a cada fase e a cada chefe do Boss Rush.
  const aviso = Math.round((80 - c.fase * 8) * (1 - 0.08 * c.indice));
  const pesos: Record<TipoChefe, [TipoPerigo | "rajada", number][]> = {
    golem: [["martelo", 4], ["investida", 3], ["anel", 2], ["rajada", 1], ["raio", 1]],
    hidra: [["rajada", 4], ["martelo", 2], ["anel", 2], ["raio", 2], ["investida", 1]],
    maquina: [["raio", 4], ["rajada", 2], ["martelo", 2], ["anel", 2], ["investida", 1]],
  };
  const lista = pesos[c.tipo].filter(([t]) => c.fase >= 2 || (t !== "anel" && t !== "investida") || c.tipo === "golem" && t === "investida");
  const total = lista.reduce((s, [, p]) => s + p, 0);
  let sorteado = r() * total, tipo: TipoPerigo | "rajada" = lista[0][0];
  for (const [t, p] of lista) { sorteado -= p; if (sorteado <= 0) { tipo = t; break; } }
  const p0 = e.passo + aviso;
  if (tipo === "martelo") {
    // Um martelo por alvo (mais na fase 3).
    const qtd = Math.min(vivos.length, c.fase === 3 ? 3 : c.fase === 2 ? 2 : 1);
    for (let k = 0; k < qtd; k++) {
      const h = vivos[(e.passo + k) % vivos.length];
      e.perigos.push({ tipo: "martelo", x: h.x, y: h.y, r: 2.2, ang: 0, largura: 0, dispara: p0, fim: p0 + 6, brecha: 0 });
    }
  } else if (tipo === "raio") {
    const a = Math.atan2(alvo.y - c.y, alvo.x - c.x);
    const raios = c.fase === 3 ? [a - 0.5, a, a + 0.5] : c.fase === 2 ? [a - 0.25, a + 0.25] : [a];
    for (const ra of raios) e.perigos.push({ tipo: "raio", x: c.x, y: c.y, r: 40, ang: ra, largura: 1, dispara: p0, fim: p0 + 36, brecha: 0 });
  } else if (tipo === "anel") {
    e.perigos.push({ tipo: "anel", x: c.x, y: c.y, r: 0, ang: r() * Math.PI * 2, largura: 0.5, dispara: p0, fim: p0 + 190, brecha: 1 - c.fase * 0.1 });
  } else if (tipo === "investida") {
    const a = Math.atan2(alvo.y - c.y, alvo.x - c.x);
    e.perigos.push({ tipo: "investida", x: c.x, y: c.y, r: 14, ang: a, largura: RAIO_CHEFE * 2, dispara: p0, fim: p0 + 40, brecha: 0 });
  } else {
    // Rajada: balas em leque (espiral na fase 3), sem aviso no chão, mas lentas.
    const nb = 10 + c.fase * 4;
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * Math.PI * 2 + e.passo * 0.01;
      const v = 0.12 + c.fase * 0.02;
      e.balas.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, inimiga: true, dono: -1 });
    }
  }
  e.eventos.push({ tipo: "aviso", perigo: tipo === "rajada" ? "martelo" : tipo });
  c.proximoAtaque = e.passo + Math.round((150 - c.fase * 25) * (1 - 0.1 * c.indice) / (1 + 0.04 * (e.herois.length - 1)));
}

/** O ponto está dentro da área do perigo (para quem não esquivou). */
export function atinge(p: Perigo, passo: number, x: number, y: number): boolean {
  if (p.tipo === "martelo") return Math.hypot(x - p.x, y - p.y) < p.r;
  if (p.tipo === "raio" || p.tipo === "investida") {
    const dx = x - p.x, dy = y - p.y;
    const ao = dx * Math.cos(p.ang) + dy * Math.sin(p.ang), lado = -dx * Math.sin(p.ang) + dy * Math.cos(p.ang);
    return ao > 0 && ao < p.r && Math.abs(lado) < p.largura / 2;
  }
  // Anel: cresce do chefe; passa quem está na brecha.
  const raio = (passo - p.dispara) * VEL_ANEL;
  const d = Math.hypot(x - p.x, y - p.y);
  if (Math.abs(d - raio) > p.largura) return false;
  return Math.abs(ang(Math.atan2(y - p.y, x - p.x) - p.ang)) > p.brecha;
}

function ferir(e: EstadoChefao, h: Heroi, de: TipoPerigo | "bala" | "lacaio" | "corpo") {
  if (h.caido || e.passo < h.invulneravelAte) return;
  h.coracoes--;
  h.invulneravelAte = e.passo + 90;
  e.eventos.push({ tipo: "golpe", perigo: de, jogador: h.id });
  if (h.coracoes > 0) return;
  h.caido = true; h.levantar = 0;
  if (e.modo === "competitivo") { h.voltaEm = e.passo + VOLTA_COMPETITIVO; h.pontos = Math.max(0, h.pontos - 25); }
  else if (e.herois.length === 1) h.voltaEm = e.passo + LEVANTAR;
  e.eventos.push({ tipo: "caiu", jogador: h.id });
}

// ---------------------------------------------------------------- bots

/** Quanto perigo há no ponto (x, y) daqui a `adiante` passos: áreas que vão disparar, balas chegando e lacaios. */
function risco(e: EstadoChefao, x: number, y: number, adiante: number): number {
  let r = 0;
  const t = e.passo + adiante;
  for (const p of e.perigos) {
    if (p.fim < e.passo || p.dispara > e.passo + adiante + 25) continue;
    const quando = Math.max(t, p.dispara);
    if (p.tipo === "investida") { if (atinge({ ...p, largura: p.largura + 1.2 }, quando, x, y)) r += 3; continue; }
    if (p.tipo === "anel") {
      // Quando o anel chega aqui? Só conta se chegar dentro da janela (a brecha salva).
      const d = Math.hypot(x - p.x, y - p.y), chega = p.dispara + d / VEL_ANEL;
      if (Math.abs(ang(Math.atan2(y - p.y, x - p.x) - p.ang)) > p.brecha * 0.85 && chega >= e.passo - 2 && chega <= t + 4) r += 3;
      continue;
    }
    if (atinge({ ...p, r: p.tipo === "martelo" ? p.r + 0.6 : p.r, largura: p.largura + 0.9 }, quando, x, y)) r += 3;
  }
  for (const b of e.balas) {
    if (!b.inimiga) continue;
    const bx = b.x + b.vx * adiante, by = b.y + b.vy * adiante;
    const d = Math.hypot(bx - x, by - y);
    if (d < 1.2) r += 2 - d;
  }
  for (const l of e.lacaios) { const d = Math.hypot(l.x - x, l.y - y); if (d < 2.5) r += (2.5 - d) * 0.8; }
  const dc = Math.hypot(e.chefe.x - x, e.chefe.y - y);
  if (dc < RAIO_CHEFE + 2) r += 1;
  if (x < 1 || y < 1 || x > LARGURA - 1 || y > ALTURA - 1) r += 0.5;
  return r;
}

export function decisaoDoBot(e: EstadoChefao, h: Heroi): Entrada {
  const nivel = h.bot ?? "medio";
  const c = e.chefe;
  const a = e.sorteio() < (nivel === "facil" ? 0.6 : 0.95);
  // Para onde quer ir: levantar aliado, perto do pilar (com escudo) ou orbitando o chefe.
  let tx: number, ty: number;
  const caido = e.modo !== "competitivo" ? e.herois.filter(o => o.caido && o !== h && !o.voltaEm).sort((x, y) => dist(x, h) - dist(y, h))[0] : undefined;
  if (caido && dist(caido, h) < 14) { tx = caido.x; ty = caido.y; }
  else {
    const pilar = e.pilares.filter(p => p.vida > 0).sort((x, y) => dist(x, h) - dist(y, h))[0];
    const ref = pilar ?? c, ideal = pilar ? 5 : 8;
    const orbita = Math.atan2(h.y - ref.y, h.x - ref.x) + (h.id % 2 ? 0.35 : -0.35);
    tx = Math.max(1.5, Math.min(LARGURA - 1.5, ref.x + Math.cos(orbita) * ideal));
    ty = Math.max(1.5, Math.min(ALTURA - 1.5, ref.y + Math.sin(orbita) * ideal));
  }
  // Fácil enxerga o perigo mais tarde.
  const olho = nivel === "facil" ? 6 : nivel === "medio" ? 14 : 20;
  const agora = risco(e, h.x, h.y, Math.min(olho, 12));
  const opcoes: (Direcao | null)[] = [null, "cima", "baixo", "esquerda", "direita"];
  let melhor: Direcao | null = null, nota = Infinity;
  for (const d of opcoes) {
    const [dx, dy] = d ? DIRS[d] : [0, 0];
    const x = Math.max(RAIO, Math.min(LARGURA - RAIO, h.x + dx * VEL * olho)), y = Math.max(RAIO, Math.min(ALTURA - RAIO, h.y + dy * VEL * olho));
    const v = risco(e, x, y, olho) * 10 + Math.hypot(tx - x, ty - y) * 0.15 + (d === null ? 0.05 : 0);
    if (v < nota) { nota = v; melhor = d; }
  }
  if (melhor === null && Math.hypot(tx - h.x, ty - h.y) > 0.6 && agora === 0) melhor = dirDe(tx - h.x, ty - h.y);
  // Esquiva: ainda em perigo logo à frente e sem saída andando.
  const iminente = risco(e, h.x, h.y, 4) > 0;
  const b = iminente && nota >= 10 && h.recargaEsquiva <= 0 && e.sorteio() < (nivel === "facil" ? 0.2 : nivel === "medio" ? 0.6 : 0.95);
  return { direcao: melhor, a, b };
}
const dirDe = (dx: number, dy: number): Direcao => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "direita" : "esquerda") : dy > 0 ? "baixo" : "cima");

// ---------------------------------------------------------------- passo

function alvoDoTiro(e: EstadoChefao, h: Heroi): { x: number; y: number } {
  const colado = e.lacaios.filter(l => dist(l, h) < 4).sort((a, b) => dist(a, h) - dist(b, h))[0];
  if (colado) return colado;
  const pilar = e.pilares.filter(p => p.vida > 0).sort((a, b) => dist(a, h) - dist(b, h))[0];
  if (pilar) return pilar;
  const lacaio = e.lacaios.filter(l => dist(l, h) < 7).sort((a, b) => dist(a, h) - dist(b, h))[0];
  return lacaio ?? e.chefe;
}

export function passoChefao(e: EstadoChefao, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  const c = e.chefe;
  // Heróis.
  for (const h of e.herois) {
    if (h.caido) {
      if (h.voltaEm && e.passo >= h.voltaEm) {
        if (e.herois.length === 1) { h.vidas--; if (h.vidas <= 0) continue; }
        Object.assign(h, { caido: false, coracoes: CORACOES, voltaEm: 0, invulneravelAte: e.passo + 120, x: LARGURA / 2, y: ALTURA - 2 });
        e.eventos.push({ tipo: "levantou", jogador: h.id });
      }
      continue;
    }
    const ent = h.bot ? decisaoDoBot(e, h) : entradas[h.id] ?? { direcao: null, a: false, b: false };
    h.recarga = Math.max(0, h.recarga - 1);
    h.recargaEsquiva = Math.max(0, h.recargaEsquiva - 1);
    if (ent.direcao) h.dir = ent.direcao;
    if (ent.b && !h.bAnterior && h.recargaEsquiva <= 0) {
      const [dx, dy] = DIRS[h.dir];
      h.dashX = dx; h.dashY = dy; h.esquivaAte = e.passo + ESQUIVA; h.invulneravelAte = Math.max(h.invulneravelAte, e.passo + INVULNERAVEL); h.recargaEsquiva = RECARGA_ESQUIVA;
      e.eventos.push({ tipo: "esquiva", jogador: h.id });
    }
    h.bAnterior = ent.b;
    let vx = 0, vy = 0;
    if (e.passo < h.esquivaAte) { vx = h.dashX * 0.4; vy = h.dashY * 0.4; }
    else if (ent.direcao) { const [dx, dy] = DIRS[ent.direcao]; vx = dx * VEL; vy = dy * VEL; }
    h.x = Math.max(RAIO, Math.min(LARGURA - RAIO, h.x + vx));
    h.y = Math.max(RAIO, Math.min(ALTURA - RAIO, h.y + vy));
    // Não entra no chefe.
    const dc = dist(h, c);
    if (dc < RAIO_CHEFE + RAIO) { h.x = c.x + (h.x - c.x) / dc * (RAIO_CHEFE + RAIO); h.y = c.y + (h.y - c.y) / dc * (RAIO_CHEFE + RAIO); }
    if (ent.a && h.recarga <= 0) {
      const alvo = alvoDoTiro(e, h);
      const a = Math.atan2(alvo.y - h.y, alvo.x - h.x);
      e.balas.push({ x: h.x, y: h.y, vx: Math.cos(a) * VEL_TIRO, vy: Math.sin(a) * VEL_TIRO, inimiga: false, dono: h.id });
      h.recarga = CADENCIA;
      if (e.passo % 3 === 0) e.eventos.push({ tipo: "tiro", jogador: h.id });
    }
  }
  // Levantar aliados (cooperativo e Boss Rush).
  if (e.modo !== "competitivo" && e.herois.length > 1) for (const h of e.herois) {
    if (!h.caido) continue;
    const ajuda = e.herois.some(o => !o.caido && dist(o, h) < 1.6);
    h.levantar = ajuda ? h.levantar + 1 : Math.max(0, h.levantar - 2);
    if (h.levantar >= LEVANTAR) { Object.assign(h, { caido: false, coracoes: 2, levantar: 0, invulneravelAte: e.passo + 90 }); e.eventos.push({ tipo: "levantou", jogador: h.id }); }
  }
  // Chefe: anda devagar, ataca, investe.
  if (c.investindo) {
    c.x = Math.max(RAIO_CHEFE, Math.min(LARGURA - RAIO_CHEFE, c.x + c.investindo.vx));
    c.y = Math.max(RAIO_CHEFE, Math.min(ALTURA - RAIO_CHEFE, c.y + c.investindo.vy));
    if (e.passo >= c.investindo.ate) c.investindo = null;
  } else {
    if (e.passo % 240 === 0) { c.alvoX = 8 + e.sorteio() * (LARGURA - 16); c.alvoY = 4 + e.sorteio() * 6; }
    c.x += Math.sign(c.alvoX - c.x) * Math.min(0.03, Math.abs(c.alvoX - c.x));
    c.y += Math.sign(c.alvoY - c.y) * Math.min(0.03, Math.abs(c.alvoY - c.y));
  }
  if (e.passo >= c.proximoAtaque && !c.investindo) ataqueDoChefe(e);
  // Perigos: dano na janela e a investida empurra o chefe.
  for (const p of e.perigos) {
    if (e.passo === p.dispara && p.tipo === "investida") c.investindo = { ate: p.fim, vx: Math.cos(p.ang) * (p.r / (p.fim - p.dispara)), vy: Math.sin(p.ang) * (p.r / (p.fim - p.dispara)) };
    if (e.passo < p.dispara || e.passo > p.fim) continue;
    for (const h of e.herois) {
      if (h.caido) continue;
      const pega = p.tipo === "investida" ? dist(h, c) < RAIO_CHEFE + RAIO + 0.2 : atinge(p, e.passo, h.x, h.y);
      if (pega) ferir(e, h, p.tipo);
    }
  }
  e.perigos = e.perigos.filter(p => e.passo <= p.fim);
  // Balas.
  for (const b of e.balas) { b.x += b.vx; b.y += b.vy; }
  e.balas = e.balas.filter(b => {
    if (b.x < -1 || b.y < -1 || b.x > LARGURA + 1 || b.y > ALTURA + 1) return false;
    if (b.inimiga) {
      const h = e.herois.find(x => !x.caido && Math.hypot(x.x - b.x, x.y - b.y) < RAIO + 0.2);
      if (h) { if (e.passo >= h.invulneravelAte) { ferir(e, h, "bala"); return false; } }
      return true;
    }
    const dono = e.herois[b.dono];
    for (const p of e.pilares) if (p.vida > 0 && Math.hypot(p.x - b.x, p.y - b.y) < RAIO_PILAR) {
      p.vida--; dono.pontos += 1;
      if (p.vida <= 0) { dono.pontos += 20; e.eventos.push({ tipo: "pilar", x: p.x, y: p.y }); }
      return false;
    }
    for (const l of e.lacaios) if (l.vida > 0 && Math.hypot(l.x - b.x, l.y - b.y) < 0.6) { l.vida--; if (l.vida <= 0) dono.pontos += 5; return false; }
    if (Math.hypot(c.x - b.x, c.y - b.y) < RAIO_CHEFE) {
      const protegido = escudo(e);
      if (!protegido) { c.vida--; dono.dano++; dono.pontos++; }
      e.eventos.push({ tipo: "acertou", x: b.x, y: b.y, escudo: protegido });
      return false;
    }
    return true;
  });
  // Lacaios (fase 3): perseguem o herói mais perto.
  if (c.fase === 3 && e.passo % 300 === 0 && e.lacaios.filter(l => l.vida > 0).length < 2 + e.herois.length) {
    for (let k = 0; k < 2; k++) e.lacaios.push({ x: c.x + (k ? 2 : -2), y: c.y + 2, vida: 4 });
  }
  for (const l of e.lacaios) {
    if (l.vida <= 0) continue;
    const h = e.herois.filter(x => !x.caido).sort((a, b) => dist(a, l) - dist(b, l))[0];
    if (!h) continue;
    const d = dist(h, l);
    l.x += (h.x - l.x) / d * 0.06; l.y += (h.y - l.y) / d * 0.06;
    if (d < 0.8) ferir(e, h, "lacaio");
  }
  e.lacaios = e.lacaios.filter(l => l.vida > 0);
  // Fases e derrota do chefe.
  const fase = c.vida <= c.max / 3 ? 3 : c.vida <= (c.max * 2) / 3 ? 2 : 1;
  if (fase > c.fase && c.vida > 0) { c.fase = fase; erguerEscudo(e); c.proximoAtaque = e.passo + 90; e.eventos.push({ tipo: "fase", fase }); }
  if (c.vida <= 0) {
    e.derrotados++;
    const proximo = e.modo === "rush" && e.derrotados < 3 ? ORDEM[(ORDEM.indexOf(c.tipo) + 1) % 3] : null;
    e.eventos.push({ tipo: "derrotado", chefe: c.tipo, proximo });
    if (proximo) {
      e.chefe = novoChefe(proximo, e.herois.length, e.derrotados);
      e.perigos = []; e.balas = []; e.lacaios = [];
      erguerEscudo(e);
      for (const h of e.herois) Object.assign(h, { caido: false, coracoes: CORACOES, levantar: 0, voltaEm: 0 });
    } else return terminar(e, true);
  }
  // Derrota: todos caídos ao mesmo tempo (sozinho: sem vidas); ou o tempo.
  const todosCaidos = e.herois.every(h => h.caido) && e.modo !== "competitivo";
  const solo = e.herois.length === 1;
  if ((todosCaidos && !solo) || (solo && e.herois[0].vidas <= 0 && e.herois[0].caido) || e.passo >= TEMPO) terminar(e, false);
}

function terminar(e: EstadoChefao, venceram: boolean) {
  e.terminado = true;
  e.venceram = venceram;
  const melhor = e.herois.slice().sort((a, b) => b.pontos - a.pontos)[0];
  e.vencedor = venceram ? melhor.id : null;
  e.eventos.push({ tipo: "fim" });
}

export const pontosChefao = (e: EstadoChefao) => e.herois.map(h => h.pontos);
