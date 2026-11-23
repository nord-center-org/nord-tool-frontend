/**
 * Arena Voxel: regras puras do tiro em primeira pessoa (60 passos por segundo), de 1 a 8 jogadores, numa arena de
 * blocos com alturas (o motor desenha em 3D).
 *
 * - ↑/↓ anda para frente e para trás, ←/→ gira. A atira (mira assistida, inclusive na altura); a recarga é sozinha
 *   quando o pente acaba. B pula; pular de novo logo ao cair encadeia (até 40% mais rápido); segurar B ao cair faz
 *   deslizar (rápido e baixo por um instante).
 * - Começa com a pistola (munição infinita). Rifle (rajada), escopeta (6 chumbos) e sniper (um tiro forte) ficam
 *   nos pedestais e voltam 10 s depois de pegos; acabou a munição, volta para a pistola. Atirar seguido abre o recuo.
 * - 100 de vida; morreu, volta em 3 s num ponto de partida.
 * - Mata-Mata: 10 abates ou 3 min. Captura de Bandeira (times): leve a bandeira inimiga até a sua base; 3 capturas.
 *   Rei da Colina: ganha ponto quem fica sozinho (ou só o seu time) no topo do meio; 60 pontos. Contra Bots: todos
 *   contra 3 + n bots. Sozinho, qualquer modo vira contra bots: 10 abates em 3 min.
 */
import { rng, type Dificuldade, type Entrada } from "./bombas.ts";

export type ModoFps = "matamata" | "bandeira" | "colina" | "bots";
export type MapaFps = "templo" | "fabrica" | "gelo";
export type Arma = "pistola" | "rifle" | "escopeta" | "sniper";

export const GRADE = 24;
export const CELULA = 2;
export const TAMANHO = GRADE * CELULA;
export const ALTURA_NIVEL = 1.2;
export const VIDA = 100;
export const TEMPO = 180 * 60;
export const ABATES_META = 10;
export const CAPTURAS_META = 3;
export const COLINA_META = 60;
const RAIO = 0.4;
const VEL = 0.11;
const GIRO = 0.055;
const GRAVIDADE = 0.016;
const PULO = 0.27;
const RESPAWN = 180;

export const ARMAS: Record<Arma, { nome: string; dano: number; cadencia: number; pente: number; recarga: number; chumbos: number; abertura: number; cone: number; alcance: number; recuo: number }> = {
  pistola: { nome: "Pistola", dano: 22, cadencia: 18, pente: 12, recarga: 60, chumbos: 1, abertura: 0.02, cone: 0.16, alcance: 30, recuo: 0.02 },
  rifle: { nome: "Rifle", dano: 13, cadencia: 7, pente: 30, recarga: 90, chumbos: 1, abertura: 0.03, cone: 0.14, alcance: 35, recuo: 0.012 },
  escopeta: { nome: "Escopeta", dano: 10, cadencia: 50, pente: 6, recarga: 100, chumbos: 6, abertura: 0.2, cone: 0.22, alcance: 14, recuo: 0.05 },
  sniper: { nome: "Sniper", dano: 90, cadencia: 75, pente: 5, recarga: 110, chumbos: 1, abertura: 0, cone: 0.07, alcance: 60, recuo: 0.08 },
};
const MUNICAO_EXTRA: Record<Arma, number> = { pistola: Infinity, rifle: 90, escopeta: 18, sniper: 10 };

export interface Soldado {
  id: number;
  bot: Dificuldade | null;
  /** Bot da arena (Contra Bots / sozinho), sem vaga. */
  extra: boolean;
  time: number;
  x: number; y: number; z: number; vy: number;
  ang: number; pitch: number;
  vida: number; vivo: boolean; voltaEm: number;
  arma: Arma; pente: number; reserva: number; recarga: number; recarregando: number; recuo: number;
  noChao: boolean; bAnterior: boolean; aterrissou: number; encadeado: number; deslizaAte: number;
  abates: number; mortes: number; pontos: number;
  bandeira: number | null;
}
export interface Pedestal { x: number; z: number; arma: Arma; voltaEm: number }
export interface Bandeira { time: number; baseX: number; baseZ: number; x: number; z: number; com: number | null }

export type EventoFps =
  | { tipo: "tiro"; jogador: number; arma: Arma; x: number; y: number; z: number; ax: number; ay: number; az: number }
  | { tipo: "acerto"; jogador: number; por: number; dano: number; x: number; y: number; z: number }
  | { tipo: "abate"; jogador: number; por: number; arma: Arma }
  | { tipo: "voltou"; jogador: number }
  | { tipo: "arma"; jogador: number; arma: Arma }
  | { tipo: "recarga"; jogador: number }
  | { tipo: "pulo"; jogador: number; encadeado: number }
  | { tipo: "desliza"; jogador: number }
  | { tipo: "bandeira"; jogador: number; time: number; acao: "pegou" | "capturou" | "caiu" | "voltou" }
  | { tipo: "fim" };

export interface EstadoFps {
  modo: ModoFps;
  mapa: MapaFps;
  alturas: number[];
  soldados: Soldado[];
  pedestais: Pedestal[];
  bandeiras: Bandeira[];
  placarTimes: [number, number];
  times: boolean;
  passo: number;
  sorteio: () => number;
  eventos: EventoFps[];
  terminado: boolean;
  vencedor: number | null;
  timeVencedor: number | null;
}

const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const angulo = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const naCelula = (v: number) => Math.floor(v / CELULA);
export const altura = (e: EstadoFps, cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= GRADE || cz >= GRADE ? 9 : e.alturas[cz * GRADE + cx]);
/** Altura do chão (em unidades) no ponto. */
export const chaoEm = (e: EstadoFps, x: number, z: number) => altura(e, naCelula(x), naCelula(z)) * ALTURA_NIVEL;

/** Pontos de partida: cantos e meios das bordas (no Bandeira, cada time no seu lado). */
function saidas(): { x: number; z: number }[] {
  const c = (i: number, j: number) => ({ x: (i + 0.5) * CELULA, z: (j + 0.5) * CELULA });
  return [c(2, 2), c(GRADE - 3, GRADE - 3), c(GRADE - 3, 2), c(2, GRADE - 3), c(2, 12), c(GRADE - 3, 11), c(12, 2), c(11, GRADE - 3)];
}

export function novaPartidaFps(o: { modo: ModoFps; mapa: MapaFps; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoFps {
  const sorteio = rng(o.semente);
  // Arena simétrica: borda alta, pilares, coberturas baixas (dá para subir pulando) e a colina no meio.
  const alturas: number[] = [];
  const meia = GRADE / 2;
  const quarto: number[][] = Array.from({ length: meia }, () => Array(meia).fill(0));
  for (let z = 0; z < meia; z++) for (let x = 0; x < meia; x++) {
    if (x === 0 || z === 0) quarto[z][x] = 3;
    else if ((x === 5 || x === 9) && (z === 5 || z === 9)) quarto[z][x] = 3;
    else if (x >= 3 && z >= 3 && sorteio() < 0.12) quarto[z][x] = 1;
  }
  for (let z = 0; z < GRADE; z++) for (let x = 0; x < GRADE; x++) {
    const qx = x < meia ? x : GRADE - 1 - x, qz = z < meia ? z : GRADE - 1 - z;
    let h = quarto[qz][qx];
    if (Math.abs(x - 11.5) <= 1 && Math.abs(z - 11.5) <= 1) h = 1; // a colina (topo de 2×2 células)
    if (Math.abs(x - 11.5) <= 2.5 && Math.abs(z - 11.5) <= 2.5 && h === 3) h = 0;
    alturas.push(h);
  }
  for (const s of saidas()) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const cx = naCelula(s.x) + dx, cz = naCelula(s.z) + dz;
    if (cx > 0 && cz > 0 && cx < GRADE - 1 && cz < GRADE - 1) alturas[cz * GRADE + cx] = 0;
  }
  const times = o.modo === "bandeira" || ((o.modo === "colina") && o.jogadores.length >= 4 && o.jogadores.length % 2 === 0);
  const contraBots = o.modo === "bots" || o.jogadores.length === 1;
  const soldados: Soldado[] = o.jogadores.map((j, i) => novoSoldado(i, j.bot, false, contraBots ? 0 : times ? i % 2 : i));
  if (contraBots) for (let k = 0; k < 2 + o.jogadores.length; k++) soldados.push(novoSoldado(soldados.length, k % 3 === 0 ? "dificil" : "medio", true, 1));
  const e: EstadoFps = {
    modo: o.jogadores.length === 1 ? "bots" : o.modo, mapa: o.mapa, alturas, soldados, pedestais: [], bandeiras: [], placarTimes: [0, 0], times: times || contraBots,
    passo: 0, sorteio, eventos: [], terminado: false, vencedor: null, timeVencedor: null,
  };
  const ped = (i: number, j: number, arma: Arma) => e.pedestais.push({ x: (i + 0.5) * CELULA, z: (j + 0.5) * CELULA, arma, voltaEm: 0 });
  ped(7, 7, "rifle"); ped(GRADE - 8, GRADE - 8, "rifle"); ped(GRADE - 8, 7, "escopeta"); ped(7, GRADE - 8, "escopeta"); ped(11, 4, "sniper"); ped(12, GRADE - 5, "sniper");
  if (e.modo === "bandeira") {
    e.bandeiras.push({ time: 0, baseX: 3 * CELULA, baseZ: TAMANHO / 2, x: 3 * CELULA, z: TAMANHO / 2, com: null });
    e.bandeiras.push({ time: 1, baseX: TAMANHO - 3 * CELULA, baseZ: TAMANHO / 2, x: TAMANHO - 3 * CELULA, z: TAMANHO / 2, com: null });
  }
  for (const s of e.soldados) renascer(e, s);
  return e;
}

function novoSoldado(id: number, bot: Dificuldade | null, extra: boolean, time: number): Soldado {
  return {
    id, bot, extra, time, x: 0, y: 0, z: 0, vy: 0, ang: 0, pitch: 0, vida: VIDA, vivo: true, voltaEm: 0,
    arma: "pistola", pente: ARMAS.pistola.pente, reserva: Infinity, recarga: 0, recarregando: 0, recuo: 0,
    noChao: true, bAnterior: false, aterrissou: -99, encadeado: 0, deslizaAte: 0, abates: 0, mortes: 0, pontos: 0, bandeira: null,
  };
}

function renascer(e: EstadoFps, s: Soldado) {
  const pontos = saidas();
  // No Bandeira, cada time nasce no seu lado; nos outros, o ponto mais longe dos inimigos.
  const candidatos = e.modo === "bandeira" ? pontos.filter(p => (s.time === 0 ? p.x < TAMANHO / 2 : p.x > TAMANHO / 2)) : pontos;
  const inimigos = e.soldados.filter(o => o.vivo && o.id !== s.id && (!e.times || o.time !== s.time));
  const p = candidatos.slice().sort((a, b) => Math.min(...inimigos.map(i => dist2(i, b)), 999) - Math.min(...inimigos.map(i => dist2(i, a)), 999))[0] ?? pontos[s.id % pontos.length];
  Object.assign(s, { x: p.x + (e.sorteio() - 0.5), z: p.z + (e.sorteio() - 0.5), y: chaoEm(e, p.x, p.z), vy: 0, vida: VIDA, vivo: true, arma: "pistola" as Arma, pente: ARMAS.pistola.pente, reserva: Infinity, recarregando: 0, recuo: 0 });
  s.ang = Math.atan2(TAMANHO / 2 - s.z, TAMANHO / 2 - s.x);
}

/** Linha de visão em 3D: amostra o segmento e confere se algum bloco está acima da linha. */
export function enxerga(e: EstadoFps, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), n = Math.ceil(d / 0.3);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    if (chaoEm(e, x, z) > y) return false;
  }
  return true;
}
const olhos = (s: Soldado) => ({ x: s.x, y: s.y + (s.deslizaAte > 0 ? 0.8 : 1.5), z: s.z });
const peito = (s: Soldado) => ({ x: s.x, y: s.y + 1.1, z: s.z });
const inimigo = (e: EstadoFps, a: Soldado, b: Soldado) => b.id !== a.id && b.vivo && (!e.times || a.time !== b.time);

function mover(e: EstadoFps, s: Soldado, dx: number, dz: number) {
  // Anda eixo por eixo; sobe sozinho degrau baixo (≤ 0,6) e bate em parede.
  for (const [mx, mz] of [[dx, 0], [0, dz]]) {
    const nx = s.x + mx, nz = s.z + mz;
    let ok = true;
    for (const [ox, oz] of [[-RAIO, -RAIO], [RAIO, -RAIO], [-RAIO, RAIO], [RAIO, RAIO]]) if (chaoEm(e, nx + ox, nz + oz) > s.y + 0.6) ok = false;
    if (ok) { s.x = nx; s.z = nz; }
  }
}

function atirar(e: EstadoFps, s: Soldado) {
  const A = ARMAS[s.arma];
  if (s.recarga > 0 || s.recarregando > 0) return;
  if (s.pente <= 0) { recarregar(e, s); return; }
  s.recarga = A.cadencia; s.pente--;
  const o = olhos(s);
  // Mira assistida: o inimigo visível mais perto dentro do cone (na horizontal) puxa a mira, na altura também.
  let alvo: Soldado | null = null, melhor = Infinity;
  for (const t of e.soldados) {
    if (!inimigo(e, s, t)) continue;
    const d = dist2(s, t);
    if (d > A.alcance) continue;
    const dif = Math.abs(angulo(Math.atan2(t.z - s.z, t.x - s.x) - s.ang));
    if (dif < A.cone && d < melhor && enxerga(e, o, peito(t))) { alvo = t; melhor = d; }
  }
  const yaw = alvo ? Math.atan2(alvo.z - s.z, alvo.x - s.x) : s.ang;
  const pitch = alvo ? Math.atan2(peito(alvo).y - o.y, melhor) : 0;
  s.pitch = pitch;
  for (let k = 0; k < A.chumbos; k++) {
    const desvio = (e.sorteio() - 0.5) * 2 * (A.abertura + s.recuo), desvioY = (e.sorteio() - 0.5) * 2 * (A.abertura + s.recuo) * 0.6;
    const ya = yaw + desvio, pi = pitch + desvioY;
    const dir = { x: Math.cos(ya) * Math.cos(pi), y: Math.sin(pi), z: Math.sin(ya) * Math.cos(pi) };
    // Raio: o primeiro inimigo cuja cápsula (vertical) o raio cruza antes de bater num bloco.
    let fim = A.alcance, atingido: Soldado | null = null;
    for (let t = 0.3; t < A.alcance; t += 0.25) {
      const p = { x: o.x + dir.x * t, y: o.y + dir.y * t, z: o.z + dir.z * t };
      if (chaoEm(e, p.x, p.z) > p.y) { fim = t; break; }
      const h = e.soldados.find(q => inimigo(e, s, q) && Math.hypot(q.x - p.x, q.z - p.z) < 0.45 && p.y > q.y && p.y < q.y + 1.8);
      if (h) { fim = t; atingido = h; break; }
    }
    e.eventos.push({ tipo: "tiro", jogador: s.id, arma: s.arma, x: o.x, y: o.y - 0.15, z: o.z, ax: o.x + dir.x * fim, ay: o.y + dir.y * fim, az: o.z + dir.z * fim });
    if (atingido) ferir(e, atingido, s, A.dano * (s.arma === "escopeta" ? Math.max(0.4, 1 - fim / A.alcance) : 1));
  }
  s.recuo = Math.min(0.25, s.recuo + A.recuo);
  if (s.pente <= 0) recarregar(e, s);
}

function recarregar(e: EstadoFps, s: Soldado) {
  if (s.reserva <= 0) { trocarArma(e, s, "pistola"); return; }
  s.recarregando = ARMAS[s.arma].recarga;
  e.eventos.push({ tipo: "recarga", jogador: s.id });
}

function trocarArma(e: EstadoFps, s: Soldado, arma: Arma) {
  s.arma = arma; s.pente = ARMAS[arma].pente; s.reserva = MUNICAO_EXTRA[arma]; s.recarregando = 0; s.recarga = 10;
  e.eventos.push({ tipo: "arma", jogador: s.id, arma });
}

function ferir(e: EstadoFps, alvo: Soldado, por: Soldado, dano: number) {
  if (!alvo.vivo) return;
  alvo.vida -= dano;
  e.eventos.push({ tipo: "acerto", jogador: alvo.id, por: por.id, dano, x: alvo.x, y: alvo.y + 1.1, z: alvo.z });
  if (alvo.vida > 0) return;
  alvo.vivo = false; alvo.vida = 0; alvo.mortes++; alvo.voltaEm = e.passo + RESPAWN;
  por.abates++;
  if (e.times && e.modo !== "colina" && e.modo !== "bandeira") e.placarTimes[por.time]++;
  e.eventos.push({ tipo: "abate", jogador: alvo.id, por: por.id, arma: por.arma });
  if (alvo.bandeira !== null) {
    const b = e.bandeiras[alvo.bandeira];
    b.com = null; b.x = alvo.x; b.z = alvo.z; alvo.bandeira = null;
    e.eventos.push({ tipo: "bandeira", jogador: alvo.id, time: b.time, acao: "caiu" });
  }
}

// ---------------------------------------------------------------- bots

const ERRO_BOT: Record<Dificuldade, number> = { facil: 0.25, medio: 0.1, dificil: 0.03 };

export function decisaoDoBot(e: EstadoFps, s: Soldado): Entrada {
  const nivel = s.bot ?? "medio";
  const o = olhos(s);
  const visiveis = e.soldados.filter(t => inimigo(e, s, t) && dist2(s, t) < 35 && enxerga(e, o, peito(t)));
  const alvoVisto = visiveis.sort((a, b) => dist2(a, s) - dist2(b, s))[0];
  let destino: { x: number; z: number } | null = null;
  if (e.modo === "bandeira") {
    const minha = e.bandeiras[s.time], deles = e.bandeiras[1 - s.time];
    destino = s.bandeira !== null ? { x: minha.baseX, z: minha.baseZ } : deles.com === null ? deles : minha.com !== null ? e.soldados[minha.com] : null;
  } else if (e.modo === "colina" && !alvoVisto) destino = { x: TAMANHO / 2, z: TAMANHO / 2 };
  if (!destino && s.arma === "pistola" && !alvoVisto) destino = e.pedestais.filter(p => e.passo >= p.voltaEm).sort((a, b) => dist2(a, s) - dist2(b, s))[0] ?? null;
  if (!destino) destino = alvoVisto ?? e.soldados.filter(t => inimigo(e, s, t)).sort((a, b) => dist2(a, s) - dist2(b, s))[0] ?? { x: TAMANHO / 2, z: TAMANHO / 2 };
  const foco = alvoVisto ?? destino;
  const quer = Math.atan2(foco.z - s.z, foco.x - s.x) + (e.sorteio() - 0.5) * ERRO_BOT[nivel];
  const dif = angulo(quer - s.ang);
  const longe = dist2(s, destino) > (alvoVisto ? ARMAS[s.arma].alcance * 0.5 : 1);
  const direcao = Math.abs(dif) > 0.12 ? (dif > 0 ? "direita" : "esquerda") : longe ? "cima" : alvoVisto && dist2(s, alvoVisto) < 4 ? "baixo" : null;
  const a = !!alvoVisto && Math.abs(dif) < ARMAS[s.arma].cone && e.sorteio() < (nivel === "facil" ? 0.3 : 0.8);
  // Pula obstáculo baixo à frente.
  const frente = chaoEm(e, s.x + Math.cos(s.ang) * 1.2, s.z + Math.sin(s.ang) * 1.2);
  const b = frente > s.y + 0.6 && frente <= s.y + ALTURA_NIVEL * 1.1 && s.noChao;
  return { direcao, a, b };
}

// ---------------------------------------------------------------- passo

export function passoFps(e: EstadoFps, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  for (const s of e.soldados) {
    if (!s.vivo) {
      if (e.passo >= s.voltaEm) { renascer(e, s); e.eventos.push({ tipo: "voltou", jogador: s.id }); }
      continue;
    }
    const ent = s.bot ? decisaoDoBot(e, s) : entradas[s.id] ?? { direcao: null, a: false, b: false };
    s.recarga = Math.max(0, s.recarga - 1);
    s.recuo = Math.max(0, s.recuo - 0.004);
    if (s.recarregando > 0 && --s.recarregando === 0) {
      const tira = Math.min(ARMAS[s.arma].pente, s.reserva);
      s.pente = tira; s.reserva -= tira;
    }
    if (ent.direcao === "esquerda") s.ang = angulo(s.ang - GIRO);
    else if (ent.direcao === "direita") s.ang = angulo(s.ang + GIRO);
    const deslizando = e.passo < s.deslizaAte;
    const fator = (1 + s.encadeado * 0.1) * (deslizando ? 1.6 : 1);
    const v = (ent.direcao === "cima" || deslizando ? VEL : ent.direcao === "baixo" ? -VEL * 0.7 : 0) * fator;
    if (v) mover(e, s, Math.cos(s.ang) * v, Math.sin(s.ang) * v);
    // Pulo, pulo encadeado e deslizar.
    const chao = chaoEm(e, s.x, s.z);
    if (ent.b && !s.bAnterior && s.noChao) {
      s.encadeado = e.passo - s.aterrissou < 10 ? Math.min(4, s.encadeado + 1) : 0;
      s.vy = PULO; s.noChao = false; s.deslizaAte = 0;
      e.eventos.push({ tipo: "pulo", jogador: s.id, encadeado: s.encadeado });
    }
    s.bAnterior = ent.b;
    if (!s.noChao) {
      s.vy -= GRAVIDADE; s.y += s.vy;
      if (s.y <= chao) {
        s.y = chao; s.vy = 0; s.noChao = true; s.aterrissou = e.passo;
        if (ent.b) { s.deslizaAte = e.passo + 30; e.eventos.push({ tipo: "desliza", jogador: s.id }); }
      }
    } else if (s.y > chao + 0.05) { s.noChao = false; s.vy = 0; }
    else s.y = chao;
    if (s.noChao && e.passo - s.aterrissou > 20 && !deslizando) s.encadeado = 0;
    if (ent.a) atirar(e, s);
    // Pedestal de arma.
    for (const p of e.pedestais) if (e.passo >= p.voltaEm && dist2(p, s) < 1 && s.y < chaoEm(e, p.x, p.z) + 0.5) { p.voltaEm = e.passo + 600; trocarArma(e, s, p.arma); }
  }
  if (e.modo === "bandeira") regrasBandeira(e);
  if (e.modo === "colina" && e.passo % 60 === 0) regrasColina(e);
  verificarFim(e);
}

function regrasBandeira(e: EstadoFps) {
  for (const b of e.bandeiras) {
    if (b.com !== null) { const s = e.soldados[b.com]; b.x = s.x; b.z = s.z; continue; }
    for (const s of e.soldados) {
      if (!s.vivo || dist2(s, b) > 1.3) continue;
      if (s.time !== b.time) { b.com = s.id; s.bandeira = b.time; e.eventos.push({ tipo: "bandeira", jogador: s.id, time: b.time, acao: "pegou" }); break; }
      if (b.x !== b.baseX || b.z !== b.baseZ) { b.x = b.baseX; b.z = b.baseZ; e.eventos.push({ tipo: "bandeira", jogador: s.id, time: b.time, acao: "voltou" }); break; }
    }
  }
  for (const s of e.soldados) {
    if (!s.vivo || s.bandeira === null) continue;
    const minha = e.bandeiras[s.time];
    if (dist2(s, { x: minha.baseX, z: minha.baseZ }) < 1.6 && minha.com === null && minha.x === minha.baseX && minha.z === minha.baseZ) {
      const deles = e.bandeiras[s.bandeira];
      deles.com = null; deles.x = deles.baseX; deles.z = deles.baseZ; s.bandeira = null;
      e.placarTimes[s.time]++; s.pontos += 100;
      e.eventos.push({ tipo: "bandeira", jogador: s.id, time: deles.time, acao: "capturou" });
    }
  }
}

function regrasColina(e: EstadoFps) {
  const noTopo = e.soldados.filter(s => s.vivo && Math.abs(s.x - TAMANHO / 2) < CELULA * 1.5 && Math.abs(s.z - TAMANHO / 2) < CELULA * 1.5 && s.y >= ALTURA_NIVEL - 0.1);
  if (!noTopo.length) return;
  const donos = new Set(noTopo.map(s => (e.times ? s.time : s.id)));
  if (donos.size !== 1) return;
  for (const s of noTopo) s.pontos++;
  if (e.times) e.placarTimes[noTopo[0].time]++;
}

function verificarFim(e: EstadoFps) {
  const pessoas = e.soldados.filter(s => !s.extra);
  if (e.modo === "bots") {
    const time0 = pessoas.reduce((t, s) => t + s.abates, 0);
    if (time0 >= ABATES_META * Math.max(1, Math.ceil(pessoas.length / 2))) return terminar(e, pessoas.slice().sort((a, b) => b.abates - a.abates)[0].id, 0);
    if (e.passo >= TEMPO) return terminar(e, null, null);
    return;
  }
  if (e.modo === "bandeira") {
    const t = e.placarTimes.findIndex(p => p >= CAPTURAS_META);
    if (t >= 0 || e.passo >= TEMPO) {
      const time = t >= 0 ? t : e.placarTimes[0] === e.placarTimes[1] ? null : e.placarTimes[0] > e.placarTimes[1] ? 0 : 1;
      return terminar(e, time === null ? null : melhorDoTime(e, time), time);
    }
    return;
  }
  if (e.modo === "colina") {
    if (e.times) {
      const t = e.placarTimes.findIndex(p => p >= COLINA_META);
      if (t >= 0 || e.passo >= TEMPO) { const time = t >= 0 ? t : e.placarTimes[0] === e.placarTimes[1] ? null : e.placarTimes[0] > e.placarTimes[1] ? 0 : 1; return terminar(e, time === null ? null : melhorDoTime(e, time), time); }
      return;
    }
    const lider = pessoas.slice().sort((a, b) => b.pontos - a.pontos);
    if (lider[0].pontos >= COLINA_META || e.passo >= TEMPO) return terminar(e, lider[0].pontos === lider[1]?.pontos ? null : lider[0].id, null);
    return;
  }
  const lider = pessoas.slice().sort((a, b) => b.abates - a.abates || a.mortes - b.mortes);
  if (lider[0].abates >= ABATES_META || e.passo >= TEMPO) {
    const empate = lider[1] && lider[0].abates === lider[1].abates && lider[0].mortes === lider[1].mortes;
    terminar(e, empate ? null : lider[0].id, null);
  }
}

const melhorDoTime = (e: EstadoFps, time: number) => e.soldados.filter(s => !s.extra && s.time === time).sort((a, b) => b.pontos + b.abates * 10 - (a.pontos + a.abates * 10))[0]?.id ?? null;

function terminar(e: EstadoFps, vencedor: number | null, time: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.timeVencedor = time;
  e.eventos.push({ tipo: "fim" });
}

export const pontosFps = (e: EstadoFps) => e.soldados.filter(s => !s.extra).map(s => s.abates * 100 + s.pontos * 5 - s.mortes * 10);
