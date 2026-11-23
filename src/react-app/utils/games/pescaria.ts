/**
 * Pescaria & Submarino: regras puras (60 passos por segundo), de 1 a 8 jogadores, vista de lado.
 *
 * Pescaria: cada um num barco na superfície. ←/→ move o barco e ↑/↓ sobe e desce o anzol. Peixe que encosta no anzol
 * fica fisgado. A (segurado) puxa a linha e B solta. Puxar enquanto o peixe briga aumenta a tensão: passou do limite,
 * a linha arrebenta. Linha frouxa por muito tempo, o peixe escapa. Peixe trazido até o barco vale os pontos dele.
 *
 * Mergulho: cada um num minissubmarino. O oxigênio acaba debaixo d'água e enche na superfície. Tesouros no fundo e
 * peixes caçados com o arpão (A) viram carga, que só vale pontos quando é entregue na superfície. B dá um impulso
 * (gasta oxigênio). Águas-vivas e tubarões tiram oxigênio. Oxigênio zerou: perde a carga e volta à superfície.
 *
 * As duas partidas duram 3 minutos e vence quem fizer mais pontos. Sozinho, há uma meta de pontos.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const LW = 40;
export const LH = 24;
export const SUPERFICIE = 4;
export const TEMPO = 180 * 60;
export const META_SOLO: Record<ModoPescaria, number> = { pescaria: 500, mergulho: 400 };
export const O2_MAX = 100;
const TENSAO_FOLGA = 90;
/** Fôlego na pescaria: quantas vezes cada peixe briga depois de fisgado. */
const FOLEGO: Record<TipoPeixe, number> = { sardinha: 1, robalo: 2, baiacu: 2, atum: 3, tubarao: 4, aguaviva: 0 };

export type ModoPescaria = "pescaria" | "mergulho";
export type TipoPeixe = "sardinha" | "robalo" | "atum" | "baiacu" | "tubarao" | "aguaviva";

export const PEIXES: Record<TipoPeixe, { nome: string; pontos: number; vel: number; forca: number; prof: [number, number]; raio: number; hp: number }> = {
  sardinha: { nome: "Sardinha", pontos: 10, vel: 0.05, forca: 0.3, prof: [6, 11], raio: 0.35, hp: 1 },
  robalo: { nome: "Robalo", pontos: 25, vel: 0.04, forca: 0.55, prof: [8, 15], raio: 0.5, hp: 1 },
  baiacu: { nome: "Baiacu", pontos: 15, vel: 0.02, forca: 0.4, prof: [11, 19], raio: 0.45, hp: 1 },
  atum: { nome: "Atum", pontos: 50, vel: 0.06, forca: 0.85, prof: [10, 18], raio: 0.65, hp: 2 },
  tubarao: { nome: "Tubarão", pontos: 100, vel: 0.05, forca: 1.2, prof: [13, 20], raio: 0.9, hp: 4 },
  aguaviva: { nome: "Água-viva", pontos: 0, vel: 0.012, forca: 0, prof: [6, 18], raio: 0.45, hp: 1 },
};

export interface Pescador {
  id: number;
  bot: Dificuldade | null;
  /** Barco (pescaria) ou submarino (mergulho). */
  x: number; y: number;
  vx: number; vy: number;
  olhando: 1 | -1;
  /** Pescaria: profundidade do anzol, peixe fisgado, tensão da linha (0 a 1) e há quanto tempo está frouxa. */
  anzolY: number;
  peixe: number | null;
  tensao: number;
  folga: number;
  /** Mergulho. */
  oxigenio: number;
  carga: number;
  recarga: number;
  atordoado: number;
  voltaEm: number;
  pontos: number;
  capturas: number;
  bAnterior: boolean;
}
export interface Peixe { id: number; tipo: TipoPeixe; x: number; y: number; dir: 1 | -1; alvoY: number; fisgado: number | null; puxaAte: number; proximaBriga: number; hp: number; mordeEm: number }
export interface Tesouro { id: number; x: number; y: number; valor: number }
export interface Arpao { x: number; y: number; vx: number; dono: number; vida: number }

export type EventoPescaria =
  | { tipo: "fisgou"; jogador: number; peixe: TipoPeixe }
  | { tipo: "pegou"; jogador: number; peixe: TipoPeixe; pontos: number }
  | { tipo: "arrebentou"; jogador: number }
  | { tipo: "escapou"; jogador: number }
  | { tipo: "arpao"; jogador: number }
  | { tipo: "acertou"; jogador: number; peixe: TipoPeixe; x: number; y: number; matou: boolean }
  | { tipo: "tesouro"; jogador: number; valor: number; x: number; y: number }
  | { tipo: "entregou"; jogador: number; valor: number }
  | { tipo: "ferido"; jogador: number; por: TipoPeixe }
  | { tipo: "afogou"; jogador: number }
  | { tipo: "impulso"; jogador: number }
  | { tipo: "fim" };

export interface EstadoPescaria {
  modo: ModoPescaria;
  jogadores: Pescador[];
  peixes: Peixe[];
  tesouros: Tesouro[];
  arpoes: Arpao[];
  fundo: number[];
  passo: number;
  proximoId: number;
  sorteio: () => number;
  eventos: EventoPescaria[];
  terminado: boolean;
  vencedor: number | null;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const VETOR: Record<Direcao, { x: number; y: number }> = { cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 }, esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 } };
export const fundoEm = (e: EstadoPescaria, x: number) => e.fundo[Math.max(0, Math.min(LW - 1, Math.floor(x)))];

export function novaPartidaPescaria(o: { modo: ModoPescaria; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoPescaria {
  const sorteio = rng(o.semente);
  const n = o.jogadores.length;
  // Fundo suave entre 19 e 22,5.
  const fundo: number[] = [];
  let y = 21;
  for (let x = 0; x < LW; x++) { y = Math.max(19, Math.min(22.5, y + (sorteio() - 0.5) * 1.2)); fundo.push(Math.round(y * 10) / 10); }
  const jogadores: Pescador[] = o.jogadores.map((j, i) => ({
    id: i, bot: j.bot, x: ((i + 0.5) / n) * (LW - 4) + 2, y: SUPERFICIE, vx: 0, vy: 0, olhando: i % 2 ? -1 : 1,
    anzolY: SUPERFICIE + 2, peixe: null, tensao: 0, folga: 0, oxigenio: O2_MAX, carga: 0, recarga: 0, atordoado: 0, voltaEm: 0,
    pontos: 0, capturas: 0, bAnterior: false,
  }));
  const e: EstadoPescaria = { modo: o.modo, jogadores, peixes: [], tesouros: [], arpoes: [], fundo, passo: 0, proximoId: 1, sorteio, eventos: [], terminado: false, vencedor: null };
  povoar(e);
  return e;
}

/** Mantém o mar cheio: peixes conforme o número de jogadores e, no mergulho, tesouros no fundo e águas-vivas. */
function povoar(e: EstadoPescaria) {
  const n = e.jogadores.length;
  const peixes = e.peixes.filter(p => p.tipo !== "aguaviva").length;
  const alvo = 8 + n * 2;
  for (let k = peixes; k < alvo; k++) {
    const r = e.sorteio();
    const tipo: TipoPeixe = r < 0.35 ? "sardinha" : r < 0.6 ? "robalo" : r < 0.78 ? "baiacu" : r < 0.94 ? "atum" : "tubarao";
    soltarPeixe(e, tipo);
  }
  if (e.modo !== "mergulho") return;
  const vivas = e.peixes.filter(p => p.tipo === "aguaviva").length;
  for (let k = vivas; k < 3 + Math.ceil(n / 2); k++) soltarPeixe(e, "aguaviva");
  for (let k = e.tesouros.length; k < 5 + n; k++) {
    const x = 1 + e.sorteio() * (LW - 2);
    e.tesouros.push({ id: e.proximoId++, x, y: fundoEm(e, x) - 0.4, valor: 20 + Math.round(e.sorteio() * 6) * 10 });
  }
}

function soltarPeixe(e: EstadoPescaria, tipo: TipoPeixe) {
  const P = PEIXES[tipo];
  const dir: 1 | -1 = e.sorteio() < 0.5 ? 1 : -1;
  const y = P.prof[0] + e.sorteio() * (P.prof[1] - P.prof[0]);
  // Entra pela borda (menos no começo, quando já nasce espalhado).
  const x = e.passo === 0 ? 1 + e.sorteio() * (LW - 2) : dir === 1 ? -0.8 : LW + 0.8;
  e.peixes.push({ id: e.proximoId++, tipo, x, y, dir, alvoY: y, fisgado: null, puxaAte: 0, proximaBriga: 0, hp: P.hp, mordeEm: 0 });
}

function nadar(e: EstadoPescaria, p: Peixe) {
  const P = PEIXES[p.tipo];
  p.x += P.vel * p.dir;
  if (e.sorteio() < 0.01) p.alvoY = P.prof[0] + e.sorteio() * (P.prof[1] - P.prof[0]);
  p.y += Math.sign(p.alvoY - p.y) * Math.min(Math.abs(p.alvoY - p.y), 0.02);
  p.y = Math.min(fundoEm(e, p.x) - 0.5, p.y);
}

// ---------------------------------------------------------------- pescaria

function passoPescador(e: EstadoPescaria, j: Pescador, ent: { direcao: Direcao | null; puxar: boolean; soltar: boolean }) {
  const peixe = j.peixe !== null ? e.peixes.find(p => p.id === j.peixe) : undefined;
  if (!peixe) {
    j.peixe = null; j.tensao = 0; j.folga = 0;
    if (ent.direcao === "esquerda" || ent.direcao === "direita") { j.x = Math.max(1, Math.min(LW - 1, j.x + VETOR[ent.direcao].x * 0.1)); j.olhando = ent.direcao === "esquerda" ? -1 : 1; }
    if (ent.direcao === "cima" || ent.direcao === "baixo") j.anzolY = Math.max(SUPERFICIE + 0.8, Math.min(fundoEm(e, j.x) - 0.4, j.anzolY + VETOR[ent.direcao].y * 0.13));
    if (ent.puxar) j.anzolY = Math.max(SUPERFICIE + 0.8, j.anzolY - 0.13);
    const anzol = { x: j.x, y: j.anzolY };
    const f = e.peixes.find(p => p.fisgado === null && p.tipo !== "aguaviva" && dist(p, anzol) < PEIXES[p.tipo].raio + 0.25);
    if (f) {
      f.fisgado = j.id; j.peixe = f.id; j.tensao = 0.3; f.proximaBriga = e.passo + 30; f.hp = FOLEGO[f.tipo];
      e.eventos.push({ tipo: "fisgou", jogador: j.id, peixe: f.tipo });
    }
    return;
  }
  const P = PEIXES[peixe.tipo];
  // O peixe briga de tempos em tempos (puxa por um tempo e descansa).
  // Cada briga cansa o peixe: os grandes brigam mais vezes (o "hp" vira fôlego), depois vêm mansos.
  if (e.passo >= peixe.proximaBriga && peixe.hp > 0) { peixe.hp--; peixe.puxaAte = e.passo + 30 + Math.floor(e.sorteio() * 60 * P.forca + 20); peixe.proximaBriga = peixe.puxaAte + 40 + Math.floor(e.sorteio() * 90); }
  const briga = e.passo < peixe.puxaAte;
  let dt: number;
  const barco = { x: j.x, y: SUPERFICIE };
  const d = Math.max(0.01, dist(peixe, barco));
  let v = 0;
  if (ent.soltar) { dt = -0.03; v = briga ? -0.05 * P.forca : 0; }
  // Peixe descansando: puxar recolhe a linha e a tensão assenta perto da metade.
  else if (ent.puxar) { dt = briga ? 0.009 + 0.018 * P.forca : (0.45 - j.tensao) * 0.03; v = briga ? 0.008 : 0.06; }
  else { dt = briga ? 0.004 * P.forca : -0.008; v = briga ? -0.035 * P.forca : 0; }
  j.tensao = Math.max(0, j.tensao + dt);
  peixe.x += ((barco.x - peixe.x) / d) * v;
  peixe.y = Math.min(fundoEm(e, peixe.x) - 0.4, peixe.y + ((barco.y - peixe.y) / d) * v);
  if (briga && !ent.puxar) peixe.x += peixe.dir * 0.02;
  peixe.x = Math.max(0.5, Math.min(LW - 0.5, peixe.x));
  j.anzolY = peixe.y;
  if (j.tensao >= 1) {
    peixe.fisgado = null; j.peixe = null; j.tensao = 0; j.anzolY = SUPERFICIE + 2;
    e.eventos.push({ tipo: "arrebentou", jogador: j.id });
    return;
  }
  j.folga = j.tensao <= 0 ? j.folga + 1 : 0;
  if (j.folga > TENSAO_FOLGA) {
    peixe.fisgado = null; j.peixe = null; j.anzolY = SUPERFICIE + 2; j.folga = 0;
    e.eventos.push({ tipo: "escapou", jogador: j.id });
    return;
  }
  if (peixe.y <= SUPERFICIE + 0.9 && Math.abs(peixe.x - j.x) < 1.2) {
    e.peixes = e.peixes.filter(p => p !== peixe);
    j.peixe = null; j.tensao = 0; j.anzolY = SUPERFICIE + 2; j.pontos += P.pontos; j.capturas++;
    e.eventos.push({ tipo: "pegou", jogador: j.id, peixe: peixe.tipo, pontos: P.pontos });
  }
}

// ---------------------------------------------------------------- mergulho

function passoMergulhador(e: EstadoPescaria, j: Pescador, ent: { direcao: Direcao | null; puxar: boolean; soltar: boolean }) {
  if (j.voltaEm > e.passo) return;
  j.recarga = Math.max(0, j.recarga - 1);
  if (j.atordoado > 0) j.atordoado--;
  const lento = 1 / (1 + j.carga / 200);
  if (ent.direcao && j.atordoado === 0) {
    const v = VETOR[ent.direcao];
    j.vx += v.x * 0.012; j.vy += v.y * 0.012;
    if (v.x) j.olhando = v.x < 0 ? -1 : 1;
  }
  if (ent.soltar && !j.bAnterior && j.oxigenio > 12 && j.atordoado === 0) {
    j.vx += j.olhando * 0.18; j.oxigenio -= 8;
    e.eventos.push({ tipo: "impulso", jogador: j.id });
  }
  j.bAnterior = ent.soltar;
  j.vx *= 0.92; j.vy *= 0.92;
  const max = 0.16 * lento;
  const sp = Math.hypot(j.vx, j.vy);
  if (sp > max && !(ent.soltar && j.vx)) { j.vx *= max / sp; j.vy *= max / sp; }
  j.x = Math.max(0.6, Math.min(LW - 0.6, j.x + j.vx));
  j.y = Math.max(SUPERFICIE, Math.min(fundoEm(e, j.x) - 0.5, j.y + j.vy));
  // Oxigênio: enche na superfície (e entrega a carga), acaba no fundo.
  if (j.y <= SUPERFICIE + 0.3) {
    j.oxigenio = Math.min(O2_MAX, j.oxigenio + 1);
    if (j.carga > 0) { j.pontos += j.carga; e.eventos.push({ tipo: "entregou", jogador: j.id, valor: j.carga }); j.carga = 0; }
  } else j.oxigenio -= 0.045 + (j.y > 15 ? 0.02 : 0);
  if (j.oxigenio <= 0) {
    j.oxigenio = O2_MAX; j.carga = 0; j.x = Math.max(1, Math.min(LW - 1, j.x)); j.y = SUPERFICIE; j.vx = 0; j.vy = 0;
    j.voltaEm = e.passo + 180;
    e.eventos.push({ tipo: "afogou", jogador: j.id });
    return;
  }
  if (ent.puxar && j.recarga === 0 && j.atordoado === 0) {
    j.recarga = 40;
    e.arpoes.push({ x: j.x + j.olhando * 0.6, y: j.y, vx: j.olhando * 0.4, dono: j.id, vida: 30 });
    e.eventos.push({ tipo: "arpao", jogador: j.id });
  }
  const t = e.tesouros.find(x => dist(x, j) < 0.8);
  if (t) {
    e.tesouros = e.tesouros.filter(x => x !== t);
    j.carga += t.valor; j.capturas++;
    e.eventos.push({ tipo: "tesouro", jogador: j.id, valor: t.valor, x: t.x, y: t.y });
  }
  // Perigos: água-viva queima e tubarão morde.
  for (const p of e.peixes) {
    if ((p.tipo !== "aguaviva" && p.tipo !== "tubarao") || e.passo < p.mordeEm || dist(p, j) > PEIXES[p.tipo].raio + 0.4) continue;
    p.mordeEm = e.passo + 90;
    j.oxigenio -= p.tipo === "tubarao" ? 30 : 18;
    j.atordoado = 40;
    if (p.tipo === "tubarao") j.carga = Math.floor(j.carga / 2);
    e.eventos.push({ tipo: "ferido", jogador: j.id, por: p.tipo });
  }
}

function passoArpoes(e: EstadoPescaria) {
  for (const a of e.arpoes) {
    a.x += a.vx; a.vida--;
    const p = e.peixes.find(q => q.tipo !== "aguaviva" && dist(q, a) < PEIXES[q.tipo].raio + 0.15);
    if (!p) continue;
    a.vida = 0; p.hp--;
    const matou = p.hp <= 0;
    if (matou) { e.peixes = e.peixes.filter(q => q !== p); const j = e.jogadores[a.dono]; j.carga += PEIXES[p.tipo].pontos; j.capturas++; }
    e.eventos.push({ tipo: "acertou", jogador: a.dono, peixe: p.tipo, x: p.x, y: p.y, matou });
  }
  e.arpoes = e.arpoes.filter(a => a.vida > 0 && a.x > -1 && a.x < LW + 1);
}

// ---------------------------------------------------------------- bots

const ERRO_BOT: Record<Dificuldade, number> = { facil: 0.25, medio: 0.12, dificil: 0.03 };

export function decisaoDoBot(e: EstadoPescaria, j: Pescador): { direcao: Direcao | null; puxar: boolean; soltar: boolean } {
  const nivel = j.bot ?? "medio";
  const rumo = (dx: number, dy: number): Direcao | null => (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15 ? null : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "esquerda" : "direita") : dy < 0 ? "cima" : "baixo");
  if (e.modo === "pescaria") {
    const fisgado = j.peixe !== null ? e.peixes.find(p => p.id === j.peixe) : undefined;
    if (fisgado) {
      const briga = e.passo < fisgado.puxaAte;
      const limite = 0.82 - ERRO_BOT[nivel] * (e.sorteio() < 0.5 ? 1 : -1);
      return { direcao: null, puxar: j.tensao < (briga ? 0.35 : limite), soltar: j.tensao > 0.92 - ERRO_BOT[nivel] };
    }
    // Vai atrás do peixe livre que vale mais por distância (cada bot de olho num pedaço do mar).
    const livres = e.peixes.filter(p => p.fisgado === null && p.tipo !== "aguaviva" && p.x > 0 && p.x < LW);
    const alvo = livres.sort((a, b) => dist(b, j) / PEIXES[b.tipo].pontos - dist(a, j) / PEIXES[a.tipo].pontos).pop();
    if (!alvo) return { direcao: null, puxar: false, soltar: false };
    // Chega perto o bastante para a isca atrair (ou mira direto no peixe).
    const dx = alvo.x + alvo.dir * 0.6 - j.x, dy = alvo.y - j.anzolY;
    return { direcao: rumo(dx, dy), puxar: false, soltar: false };
  }
  const prof = j.y - SUPERFICIE;
  const voltar = j.oxigenio < prof * 2.4 + 22 || j.carga >= 160;
  if (voltar) return { direcao: rumo(0, SUPERFICIE - j.y), puxar: false, soltar: false };
  const perigo = e.peixes.find(p => (p.tipo === "aguaviva" || p.tipo === "tubarao") && dist(p, j) < 2.2);
  if (perigo) return { direcao: rumo(j.x - perigo.x, j.y - perigo.y), puxar: false, soltar: e.sorteio() < 0.02 };
  const presa = e.peixes.find(p => p.tipo !== "aguaviva" && Math.abs(p.y - j.y) < 0.5 && (p.x - j.x) * j.olhando > 0 && Math.abs(p.x - j.x) < 6);
  const puxar = !!presa && e.sorteio() > ERRO_BOT[nivel];
  const t = e.tesouros.slice().sort((a, b) => dist(a, j) - dist(b, j))[0];
  if (t) return { direcao: rumo(t.x - j.x, t.y - j.y), puxar, soltar: false };
  return { direcao: null, puxar, soltar: false };
}

// ---------------------------------------------------------------- passo

export function passoPescaria(e: EstadoPescaria, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  for (const p of e.peixes) {
    if (p.fisgado !== null) continue;
    if (e.modo === "mergulho" && p.tipo === "tubarao") {
      // O tubarão caça o submarino mais perto.
      const s = e.jogadores.filter(j => j.y > SUPERFICIE + 1 && e.passo >= j.voltaEm).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (s && dist(s, p) < 6) {
        const d = Math.max(0.01, dist(s, p));
        p.x += ((s.x - p.x) / d) * 0.035; p.y += ((s.y - p.y) / d) * 0.035; p.dir = s.x < p.x ? -1 : 1;
        continue;
      }
    }
    // A isca atrai: peixe livre perto de um anzol vai até ele.
    if (e.modo === "pescaria" && p.tipo !== "aguaviva") {
      const isca = e.jogadores.filter(j => j.peixe === null).map(j => ({ x: j.x, y: j.anzolY })).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (isca && dist(isca, p) < 3) {
        const d = Math.max(0.01, dist(isca, p)), v = PEIXES[p.tipo].vel * 0.7;
        p.x += ((isca.x - p.x) / d) * v; p.y += ((isca.y - p.y) / d) * v; p.dir = isca.x < p.x ? -1 : 1;
        continue;
      }
    }
    nadar(e, p);
  }
  e.peixes = e.peixes.filter(p => p.fisgado !== null || (p.x > -1.5 && p.x < LW + 1.5));
  for (const j of e.jogadores) {
    let ent: { direcao: Direcao | null; puxar: boolean; soltar: boolean };
    if (j.bot) ent = decisaoDoBot(e, j);
    else { const x = entradas[j.id] ?? { direcao: null, a: false, b: false }; ent = { direcao: x.direcao, puxar: x.a, soltar: x.b }; }
    if (e.modo === "pescaria") passoPescador(e, j, ent);
    else passoMergulhador(e, j, ent);
  }
  if (e.modo === "mergulho") passoArpoes(e);
  if (e.passo % 30 === 0) povoar(e);
  if (e.passo >= TEMPO) terminar(e);
}

function terminar(e: EstadoPescaria) {
  e.terminado = true;
  if (e.modo === "mergulho") for (const j of e.jogadores) if (j.y <= SUPERFICIE + 0.3) { j.pontos += j.carga; j.carga = 0; }
  if (e.jogadores.length === 1) e.vencedor = e.jogadores[0].pontos >= META_SOLO[e.modo] ? 0 : null;
  else {
    const max = Math.max(...e.jogadores.map(j => j.pontos));
    const lideres = e.jogadores.filter(j => j.pontos === max);
    // Empate nos pontos: desempata por capturas.
    const melhor = lideres.sort((a, b) => b.capturas - a.capturas);
    e.vencedor = melhor.length === 1 || melhor[0].capturas > melhor[1].capturas ? melhor[0].id : null;
  }
  e.eventos.push({ tipo: "fim" });
}
