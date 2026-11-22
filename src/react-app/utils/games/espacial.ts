/**
 * Corrida Espacial: regras puras das naves com inércia (60 passos por segundo), de 1 a 8 jogadores.
 *
 * - ←/→ giram a nave, A (ou ↑) acelera na direção do bico, ↓ freia. Sem atrito: a nave segue andando.
 * - Planetas puxam pela gravidade; bater num planeta explode a nave, que volta em 2 s. O espaço dá a volta nas bordas.
 * - B atira o laser: atordoa outra nave por 1 s (e ela larga cristais) e quebra asteroides.
 * - Corrida: passar pelos anéis na ordem, 2 voltas; vence quem terminar primeiro. Sozinho: as 2 voltas em 75 s.
 * - Asteroides: pontos por quebrar (grandes se partem em menores) em 90 s.
 * - Coleta: juntar mais cristais em 90 s.
 */
import { rng, type Dificuldade, type Entrada } from "./bombas.ts";

export const W = 32;
export const H = 18;
const GIRO = 0.075;
const EMPUXO = 0.0055;
const VMAX = 0.28;
const GRAV = 0.0009;
const DURACAO = 90 * 60;
export const VOLTAS = 2;
export const TEMPO_SOLO = 75 * 60;

export type ModoEspacial = "corrida" | "asteroides" | "coleta";
export type Setor = "nebulosa" | "aneis" | "binario";
export interface Planeta { x: number; y: number; r: number; m: number; cor: string }

export const SETORES: Record<Setor, { nome: string; planetas: Planeta[]; aneis: [number, number][] }> = {
  nebulosa: { nome: "Nebulosa", planetas: [{ x: 16, y: 9, r: 1.6, m: 1.4, cor: "#a855f7" }], aneis: [[5, 4], [16, 3], [27, 4], [27, 14], [16, 15], [5, 14]] },
  aneis: { nome: "Cinturão", planetas: [{ x: 10, y: 9, r: 1.3, m: 1, cor: "#f59e0b" }, { x: 22, y: 9, r: 1.3, m: 1, cor: "#22d3ee" }], aneis: [[4, 9], [10, 3], [16, 9], [22, 15], [28, 9], [22, 3], [16, 9], [10, 15]] },
  binario: { nome: "Sistema binário", planetas: [{ x: 12, y: 7, r: 1.1, m: 0.9, cor: "#ef4444" }, { x: 20, y: 11, r: 1.1, m: 0.9, cor: "#3b82f6" }], aneis: [[4, 4], [16, 2.5], [28, 4], [28, 14], [16, 15.5], [4, 14]] },
};

export interface Nave {
  id: number; bot: Dificuldade | null;
  x: number; y: number; vx: number; vy: number; ang: number;
  explodidaAte: number; atordoadaAte: number; recarga: number;
  anel: number; volta: number; terminouEm: number | null;
  pontos: number; cristais: number;
  bAnterior: boolean;
}
export interface Tiro { x: number; y: number; vx: number; vy: number; vida: number; dono: number }
export interface Rocha { id: number; x: number; y: number; vx: number; vy: number; r: number }
export interface Cristal { id: number; x: number; y: number }

export type EventoEspacial =
  | { tipo: "tiro"; nave: number }
  | { tipo: "explodiu"; nave: number; x: number; y: number }
  | { tipo: "atordoou"; nave: number; por: number }
  | { tipo: "anel"; nave: number; anel: number; volta: number }
  | { tipo: "chegou"; nave: number; lugar: number }
  | { tipo: "rocha"; x: number; y: number; r: number; nave: number }
  | { tipo: "cristal"; nave: number }
  | { tipo: "fim"; vencedor: number | null };

export interface EstadoEspacial {
  modo: ModoEspacial;
  setor: Setor;
  naves: Nave[];
  tiros: Tiro[];
  rochas: Rocha[];
  cristais: Cristal[];
  chegada: number[];
  passo: number;
  duracao: number;
  proximoId: number;
  sorteio: () => number;
  eventos: EventoEspacial[];
  terminado: boolean;
  vencedor: number | null;
}

const envolve = (v: number, max: number) => ((v % max) + max) % max;
/** Diferença mais curta no espaço que dá a volta. */
const delta = (a: number, b: number, max: number) => { let d = b - a; if (d > max / 2) d -= max; if (d < -max / 2) d += max; return d; };
const distW = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(delta(a.x, b.x, W), delta(a.y, b.y, H));

export function novaPartidaEspacial(o: { modo: ModoEspacial; setor: Setor; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoEspacial {
  const sorteio = rng(o.semente);
  const largada = SETORES[o.setor].aneis[0];
  const naves: Nave[] = o.jogadores.map((j, i) => ({
    id: i, bot: j.bot, x: largada[0] - 2 + (i % 4) * 0.9, y: largada[1] + 1.5 + Math.floor(i / 4) * 0.9, vx: 0, vy: 0, ang: -Math.PI / 2,
    explodidaAte: 0, atordoadaAte: 0, recarga: 0, anel: 1, volta: 0, terminouEm: null, pontos: 0, cristais: 0, bAnterior: false,
  }));
  if (o.modo !== "corrida") naves.forEach((n, i) => { const a = (i / naves.length) * Math.PI * 2; n.x = envolve(16 + Math.cos(a) * 12, W); n.y = envolve(9 + Math.sin(a) * 6.5, H); n.ang = a + Math.PI; });
  const e: EstadoEspacial = {
    modo: o.modo, setor: o.setor, naves, tiros: [], rochas: [], cristais: [], chegada: [], passo: 0,
    duracao: o.modo === "corrida" ? (naves.length === 1 ? TEMPO_SOLO : 4 * 60 * 60) : DURACAO, proximoId: 1, sorteio, eventos: [], terminado: false, vencedor: null,
  };
  if (o.modo === "asteroides") for (let k = 0; k < 6; k++) novaRocha(e, 1.1);
  if (o.modo === "coleta") for (let k = 0; k < 8; k++) novoCristal(e);
  return e;
}

function longeDosPlanetas(e: EstadoEspacial): { x: number; y: number } {
  for (;;) {
    const p = { x: e.sorteio() * W, y: e.sorteio() * H };
    if (SETORES[e.setor].planetas.every(q => Math.hypot(q.x - p.x, q.y - p.y) > q.r + 2)) return p;
  }
}
function novaRocha(e: EstadoEspacial, r: number, perto?: { x: number; y: number }) {
  const p = perto ?? longeDosPlanetas(e);
  const a = e.sorteio() * Math.PI * 2, v = 0.02 + e.sorteio() * 0.03;
  e.rochas.push({ id: e.proximoId++, x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r });
}
function novoCristal(e: EstadoEspacial, perto?: { x: number; y: number }) {
  const p = perto ? { x: envolve(perto.x + (e.sorteio() - 0.5) * 2, W), y: envolve(perto.y + (e.sorteio() - 0.5) * 2, H) } : longeDosPlanetas(e);
  e.cristais.push({ id: e.proximoId++, ...p });
}

function explodir(e: EstadoEspacial, n: Nave) {
  e.eventos.push({ tipo: "explodiu", nave: n.id, x: n.x, y: n.y });
  n.explodidaAte = e.passo + 120;
  if (e.modo === "coleta") { const largar = Math.min(n.cristais, 3); n.cristais -= largar; for (let k = 0; k < largar; k++) novoCristal(e, n); }
  if (e.modo === "asteroides") n.pontos = Math.max(0, n.pontos - 100);
  // Volta no último anel (corrida) ou num ponto seguro.
  const aneis = SETORES[e.setor].aneis;
  const p = e.modo === "corrida" ? { x: aneis[(n.anel - 1 + aneis.length) % aneis.length][0], y: aneis[(n.anel - 1 + aneis.length) % aneis.length][1] } : longeDosPlanetas(e);
  n.x = p.x; n.y = p.y; n.vx = 0; n.vy = 0;
}

// ---------------------------------------------------------------- bots

/** O bot mira no alvo (próximo anel, rocha ou cristal), gira, acelera quando aponta e desvia dos planetas. */
function decidirBot(e: EstadoEspacial, n: Nave): { giro: -1 | 0 | 1; acelera: boolean; freia: boolean; atira: boolean } {
  const nivel = n.bot ?? "medio";
  let alvo: { x: number; y: number } | null = null;
  if (e.modo === "corrida") { const a = SETORES[e.setor].aneis[n.anel % SETORES[e.setor].aneis.length]; alvo = { x: a[0], y: a[1] }; }
  else if (e.modo === "asteroides") alvo = e.rochas.reduce<Rocha | null>((m, r) => (!m || distW(n, r) < distW(n, m) ? r : m), null);
  else alvo = e.cristais.reduce<Cristal | null>((m, c) => (!m || distW(n, c) < distW(n, m) ? c : m), null);
  if (!alvo) return { giro: 0, acelera: false, freia: true, atira: false };
  // Velocidade desejada: rumo ao alvo, mais devagar perto dele e afastada dos planetas; o bot corrige a diferença.
  const nivelVel = nivel === "facil" ? 0.12 : nivel === "medio" ? 0.17 : 0.22;
  const dx = delta(n.x, alvo.x, W), dy = delta(n.y, alvo.y, H), d = Math.max(0.01, Math.hypot(dx, dy));
  const vd = Math.min(nivelVel, 0.03 + d * 0.025);
  // Asteroides: chega a uns 4 de distância e fica parado mirando (encostar explode).
  const atirador = e.modo === "asteroides";
  const sinal = atirador ? (d < 3.5 ? -1 : d < 5 ? 0 : 1) : 1;
  let desx = (dx / d) * vd * sinal, desy = (dy / d) * vd * sinal;
  for (const r of atirador ? e.rochas : []) {
    const rx = delta(n.x, r.x, W), ry = delta(n.y, r.y, H), dr = Math.max(0.01, Math.hypot(rx, ry));
    if (dr < 2.5 + r.r) { desx -= (rx / dr) * 0.15; desy -= (ry / dr) * 0.15; }
  }
  for (const p of SETORES[e.setor].planetas) {
    const px = delta(n.x, p.x, W), py = delta(n.y, p.y, H), dp = Math.max(0.01, Math.hypot(px, py));
    if (dp < p.r + 3.6) { const f = 0.4 * (1 - (dp - p.r) / 3.6) ** 0.7; desx -= (px / dp) * f; desy -= (py / dp) * f; }
  }
  const sx = desx - n.vx, sy = desy - n.vy, sm = Math.hypot(sx, sy);
  // Perto e com pouca correção a fazer, o atirador vira o bico para a rocha.
  const quer = atirador && d < 6 && sm < 0.05 ? Math.atan2(dy, dx) : Math.atan2(sy, sx);
  let dif = quer - n.ang;
  while (dif > Math.PI) dif -= Math.PI * 2;
  while (dif < -Math.PI) dif += Math.PI * 2;
  const tolera = nivel === "facil" ? 0.55 : nivel === "medio" ? 0.35 : 0.2;
  const vel = Math.hypot(n.vx, n.vy);
  const contra = n.vx * desx + n.vy * desy < 0;
  const atira = e.modo !== "corrida" && Math.abs(dif) < 0.25 && (e.modo === "asteroides" ? e.sorteio() < 0.4 : e.naves.some(o => o.id !== n.id && distW(n, o) < 5 && e.sorteio() < 0.1));
  return { giro: Math.abs(dif) < 0.05 ? 0 : dif > 0 ? 1 : -1, acelera: sm > (atirador ? 0.04 : 0.01) && Math.abs(dif) < tolera, freia: (contra && vel > 0.05) || vel > nivelVel * 1.3, atira };
}

// ---------------------------------------------------------------- passo

export function passoEspacial(e: EstadoEspacial, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  const S = SETORES[e.setor];
  for (const n of e.naves) {
    n.recarga = Math.max(0, n.recarga - 1);
    if (e.passo < n.explodidaAte || n.terminouEm !== null) continue;
    let giro: -1 | 0 | 1 = 0, acelera = false, freia = false, atira = false;
    if (n.bot) ({ giro, acelera, freia, atira } = decidirBot(e, n));
    else {
      const ent = entradas[n.id] ?? { direcao: null, a: false, b: false };
      giro = ent.direcao === "esquerda" ? -1 : ent.direcao === "direita" ? 1 : 0;
      acelera = ent.a || ent.direcao === "cima";
      freia = ent.direcao === "baixo";
      atira = ent.b && !n.bAnterior;
      n.bAnterior = ent.b;
    }
    const tonta = e.passo < n.atordoadaAte;
    if (!tonta) {
      n.ang += giro * GIRO;
      if (acelera) { n.vx += Math.cos(n.ang) * EMPUXO; n.vy += Math.sin(n.ang) * EMPUXO; }
      if (freia) { n.vx *= 0.96; n.vy *= 0.96; }
      if (atira && n.recarga === 0) {
        n.recarga = 24;
        e.tiros.push({ x: n.x + Math.cos(n.ang) * 0.5, y: n.y + Math.sin(n.ang) * 0.5, vx: Math.cos(n.ang) * 0.5 + n.vx, vy: Math.sin(n.ang) * 0.5 + n.vy, vida: 40, dono: n.id });
        e.eventos.push({ tipo: "tiro", nave: n.id });
      }
    } else n.ang += 0.2;
    // Gravidade dos planetas.
    for (const p of S.planetas) {
      const dx = delta(n.x, p.x, W), dy = delta(n.y, p.y, H), d2 = Math.max(0.5, dx * dx + dy * dy), d = Math.sqrt(d2);
      n.vx += (dx / d) * (GRAV * p.m * 28) / d2; n.vy += (dy / d) * (GRAV * p.m * 28) / d2;
      if (d < p.r + 0.25) { explodir(e, n); break; }
    }
    const v = Math.hypot(n.vx, n.vy);
    if (v > VMAX) { n.vx *= VMAX / v; n.vy *= VMAX / v; }
    n.x = envolve(n.x + n.vx, W); n.y = envolve(n.y + n.vy, H);
    // Corrida: passar pelo anel da vez.
    if (e.modo === "corrida") {
      const a = S.aneis[n.anel % S.aneis.length];
      if (Math.hypot(delta(n.x, a[0], W), delta(n.y, a[1], H)) < 1.2) {
        if (n.anel % S.aneis.length === 0) n.volta++;
        n.anel++;
        n.pontos += 50;
        e.eventos.push({ tipo: "anel", nave: n.id, anel: n.anel, volta: n.volta });
        if (n.volta >= VOLTAS) {
          n.terminouEm = e.passo;
          e.chegada.push(n.id);
          n.pontos += [500, 300, 200, 100][e.chegada.length - 1] ?? 50;
          e.eventos.push({ tipo: "chegou", nave: n.id, lugar: e.chegada.length });
        }
      }
    }
    if (e.modo === "coleta") for (const c of e.cristais) if (distW(n, c) < 0.7) { n.cristais++; n.pontos += 20; c.x = -99; e.eventos.push({ tipo: "cristal", nave: n.id }); }
  }
  e.cristais = e.cristais.filter(c => c.x > -50);
  if (e.modo === "coleta") while (e.cristais.length < 8) novoCristal(e);
  // Tiros.
  for (const t of e.tiros) {
    t.x = envolve(t.x + t.vx, W); t.y = envolve(t.y + t.vy, H); t.vida--;
    for (const n of e.naves) {
      if (n.id === t.dono || t.vida <= 0 || e.passo < n.explodidaAte || distW(t, n) > 0.5) continue;
      n.atordoadaAte = e.passo + 60; t.vida = 0;
      e.eventos.push({ tipo: "atordoou", nave: n.id, por: t.dono });
      if (e.modo === "coleta" && n.cristais > 0) { n.cristais--; novoCristal(e, n); }
    }
    for (const r of e.rochas) {
      if (t.vida <= 0 || distW(t, r) > r.r) continue;
      t.vida = 0;
      const dono = e.naves[t.dono];
      dono.pontos += r.r > 0.8 ? 20 : r.r > 0.45 ? 50 : 100;
      e.eventos.push({ tipo: "rocha", x: r.x, y: r.y, r: r.r, nave: dono.id });
      if (r.r > 0.45) { novaRocha(e, r.r * 0.55, r); novaRocha(e, r.r * 0.55, r); }
      r.r = 0;
    }
  }
  e.tiros = e.tiros.filter(t => t.vida > 0);
  e.rochas = e.rochas.filter(r => r.r > 0);
  for (const r of e.rochas) {
    r.x = envolve(r.x + r.vx, W); r.y = envolve(r.y + r.vy, H);
    for (const n of e.naves) if (e.passo >= n.explodidaAte && distW(r, n) < r.r + 0.3) explodir(e, n);
  }
  if (e.modo === "asteroides" && e.rochas.length < 4) novaRocha(e, 1.1);
  // Fim.
  if (e.modo === "corrida") {
    const todas = e.naves.every(n => n.terminouEm !== null);
    if (e.naves.length === 1 && e.chegada.length) return terminar(e, 0);
    if (todas || (e.chegada.length && e.passo - (e.naves[e.chegada[0]].terminouEm ?? 0) > 20 * 60)) return terminar(e, e.chegada[0]);
    if (e.passo >= e.duracao) return terminar(e, e.naves.length === 1 ? null : e.chegada[0] ?? lider(e));
  } else if (e.passo >= e.duracao) {
    const chave = (n: Nave) => (e.modo === "coleta" ? n.cristais : n.pontos);
    const max = Math.max(...e.naves.map(chave));
    const lideres = e.naves.filter(n => chave(n) === max);
    terminar(e, e.naves.length === 1 ? (e.modo === "asteroides" && max >= 1500) || (e.modo === "coleta" && max >= 25) ? 0 : null : lideres.length === 1 ? lideres[0].id : null);
  }
}

const lider = (e: EstadoEspacial) => e.naves.reduce((a, b) => (b.anel > a.anel ? b : a)).id;

function terminar(e: EstadoEspacial, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.eventos.push({ tipo: "fim", vencedor });
}

export const pontosEspacial = (e: EstadoEspacial, n: Nave) => n.pontos + n.cristais * 10 + (e.vencedor === n.id ? 300 : 0);
