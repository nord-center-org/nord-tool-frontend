/**
 * Cozinha Caótica: regras puras do cooperativo de pedidos (60 passos por segundo), de 1 a 8 jogadores, numa cozinha
 * em grade (o motor desenha em 3D).
 *
 * - Setas andam; A pega/solta/junta o que está à frente; B usa (corta na tábua, lava na pia, apaga com o extintor).
 * - Receitas: Salada (alface + tomate picados), Hambúrguer (pão + carne picada e frita), Hambúrguer com salada (+ alface)
 *   e Sopa (3 tomates picados cozidos na panela). Tudo é servido num prato limpo e entregue no balcão de entrega.
 * - Panela/frigideira no fogão cozinham; esquecidas, queimam e depois pegam fogo, que se espalha pelos balcões até
 *   alguém apagar com o extintor. Comida queimada vai para a lixeira.
 * - Prato entregue volta sujo em 5 s no retorno; leva-se à pia e lava-se (B) para voltar à pilha.
 * - Pedidos têm prazo: entregar dá pontos + gorjeta (maior quanto mais cedo) × combo; deixar vencer tira 10.
 * - Cooperativo: todos numa cozinha, 3 minutos, meta de pontos (1 a 3 estrelas). Duelo de Cozinhas: dois times, uma
 *   cozinha cada, com os mesmos pedidos; mais pontos vence. Desafio Solo: a meta de uma pessoa.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export type ModoCozinha = "coop" | "duelo" | "solo";
export type TemaCozinha = "bistro" | "food" | "navio";
export type Ingrediente = "tomate" | "alface" | "carne" | "pao";
export type Componente = "tomate" | "alface" | "carne" | "pao" | "sopa";
export type Receita = "salada" | "burger" | "burgerSalada" | "sopa";
export type TipoCelula = "chao" | "balcao" | "caixa" | "tabua" | "fogao" | "pia" | "retorno" | "pilha" | "entrega" | "lixeira";

export const LARGURA = 13;
export const ALTURA = 7;
export const TEMPO = 180 * 60;
const VEL = 0.075;
const RAIO = 0.3;
const CORTE = 90;
const LAVAR = 80;
const COZ_FRIGIDEIRA = 300;
const COZ_PANELA = 420;
const QUEIMA = 1.8;
const INCENDIO = 2.4;
const RETORNO = 300;
const ESPALHA = 240;

export const RECEITAS: Record<Receita, { nome: string; itens: Componente[]; base: number; prazo: number }> = {
  salada: { nome: "Salada", itens: ["alface", "tomate"], base: 20, prazo: 60 * 60 },
  burger: { nome: "Hambúrguer", itens: ["pao", "carne"], base: 25, prazo: 70 * 60 },
  burgerSalada: { nome: "Hambúrguer com salada", itens: ["pao", "carne", "alface"], base: 35, prazo: 80 * 60 },
  sopa: { nome: "Sopa de tomate", itens: ["sopa"], base: 30, prazo: 80 * 60 },
};

export type Item =
  | { k: "ing"; ing: Ingrediente; corte: number }
  | { k: "prato"; itens: Componente[] }
  | { k: "sujos"; n: number }
  | { k: "panela" | "frigideira"; tomates: number; carne: boolean; coz: number; queimado: boolean }
  | { k: "extintor" };

export interface Celula {
  tipo: TipoCelula;
  cozinha: number;
  caixa?: Ingrediente;
  item: Item | null;
  fogo: number;
  /** Pilha: pratos limpos; pia/retorno: pratos sujos. */
  pratos: number;
  lavagem: number;
}
export interface Cozinheiro {
  id: number;
  bot: Dificuldade | null;
  time: number;
  x: number; z: number;
  dir: Direcao;
  mao: Item | null;
  aAnterior: boolean;
  entregas: number;
  pontos: number;
  /** Bots: pedido que assumiu, prato que monta e onde quer agir. */
  pedido: number | null; montagem: number | null; alvo: number | null; pausa: number;
}
export interface Pedido { id: number; receita: Receita; cozinha: number; criado: number; prazo: number }

export type EventoCozinha =
  | { tipo: "pegou" | "soltou" | "juntou"; jogador: number; x: number; z: number }
  | { tipo: "corte"; jogador: number; x: number; z: number; pronto: boolean }
  | { tipo: "lavou"; jogador: number; x: number; z: number }
  | { tipo: "entrega"; jogador: number; cozinha: number; receita: Receita; pontos: number; combo: number }
  | { tipo: "errado"; jogador: number }
  | { tipo: "venceu"; cozinha: number; receita: Receita }
  | { tipo: "pedido"; cozinha: number; receita: Receita }
  | { tipo: "pronto" | "queimou" | "fogo" | "apagou"; x: number; z: number }
  | { tipo: "extintor"; jogador: number; x: number; z: number }
  | { tipo: "fim" };

export interface EstadoCozinha {
  modo: ModoCozinha;
  tema: TemaCozinha;
  largura: number;
  celulas: Celula[];
  cozinheiros: Cozinheiro[];
  cozinhas: number;
  pedidos: Pedido[];
  proximoPedido: number[];
  pontos: number[];
  combo: number[];
  retornos: { cozinha: number; em: number }[];
  meta: number;
  passo: number;
  sorteio: () => number;
  eventos: EventoCozinha[];
  terminado: boolean;
  vencedor: number | null;
  timeVencedor: number | null;
  idPedido: number;
  saco: Receita[];
}

// Planta de uma cozinha (13×7): t/a/c/p caixas, x tábua, f fogão, s pia, r retorno, o pilha, e entrega, l lixeira, X extintor.
const PLANTA = [
  "#tacp#f#f#e##",
  "x...........#",
  "x...#o#X#...r",
  "#...#l#f#...s",
  "#...........s",
  "#...........#",
  "#############",
];
const CAIXAS: Record<string, Ingrediente> = { t: "tomate", a: "alface", c: "carne", p: "pao" };
const DIRS: Record<Direcao, [number, number]> = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] };

export const idx = (e: EstadoCozinha, x: number, z: number) => z * e.largura + x;
export const celulaEm = (e: EstadoCozinha, x: number, z: number): Celula | null =>
  x < 0 || z < 0 || x >= e.largura || z >= ALTURA ? null : e.celulas[idx(e, x, z)];
const solida = (e: EstadoCozinha, x: number, z: number) => { const c = celulaEm(e, Math.floor(x), Math.floor(z)); return !c || c.tipo !== "chao"; };

export function novaPartidaCozinha(o: { modo: ModoCozinha; tema: TemaCozinha; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoCozinha {
  const n = o.jogadores.length;
  const modo: ModoCozinha = n === 1 ? "solo" : o.modo === "duelo" && n >= 2 ? "duelo" : o.modo === "solo" ? "coop" : o.modo;
  const cozinhas = modo === "duelo" ? 2 : 1;
  const largura = LARGURA * cozinhas;
  const celulas: Celula[] = [];
  for (let z = 0; z < ALTURA; z++) for (let x = 0; x < largura; x++) {
    const k = Math.floor(x / LARGURA), ch = PLANTA[z][x % LARGURA];
    const tipo: TipoCelula = ch === "." ? "chao" : CAIXAS[ch] ? "caixa" : ch === "x" ? "tabua" : ch === "f" ? "fogao" : ch === "s" ? "pia" : ch === "r" ? "retorno" : ch === "o" ? "pilha" : ch === "e" ? "entrega" : ch === "l" ? "lixeira" : "balcao";
    const c: Celula = { tipo, cozinha: k, item: null, fogo: 0, pratos: 0, lavagem: 0 };
    if (CAIXAS[ch]) c.caixa = CAIXAS[ch];
    if (ch === "X") c.item = { k: "extintor" };
    if (tipo === "pilha") c.pratos = 4 + Math.floor(n / (2 * cozinhas));
    celulas.push(c);
  }
  const e: EstadoCozinha = {
    modo, tema: o.tema, largura, celulas, cozinheiros: [], cozinhas, pedidos: [], proximoPedido: Array(cozinhas).fill(60), pontos: Array(cozinhas).fill(0),
    combo: Array(cozinhas).fill(0), retornos: [], meta: 0, passo: 0, sorteio: rng(o.semente), eventos: [], terminado: false, vencedor: null, timeVencedor: null, idPedido: 0, saco: [],
  };
  // Panelas: os dois fogões de cima com frigideira e panela, o da ilha com frigideira.
  for (let k = 0; k < cozinhas; k++) {
    const b = k * LARGURA;
    e.celulas[idx(e, b + 6, 0)].item = { k: "panela", tomates: 0, carne: false, coz: 0, queimado: false };
    e.celulas[idx(e, b + 8, 0)].item = { k: "frigideira", tomates: 0, carne: false, coz: 0, queimado: false };
    e.celulas[idx(e, b + 7, 3)].item = { k: "frigideira", tomates: 0, carne: false, coz: 0, queimado: false };
  }
  const lugares = [[2, 4], [10, 4], [6, 5], [2, 1], [10, 1], [6, 1], [3, 5], [9, 5]];
  o.jogadores.forEach((j, i) => {
    const time = cozinhas === 2 ? i % 2 : 0;
    const pos = lugares[Math.floor(i / cozinhas) % lugares.length];
    e.cozinheiros.push({ id: i, bot: j.bot, time, x: time * LARGURA + pos[0] + 0.5, z: pos[1] + 0.5, dir: "cima", mao: null, aAnterior: false, entregas: 0, pontos: 0, pedido: null, montagem: null, alvo: null, pausa: 0 });
  });
  const porCozinha = Math.ceil(n / cozinhas);
  e.meta = metaCozinha(porCozinha);
  return e;
}

/** Pontos para 1 estrela: cresce com o número de pessoas numa cozinha. */
export const metaCozinha = (pessoas: number) => Math.round(250 * (1 + 0.4 * (Math.min(pessoas, 6) - 1)));
export const estrelas = (e: EstadoCozinha, k = 0) => (e.pontos[k] >= e.meta * 2 ? 3 : e.pontos[k] >= e.meta * 1.5 ? 2 : e.pontos[k] >= e.meta ? 1 : 0);

function pessoasNaCozinha(e: EstadoCozinha, k: number) { return e.cozinheiros.filter(c => c.time === k).length; }

function novoPedido(e: EstadoCozinha, k: number, receita?: Receita) {
  // Saco embaralhado: as quatro receitas aparecem a cada quatro pedidos.
  if (!receita && !e.saco.length) {
    e.saco = ["salada", "burger", "burgerSalada", "sopa"];
    for (let i = 3; i > 0; i--) { const j = Math.floor(e.sorteio() * (i + 1)); [e.saco[i], e.saco[j]] = [e.saco[j], e.saco[i]]; }
  }
  const r = receita ?? e.saco.pop()!;
  e.pedidos.push({ id: ++e.idPedido, receita: r, cozinha: k, criado: e.passo, prazo: e.passo + RECEITAS[r].prazo });
  e.eventos.push({ tipo: "pedido", cozinha: k, receita: r });
}

// ---------------------------------------------------------------- interação

const final = (it: Item): Componente | null => {
  if (it.k !== "ing") return null;
  if (it.ing === "pao") return "pao";
  if ((it.ing === "alface" || it.ing === "tomate") && it.corte >= 1) return it.ing;
  return null;
};
const vasilhaPronta = (v: Item): Componente | null => {
  if (v.k !== "panela" && v.k !== "frigideira") return null;
  if (v.queimado || v.coz < 1) return null;
  if (v.k === "frigideira" && v.carne) return "carne";
  if (v.k === "panela" && v.tomates >= 3) return "sopa";
  return null;
};
/** O componente cabe no prato (o prato continua a caminho de alguma receita). */
export const cabeNoPrato = (itens: Componente[], c: Componente) => {
  const novo = [...itens, c];
  return Object.values(RECEITAS).some(r => {
    const resta = [...r.itens];
    return novo.every(x => { const i = resta.indexOf(x); if (i < 0) return false; resta.splice(i, 1); return true; });
  });
};
const esvaziar = (v: Item) => { if (v.k === "panela" || v.k === "frigideira") Object.assign(v, { tomates: 0, carne: false, coz: 0, queimado: false }); };

export function frente(e: EstadoCozinha, s: Cozinheiro): number {
  const [dx, dz] = DIRS[s.dir];
  return idx(e, Math.floor(s.x) + dx, Math.floor(s.z) + dz);
}

function botaoA(e: EstadoCozinha, s: Cozinheiro) {
  const i = frente(e, s), c = e.celulas[i];
  if (!c || c.tipo === "chao" || c.fogo > 0) return;
  const x = i % e.largura + 0.5, z = Math.floor(i / e.largura) + 0.5;
  const ev = (tipo: "pegou" | "soltou" | "juntou") => e.eventos.push({ tipo, jogador: s.id, x, z });
  const mao = s.mao;
  if (c.tipo === "caixa") {
    if (!mao) { s.mao = { k: "ing", ing: c.caixa!, corte: 0 }; ev("pegou"); }
    else if (mao.k === "prato" && c.caixa === "pao" && cabeNoPrato(mao.itens, "pao")) { mao.itens.push("pao"); ev("juntou"); }
    return;
  }
  if (c.tipo === "pilha") {
    if (!mao && c.pratos > 0) { c.pratos--; s.mao = { k: "prato", itens: [] }; ev("pegou"); }
    else if (mao?.k === "prato" && !mao.itens.length) { c.pratos++; s.mao = null; ev("soltou"); }
    return;
  }
  if (c.tipo === "retorno") { if (!mao && c.pratos > 0) { s.mao = { k: "sujos", n: c.pratos }; c.pratos = 0; ev("pegou"); } return; }
  if (c.tipo === "pia") { if (mao?.k === "sujos") { c.pratos += mao.n; s.mao = null; ev("soltou"); } return; }
  if (c.tipo === "entrega") { if (mao?.k === "prato" && mao.itens.length) entregar(e, s, c.cozinha); return; }
  if (c.tipo === "lixeira") {
    if (mao?.k === "ing") s.mao = null;
    else if (mao?.k === "prato") mao.itens = [];
    else if (mao) esvaziar(mao);
    ev("soltou");
    return;
  }
  // Balcão, tábua e fogão: apoiar, pegar ou juntar.
  const it = c.item;
  if (!mao) { if (it) { s.mao = it; c.item = null; ev("pegou"); } return; }
  if (!it) {
    if (c.tipo === "fogao" && mao.k !== "panela" && mao.k !== "frigideira") return;
    c.item = mao; s.mao = null; ev("soltou"); return;
  }
  // Juntar.
  const f = final(mao);
  if (f && it.k === "prato" && cabeNoPrato(it.itens, f)) { it.itens.push(f); s.mao = null; ev("juntou"); return; }
  const g = final(it);
  if (g && mao.k === "prato" && cabeNoPrato(mao.itens, g)) { mao.itens.push(g); c.item = null; ev("juntou"); return; }
  if (mao.k === "ing" && mao.corte >= 1 && (it.k === "panela" || it.k === "frigideira") && !it.queimado) {
    if (it.k === "panela" && mao.ing === "tomate" && it.tomates < 3) { it.tomates++; if (it.tomates < 3) it.coz = 0; s.mao = null; ev("juntou"); return; }
    if (it.k === "frigideira" && mao.ing === "carne" && !it.carne) { it.carne = true; it.coz = 0; s.mao = null; ev("juntou"); return; }
  }
  const pv = vasilhaPronta(it);
  if (pv && mao.k === "prato" && cabeNoPrato(mao.itens, pv)) { mao.itens.push(pv); esvaziar(it); ev("juntou"); return; }
  const pm = vasilhaPronta(mao);
  if (pm && it.k === "prato" && cabeNoPrato(it.itens, pm)) { it.itens.push(pm); esvaziar(mao); ev("juntou"); return; }
}

function botaoB(e: EstadoCozinha, s: Cozinheiro) {
  const i = frente(e, s), c = e.celulas[i];
  if (!c) return;
  const x = i % e.largura + 0.5, z = Math.floor(i / e.largura) + 0.5;
  if (s.mao?.k === "extintor") {
    if (e.passo % 6 === 0) e.eventos.push({ tipo: "extintor", jogador: s.id, x, z });
    // Apaga o fogo à frente e dos lados dele.
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const v = celulaEm(e, (i % e.largura) + dx, Math.floor(i / e.largura) + dz);
      if (v && v.fogo > 0) { v.fogo = Math.max(0, v.fogo - (dx || dz ? 1.5 : 3)); if (v.fogo === 0) e.eventos.push({ tipo: "apagou", x, z }); }
    }
    return;
  }
  if (s.mao || c.fogo > 0) return;
  if (c.tipo === "tabua" && c.item?.k === "ing" && c.item.ing !== "pao" && c.item.corte < 1) {
    c.item.corte = Math.min(1, c.item.corte + 1 / CORTE);
    if (e.passo % 10 === 0 || c.item.corte >= 1) e.eventos.push({ tipo: "corte", jogador: s.id, x, z, pronto: c.item.corte >= 1 });
  } else if (c.tipo === "pia" && c.pratos > 0) {
    if (++c.lavagem >= LAVAR) {
      c.lavagem = 0; c.pratos--;
      const pilha = e.celulas.find(p => p.tipo === "pilha" && p.cozinha === c.cozinha)!;
      pilha.pratos++;
      e.eventos.push({ tipo: "lavou", jogador: s.id, x, z });
    }
  }
}

function entregar(e: EstadoCozinha, s: Cozinheiro, k: number) {
  const prato = s.mao as Extract<Item, { k: "prato" }>;
  const chave = (l: Componente[]) => l.slice().sort().join("+");
  const p = e.pedidos.filter(x => x.cozinha === k && chave(RECEITAS[x.receita].itens) === chave(prato.itens)).sort((a, b) => a.prazo - b.prazo)[0];
  if (!p) { e.eventos.push({ tipo: "errado", jogador: s.id }); return; }
  e.pedidos.splice(e.pedidos.indexOf(p), 1);
  const r = RECEITAS[p.receita];
  const resta = Math.max(0, (p.prazo - e.passo) / r.prazo);
  e.combo[k] = Math.min(4, e.combo[k] + 1);
  const pontos = r.base + Math.round(10 * resta) * e.combo[k];
  e.pontos[k] += pontos; s.pontos += pontos; s.entregas++;
  s.mao = null;
  e.retornos.push({ cozinha: k, em: e.passo + RETORNO });
  for (const b of e.cozinheiros) if (b.pedido === p.id) { b.pedido = null; b.montagem = null; }
  e.eventos.push({ tipo: "entrega", jogador: s.id, cozinha: k, receita: p.receita, pontos, combo: e.combo[k] });
}

// ---------------------------------------------------------------- bots

/** Caminho: BFS no chão até uma célula vizinha (em cruz) do alvo; devolve a próxima célula e se já chegou. */
function rumo(e: EstadoCozinha, s: Cozinheiro, alvo: number): { prox: number | null; chegou: boolean; dir: Direcao } {
  const W = e.largura, ax = alvo % W, az = Math.floor(alvo / W);
  const sx = Math.floor(s.x), sz = Math.floor(s.z);
  const dirPara = (x: number, z: number): Direcao => (ax > x ? "direita" : ax < x ? "esquerda" : az > z ? "baixo" : "cima");
  const vizinho = (x: number, z: number) => Math.abs(x - ax) + Math.abs(z - az) === 1;
  if (vizinho(sx, sz)) return { prox: null, chegou: true, dir: dirPara(sx, sz) };
  const ini = idx(e, sx, sz), veio = new Map<number, number>([[ini, -1]]), fila = [ini];
  while (fila.length) {
    const atual = fila.shift()!, x = atual % W, z = Math.floor(atual / W);
    if (vizinho(x, z)) {
      let p = atual;
      while (veio.get(p) !== ini && veio.get(p) !== -1) p = veio.get(p)!;
      return { prox: p, chegou: false, dir: dirPara(x, z) };
    }
    for (const [dx, dz] of Object.values(DIRS)) {
      const nx = x + dx, nz = z + dz, c = celulaEm(e, nx, nz);
      if (!c || c.tipo !== "chao") continue;
      const ni = idx(e, nx, nz);
      if (!veio.has(ni)) { veio.set(ni, atual); fila.push(ni); }
    }
  }
  return { prox: null, chegou: false, dir: s.dir };
}

type Plano = { alvo: number; acao: "A" | "B" | "espera" };

function decidir(e: EstadoCozinha, s: Cozinheiro): Plano | null {
  const k = s.time;
  const minhas = (f: (c: Celula, i: number) => boolean) => e.celulas.map((c, i) => [c, i] as const).filter(([c, i]) => c.cozinha === k && f(c, i)).map(([, i]) => i);
  const perto = (lista: number[]) => lista.sort((a, b) => dist(e, s, a) - dist(e, s, b))[0] ?? null;
  const ocupadaPorOutro = (i: number) => e.cozinheiros.some(o => o !== s && o.alvo === i);
  const livre = (c: Celula) => c.tipo === "balcao" && !c.item && c.fogo === 0;
  const mao = s.mao;
  const fogo = minhas(c => c.fogo > 0);
  // 1. Incêndio: o mais perto do extintor vai apagar.
  if (mao?.k === "extintor") {
    if (fogo.length) return { alvo: perto(fogo)!, acao: "B" };
    const l = perto(minhas((c, i) => livre(c) && !ocupadaPorOutro(i)));
    return l === null ? null : { alvo: l, acao: "A" };
  }
  if (fogo.length && !mao && !e.cozinheiros.some(o => o.time === k && o.mao?.k === "extintor")) {
    const ext = minhas(c => c.item?.k === "extintor" && c.fogo === 0);
    const meu = perto(ext.slice());
    const maisPerto = meu !== null && e.cozinheiros.filter(o => o.time === k && !o.mao && o.bot).sort((a, b) => dist(e, a, meu) - dist(e, b, meu))[0] === s;
    if (meu !== null && maisPerto) return { alvo: meu, acao: "A" };
  }
  // 2. O que está na mão.
  if (mao?.k === "sujos") return { alvo: perto(minhas(c => c.tipo === "pia"))!, acao: "A" };
  if (mao && (mao.k === "panela" || mao.k === "frigideira")) {
    if (mao.queimado) return { alvo: perto(minhas(c => c.tipo === "lixeira"))!, acao: "A" };
    const f = perto(minhas(c => c.tipo === "fogao" && !c.item && c.fogo === 0));
    return f === null ? null : { alvo: f, acao: "A" };
  }
  // 3. Comida queimada numa vasilha: alguém sem pedido leva para a lixeira.
  const queimada = minhas((c, i) => c.fogo === 0 && (c.item?.k === "panela" || c.item?.k === "frigideira") && c.item.queimado && !ocupadaPorOutro(i));
  if (!mao && queimada.length && (s.pedido === null || dist(e, s, queimada[0]) < 4)) return { alvo: perto(queimada)!, acao: "A" };
  // 4. Pedido: assume o mais antigo sem dono.
  if (s.pedido !== null && !e.pedidos.some(p => p.id === s.pedido)) { s.pedido = null; }
  if (s.pedido === null) {
    const p = e.pedidos.filter(x => x.cozinha === k && !e.cozinheiros.some(o => o.pedido === x.id)).sort((a, b) => a.prazo - b.prazo)[0];
    if (p) { s.pedido = p.id; s.montagem = null; }
  }
  const pedido = e.pedidos.find(p => p.id === s.pedido);
  if (!pedido) return apoio(e, s, minhas, perto, mao);
  const receita = RECEITAS[pedido.receita];
  // Prato de montagem.
  const pm = s.montagem !== null ? e.celulas[s.montagem] : null;
  if (s.montagem !== null && (!pm || pm.item?.k !== "prato") && mao?.k !== "prato") s.montagem = null;
  const prato = mao?.k === "prato" ? mao : s.montagem !== null ? (e.celulas[s.montagem].item as Extract<Item, { k: "prato" }>) : null;
  if (!prato) {
    if (mao) { const l = perto(minhas((c, i) => livre(c) && !ocupadaPorOutro(i))); return l === null ? null : { alvo: l, acao: "A" }; }
    const pilha = minhas(c => c.tipo === "pilha")[0];
    if (e.celulas[pilha].pratos > 0) return { alvo: pilha, acao: "A" };
    return apoio(e, s, minhas, perto, mao);
  }
  const falta = (() => { const r = [...receita.itens]; for (const x of prato.itens) { const i = r.indexOf(x); if (i >= 0) r.splice(i, 1); } return r; })();
  if (mao?.k === "prato") {
    if (!falta.length) return { alvo: minhas(c => c.tipo === "entrega")[0], acao: "A" };
    // Com o prato na mão: busca a vasilha pronta, ou põe o pão, ou apoia o prato (vira a montagem).
    const c0 = falta[0];
    if (c0 === "carne" || c0 === "sopa") {
      const pronta = perto(minhas(c => c.fogo === 0 && !!c.item && vasilhaPronta(c.item) === c0));
      if (pronta !== null) return { alvo: pronta, acao: "A" };
    }
    if (falta.includes("pao")) return { alvo: minhas(c => c.caixa === "pao")[0], acao: "A" };
    const l = s.montagem ?? perto(minhas((c, i) => livre(c) && !ocupadaPorOutro(i) && c.tipo === "balcao"));
    if (l !== null && !e.celulas[l].item) { s.montagem = l; return { alvo: l, acao: "A" }; }
    return null;
  }
  // Prato apoiado na montagem.
  if (!falta.length) return { alvo: s.montagem!, acao: "A" };
  const c0 = falta.find(x => x !== "pao") ?? "pao";
  if (mao?.k === "ing") {
    const serve = mao.ing === "carne" ? falta.includes("carne") : mao.ing === "tomate" ? falta.includes("tomate") || c0 === "sopa" : falta.includes(mao.ing);
    if (!serve) return { alvo: perto(minhas(c => c.tipo === "lixeira"))!, acao: "A" };
    if (mao.ing === "pao") return { alvo: s.montagem!, acao: "A" };
    if (mao.corte < 1) {
      const t = perto(minhas((c, i) => c.tipo === "tabua" && !c.item && c.fogo === 0 && !ocupadaPorOutro(i)));
      return t === null ? null : { alvo: t, acao: "A" };
    }
    if (mao.ing === "carne") {
      const f = perto(minhas((c, i) => c.fogo === 0 && c.item?.k === "frigideira" && !c.item.carne && !c.item.queimado && c.tipo === "fogao" && !ocupadaPorOutro(i)));
      return f === null ? null : { alvo: f, acao: "A" };
    }
    if (mao.ing === "tomate" && c0 === "sopa") {
      const p = perto(minhas(c => c.fogo === 0 && c.item?.k === "panela" && c.item.tomates < 3 && !c.item.queimado && c.tipo === "fogao"));
      return p === null ? null : { alvo: p, acao: "A" };
    }
    return { alvo: s.montagem!, acao: "A" };
  }
  if (mao) return null;
  // Mão vazia: há algo picando na tábua que é meu? Continua cortando; terminou, pega.
  const tabua = minhas(c => c.tipo === "tabua" && c.item?.k === "ing" && c.item.ing !== "pao");
  for (const t of tabua) {
    const it = e.celulas[t].item as Extract<Item, { k: "ing" }>;
    const serve = falta.includes(it.ing as Componente) || (it.ing === "tomate" && c0 === "sopa");
    if (s.alvo === t || (serve && !ocupadaPorOutro(t))) return { alvo: t, acao: it.corte < 1 ? "B" : "A" };
  }
  if (c0 === "carne" || c0 === "sopa") {
    const pronta = perto(minhas(c => c.fogo === 0 && !!c.item && vasilhaPronta(c.item) === c0));
    if (pronta !== null) return { alvo: s.montagem!, acao: "A" }; // pega o prato para servir
    const cozinhando = minhas(c => c.fogo === 0 && (c.item?.k === "frigideira" && c0 === "carne" ? c.item.carne : c.item?.k === "panela" && c0 === "sopa" ? c.item.tomates >= 3 : false));
    if (cozinhando.length) {
      // Já está no fogo: adianta o pão, se faltar; senão espera perto.
      if (falta.includes("pao")) return { alvo: minhas(c => c.caixa === "pao")[0], acao: "A" };
      return { alvo: cozinhando[0], acao: "espera" };
    }
  }
  const ing: Ingrediente = c0 === "sopa" ? "tomate" : c0 === "pao" ? "pao" : c0;
  return { alvo: minhas(c => c.caixa === ing)[0], acao: "A" };
}

function apoio(e: EstadoCozinha, s: Cozinheiro, minhas: (f: (c: Celula, i: number) => boolean) => number[], perto: (l: number[]) => number | null, mao: Item | null): Plano | null {
  if (mao?.k === "prato" && !mao.itens.length) return { alvo: minhas(c => c.tipo === "pilha")[0], acao: "A" };
  if (mao) {
    const l = perto(minhas(c => c.tipo === "balcao" && !c.item && c.fogo === 0));
    return l === null ? null : { alvo: l, acao: "A" };
  }
  const pia = minhas(c => c.tipo === "pia" && c.pratos > 0);
  const lavando = e.cozinheiros.filter(o => o !== s && o.alvo !== null && pia.includes(o.alvo)).map(o => o.alvo);
  const pl = pia.find(p => !lavando.includes(p));
  if (pl !== undefined) return { alvo: pl, acao: "B" };
  const ret = minhas(c => c.tipo === "retorno" && c.pratos > 0);
  if (ret.length && !e.cozinheiros.some(o => o !== s && o.alvo === ret[0])) return { alvo: ret[0], acao: "A" };
  return null;
}

const dist = (e: EstadoCozinha, s: { x: number; z: number }, i: number) => Math.abs(s.x - (i % e.largura + 0.5)) + Math.abs(s.z - (Math.floor(i / e.largura) + 0.5));

const LENTIDAO: Record<Dificuldade, number> = { facil: 0.55, medio: 0.25, dificil: 0 };

export function decisaoDoBot(e: EstadoCozinha, s: Cozinheiro): Entrada {
  if (s.pausa > 0) { s.pausa--; return { direcao: null, a: false, b: false }; }
  const plano = decidir(e, s);
  s.alvo = plano?.alvo ?? null;
  if (!plano) return { direcao: null, a: false, b: false };
  const r = rumo(e, s, plano.alvo);
  if (!r.chegou) {
    if (r.prox === null) return { direcao: null, a: false, b: false };
    const cx = r.prox % e.largura + 0.5, cz = Math.floor(r.prox / e.largura) + 0.5;
    const dx = cx - s.x, dz = cz - s.z;
    // Centraliza no eixo de lado antes de virar a esquina.
    const direcao: Direcao = Math.abs(dx) > Math.abs(dz) ? (Math.abs(dz) > 0.12 ? (dz > 0 ? "baixo" : "cima") : dx > 0 ? "direita" : "esquerda")
      : (Math.abs(dx) > 0.12 ? (dx > 0 ? "direita" : "esquerda") : dz > 0 ? "baixo" : "cima");
    return { direcao, a: false, b: false };
  }
  if (s.dir !== r.dir) return { direcao: r.dir, a: false, b: false };
  if (plano.acao === "espera") return { direcao: null, a: false, b: false };
  if (plano.acao === "B") return { direcao: null, a: false, b: true };
  // A é por toque: solta antes de apertar de novo; depois de agir, uma pausa pela dificuldade.
  if (s.aAnterior) return { direcao: null, a: false, b: false };
  if (e.sorteio() < LENTIDAO[s.bot ?? "medio"]) s.pausa = 40;
  return { direcao: null, a: true, b: false };
}

// ---------------------------------------------------------------- passo

export function passoCozinha(e: EstadoCozinha, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  // Pedidos novos e vencidos.
  for (let k = 0; k < e.cozinhas; k++) {
    const n = pessoasNaCozinha(e, k);
    const max = 2 + Math.min(4, Math.ceil(n / 2));
    if (k === 1) break; // no Duelo, a cozinha 1 recebe a cópia do pedido da 0
    if (e.passo >= e.proximoPedido[k] && e.pedidos.filter(p => p.cozinha === k).length < max) {
      novoPedido(e, k);
      if (e.cozinhas === 2 && e.pedidos.filter(p => p.cozinha === 1).length < max) novoPedido(e, 1, e.pedidos[e.pedidos.length - 1].receita);
      e.proximoPedido[k] = e.passo + Math.round(14 * 60 / (0.7 + 0.3 * Math.min(n, 6)));
    }
  }
  for (const p of e.pedidos.slice()) if (e.passo >= p.prazo) {
    e.pedidos.splice(e.pedidos.indexOf(p), 1);
    e.pontos[p.cozinha] = Math.max(0, e.pontos[p.cozinha] - 10);
    e.combo[p.cozinha] = 0;
    e.eventos.push({ tipo: "venceu", cozinha: p.cozinha, receita: p.receita });
  }
  for (const r of e.retornos.slice()) if (e.passo >= r.em) {
    e.retornos.splice(e.retornos.indexOf(r), 1);
    e.celulas.find(c => c.tipo === "retorno" && c.cozinha === r.cozinha)!.pratos++;
  }
  // Cozinheiros.
  for (const s of e.cozinheiros) {
    const ent = s.bot ? decisaoDoBot(e, s) : entradas[s.id] ?? { direcao: null, a: false, b: false };
    if (ent.direcao) {
      s.dir = ent.direcao;
      const [dx, dz] = DIRS[ent.direcao];
      const nx = s.x + dx * VEL, nz = s.z + dz * VEL;
      const bate = (x: number, z: number) => solida(e, x - RAIO, z - RAIO) || solida(e, x + RAIO, z - RAIO) || solida(e, x - RAIO, z + RAIO) || solida(e, x + RAIO, z + RAIO);
      if (!bate(nx, s.z)) s.x = nx;
      if (!bate(s.x, nz)) s.z = nz;
      // Desliza para o centro do corredor (passa nas esquinas sem enroscar).
      if (dx && !bate(s.x + dx * VEL, s.z)) s.z += (Math.floor(s.z) + 0.5 - s.z) * 0.08;
      if (dz && !bate(s.x, s.z + dz * VEL)) s.x += (Math.floor(s.x) + 0.5 - s.x) * 0.08;
    }
    if (ent.a && !s.aAnterior) botaoA(e, s);
    s.aAnterior = ent.a;
    if (ent.b) botaoB(e, s);
  }
  // Fogões: cozinhar, queimar e pegar fogo.
  e.celulas.forEach((c, i) => {
    const v = c.item;
    if (c.tipo === "fogao" && c.fogo === 0 && v && (v.k === "panela" || v.k === "frigideira")) {
      const temComida = v.k === "frigideira" ? v.carne : v.tomates >= 3;
      if (temComida && v.coz < INCENDIO) {
        const antes = v.coz;
        v.coz += 1 / (v.k === "frigideira" ? COZ_FRIGIDEIRA : COZ_PANELA);
        const x = i % e.largura + 0.5, z = Math.floor(i / e.largura) + 0.5;
        if (antes < 1 && v.coz >= 1) e.eventos.push({ tipo: "pronto", x, z });
        if (antes < QUEIMA && v.coz >= QUEIMA) { v.queimado = true; e.eventos.push({ tipo: "queimou", x, z }); }
        if (antes < INCENDIO && v.coz >= INCENDIO) { c.fogo = 100; e.eventos.push({ tipo: "fogo", x, z }); }
      }
    }
  });
  // Fogo se espalha pelos balcões vizinhos.
  if (e.passo % ESPALHA === 0) {
    const novos: number[] = [];
    e.celulas.forEach((c, i) => {
      if (c.fogo <= 0) return;
      for (const [dx, dz] of Object.values(DIRS)) {
        const v = celulaEm(e, (i % e.largura) + dx, Math.floor(i / e.largura) + dz);
        if (v && v.tipo !== "chao" && v.fogo === 0 && v.cozinha === c.cozinha && e.sorteio() < 0.5) novos.push(idx(e, (i % e.largura) + dx, Math.floor(i / e.largura) + dz));
      }
    });
    for (const i of novos) {
      const c = e.celulas[i]; c.fogo = 100;
      if (c.item?.k === "ing") c.item = null;
      else if (c.item?.k === "panela" || c.item?.k === "frigideira") { c.item.queimado = c.item.carne || c.item.tomates > 0; }
      e.eventos.push({ tipo: "fogo", x: i % e.largura + 0.5, z: Math.floor(i / e.largura) + 0.5 });
    }
  }
  if (e.passo >= TEMPO) terminar(e);
}

function terminar(e: EstadoCozinha) {
  e.terminado = true;
  const mvp = (k: number) => e.cozinheiros.filter(c => c.time === k).sort((a, b) => b.pontos - a.pontos)[0]?.id ?? null;
  if (e.cozinhas === 2) {
    e.timeVencedor = e.pontos[0] === e.pontos[1] ? null : e.pontos[0] > e.pontos[1] ? 0 : 1;
    e.vencedor = e.timeVencedor === null ? null : mvp(e.timeVencedor);
  } else e.vencedor = e.pontos[0] >= e.meta ? mvp(0) : null;
  e.eventos.push({ tipo: "fim" });
}

export const pontosCozinha = (e: EstadoCozinha) => e.cozinheiros.map(c => c.pontos);
