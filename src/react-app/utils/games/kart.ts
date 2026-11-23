/**
 * Kart Turbo & Balões: regras puras (60 passos por segundo), de 1 a 8 pilotos. A física é no plano (x, z); o motor
 * desenha em 3D.
 *
 * - O kart acelera sozinho; ←/→ vira e ↓ freia. Segurar A numa curva faz drift, que carrega o turbo em três níveis
 *   (azul, laranja e roxo); soltar dispara o turbo. Fora da pista o kart fica lento.
 * - Caixas de item na pista dão míssil (persegue quem está à frente), escudo, óleo (deixado para trás) ou turbo. B usa.
 *   Quem está atrás ganha itens melhores.
 * - Grande Prêmio: 3 voltas; a ordem de chegada dá os pontos. Sozinho: contra o relógio.
 * - Arena de Balões: cada kart tem 3 balões; míssil, óleo ou batida de quem está no turbo estoura um. Fica quem tiver
 *   balão; sozinho, estoure os 10 balões-alvo em 90 s.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export type ModoKart = "gp" | "baloes";
export type PistaKart = "verde" | "deserto" | "neon";
export type ItemKart = "missil" | "escudo" | "oleo" | "turbo";

export const VOLTAS = 3;
export const LARGURA_PISTA = 9;
export const RAIO_ARENA = 28;
export const VEL_MAX = 0.32;
export const BALOES = 3;
export const TEMPO_ARENA = 180 * 60;
export const TEMPO_SOLO_ARENA = 90 * 60;
export const ALVOS_SOLO = 10;
const RAIO_KART = 0.9;
const NIVEIS_DRIFT = [0, 40, 90, 150];
const TURBO_DO_NIVEL = [0, 30, 55, 80];
const PONTOS_POSICAO = [10, 8, 6, 5, 4, 3, 2, 1];

const PONTOS_DA_PISTA: Record<PistaKart, [number, number][]> = {
  verde: [[-30, 0], [-26, -17], [-6, -22], [16, -21], [31, -10], [30, 8], [16, 20], [-4, 14], [-14, 21], [-28, 15]],
  deserto: [[-30, -15], [-5, -24], [20, -20], [32, -4], [22, 8], [30, 20], [8, 24], [-10, 14], [-28, 20], [-36, 4]],
  neon: [[-34, -6], [-26, -20], [-8, -18], [0, -6], [10, -20], [28, -18], [34, 0], [24, 18], [4, 20], [-6, 8], [-18, 20], [-32, 14]],
};

export interface Ponto { x: number; z: number }
export interface Pista { pontos: Ponto[]; tangentes: number[]; comprimento: number }

/** Linha central da pista: spline Catmull-Rom fechada, reamostrada em passos de ~1 unidade. */
export function montarPista(nome: PistaKart): Pista {
  // Os pontos de controle estão em escala 1:2 (a pista real tem o dobro do tamanho).
  const c = PONTOS_DA_PISTA[nome].map(([x, z]) => [x * 2, z * 2] as [number, number]);
  const bruto: Ponto[] = [];
  for (let i = 0; i < c.length; i++) {
    const p0 = c[(i - 1 + c.length) % c.length], p1 = c[i], p2 = c[(i + 1) % c.length], p3 = c[(i + 2) % c.length];
    for (let k = 0; k < 40; k++) {
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, d: number, e: number) => 0.5 * (2 * b + (-a + d) * t + (2 * a - 5 * b + 4 * d - e) * t2 + (-a + 3 * b - 3 * d + e) * t3);
      bruto.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  let total = 0;
  const acumulado = [0];
  for (let i = 1; i <= bruto.length; i++) { total += dist(bruto[i - 1], bruto[i % bruto.length]); acumulado.push(total); }
  const n = Math.round(total);
  const pontos: Ponto[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const alvo = (k / n) * total;
    while (acumulado[j + 1] < alvo) j++;
    const a = bruto[j], b = bruto[(j + 1) % bruto.length], t = (alvo - acumulado[j]) / Math.max(1e-6, acumulado[j + 1] - acumulado[j]);
    pontos.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  const tangentes = pontos.map((p, i) => { const q = pontos[(i + 1) % n]; return Math.atan2(q.z - p.z, q.x - p.x); });
  return { pontos, tangentes, comprimento: total };
}

export interface Kart {
  id: number;
  bot: Dificuldade | null;
  x: number; z: number; ang: number; vel: number;
  drift: -1 | 0 | 1; carga: number;
  turboAte: number; giroAte: number; escudoAte: number; invulAte: number;
  item: ItemKart | null; usarAnterior: boolean;
  idx: number; volta: number; meio: boolean;
  posicao: number | null; tempo: number | null;
  baloes: number; fora: boolean; estouros: number;
}
export interface Caixa { x: number; z: number; voltaEm: number }
export interface Missil { x: number; z: number; ang: number; dono: number; vida: number }
export interface Oleo { x: number; z: number; ate: number; dono: number }

export type EventoKart =
  | { tipo: "volta"; jogador: number; volta: number }
  | { tipo: "chegou"; jogador: number; posicao: number }
  | { tipo: "caixa"; jogador: number; item: ItemKart }
  | { tipo: "usou"; jogador: number; item: ItemKart }
  | { tipo: "turbo"; jogador: number; nivel: number }
  | { tipo: "giro"; jogador: number; x: number; z: number }
  | { tipo: "escudo"; jogador: number }
  | { tipo: "balao"; jogador: number; restam: number; x: number; z: number }
  | { tipo: "fora"; jogador: number }
  | { tipo: "alvo"; x: number; z: number }
  | { tipo: "batida"; x: number; z: number }
  | { tipo: "fim" };

export interface EstadoKart {
  modo: ModoKart;
  pista: PistaKart;
  karts: Kart[];
  caixas: Caixa[];
  misseis: Missil[];
  oleos: Oleo[];
  alvos: Ponto[];
  chegados: number;
  fimEm: number | null;
  meta: number;
  passo: number;
  sorteio: () => number;
  eventos: EventoKart[];
  terminado: boolean;
  vencedor: number | null;
}

const dist = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.z - b.z);
const angulo = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const cache = new Map<PistaKart, Pista>();
export const pistaDe = (p: PistaKart) => { let t = cache.get(p); if (!t) { t = montarPista(p); cache.set(p, t); } return t; };

export function novaPartidaKart(o: { modo: ModoKart; pista: PistaKart; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoKart {
  const sorteio = rng(o.semente);
  const n = o.jogadores.length;
  const P = pistaDe(o.pista);
  const N = P.pontos.length;
  const karts: Kart[] = o.jogadores.map((j, i) => {
    let x: number, z: number, ang: number, idx: number;
    if (o.modo === "gp") {
      // Grid de largada atrás da linha, em duas colunas.
      idx = (N - 3 - Math.floor(i / 2) * 3 + N) % N;
      const p = P.pontos[idx], t = P.tangentes[idx], lado = i % 2 ? 1.8 : -1.8;
      x = p.x - Math.sin(t) * lado; z = p.z + Math.cos(t) * lado; ang = t;
    } else {
      const a = (i / n) * Math.PI * 2;
      x = Math.cos(a) * RAIO_ARENA * 0.7; z = Math.sin(a) * RAIO_ARENA * 0.7; ang = a + Math.PI; idx = 0;
    }
    return {
      id: i, bot: j.bot, x, z, ang, vel: 0, drift: 0, carga: 0, turboAte: 0, giroAte: 0, escudoAte: 0, invulAte: 0,
      item: null, usarAnterior: false, idx, volta: 0, meio: false, posicao: null, tempo: null, baloes: BALOES, fora: false, estouros: 0,
    };
  });
  const caixas: Caixa[] = [];
  if (o.modo === "gp") {
    for (const f of [0.22, 0.55, 0.82]) {
      const k = Math.floor(f * N), p = P.pontos[k], t = P.tangentes[k];
      for (const lado of [-2.7, -0.9, 0.9, 2.7]) caixas.push({ x: p.x - Math.sin(t) * lado, z: p.z + Math.cos(t) * lado, voltaEm: 0 });
    }
  } else {
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.4; caixas.push({ x: Math.cos(a) * 14, z: Math.sin(a) * 14, voltaEm: 0 }); }
  }
  const alvos: Ponto[] = [];
  if (o.modo === "baloes" && n === 1) {
    for (let k = 0; k < ALVOS_SOLO; k++) { const a = sorteio() * Math.PI * 2, r = 6 + sorteio() * (RAIO_ARENA - 9); alvos.push({ x: Math.cos(a) * r, z: Math.sin(a) * r }); }
  }
  // Meta do contra-relógio: 3 voltas a 82% da velocidade máxima.
  const meta = o.modo === "gp" ? Math.round((VOLTAS * P.comprimento) / (VEL_MAX * 0.82)) : n === 1 ? TEMPO_SOLO_ARENA : TEMPO_ARENA;
  return { modo: o.modo, pista: o.pista, karts, caixas, misseis: [], oleos: [], alvos, chegados: 0, fimEm: null, meta, passo: 0, sorteio, eventos: [], terminado: false, vencedor: null };
}

/** Progresso na corrida (voltas completas mais o trecho), para a ordem e para o míssil achar quem está à frente. */
export const progresso = (e: EstadoKart, k: Kart) => k.volta * pistaDe(e.pista).pontos.length + k.idx;

/** Posição atual de cada kart (1 = primeiro): quem chegou pela ordem de chegada, o resto pelo progresso. */
export function classificacao(e: EstadoKart): number[] {
  const ordem = e.karts.slice().sort((a, b) => {
    if (a.posicao !== null || b.posicao !== null) return (a.posicao ?? 99) - (b.posicao ?? 99);
    if (e.modo === "baloes") return b.baloes - a.baloes || b.estouros - a.estouros;
    return progresso(e, b) - progresso(e, a);
  });
  const pos = e.karts.map(() => 0);
  ordem.forEach((k, i) => { pos[k.id] = i + 1; });
  return pos;
}

/** Distância à linha central da pista (para saber se está na grama). */
function atualizarIndice(e: EstadoKart, k: Kart): number {
  const P = pistaDe(e.pista), N = P.pontos.length;
  let melhor = k.idx, md = Infinity;
  for (let d = -12; d <= 12; d++) {
    const i = (k.idx + d + N) % N, dd = dist(k, P.pontos[i]);
    if (dd < md) { md = dd; melhor = i; }
  }
  // Muito longe do trecho esperado (ex.: reposicionado): procura na pista inteira.
  if (md > LARGURA_PISTA * 2) for (let i = 0; i < N; i++) { const dd = dist(k, P.pontos[i]); if (dd < md) { md = dd; melhor = i; } }
  const antes = k.idx;
  k.idx = melhor;
  if (melhor > N * 0.4 && melhor < N * 0.6) k.meio = true;
  // Cruzou a linha (índice voltou do fim para o começo) depois de passar pela metade: conta a volta.
  if (antes > N * 0.85 && melhor < N * 0.15 && k.meio) {
    k.volta++; k.meio = false;
    e.eventos.push({ tipo: "volta", jogador: k.id, volta: k.volta });
    if (k.volta >= VOLTAS && k.posicao === null) {
      k.posicao = ++e.chegados; k.tempo = e.passo;
      e.eventos.push({ tipo: "chegou", jogador: k.id, posicao: k.posicao });
      if (e.fimEm === null) e.fimEm = e.passo + 15 * 60;
    }
  } else if (antes < N * 0.15 && melhor > N * 0.85 && k.volta > 0 && !k.meio) {
    k.volta--; k.meio = true;
  }
  return md;
}

function sortearItem(e: EstadoKart, k: Kart): ItemKart {
  const r = e.sorteio();
  if (e.modo === "baloes") return r < 0.5 ? "missil" : r < 0.75 ? "escudo" : "oleo";
  const pos = classificacao(e)[k.id], f = e.karts.length > 1 ? (pos - 1) / (e.karts.length - 1) : 0.5;
  const pTurbo = 0.05 + 0.35 * f, pMissil = 0.2 + 0.2 * f, pEscudo = 0.3 - 0.1 * f;
  return r < pTurbo ? "turbo" : r < pTurbo + pMissil ? "missil" : r < pTurbo + pMissil + pEscudo ? "escudo" : "oleo";
}

/** Atingido (míssil, óleo ou batida no turbo): o escudo segura; sem escudo, roda e, na arena, perde um balão. */
function atingir(e: EstadoKart, k: Kart, giro: number) {
  if (k.fora || e.passo < k.invulAte) return;
  if (e.passo < k.escudoAte) { k.escudoAte = 0; k.invulAte = e.passo + 30; e.eventos.push({ tipo: "escudo", jogador: k.id }); return; }
  k.giroAte = e.passo + giro; k.vel = 0; k.drift = 0; k.carga = 0; k.invulAte = e.passo + (e.modo === "baloes" ? 150 : 90);
  e.eventos.push({ tipo: "giro", jogador: k.id, x: k.x, z: k.z });
  if (e.modo === "baloes") {
    k.baloes--;
    e.eventos.push({ tipo: "balao", jogador: k.id, restam: k.baloes, x: k.x, z: k.z });
    if (k.baloes <= 0) { k.fora = true; e.eventos.push({ tipo: "fora", jogador: k.id }); }
  }
}

function usarItem(e: EstadoKart, k: Kart) {
  const it = k.item;
  if (!it) return;
  k.item = null;
  e.eventos.push({ tipo: "usou", jogador: k.id, item: it });
  if (it === "turbo") k.turboAte = e.passo + 75;
  else if (it === "escudo") k.escudoAte = e.passo + 8 * 60;
  else if (it === "oleo") e.oleos.push({ x: k.x - Math.cos(k.ang) * 2.2, z: k.z - Math.sin(k.ang) * 2.2, ate: e.passo + 20 * 60, dono: k.id });
  else e.misseis.push({ x: k.x + Math.cos(k.ang) * 1.4, z: k.z + Math.sin(k.ang) * 1.4, ang: k.ang, dono: k.id, vida: 360 });
}

/** O míssil persegue: na corrida, o kart logo à frente de quem atirou; na arena, o mais perto. */
function alvoDoMissil(e: EstadoKart, m: Missil): Kart | null {
  const dono = e.karts[m.dono];
  const vivos = e.karts.filter(k => k.id !== m.dono && !k.fora && k.posicao === null);
  if (!vivos.length) return null;
  if (e.modo === "baloes") return vivos.reduce((a, b) => (dist(m, a) < dist(m, b) ? a : b));
  const meu = progresso(e, dono);
  const frente = vivos.filter(k => progresso(e, k) > meu).sort((a, b) => progresso(e, a) - progresso(e, b))[0];
  return frente ?? vivos.reduce((a, b) => (dist(m, a) < dist(m, b) ? a : b));
}

// ---------------------------------------------------------------- bots

const ERRO_BOT: Record<Dificuldade, number> = { facil: 0.35, medio: 0.15, dificil: 0.04 };

export function decisaoDoBot(e: EstadoKart, k: Kart): Entrada {
  const nivel = k.bot ?? "medio";
  let alvo: Ponto;
  if (e.modo === "gp") {
    const P = pistaDe(e.pista);
    alvo = P.pontos[(k.idx + 7) % P.pontos.length];
  } else if (e.alvos.length) {
    alvo = e.alvos.reduce((a, b) => (dist(k, a) < dist(k, b) ? a : b));
  } else {
    const outros = e.karts.filter(o => o.id !== k.id && !o.fora);
    const caixa = e.caixas.filter(c => e.passo >= c.voltaEm).sort((a, b) => dist(k, a) - dist(k, b))[0];
    alvo = !k.item && caixa ? caixa : outros.length ? outros.reduce((a, b) => (dist(k, a) < dist(k, b) ? a : b)) : { x: 0, z: 0 };
  }
  const desejado = Math.atan2(alvo.z - k.z, alvo.x - k.x) + (e.sorteio() - 0.5) * ERRO_BOT[nivel];
  const dif = angulo(desejado - k.ang);
  const direcao: Direcao | null = dif > 0.06 ? "direita" : dif < -0.06 ? "esquerda" : null;
  // Drift nas curvas fechadas (o Difícil segura até o laranja).
  const a = nivel !== "facil" && Math.abs(dif) > 0.35 && k.vel > VEL_MAX * 0.7 && (k.drift !== 0 || Math.abs(dif) > 0.5);
  let b = false;
  if (k.item) {
    if (k.item === "turbo" || k.item === "escudo") b = true;
    else if (k.item === "missil") b = e.karts.some(o => o.id !== k.id && !o.fora && dist(o, k) < 25 && Math.abs(angulo(Math.atan2(o.z - k.z, o.x - k.x) - k.ang)) < 0.6);
    else b = e.karts.some(o => o.id !== k.id && dist(o, k) < 8 && Math.abs(angulo(Math.atan2(o.z - k.z, o.x - k.x) - k.ang)) > 2.4);
    b = b && e.sorteio() < 0.2;
  }
  return { direcao, a, b };
}

// ---------------------------------------------------------------- passo

function mover(e: EstadoKart, k: Kart, ent: Entrada) {
  if (k.fora) return;
  const girando = e.passo < k.giroAte;
  const turbo = e.passo < k.turboAte;
  const curva = girando ? 0 : ent.direcao === "esquerda" ? -1 : ent.direcao === "direita" ? 1 : 0;
  const freio = !girando && ent.direcao === "baixo";
  // Drift: segurar A numa curva com velocidade; soltar dispara o turbo do nível alcançado.
  if (!girando && ent.a && curva !== 0 && k.drift === 0 && k.vel > VEL_MAX * 0.6) k.drift = curva as -1 | 1;
  if (k.drift !== 0 && (!ent.a || girando)) {
    const nivel = NIVEIS_DRIFT.filter(l => k.carga >= l).length - 1;
    if (nivel > 0) { k.turboAte = Math.max(k.turboAte, e.passo + TURBO_DO_NIVEL[nivel]); e.eventos.push({ tipo: "turbo", jogador: k.id, nivel }); }
    k.drift = 0; k.carga = 0;
  }
  let fatorCurva = curva;
  if (k.drift !== 0) { k.carga++; fatorCurva = k.drift * (curva === k.drift ? 1.35 : curva === 0 ? 0.9 : 0.45); }
  k.ang = angulo(k.ang + fatorCurva * 0.042 * (0.35 + 0.65 * Math.min(1, k.vel / VEL_MAX)) + (girando ? 0.25 : 0));
  let alvoVel = VEL_MAX * (turbo ? 1.5 : 1);
  if (e.modo === "gp") {
    const longe = atualizarIndice(e, k);
    if (longe > LARGURA_PISTA / 2 && !turbo) alvoVel *= 0.55;
    // Muro invisível longe da pista: volta para dentro.
    if (longe > LARGURA_PISTA / 2 + 6) { const p = pistaDe(e.pista).pontos[k.idx]; k.x += (p.x - k.x) * 0.08; k.z += (p.z - k.z) * 0.08; k.vel *= 0.9; }
  }
  if (girando) k.vel *= 0.9;
  else if (freio) k.vel = Math.max(0, k.vel - 0.012);
  else k.vel += (alvoVel - k.vel) * (turbo ? 0.08 : 0.025);
  k.x += Math.cos(k.ang) * k.vel;
  k.z += Math.sin(k.ang) * k.vel;
  if (e.modo === "baloes") {
    const r = Math.hypot(k.x, k.z);
    if (r > RAIO_ARENA - RAIO_KART) { k.x *= (RAIO_ARENA - RAIO_KART) / r; k.z *= (RAIO_ARENA - RAIO_KART) / r; k.vel *= 0.5; k.ang = angulo(k.ang + Math.PI * 0.6); }
  }
  // Item: B usa (na borda), caixas e óleo.
  if (ent.b && !k.usarAnterior && !girando) usarItem(e, k);
  k.usarAnterior = ent.b;
  for (const c of e.caixas) {
    if (e.passo < c.voltaEm || dist(c, k) > 1.4) continue;
    c.voltaEm = e.passo + 180;
    if (!k.item) { k.item = sortearItem(e, k); e.eventos.push({ tipo: "caixa", jogador: k.id, item: k.item }); }
  }
  for (const o of e.oleos) if (o.ate > e.passo && dist(o, k) < 1.3) { o.ate = 0; atingir(e, k, 45); }
  for (let i = e.alvos.length - 1; i >= 0; i--) {
    if (dist(e.alvos[i], k) < 1.6) { e.eventos.push({ tipo: "alvo", x: e.alvos[i].x, z: e.alvos[i].z }); e.alvos.splice(i, 1); k.estouros++; }
  }
}

export function passoKart(e: EstadoKart, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  for (const k of e.karts) {
    // Quem já chegou segue andando (o bot dirige por ele), sem contar mais nada.
    const ent = k.bot || k.posicao !== null ? decisaoDoBot(e, k) : entradas[k.id] ?? { direcao: null, a: false, b: false };
    mover(e, k, ent);
  }
  // Batidas entre karts: se afastam; na arena, quem está no turbo estoura um balão de quem levou.
  for (let i = 0; i < e.karts.length; i++) for (let j = i + 1; j < e.karts.length; j++) {
    const a = e.karts[i], b = e.karts[j];
    if (a.fora || b.fora) continue;
    const d = dist(a, b);
    if (d > 0 && d < RAIO_KART * 2) {
      const f = (RAIO_KART * 2 - d) / 2 / d;
      a.x += (a.x - b.x) * f; a.z += (a.z - b.z) * f; b.x += (b.x - a.x) * f; b.z += (b.z - a.z) * f;
      if (e.passo % 6 === 0) e.eventos.push({ tipo: "batida", x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
      if (e.modo === "baloes") {
        if (e.passo < a.turboAte && e.passo >= b.turboAte) atingir(e, b, 40);
        else if (e.passo < b.turboAte && e.passo >= a.turboAte) atingir(e, a, 40);
      }
    }
  }
  for (const m of e.misseis) {
    const alvo = alvoDoMissil(e, m);
    const giro = e.modo === "baloes" ? 0.05 : 0.09;
    if (alvo) m.ang = m.ang + Math.max(-giro, Math.min(giro, angulo(Math.atan2(alvo.z - m.z, alvo.x - m.x) - m.ang)));
    m.x += Math.cos(m.ang) * 0.62; m.z += Math.sin(m.ang) * 0.62; m.vida--;
    const atingido = e.karts.find(k => k.id !== m.dono && !k.fora && dist(k, m) < 1.3);
    if (atingido) { atingir(e, atingido, 60); m.vida = 0; }
    if (e.modo === "baloes" && Math.hypot(m.x, m.z) > RAIO_ARENA) m.vida = 0;
    for (let i = e.alvos.length - 1; i >= 0 && m.vida > 0; i--) {
      if (dist(e.alvos[i], m) < 1.6) { e.eventos.push({ tipo: "alvo", x: e.alvos[i].x, z: e.alvos[i].z }); e.alvos.splice(i, 1); e.karts[m.dono].estouros++; m.vida = 0; }
    }
  }
  e.misseis = e.misseis.filter(m => m.vida > 0);
  e.oleos = e.oleos.filter(o => o.ate > e.passo);
  verificarFim(e);
}

function verificarFim(e: EstadoKart) {
  const humanos = e.karts.filter(k => !k.bot);
  if (e.modo === "gp") {
    const todosChegaram = e.karts.every(k => k.posicao !== null) || (humanos.length > 0 && humanos.every(k => k.posicao !== null));
    if (e.karts.length === 1) { if (e.karts[0].posicao !== null) return terminar(e, e.karts[0].tempo! <= e.meta ? 0 : null); if (e.passo > e.meta * 2) return terminar(e, null); return; }
    if (todosChegaram || (e.fimEm !== null && e.passo >= e.fimEm)) {
      const pos = classificacao(e);
      return terminar(e, pos.indexOf(1));
    }
    return;
  }
  if (e.karts.length === 1) {
    if (e.alvos.length === 0) return terminar(e, 0);
    if (e.passo >= e.meta) return terminar(e, null);
    return;
  }
  const vivos = e.karts.filter(k => !k.fora);
  if (vivos.length <= 1) return terminar(e, vivos.length ? vivos[0].id : null);
  if (e.passo >= e.meta) {
    const max = Math.max(...vivos.map(k => k.baloes));
    const lideres = vivos.filter(k => k.baloes === max);
    terminar(e, lideres.length === 1 ? lideres[0].id : null);
  }
}

function terminar(e: EstadoKart, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.eventos.push({ tipo: "fim" });
}

/** Pontos de cada um no fim: Grande Prêmio pela posição, arena pelos balões e estouros. */
export function pontosKart(e: EstadoKart): number[] {
  if (e.modo === "gp") {
    if (e.karts.length === 1) { const k = e.karts[0]; return [k.tempo !== null ? Math.max(0, 1000 + (e.meta - k.tempo) * 2) : 0]; }
    const pos = classificacao(e);
    return e.karts.map(k => PONTOS_POSICAO[pos[k.id] - 1] ?? 0);
  }
  return e.karts.map(k => k.baloes * 100 + k.estouros * 50);
}
