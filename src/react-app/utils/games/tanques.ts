/**
 * Tanques de Aço: regras puras (60 passos por segundo), de 1 a 8 tanques, numa arena em grade vista de cima (o motor
 * desenha em 3D).
 *
 * - ↑/↓ anda para frente e para trás, ←/→ gira o chassi. A torre gira separada: mira sozinha no inimigo à vista mais
 *   perto (sem ninguém à vista, acompanha o chassi). A atira, B solta uma mina.
 * - Os tiros ricocheteiam nos muros até 2 vezes; depois de ricochetear, o tiro acerta até quem atirou. Cada tanque tem
 *   3 de blindagem. Caixotes de madeira quebram com 2 tiros (ou com a mina); muros de pedra não quebram.
 * - Minas armam em 1 s e explodem quando um tanque inimigo passa perto (ou depois de 25 s), abrindo os caixotes em volta.
 * - Mata-Mata: fica o último tanque. Times: o time que sobrar. 3 minutos; no tempo, vence quem tiver mais blindagem.
 *   Sozinho: destrua os 10 alvos em 90 s.
 */
import { rng, type Dificuldade, type Entrada } from "./bombas.ts";

export type ModoTanques = "matamata" | "times";
export type ArenaTanques = "deserto" | "neve" | "fabrica";
export const GRADE = 21;
export const CELULA = 2;
export const TAMANHO = GRADE * CELULA;
export const BLINDAGEM = 3;
export const TEMPO = 180 * 60;
export const TEMPO_SOLO = 90 * 60;
export const ALVOS_SOLO = 10;
const RAIO = 0.75;
const VEL = 0.09;
const GIRO = 0.05;
const RECARGA = 38;
const MAX_TIROS = 3;
const MAX_MINAS = 2;
const VEL_TIRO = 0.36;
const RICOCHETES = 2;

/** 0 chão, 1 muro de pedra, 2 caixote (2 de vida), 3 caixote rachado (1 de vida). */
export type Celula = 0 | 1 | 2 | 3;

export interface Tanque {
  id: number;
  bot: Dificuldade | null;
  time: number;
  x: number; z: number;
  ang: number; torre: number;
  blindagem: number;
  recarga: number;
  vivo: boolean;
  abates: number;
  aAnterior: boolean; bAnterior: boolean;
  atingidoEm: number;
  alvoBot: { x: number; z: number } | null;
}
export interface Tiro { x: number; z: number; vx: number; vz: number; dono: number; ricochetes: number; vida: number }
export interface Mina { x: number; z: number; dono: number; armaEm: number; explodeEm: number }
export interface Alvo { x: number; z: number; vida: number }

export type EventoTanques =
  | { tipo: "tiro"; jogador: number }
  | { tipo: "ricochete"; x: number; z: number }
  | { tipo: "acerto"; jogador: number; por: number; restam: number; x: number; z: number }
  | { tipo: "destruido"; jogador: number; por: number; x: number; z: number }
  | { tipo: "caixote"; x: number; z: number; quebrou: boolean }
  | { tipo: "mina"; jogador: number }
  | { tipo: "explosao"; x: number; z: number }
  | { tipo: "alvo"; x: number; z: number; restam: number }
  | { tipo: "fim" };

export interface EstadoTanques {
  modo: ModoTanques;
  arena: ArenaTanques;
  grade: Celula[];
  tanques: Tanque[];
  tiros: Tiro[];
  minas: Mina[];
  alvos: Alvo[];
  meta: number;
  passo: number;
  sorteio: () => number;
  eventos: EventoTanques[];
  terminado: boolean;
  vencedor: number | null;
  timeVencedor: number | null;
}

export const celula = (e: EstadoTanques, cx: number, cz: number): Celula =>
  cx < 0 || cz < 0 || cx >= GRADE || cz >= GRADE ? 1 : e.grade[cz * GRADE + cx];
const naCelula = (v: number) => Math.floor(v / CELULA);
export const solido = (e: EstadoTanques, x: number, z: number) => celula(e, naCelula(x), naCelula(z)) !== 0;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const angulo = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Pontos de partida: cantos e meios das bordas (sempre livres). */
const SAIDAS: [number, number][] = [[1, 1], [GRADE - 2, GRADE - 2], [GRADE - 2, 1], [1, GRADE - 2], [10, 1], [10, GRADE - 2], [1, 10], [GRADE - 2, 10]];

export function novaPartidaTanques(o: { modo: ModoTanques; arena: ArenaTanques; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoTanques {
  const sorteio = rng(o.semente);
  const grade: Celula[] = [];
  // Arena simétrica (as quatro partes iguais): borda de pedra, pilares de pedra e caixotes espalhados.
  const meia = Math.ceil(GRADE / 2);
  const quarto: Celula[][] = Array.from({ length: meia }, () => Array<Celula>(meia).fill(0));
  for (let z = 0; z < meia; z++) for (let x = 0; x < meia; x++) {
    if (x === 0 || z === 0) quarto[z][x] = 1;
    else if (x % 4 === 2 && z % 4 === 2) quarto[z][x] = 1;
    else if (sorteio() < 0.28) quarto[z][x] = 2;
  }
  for (let z = 0; z < GRADE; z++) for (let x = 0; x < GRADE; x++) {
    const qx = x < meia ? x : GRADE - 1 - x, qz = z < meia ? z : GRADE - 1 - z;
    grade.push(quarto[qz][qx]);
  }
  // Saídas e corredores livres em volta delas.
  for (const [sx, sz] of SAIDAS) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const x = sx + dx, z = sz + dz;
    if (x > 0 && z > 0 && x < GRADE - 1 && z < GRADE - 1) grade[z * GRADE + x] = 0;
  }
  const n = o.jogadores.length;
  const tanques: Tanque[] = o.jogadores.map((j, i) => {
    const [cx, cz] = SAIDAS[i % SAIDAS.length];
    const x = (cx + 0.5) * CELULA, z = (cz + 0.5) * CELULA;
    const ang = Math.atan2(TAMANHO / 2 - z, TAMANHO / 2 - x);
    return {
      id: i, bot: j.bot, time: o.modo === "times" ? i % 2 : i, x, z, ang, torre: ang, blindagem: BLINDAGEM, recarga: 60, vivo: true,
      abates: 0, aAnterior: false, bAnterior: false, atingidoEm: -999, alvoBot: null,
    };
  });
  const alvos: Alvo[] = [];
  if (n === 1) {
    const livres: [number, number][] = [];
    for (let z = 1; z < GRADE - 1; z++) for (let x = 1; x < GRADE - 1; x++) if (grade[z * GRADE + x] === 0 && Math.hypot(x - 1, z - 1) > 5) livres.push([x, z]);
    for (let k = 0; k < ALVOS_SOLO && livres.length; k++) {
      const [x, z] = livres.splice(Math.floor(sorteio() * livres.length), 1)[0];
      alvos.push({ x: (x + 0.5) * CELULA, z: (z + 0.5) * CELULA, vida: 1 });
    }
  }
  return {
    modo: o.modo, arena: o.arena, grade, tanques, tiros: [], minas: [], alvos, meta: n === 1 ? TEMPO_SOLO : TEMPO, passo: 0, sorteio,
    eventos: [], terminado: false, vencedor: null, timeVencedor: null,
  };
}

/** Há linha de tiro reta (sem muro nem caixote) entre dois pontos? */
export function linhaLivre(e: EstadoTanques, a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  const d = dist(a, b), passos = Math.ceil(d / 0.15);
  if (d < 0.01) return true;
  // Confere a largura do tiro (três linhas paralelas), para não contar como livre um tiro que raspa a quina.
  const px = (-(b.z - a.z) / d) * 0.22, pz = ((b.x - a.x) / d) * 0.22;
  for (const k of [-1, 0, 1]) for (let i = 1; i < passos; i++) {
    const t = i / passos;
    if (solido(e, a.x + (b.x - a.x) * t + px * k, a.z + (b.z - a.z) * t + pz * k)) return false;
  }
  return true;
}

const inimigos = (e: EstadoTanques, t: Tanque) => e.tanques.filter(o => o.vivo && o.id !== t.id && o.time !== t.time);
const cabe = (e: EstadoTanques, x: number, z: number) =>
  !solido(e, x - RAIO, z - RAIO) && !solido(e, x + RAIO, z - RAIO) && !solido(e, x - RAIO, z + RAIO) && !solido(e, x + RAIO, z + RAIO);

function atingir(e: EstadoTanques, t: Tanque, por: number, dano: number) {
  if (!t.vivo) return;
  t.blindagem = Math.max(0, t.blindagem - dano);
  t.atingidoEm = e.passo;
  if (t.blindagem > 0) { e.eventos.push({ tipo: "acerto", jogador: t.id, por, restam: t.blindagem, x: t.x, z: t.z }); return; }
  t.vivo = false;
  if (por !== t.id && e.tanques[por]) e.tanques[por].abates++;
  e.eventos.push({ tipo: "destruido", jogador: t.id, por, x: t.x, z: t.z });
}

function danificarCelula(e: EstadoTanques, cx: number, cz: number, forte: boolean) {
  const c = celula(e, cx, cz);
  if (c !== 2 && c !== 3) return;
  const nova: Celula = forte || c === 3 ? 0 : 3;
  e.grade[cz * GRADE + cx] = nova;
  e.eventos.push({ tipo: "caixote", x: (cx + 0.5) * CELULA, z: (cz + 0.5) * CELULA, quebrou: nova === 0 });
}

function explodir(e: EstadoTanques, m: Mina) {
  e.eventos.push({ tipo: "explosao", x: m.x, z: m.z });
  const cx = naCelula(m.x), cz = naCelula(m.z);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) danificarCelula(e, cx + dx, cz + dz, true);
  for (const t of e.tanques) if (t.vivo && dist(t, m) < 2.6) atingir(e, t, m.dono, 2);
  for (const a of e.alvos) if (a.vida > 0 && dist(a, m) < 2.6) acertarAlvo(e, a);
}

function acertarAlvo(e: EstadoTanques, a: Alvo) {
  a.vida = 0;
  e.eventos.push({ tipo: "alvo", x: a.x, z: a.z, restam: e.alvos.filter(x => x.vida > 0).length });
}

function atirar(e: EstadoTanques, t: Tanque) {
  if (t.recarga > 0 || e.tiros.filter(x => x.dono === t.id).length >= MAX_TIROS) return;
  const sx = t.x + Math.cos(t.torre) * 1.1, sz = t.z + Math.sin(t.torre) * 1.1;
  if (solido(e, sx, sz)) {
    // Encostado: o tiro acerta na hora o caixote da frente (muro de pedra, nada).
    const cx = naCelula(sx), cz = naCelula(sz);
    if (celula(e, cx, cz) === 1) return;
    t.recarga = RECARGA;
    e.eventos.push({ tipo: "tiro", jogador: t.id });
    danificarCelula(e, cx, cz, false);
    return;
  }
  t.recarga = RECARGA;
  e.tiros.push({ x: sx, z: sz, vx: Math.cos(t.torre) * VEL_TIRO, vz: Math.sin(t.torre) * VEL_TIRO, dono: t.id, ricochetes: 0, vida: 420 });
  e.eventos.push({ tipo: "tiro", jogador: t.id });
}

function minar(e: EstadoTanques, t: Tanque) {
  if (e.minas.filter(m => m.dono === t.id).length >= MAX_MINAS) return;
  e.minas.push({ x: t.x, z: t.z, dono: t.id, armaEm: e.passo + 60, explodeEm: e.passo + 25 * 60 });
  e.eventos.push({ tipo: "mina", jogador: t.id });
}

/** A torre mira sozinha no inimigo à vista mais perto; sem ninguém à vista, acompanha o chassi. */
function mirarTorre(e: EstadoTanques, t: Tanque) {
  const vistos = inimigos(e, t).filter(o => linhaLivre(e, t, o));
  const alvosVistos = e.alvos.filter(a => a.vida > 0 && linhaLivre(e, t, a));
  const todos: { x: number; z: number }[] = [...vistos, ...alvosVistos];
  const alvo = todos.sort((a, b) => dist(a, t) - dist(b, t))[0];
  const desejado = alvo ? Math.atan2(alvo.z - t.z, alvo.x - t.x) : t.ang;
  t.torre = angulo(t.torre + Math.max(-0.07, Math.min(0.07, angulo(desejado - t.torre))));
}

// ---------------------------------------------------------------- bots

/** Próximo ponto do menor caminho na grade (BFS; caixotes contam como passagem) até a célula do alvo. */
function proximoPasso(e: EstadoTanques, de: { x: number; z: number }, para: { x: number; z: number }): { x: number; z: number } | null {
  const ini = naCelula(de.z) * GRADE + naCelula(de.x), fim = naCelula(para.z) * GRADE + naCelula(para.x);
  const veio = new Int16Array(GRADE * GRADE).fill(-1);
  veio[ini] = ini;
  const fila = [ini];
  for (let k = 0; k < fila.length; k++) {
    const c = fila[k];
    if (c === fim) break;
    const cx = c % GRADE, cz = (c - cx) / GRADE;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz, n = nz * GRADE + nx;
      // Caixote entra no caminho (o bot atira nele); muro de pedra, não.
      if (celula(e, nx, nz) === 1 && n !== fim) continue;
      if (veio[n] !== -1) continue;
      veio[n] = c; fila.push(n);
    }
  }
  if (veio[fim] === -1) return null;
  let c = fim;
  while (veio[c] !== ini && veio[c] !== c) c = veio[c];
  return { x: ((c % GRADE) + 0.5) * CELULA, z: (Math.floor(c / GRADE) + 0.5) * CELULA };
}

const ERRO_BOT: Record<Dificuldade, number> = { facil: 0.3, medio: 0.12, dificil: 0.03 };

export function decisaoDoBot(e: EstadoTanques, t: Tanque): Entrada {
  const nivel = t.bot ?? "medio";
  const alvos: { x: number; z: number }[] = [...inimigos(e, t), ...e.alvos.filter(a => a.vida > 0)];
  const alvo = alvos.sort((a, b) => dist(a, t) - dist(b, t))[0];
  if (!alvo) return { direcao: null, a: false, b: false };
  const visto = linhaLivre(e, t, alvo);
  // Mira certa o bastante: atira (o Fácil erra mais e demora a decidir).
  const desvio = Math.abs(angulo(Math.atan2(alvo.z - t.z, alvo.x - t.x) - t.torre));
  const a = visto && desvio < 0.12 + ERRO_BOT[nivel] && e.sorteio() < (nivel === "facil" ? 0.08 : 0.3);
  // Anda pelo menor caminho até ficar a uma distância boa (perto, mas não colado); caixote no caminho, atira nele.
  let destino: { x: number; z: number } | null = null;
  if (!visto || dist(t, alvo) > 9) destino = proximoPasso(e, t, alvo);
  let direcao: Entrada["direcao"] = null;
  let b = false;
  if (destino) {
    const quer = Math.atan2(destino.z - t.z, destino.x - t.x), dif = angulo(quer - t.ang);
    direcao = Math.abs(dif) > 0.25 ? (dif > 0 ? "direita" : "esquerda") : "cima";
  }
  const frente = { x: t.x + Math.cos(t.ang) * 1.6, z: t.z + Math.sin(t.ang) * 1.6 };
  const naFrente = celula(e, naCelula(frente.x), naCelula(frente.z));
  const atirarCaixote = (naFrente === 2 || naFrente === 3) && Math.abs(angulo(t.ang - t.torre)) < 0.2 && e.sorteio() < 0.2;
  // Mina: o Médio e o Difícil soltam quando um inimigo está perto e a mina não vai pegar neles mesmos.
  if (nivel !== "facil" && e.tanques.some(o => o.vivo && o.time !== t.time && dist(o, t) < 5) && e.sorteio() < 0.01) b = true;
  return { direcao, a: a || atirarCaixote, b };
}

// ---------------------------------------------------------------- passo

export function passoTanques(e: EstadoTanques, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  for (const t of e.tanques) {
    if (!t.vivo) continue;
    t.recarga = Math.max(0, t.recarga - 1);
    const ent = t.bot ? decisaoDoBot(e, t) : entradas[t.id] ?? { direcao: null, a: false, b: false };
    if (ent.direcao === "esquerda") t.ang = angulo(t.ang - GIRO);
    else if (ent.direcao === "direita") t.ang = angulo(t.ang + GIRO);
    const v = ent.direcao === "cima" ? VEL : ent.direcao === "baixo" ? -VEL * 0.6 : 0;
    if (v) {
      const nx = t.x + Math.cos(t.ang) * v, nz = t.z + Math.sin(t.ang) * v;
      if (cabe(e, nx, t.z)) t.x = nx;
      if (cabe(e, t.x, nz)) t.z = nz;
    }
    mirarTorre(e, t);
    if (ent.a && !t.aAnterior) atirar(e, t);
    else if (ent.a && t.bot) atirar(e, t);
    if (ent.b && !t.bAnterior) minar(e, t);
    t.aAnterior = ent.a; t.bAnterior = ent.b;
  }
  // Tanques não se atravessam.
  for (let i = 0; i < e.tanques.length; i++) for (let j = i + 1; j < e.tanques.length; j++) {
    const a = e.tanques[i], b = e.tanques[j];
    if (!a.vivo || !b.vivo) continue;
    const d = dist(a, b);
    if (d > 0 && d < RAIO * 2) {
      const f = (RAIO * 2 - d) / 2 / d;
      const ax = a.x + (a.x - b.x) * f, az = a.z + (a.z - b.z) * f, bx = b.x + (b.x - a.x) * f, bz = b.z + (b.z - a.z) * f;
      if (cabe(e, ax, az)) { a.x = ax; a.z = az; }
      if (cabe(e, bx, bz)) { b.x = bx; b.z = bz; }
    }
  }
  passoTiros(e);
  for (const m of e.minas) {
    if (e.passo >= m.explodeEm) { explodir(e, m); m.explodeEm = -1; continue; }
    if (e.passo < m.armaEm) continue;
    const dono = e.tanques[m.dono];
    if (e.tanques.some(t => t.vivo && t.time !== dono.time && dist(t, m) < 1.3)) { explodir(e, m); m.explodeEm = -1; }
  }
  e.minas = e.minas.filter(m => m.explodeEm !== -1);
  verificarFim(e);
}

function passoTiros(e: EstadoTanques) {
  for (const s of e.tiros) {
    for (let k = 0; k < 3 && s.vida > 0; k++) {
      const nx = s.x + s.vx / 3, nz = s.z + s.vz / 3;
      const bateX = solido(e, nx, s.z), bateZ = solido(e, s.x, nz);
      if (bateX || bateZ || solido(e, nx, nz)) {
        const cx = naCelula(bateX ? nx : s.x), cz = naCelula(bateZ ? nz : s.z);
        const alvoCel = bateX || bateZ ? [cx, cz] : [naCelula(nx), naCelula(nz)];
        const c = celula(e, alvoCel[0], alvoCel[1]);
        if (c === 2 || c === 3) { danificarCelula(e, alvoCel[0], alvoCel[1], false); s.vida = 0; break; }
        // Muro de pedra: ricocheteia (até 2 vezes).
        if (s.ricochetes >= RICOCHETES) { s.vida = 0; break; }
        s.ricochetes++;
        if (bateX) s.vx = -s.vx;
        if (bateZ) s.vz = -s.vz;
        if (!bateX && !bateZ) { s.vx = -s.vx; s.vz = -s.vz; }
        e.eventos.push({ tipo: "ricochete", x: s.x, z: s.z });
        continue;
      }
      s.x = nx; s.z = nz;
      const t = e.tanques.find(o => o.vivo && dist(o, s) < RAIO + 0.15 && (o.id !== s.dono || s.ricochetes > 0));
      if (t) { atingir(e, t, s.dono, 1); s.vida = 0; break; }
      const a = e.alvos.find(x => x.vida > 0 && dist(x, s) < 0.9);
      if (a) { acertarAlvo(e, a); s.vida = 0; break; }
    }
    s.vida--;
  }
  // Tiros que se encontram se anulam.
  for (let i = 0; i < e.tiros.length; i++) for (let j = i + 1; j < e.tiros.length; j++) {
    if (e.tiros[i].vida > 0 && e.tiros[j].vida > 0 && dist(e.tiros[i], e.tiros[j]) < 0.4) { e.tiros[i].vida = 0; e.tiros[j].vida = 0; }
  }
  e.tiros = e.tiros.filter(s => s.vida > 0);
}

function verificarFim(e: EstadoTanques) {
  if (e.tanques.length === 1) {
    if (e.alvos.every(a => a.vida <= 0)) return terminar(e, 0, null);
    if (!e.tanques[0].vivo || e.passo >= e.meta) return terminar(e, null, null);
    return;
  }
  const vivos = e.tanques.filter(t => t.vivo);
  const times = new Set(vivos.map(t => t.time));
  if (times.size <= 1) {
    const time = vivos.length ? vivos[0].time : null;
    // No modo Times a rodada é do time; o "vencedor" é quem mais derrubou nele.
    const melhor = vivos.length ? e.tanques.filter(t => t.time === time).sort((a, b) => b.abates - a.abates || b.blindagem - a.blindagem)[0].id : null;
    return terminar(e, melhor, e.modo === "times" ? time : null);
  }
  if (e.passo >= e.meta) {
    // No tempo: mais blindagem somada (por time, nos Times); empate, ninguém vence.
    const pontos = new Map<number, number>();
    for (const t of vivos) pontos.set(t.time, (pontos.get(t.time) ?? 0) + t.blindagem);
    const ordem = [...pontos.entries()].sort((a, b) => b[1] - a[1]);
    if (ordem.length > 1 && ordem[0][1] === ordem[1][1]) return terminar(e, null, null);
    const time = ordem[0][0];
    const melhor = vivos.filter(t => t.time === time).sort((a, b) => b.abates - a.abates)[0].id;
    terminar(e, melhor, e.modo === "times" ? time : null);
  }
}

function terminar(e: EstadoTanques, vencedor: number | null, time: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.timeVencedor = time;
  e.eventos.push({ tipo: "fim" });
}

/** Pontos de cada um: 100 por tanque derrubado, 30 por blindagem que sobrou; sozinho, 100 por alvo. */
export const pontosTanques = (e: EstadoTanques) => e.tanques.length === 1
  ? [e.alvos.filter(a => a.vida <= 0).length * 100]
  : e.tanques.map(t => t.abates * 100 + (t.vivo ? t.blindagem * 30 : 0));
