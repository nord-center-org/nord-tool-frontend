/**
 * Torres em Colapso: regras puras da artilharia por turnos (60 passos por segundo), de 1 a 8 jogadores.
 *
 * - Cada jogador tem uma torre de blocos (madeira 1, pedra 2, aço 3 de resistência) com o rei no topo.
 * - Na sua vez: ←/→ ajustam o ângulo, ↑/↓ a força e A dispara. O vento muda a cada vez e empurra o projétil.
 * - A explosão tira resistência dos blocos em volta; bloco sem apoio embaixo cai (a torre desaba aos poucos).
 * - Rei atingido (pela explosão ou por um bloco que cai em cima) está fora. O último rei de pé vence.
 * - B troca o projétil: bala (normal) ou bomba pesada (raio maior, menos alcance), uma por partida.
 * - Sozinho: derrubar 5 alvos em 12 tiros.
 */
import { rng, type Dificuldade, type Entrada } from "./bombas.ts";

export const LW = 48;
export const LH = 24;
const G = 0.006;
const TEMPO_VEZ = 25 * 60;
export const TIROS_SOLO = 12;
export const ALVOS_SOLO = 5;

export type ModoTorres = "batalha" | "alvos";
export type Material = 0 | 1 | 2 | 3;
export type Paisagem = "campo" | "deserto" | "neve";

export interface Rei { id: number; bot: Dificuldade | null; x: number; y: number; vivo: boolean; angulo: number; forca: number; bombas: number; arma: "bala" | "bomba"; acertos: number; pontos: number; aAnterior: boolean; bAnterior: boolean }
export interface Projetil { x: number; y: number; vx: number; vy: number; dono: number; arma: "bala" | "bomba"; idade: number }

export type EventoTorres =
  | { tipo: "vez"; jogador: number; vento: number }
  | { tipo: "disparo"; jogador: number }
  | { tipo: "explosao"; x: number; y: number; raio: number }
  | { tipo: "caiu"; n: number }
  | { tipo: "reiFora"; jogador: number; por: number }
  | { tipo: "alvo"; x: number; y: number }
  | { tipo: "fim"; vencedor: number | null };

export interface EstadoTorres {
  modo: ModoTorres;
  paisagem: Paisagem;
  /** Blocos: material por célula (0 = vazio), linha a linha (y de cima para baixo). */
  blocos: Material[];
  chao: number[];
  reis: Rei[];
  alvos: { x: number; y: number }[];
  vez: number;
  inicioVez: number;
  vento: number;
  projetil: Projetil | null;
  esperaAte: number;
  tiros: number;
  passo: number;
  sorteio: () => number;
  eventos: EventoTorres[];
  terminado: boolean;
  vencedor: number | null;
}

export const bloco = (e: EstadoTorres, x: number, y: number): Material => (x < 0 || y < 0 || x >= LW || y >= LH ? 0 : e.blocos[y * LW + x]);
const pos = (x: number, y: number) => y * LW + x;
const solido = (e: EstadoTorres, x: number, y: number) => y >= e.chao[Math.max(0, Math.min(LW - 1, Math.floor(x)))] || bloco(e, Math.floor(x), Math.floor(y)) > 0;

export function novaPartidaTorres(o: { modo: ModoTorres; paisagem: Paisagem; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoTorres {
  const sorteio = rng(o.semente);
  const n = o.jogadores.length;
  const modo: ModoTorres = n === 1 ? "alvos" : "batalha";
  // Chão ondulado.
  const fase = sorteio() * 6;
  const chao = Array.from({ length: LW }, (_v, x) => Math.round(LH - 4 + Math.sin(x / 6 + fase) * 1.5 + Math.sin(x / 2.7) * 0.6));
  const blocos: Material[] = Array(LW * LH).fill(0);
  const reis: Rei[] = [];
  const xs = n === 1 ? [4] : Array.from({ length: n }, (_v, i) => Math.round(3 + (i * (LW - 7)) / (n - 1)));
  o.jogadores.forEach((j, i) => {
    const cx = xs[i];
    const base = chao[cx];
    const altura = 4 + Math.floor(sorteio() * 2);
    // Torre de 3 colunas: aço embaixo, pedra no meio, madeira em cima.
    for (let dy = 1; dy <= altura; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = base - dy;
      if (x < 0 || x >= LW) continue;
      for (let yy = y + 1; yy < chao[x]; yy++) blocos[pos(x, yy)] = 3;
      blocos[pos(x, y)] = dy <= 1 ? 3 : dy <= 3 ? 2 : 1;
    }
    reis.push({ id: i, bot: j.bot, x: cx + 0.5, y: base - altura, vivo: true, angulo: cx < LW / 2 ? -50 : -130, forca: 0.55, bombas: 1, arma: "bala", acertos: 0, pontos: 0, aAnterior: false, bAnterior: false });
  });
  const e: EstadoTorres = { modo, paisagem: o.paisagem, blocos, chao, reis, alvos: [], vez: 0, inicioVez: 0, vento: 0, projetil: null, esperaAte: 60, tiros: 0, passo: 0, sorteio, eventos: [], terminado: false, vencedor: null };
  if (modo === "alvos") for (let k = 0; k < ALVOS_SOLO; k++) novoAlvo(e);
  comecarVez(e, 0);
  return e;
}

function novoAlvo(e: EstadoTorres) {
  const x = 14 + Math.floor(e.sorteio() * (LW - 18));
  e.alvos.push({ x: x + 0.5, y: e.chao[x] - 1 - Math.floor(e.sorteio() * 6) });
}

function comecarVez(e: EstadoTorres, k: number) {
  e.vez = k;
  e.inicioVez = e.passo;
  e.vento = Math.round((e.sorteio() - 0.5) * 2 * 10) / 10;
  e.eventos.push({ tipo: "vez", jogador: k, vento: e.vento });
}

function disparar(e: EstadoTorres, r: Rei) {
  const a = (r.angulo * Math.PI) / 180;
  const v = r.forca * (r.arma === "bomba" ? 0.75 : 1) * 0.9;
  e.projetil = { x: r.x + Math.cos(a) * 0.9, y: r.y - 1.2 + Math.sin(a) * 0.9, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dono: r.id, arma: r.arma, idade: 0 };
  if (r.arma === "bomba") { r.bombas--; r.arma = "bala"; }
  e.tiros++;
  e.eventos.push({ tipo: "disparo", jogador: r.id });
}

/** Simula um tiro (para os bots acharem o ângulo e a força), devolve onde ele bate. */
export function simular(e: EstadoTorres, x0: number, y0: number, angulo: number, forca: number, alvo?: { x: number; y: number }): { x: number; y: number; perto: number } {
  const a = (angulo * Math.PI) / 180;
  let x = x0 + Math.cos(a) * 0.9, y = y0 - 1.2 + Math.sin(a) * 0.9, vx = Math.cos(a) * forca * 0.9, vy = Math.sin(a) * forca * 0.9;
  let perto = Infinity;
  for (let k = 0; k < 900; k++) {
    // Mesmo passo do projetil de verdade (dois meio-passos).
    for (let s = 0; s < 2; s++) { vx += e.vento * 0.0004; vy += G / 2; x += vx / 2; y += vy / 2; }
    if (alvo) perto = Math.min(perto, Math.hypot(x - alvo.x, y - alvo.y));
    if (x < 0 || x >= LW || y >= LH) break;
    if (k > 1 && solido(e, x, y)) break;
  }
  return { x, y, perto: alvo ? perto : Infinity };
}

function explodir(e: EstadoTorres, x: number, y: number, raio: number, dono: number) {
  e.eventos.push({ tipo: "explosao", x, y, raio });
  for (let yy = Math.floor(y - raio); yy <= Math.ceil(y + raio); yy++) for (let xx = Math.floor(x - raio); xx <= Math.ceil(x + raio); xx++) {
    const m = bloco(e, xx, yy);
    if (!m) continue;
    const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
    if (d > raio) continue;
    const dano = d < raio * 0.5 ? 2 : 1;
    e.blocos[pos(xx, yy)] = Math.max(0, m - dano) as Material;
  }
  for (const r of e.reis) if (r.vivo && Math.hypot(r.x - x, r.y - 0.5 - y) < raio + 0.4) foraRei(e, r, dono);
  if (e.modo === "alvos") {
    const antes = e.alvos.length;
    e.alvos = e.alvos.filter(a => { const bate = Math.hypot(a.x - x, a.y - y) < raio + 0.6; if (bate) e.eventos.push({ tipo: "alvo", x: a.x, y: a.y }); return !bate; });
    e.reis[0].acertos += antes - e.alvos.length;
    e.reis[0].pontos += (antes - e.alvos.length) * 200;
  }
}

function foraRei(e: EstadoTorres, r: Rei, por: number) {
  if (!r.vivo) return;
  r.vivo = false;
  if (por !== r.id) { e.reis[por].pontos += 500; e.reis[por].acertos++; }
  e.eventos.push({ tipo: "reiFora", jogador: r.id, por });
}

/** Blocos sem apoio caem uma casa por vez; rei sem chão embaixo também cai (e cai fora se despencar muito). */
function desabar(e: EstadoTorres): number {
  let caiu = 0;
  for (let y = LH - 2; y >= 0; y--) for (let x = 0; x < LW; x++) {
    const m = e.blocos[pos(x, y)];
    if (!m || y + 1 >= e.chao[x] || e.blocos[pos(x, y + 1)]) continue;
    e.blocos[pos(x, y + 1)] = m;
    e.blocos[pos(x, y)] = 0;
    caiu++;
    for (const r of e.reis) if (r.vivo && Math.floor(r.x) === x && Math.abs(r.y - (y + 1)) < 1) foraRei(e, r, e.vez);
  }
  for (const r of e.reis) {
    if (!r.vivo) continue;
    if (!solido(e, r.x, r.y + 0.05)) { r.y += 1; if (r.y > LH - 1) foraRei(e, r, e.vez); }
  }
  return caiu;
}

// ---------------------------------------------------------------- bots

const ERRO: Record<Dificuldade, number> = { facil: 0.09, medio: 0.035, dificil: 0.01 };

/** O bot testa ângulos e forças e fica com o que cai mais perto do rei rival mais próximo. */
export function miraDoBot(e: EstadoTorres, r: Rei): { angulo: number; forca: number } {
  const alvos = e.modo === "alvos" ? e.alvos : e.reis.filter(o => o.vivo && o.id !== r.id).map(o => ({ x: o.x, y: o.y - 0.5 }));
  const alvo = alvos.reduce((a, b) => (Math.abs(b.x - r.x) < Math.abs(a.x - r.x) ? b : a));
  let melhor = { angulo: r.angulo, forca: r.forca, d: Infinity };
  const lado = alvo.x > r.x ? 1 : -1;
  for (let ang = 10; ang <= 80; ang += 4) for (let f = 0.2; f <= 1.0; f += 0.04) {
    const a = lado > 0 ? -ang : -180 + ang;
    const p = simular(e, r.x, r.y, a, f, alvo);
    const d = Math.min(p.perto, Math.hypot(p.x - alvo.x, p.y - alvo.y));
    if (d < melhor.d) melhor = { angulo: a, forca: f, d };
  }
  const nivel = r.bot ?? "medio";
  return { angulo: melhor.angulo + (e.sorteio() - 0.5) * ERRO[nivel] * 200, forca: Math.max(0.2, Math.min(1, melhor.forca + (e.sorteio() - 0.5) * ERRO[nivel] * 2)) };
}

// ---------------------------------------------------------------- passo

export function passoTorres(e: EstadoTorres, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  if (e.projetil) {
    const p = e.projetil;
    p.idade++;
    for (let s = 0; s < 2 && e.projetil; s++) {
      p.vx += e.vento * 0.0004; p.vy += G / 2; p.x += p.vx / 2; p.y += p.vy / 2;
      if (p.x < -2 || p.x > LW + 2 || p.y > LH) { e.projetil = null; break; }
      const reiAtingido = e.reis.find(r => r.vivo && (r.id !== p.dono || p.idade > 30) && Math.abs(r.x - p.x) < 0.5 && p.y > r.y - 1.1 && p.y < r.y);
      if ((p.idade > 2 && solido(e, p.x, p.y)) || reiAtingido || (e.modo === "alvos" && e.alvos.some(a => Math.hypot(a.x - p.x, a.y - p.y) < 0.6))) {
        explodir(e, p.x, p.y, p.arma === "bomba" ? 3.2 : 1.8, p.dono);
        e.projetil = null;
      }
    }
    if (!e.projetil) e.esperaAte = e.passo + 50;
    return;
  }
  if (e.passo < e.esperaAte) {
    if (e.passo % 6 === 0) { const n = desabar(e); if (n) e.eventos.push({ tipo: "caiu", n }); }
    return;
  }
  // Depois do tiro: confere o fim e passa a vez para o próximo rei de pé.
  if (e.tiros > 0 && e.passo === e.esperaAte) {
    if (e.modo === "alvos") {
      if (!e.alvos.length) return terminar(e, 0);
      if (e.tiros >= TIROS_SOLO) return terminar(e, null);
      return comecarVez(e, 0);
    }
    const vivos = e.reis.filter(r => r.vivo);
    if (vivos.length <= 1) return terminar(e, vivos[0]?.id ?? null);
    for (let k = 1; k <= e.reis.length; k++) { const r = e.reis[(e.vez + k) % e.reis.length]; if (r.vivo) return comecarVez(e, r.id); }
  }
  const r = e.reis[e.vez];
  if (!r.vivo) { const prox = e.reis.find(x => x.vivo); if (prox) comecarVez(e, prox.id); return; }
  if (r.bot) {
    if (e.passo - e.inicioVez === 40) { const m = miraDoBot(e, r); r.angulo = m.angulo; r.forca = m.forca; if (r.bombas && e.sorteio() < 0.25) r.arma = "bomba"; }
    if (e.passo - e.inicioVez >= 70) disparar(e, r);
    return;
  }
  const ent = entradas[r.id] ?? { direcao: null, a: false, b: false };
  if (ent.direcao === "esquerda") r.angulo -= 0.6;
  if (ent.direcao === "direita") r.angulo += 0.6;
  if (ent.direcao === "cima") r.forca = Math.min(1, r.forca + 0.006);
  if (ent.direcao === "baixo") r.forca = Math.max(0.2, r.forca - 0.006);
  r.angulo = Math.max(-178, Math.min(-2, r.angulo));
  if (ent.b && !r.bAnterior && r.bombas > 0) r.arma = r.arma === "bala" ? "bomba" : "bala";
  r.bAnterior = ent.b;
  const tiro = (ent.a && !r.aAnterior) || e.passo - e.inicioVez >= TEMPO_VEZ;
  r.aAnterior = ent.a;
  if (tiro) disparar(e, r);
}

function terminar(e: EstadoTorres, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  if (vencedor !== null) e.reis[vencedor].pontos += 300;
  e.eventos.push({ tipo: "fim", vencedor });
}

export const TEMPO_DA_VEZ = TEMPO_VEZ;
