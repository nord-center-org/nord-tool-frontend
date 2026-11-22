/**
 * Defesa de Base: regras puras do tower defense cooperativo (60 passos por segundo), de 1 a 8 engenheiros.
 *
 * - Os inimigos seguem a estrada da entrada (esquerda) até a base (direita). Cada um que chega tira vida da base;
 *   a base zerou, fim de jogo.
 * - O ouro é do time: vem dos cristais espalhados pelo mapa (basta passar por cima) e de cada inimigo derrubado.
 * - Nos pontos de obra (placas ao lado da estrada), B ergue a torre escolhida ou melhora a que já está lá (até o
 *   nível 3). Fora de um ponto de obra, B troca a torre escolhida: Flecha (rápida), Canhão (área) e Gelo (deixa lento).
 * - A atira na mão, com mira assistida, para ajudar as torres.
 * - Cooperativo: aguentar 10 ondas (sozinho, 8), a última com um chefão. Infinito: as ondas não param e a cada 5
 *   vem um chefão; vale quantas ondas o time aguentou.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const LARGURA = 32;
export const ALTURA = 20;
/** A estrada: pontos por onde os inimigos passam, da entrada até a base. */
export const ESTRADA: { x: number; y: number }[] = [
  { x: -0.5, y: 4 }, { x: 9, y: 4 }, { x: 9, y: 15 }, { x: 19, y: 15 }, { x: 19, y: 5 }, { x: 27, y: 5 }, { x: 27, y: 15 }, { x: 30.5, y: 15 },
];
export const BASE = { x: 30.5, y: 15 };
/** Pontos de obra, sempre ao lado da estrada. */
export const PONTOS_OBRA: { x: number; y: number }[] = [
  { x: 4, y: 6.2 }, { x: 6.5, y: 2 }, { x: 11.2, y: 7 }, { x: 6.8, y: 10 }, { x: 11.2, y: 12.5 }, { x: 14, y: 12.8 }, { x: 14, y: 17.2 },
  { x: 16.8, y: 10 }, { x: 21.2, y: 9 }, { x: 21.2, y: 13 }, { x: 23, y: 2.8 }, { x: 24.6, y: 7.2 }, { x: 29.3, y: 9 }, { x: 24.8, y: 12 }, { x: 29.6, y: 12.6 },
];
export const VIDA_BASE = 20;
export const META_ONDAS = 10;
export const META_ONDAS_SOLO = 8;
const INTERVALO = 8 * 60;
const RAIO_COLETA = 0.8;
const RAIO_OBRA = 0.9;

export type ModoDefesa = "cooperativo" | "infinito";
export type TipoTorre = "flecha" | "canhao" | "gelo";
export type TipoInimigo = "normal" | "rapido" | "blindado" | "chefe";
export const TIPOS_TORRE: TipoTorre[] = ["flecha", "canhao", "gelo"];

export const TORRES: Record<TipoTorre, { nome: string; preco: number; alcance: number; cadencia: number; dano: number; area: number; lento: number }> = {
  flecha: { nome: "Flecha", preco: 100, alcance: 3.6, cadencia: 28, dano: 1, area: 0, lento: 0 },
  canhao: { nome: "Canhão", preco: 150, alcance: 3.1, cadencia: 80, dano: 2.2, area: 1.3, lento: 0 },
  gelo: { nome: "Gelo", preco: 120, alcance: 3.1, cadencia: 50, dano: 0.4, area: 0.9, lento: 90 },
};
export const precoMelhoria = (nivel: number) => 80 * nivel;
const OURO_ABATE: Record<TipoInimigo, number> = { normal: 8, rapido: 10, blindado: 18, chefe: 150 };
const DANO_BASE: Record<TipoInimigo, number> = { normal: 1, rapido: 1, blindado: 2, chefe: 8 };
const VELOCIDADE: Record<TipoInimigo, number> = { normal: 0.034, rapido: 0.058, blindado: 0.024, chefe: 0.018 };

export interface Engenheiro {
  id: number;
  bot: Dificuldade | null;
  x: number; y: number;
  mira: { x: number; y: number };
  escolha: TipoTorre;
  recarga: number;
  pontos: number;
  abates: number;
  obras: number;
  coletas: number;
  bAnterior: boolean;
}
export interface Torre { ponto: number; tipo: TipoTorre; nivel: number; dono: number; recarga: number; mira: number }
export interface Inimigo { id: number; tipo: TipoInimigo; x: number; y: number; trecho: number; hp: number; hpMax: number; lentoAte: number }
export interface Cristal { id: number; x: number; y: number; valor: number }
export interface Bala { x: number; y: number; vx: number; vy: number; vida: number; dono: number }

export type EventoDefesa =
  | { tipo: "tiro"; jogador: number }
  | { tipo: "torre"; ponto: number; x: number; y: number; ax: number; ay: number; torre: TipoTorre }
  | { tipo: "acerto"; x: number; y: number; area: number }
  | { tipo: "abate"; x: number; y: number; inimigo: TipoInimigo; jogador: number }
  | { tipo: "base"; vida: number }
  | { tipo: "obra"; jogador: number; ponto: number; torre: TipoTorre; nivel: number }
  | { tipo: "semOuro"; jogador: number }
  | { tipo: "escolha"; jogador: number; torre: TipoTorre }
  | { tipo: "coleta"; jogador: number; valor: number; x: number; y: number }
  | { tipo: "onda"; onda: number; chefe: boolean }
  | { tipo: "fim"; venceu: boolean };

export interface EstadoDefesa {
  modo: ModoDefesa;
  jogadores: Engenheiro[];
  torres: Torre[];
  inimigos: Inimigo[];
  cristais: Cristal[];
  balas: Bala[];
  ouro: number;
  vidaBase: number;
  onda: number;
  fase: "intervalo" | "onda";
  faseAte: number;
  paraSurgir: number;
  chefePendente: boolean;
  proximoSurgir: number;
  proximoCristal: number;
  meta: number;
  passo: number;
  proximoId: number;
  sorteio: () => number;
  eventos: EventoDefesa[];
  terminado: boolean;
  venceram: boolean;
  vencedor: number | null;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const VETOR: Record<Direcao, { x: number; y: number }> = { cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 }, esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 } };

/** Distância de um ponto até a estrada (o trecho mais perto). */
export function distEstrada(x: number, y: number): number {
  let m = Infinity;
  for (let i = 0; i < ESTRADA.length - 1; i++) {
    const a = ESTRADA[i], b = ESTRADA[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    m = Math.min(m, Math.hypot(x - (a.x + dx * k), y - (a.y + dy * k)));
  }
  return m;
}

/** Quanto do caminho o inimigo já andou (para as torres mirarem no que está mais adiantado). */
export function progresso(i: Inimigo): number {
  const p = ESTRADA[i.trecho + 1] ?? BASE;
  let resto = dist(i, p);
  for (let k = i.trecho + 1; k < ESTRADA.length - 1; k++) resto += dist(ESTRADA[k], ESTRADA[k + 1]);
  return -resto;
}

export function novaPartidaDefesa(o: { modo: ModoDefesa; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoDefesa {
  const n = o.jogadores.length;
  const jogadores: Engenheiro[] = o.jogadores.map((j, i) => ({
    id: i, bot: j.bot, x: 25 + (i % 4) * 1.2, y: 17.5 + Math.floor(i / 4) * 1, mira: { x: -1, y: 0 },
    escolha: TIPOS_TORRE[i % 3], recarga: 0, pontos: 0, abates: 0, obras: 0, coletas: 0, bAnterior: false,
  }));
  const e: EstadoDefesa = {
    modo: o.modo, jogadores, torres: [], inimigos: [], cristais: [], balas: [], ouro: 220 + 40 * n, vidaBase: VIDA_BASE,
    onda: 0, fase: "intervalo", faseAte: 10 * 60, paraSurgir: 0, chefePendente: false, proximoSurgir: 0, proximoCristal: 60,
    meta: n === 1 ? META_ONDAS_SOLO : META_ONDAS, passo: 0, proximoId: 1, sorteio: rng(o.semente), eventos: [],
    terminado: false, venceram: false, vencedor: null,
  };
  for (let k = 0; k < 3; k++) soltarCristal(e);
  return e;
}

function soltarCristal(e: EstadoDefesa) {
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const x = 1 + e.sorteio() * (LARGURA - 2), y = 1 + e.sorteio() * (ALTURA - 2);
    if (distEstrada(x, y) < 1.4 || PONTOS_OBRA.some(p => dist(p, { x, y }) < 1.2) || dist(BASE, { x, y }) < 2) continue;
    e.cristais.push({ id: e.proximoId++, x, y, valor: 25 + Math.round(e.sorteio() * 3) * 5 });
    return;
  }
}

function comecarOnda(e: EstadoDefesa) {
  e.onda++;
  e.fase = "onda";
  const n = e.jogadores.length;
  e.paraSurgir = Math.round((6 + e.onda * 2.5) * (0.8 + 0.2 * n));
  e.chefePendente = e.modo === "cooperativo" ? e.onda === e.meta : e.onda % 5 === 0;
  e.proximoSurgir = e.passo + 20;
  e.eventos.push({ tipo: "onda", onda: e.onda, chefe: e.chefePendente });
}

function surgir(e: EstadoDefesa, tipo?: TipoInimigo) {
  const r = e.sorteio();
  const t: TipoInimigo = tipo ?? (e.onda >= 4 && r < 0.18 ? "blindado" : e.onda >= 2 && r < 0.42 ? "rapido" : "normal");
  const n = e.jogadores.length;
  const base = (3 + e.onda * 1.7) * (0.85 + 0.15 * n);
  const hp = Math.round((t === "chefe" ? base * 18 : t === "blindado" ? base * 2.6 : t === "rapido" ? base * 0.6 : base) * 10) / 10;
  e.inimigos.push({ id: e.proximoId++, tipo: t, x: ESTRADA[0].x, y: ESTRADA[0].y, trecho: 0, hp, hpMax: hp, lentoAte: 0 });
}

/** Dano num inimigo; blindado e chefão levam menos. Devolve se derrubou. */
function ferir(e: EstadoDefesa, i: Inimigo, dano: number, dono: number): boolean {
  if (i.hp <= 0) return false;
  i.hp -= i.tipo === "blindado" || i.tipo === "chefe" ? dano * 0.65 : dano;
  if (i.hp > 0) return false;
  const j = e.jogadores[dono];
  e.ouro += OURO_ABATE[i.tipo];
  if (j) { j.pontos += OURO_ABATE[i.tipo] * 5; j.abates++; }
  e.eventos.push({ tipo: "abate", x: i.x, y: i.y, inimigo: i.tipo, jogador: dono });
  return true;
}

function passoInimigos(e: EstadoDefesa) {
  for (const i of e.inimigos) {
    const alvo = ESTRADA[i.trecho + 1];
    if (!alvo) continue;
    const v = VELOCIDADE[i.tipo] * (e.passo < i.lentoAte ? 0.5 : 1) * (1 + Math.min(0.4, e.onda * 0.02));
    const d = dist(i, alvo);
    if (d <= v) { i.x = alvo.x; i.y = alvo.y; i.trecho++; }
    else { i.x += ((alvo.x - i.x) / d) * v; i.y += ((alvo.y - i.y) / d) * v; }
    if (i.trecho >= ESTRADA.length - 1) {
      i.hp = 0;
      e.vidaBase = Math.max(0, e.vidaBase - DANO_BASE[i.tipo]);
      e.eventos.push({ tipo: "base", vida: e.vidaBase });
    }
  }
}

export const atributos = (t: Torre) => {
  const b = TORRES[t.tipo];
  return { alcance: b.alcance + (t.nivel - 1) * 0.5, cadencia: Math.round(b.cadencia * (1 - (t.nivel - 1) * 0.15)), dano: b.dano * (1 + (t.nivel - 1) * 0.7), area: b.area, lento: b.lento };
};

function passoTorres(e: EstadoDefesa) {
  for (const t of e.torres) {
    t.recarga = Math.max(0, t.recarga - 1);
    if (t.recarga > 0) continue;
    const a = atributos(t);
    const p = PONTOS_OBRA[t.ponto];
    const alvo = e.inimigos.filter(i => i.hp > 0 && dist(i, p) <= a.alcance).sort((x, y) => progresso(y) - progresso(x))[0];
    if (!alvo) continue;
    t.recarga = a.cadencia;
    t.mira = Math.atan2(alvo.y - p.y, alvo.x - p.x);
    e.eventos.push({ tipo: "torre", ponto: t.ponto, x: p.x, y: p.y, ax: alvo.x, ay: alvo.y, torre: t.tipo });
    const atingidos = a.area > 0 ? e.inimigos.filter(i => i.hp > 0 && dist(i, alvo) <= a.area) : [alvo];
    for (const i of atingidos) {
      if (a.lento) i.lentoAte = e.passo + a.lento;
      ferir(e, i, a.dano, t.dono);
    }
    e.eventos.push({ tipo: "acerto", x: alvo.x, y: alvo.y, area: a.area });
  }
}

function miraAssistida(e: EstadoDefesa, j: Engenheiro): { x: number; y: number } {
  let melhor: Inimigo | null = null;
  for (const i of e.inimigos) {
    const dx = i.x - j.x, dy = i.y - j.y, d = Math.hypot(dx, dy);
    if (d > 8 || d < 0.01 || i.hp <= 0) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (dx * j.mira.x + dy * j.mira.y) / d)));
    if (ang < 0.7 && (!melhor || d < dist(j, melhor))) melhor = i;
  }
  if (!melhor) return j.mira;
  const d = dist(j, melhor);
  return { x: (melhor.x - j.x) / d, y: (melhor.y - j.y) / d };
}

function atirar(e: EstadoDefesa, j: Engenheiro, dir: { x: number; y: number }) {
  j.recarga = 20;
  e.balas.push({ x: j.x + dir.x * 0.4, y: j.y + dir.y * 0.4, vx: dir.x * 0.5, vy: dir.y * 0.5, vida: 22, dono: j.id });
  e.eventos.push({ tipo: "tiro", jogador: j.id });
}

function passoBalas(e: EstadoDefesa) {
  for (const b of e.balas) {
    for (let s = 0; s < 2 && b.vida > 0; s++) {
      b.x += b.vx / 2; b.y += b.vy / 2;
      const i = e.inimigos.find(q => q.hp > 0 && dist(q, b) < (q.tipo === "chefe" ? 0.8 : 0.45));
      if (i) { ferir(e, i, 0.8, b.dono); b.vida = 0; e.eventos.push({ tipo: "acerto", x: b.x, y: b.y, area: 0 }); }
    }
    b.vida--;
    if (b.x < -1 || b.y < -1 || b.x > LARGURA + 1 || b.y > ALTURA + 1) b.vida = 0;
  }
  e.balas = e.balas.filter(b => b.vida > 0);
}

/** B: no ponto de obra ergue ou melhora a torre; fora dele troca a torre escolhida. */
export function usar(e: EstadoDefesa, j: Engenheiro) {
  const ponto = PONTOS_OBRA.findIndex(p => dist(p, j) < RAIO_OBRA);
  if (ponto < 0) {
    j.escolha = TIPOS_TORRE[(TIPOS_TORRE.indexOf(j.escolha) + 1) % TIPOS_TORRE.length];
    e.eventos.push({ tipo: "escolha", jogador: j.id, torre: j.escolha });
    return;
  }
  const t = e.torres.find(x => x.ponto === ponto);
  if (t && t.nivel >= 3) return;
  const preco = t ? precoMelhoria(t.nivel) : TORRES[j.escolha].preco;
  if (e.ouro < preco) { e.eventos.push({ tipo: "semOuro", jogador: j.id }); return; }
  e.ouro -= preco;
  j.obras++;
  j.pontos += preco;
  if (t) t.nivel++;
  else e.torres.push({ ponto, tipo: j.escolha, nivel: 1, dono: j.id, recarga: 0, mira: 0 });
  const feita = t ?? e.torres[e.torres.length - 1];
  e.eventos.push({ tipo: "obra", jogador: j.id, ponto, torre: feita.tipo, nivel: feita.nivel });
}

function andar(j: Engenheiro, dx: number, dy: number) {
  j.x = Math.min(LARGURA - 0.4, Math.max(0.4, j.x + dx));
  j.y = Math.min(ALTURA - 0.4, Math.max(0.4, j.y + dy));
}

// ---------------------------------------------------------------- bots

const MIRA_BOT: Record<Dificuldade, number> = { facil: 0.4, medio: 0.18, dificil: 0.05 };

/** O que o bot quer: para onde andar, se atira e se aperta B. Cada bot cuida de uma parte da estrada. */
export function decisaoDoBot(e: EstadoDefesa, j: Engenheiro): { mover: { x: number; y: number }; atirar: { x: number; y: number } | null; b: boolean } {
  const nivel = j.bot ?? "medio";
  const ir = (alvo: { x: number; y: number }) => { const d = dist(j, alvo); return d < 0.25 ? { x: 0, y: 0 } : { x: (alvo.x - j.x) / d, y: (alvo.y - j.y) / d }; };
  const n = e.jogadores.length;
  // Pontos de obra que cabem a este bot (divididos entre todos), começando pelos do fim da estrada.
  const meus = PONTOS_OBRA.map((p, i) => ({ p, i })).filter(({ i }) => i % n === j.id % n || n > PONTOS_OBRA.length).reverse();
  const vazio = meus.find(({ i }) => !e.torres.some(t => t.ponto === i));
  const fraca = meus.map(({ i, p }) => ({ i, p, t: e.torres.find(t => t.ponto === i) })).filter(x => x.t && x.t.nivel < 3).sort((a, b) => a.t!.nivel - b.t!.nivel)[0];
  const cristal = e.cristais.slice().sort((a, b) => dist(a, j) - dist(b, j))[0];
  let mover = { x: 0, y: 0 };
  let b = false;
  const escolhaDesejada: TipoTorre = vazio ? TIPOS_TORRE[(vazio.i + j.id) % 3] : j.escolha;
  if (vazio && e.ouro >= TORRES[escolhaDesejada].preco) {
    // Longe do ponto troca a escolha até a desejada; já em cima, constrói o que estiver escolhido.
    const longe = PONTOS_OBRA.every(p => dist(p, j) > RAIO_OBRA + 0.3);
    if (j.escolha !== escolhaDesejada && longe) b = e.passo % 12 === 0;
    else b = dist(j, vazio.p) < RAIO_OBRA * 0.8 && e.passo % 10 === 0;
    mover = ir(vazio.p);
  } else if (!vazio && fraca && e.ouro >= precoMelhoria(fraca.t!.nivel) + 40) {
    mover = ir(fraca.p); b = dist(j, fraca.p) < RAIO_OBRA * 0.8 && e.passo % 10 === 0;
  } else if (cristal && dist(cristal, j) < 14) mover = ir(cristal);
  else mover = ir({ x: BASE.x - 3 - (j.id % 3), y: BASE.y + 2 });
  const perto = e.inimigos.filter(i => i.hp > 0).map(i => ({ i, d: dist(i, j) })).sort((a, c) => a.d - c.d)[0];
  let atirar: { x: number; y: number } | null = null;
  if (perto && perto.d < 7) {
    const ang = Math.atan2(perto.i.y - j.y, perto.i.x - j.x) + (e.sorteio() - 0.5) * MIRA_BOT[nivel] * 2;
    atirar = { x: Math.cos(ang), y: Math.sin(ang) };
  }
  return { mover, atirar, b };
}

// ---------------------------------------------------------------- passo

export function passoDefesa(e: EstadoDefesa, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  if (e.fase === "intervalo" && e.passo >= e.faseAte) comecarOnda(e);
  if (e.fase === "onda" && e.passo >= e.proximoSurgir) {
    if (e.paraSurgir > 0) { surgir(e); e.paraSurgir--; e.proximoSurgir = e.passo + Math.max(18, 54 - e.onda * 3); }
    else if (e.chefePendente) { surgir(e, "chefe"); e.chefePendente = false; }
  }
  const maxCristais = 4 + Math.ceil(e.jogadores.length / 2);
  if (e.passo >= e.proximoCristal) { e.proximoCristal = e.passo + 4 * 60; if (e.cristais.length < maxCristais) soltarCristal(e); }
  for (const j of e.jogadores) {
    j.recarga = Math.max(0, j.recarga - 1);
    let b: boolean;
    if (j.bot) {
      const d = decisaoDoBot(e, j);
      andar(j, d.mover.x * 0.085, d.mover.y * 0.085);
      if (d.atirar) { j.mira = d.atirar; if (j.recarga === 0) atirar(e, j, d.atirar); }
      else if (d.mover.x || d.mover.y) j.mira = d.mover;
      b = d.b;
    } else {
      const ent = entradas[j.id] ?? { direcao: null, a: false, b: false };
      if (ent.direcao) { const v = VETOR[ent.direcao]; j.mira = v; andar(j, v.x * 0.09, v.y * 0.09); }
      if (ent.a && j.recarga === 0) atirar(e, j, miraAssistida(e, j));
      b = ent.b;
    }
    if (b && !j.bAnterior) usar(e, j);
    j.bAnterior = b;
    // Cristal debaixo do pé vai para o ouro do time.
    const c = e.cristais.find(x => dist(x, j) < RAIO_COLETA);
    if (c) {
      e.cristais = e.cristais.filter(x => x !== c);
      e.ouro += c.valor; j.coletas++; j.pontos += c.valor * 2;
      e.eventos.push({ tipo: "coleta", jogador: j.id, valor: c.valor, x: c.x, y: c.y });
    }
  }
  passoInimigos(e);
  passoTorres(e);
  passoBalas(e);
  e.inimigos = e.inimigos.filter(i => i.hp > 0);
  if (e.vidaBase <= 0) return terminar(e, false);
  if (e.fase === "onda" && e.paraSurgir === 0 && !e.chefePendente && e.inimigos.length === 0) {
    e.ouro += 40 + e.onda * 10;
    if (e.modo === "cooperativo" && e.onda >= e.meta) return terminar(e, true);
    e.fase = "intervalo";
    e.faseAte = e.passo + INTERVALO;
  }
}

function terminar(e: EstadoDefesa, venceram: boolean) {
  e.terminado = true;
  e.venceram = venceram;
  // No Infinito ninguém "vence" a horda: a rodada fica com quem mais pontuou. No Cooperativo, só se venceram.
  const mvp = e.jogadores.reduce((a, b) => (b.pontos > a.pontos ? b : a)).id;
  e.vencedor = venceram || e.modo === "infinito" ? mvp : null;
  e.eventos.push({ tipo: "fim", venceu: venceram });
}

/** Pontos para o recorde: os do jogo, mais 100 por onda aguentada e a vida que sobrou na base. */
export const pontosDefesa = (e: EstadoDefesa, j: Engenheiro) => j.pontos + Math.max(0, e.onda - 1) * 100 + (e.venceram ? e.vidaBase * 50 : 0);
