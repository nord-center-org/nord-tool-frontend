/**
 * Bombas Táticas: regras clássicas do gênero de bombas em grade, sem React (testável em node).
 * Simulação determinística a 60 passos por segundo: mapa com pilares fixos e caixas destrutíveis, bomba com pavio,
 * chama em cruz que para em pilar e destrói a primeira caixa, reação em cadeia, power-ups escondidos nas caixas
 * (bomba, fogo, patins, chute, luva, detonador, escudo, fogo total e caveira), morte súbita em espiral e bots.
 */

export const PASSOS_POR_SEGUNDO = 60;
export const PAVIO = 150; // 2,5 s
export const DURACAO_CHAMA = 30; // 0,5 s
export const MORTE_SUBITA_A_PARTIR = 60 * PASSOS_POR_SEGUNDO; // últimos 60 s
export const INTERVALO_MORTE_SUBITA = 12; // um bloco a cada 0,2 s
export const AVISO_MORTE_SUBITA = 48; // 800 ms para sair da casa marcada
export const BUFFER_CURVA = 18; // 300 ms: preserva o toque antes de chegar à esquina
export const RESPAWN_MOEDAS = 3 * PASSOS_POR_SEGUNDO;
export const MAX_JOGADORES = 8;

export type Celula = "chao" | "pilar" | "caixa";
export type ModoBombas = Modo | "campanha";
export type Modo = "sobrevivencia" | "times" | "moedas";
export type Dificuldade = "facil" | "medio" | "dificil";
export type Direcao = "cima" | "baixo" | "esquerda" | "direita";
export type PowerUp = "bomba" | "fogo" | "patins" | "chute" | "luva" | "detonador" | "escudo" | "fogoTotal" | "caveira" | "ovo";
export type Maldicao = "lento" | "fogoMinimo" | "diarreia" | "rapidoDemais";
export type Bioma = "fabrica" | "gelo" | "vulcao";

export const DIRECOES: Record<Direcao, [number, number]> = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] };
const LISTA_DIRECOES = Object.keys(DIRECOES) as Direcao[];

export interface Entrada {
  direcao: Direcao | null;
  /** Dois eixos opcionais: preservam diagonais sem quebrar os jogos de quatro direções. */
  eixoX?: number;
  eixoY?: number;
  /** Botão A: soltar bomba. */
  a: boolean;
  /** Botão B: detonar (com detonador) ou arremessar a bomba que está aos pés (com luva). */
  b: boolean;
}

export const ENTRADA_VAZIA: Entrada = { direcao: null, a: false, b: false };

export interface Revanche { posicao: number; ativaEm: number; recargaAte: number; alcance: number }

export type TipoMontaria = "brasa" | "vento" | "pedra";
export interface Montaria { tipo: TipoMontaria; recargaAte: number; impulso: number }

export interface Jogador {
  montaria?: Montaria;
  id: number;
  nome: string;
  time: number;
  bot: Dificuldade | null;
  x: number;
  y: number;
  alvoX: number;
  alvoY: number;
  direcao: Direcao;
  vivo: boolean;
  bombas: number;
  fogo: number;
  velocidade: number;
  chute: boolean;
  luva: boolean;
  detonador: boolean;
  escudo: boolean;
  maldicao: Maldicao | null;
  maldicaoAte: number;
  moedas: number;
  vitorias: number;
  respawnEm: number;
  invulneravelAte: number;
  /** Para os botões não repetirem enquanto ficam apertados. */
  aAnterior: boolean;
  bAnterior: boolean;
  /** Bots: próximo passo em que pensam de novo. */
  pensaEm: number;
  andou: number;
  /** Curva solicitada entre duas casas; incluída no estado do espelho. */
  direcaoPendente?: Direcao | null;
  direcaoAte?: number;
  revanche?: Revanche;
  participando?: boolean;
}

export interface Bomba {
  revanche?: boolean;
  id: number;
  dono: number;
  x: number;
  y: number;
  fogo: number;
  pavio: number;
  remota: boolean;
  /** Bomba chutada deslizando. */
  deslizando: Direcao | null;
  progresso: number;
  /** Bomba arremessada no ar: chega ao destino em `voo` passos. */
  voo: number;
  destinoX: number;
  destinoY: number;
  origemX: number;
  origemY: number;
}

export interface Chama { dono?: number; revanche?: boolean; x: number; y: number; ate: number; centro: boolean; eixo: "h" | "v" | "c" }
export interface Item { x: number; y: number; tipo: PowerUp }
export interface Moeda { x: number; y: number }

export type Evento =
  | { tipo: "bomba"; x: number; y: number }
  | { tipo: "explosao"; x: number; y: number; tamanho: number }
  | { tipo: "caixa"; x: number; y: number }
  | { tipo: "powerup"; x: number; y: number; jogador: number; item: PowerUp }
  | { tipo: "retorno"; x: number; y: number; jogador: number }
  | { tipo: "morte"; x: number; y: number; jogador: number }
  | { tipo: "escudo"; x: number; y: number; jogador: number }
  | { tipo: "chute"; x: number; y: number }
  | { tipo: "arremesso"; x: number; y: number }
  | { tipo: "moeda"; x: number; y: number; jogador: number }
  | { tipo: "bloco"; x: number; y: number }
  | { tipo: "morteSubita" }
  | { tipo: "fim"; vencedor: number | null; time: number | null };

export interface InimigoCampanha { id: number; x: number; y: number; alvoX: number; alvoY: number; tipo: "patrulha" | "cacador" | "saltador" | "cauteloso" | "chefe"; aspecto?: number; vida: number; protecaoAte: number; ataqueEm: number }
export interface Campanha { etapa: number; vidas: number; pontos: number; proximaVida: number; inimigos: InimigoCampanha[]; saida: { x: number; y: number }; transicaoEm: number; mortes: number[]; }

export interface Estado {
  campanha?: Campanha;
  largura: number;
  altura: number;
  bioma: Bioma;
  modo: Modo;
  grade: Celula[];
  /** Power-up escondido em cada caixa (índice da grade). */
  escondidos: Map<number, PowerUp | "moeda">;
  jogadores: Jogador[];
  bombas: Bomba[];
  chamas: Chama[];
  itens: Item[];
  moedas: Moeda[];
  passo: number;
  duracao: number;
  semente: number;
  proximoId: number;
  morteSubita: { ordem: number[]; indice: number } | null;
  terminado: boolean;
  vencedor: number | null;
  timeVencedor: number | null;
  eventos: Evento[];
}

export interface Configuracao {
  modo: Modo;
  bioma: Bioma;
  jogadores: { nome: string; bot: Dificuldade | null }[];
  /** Duração da rodada em segundos (padrão: 3 min; moedas: 2 min). */
  segundos?: number;
  semente?: number;
}

// ---------------------------------------------------------------- aleatório determinístico

export function rng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sortear(e: Estado): number {
  // Avança a semente guardada no estado: a partida inteira é reproduzível.
  const r = rng(e.semente)();
  e.semente = (e.semente * 1664525 + 1013904223) >>> 0;
  return r;
}

// ---------------------------------------------------------------- mapa

export const idx = (e: Pick<Estado, "largura">, x: number, y: number) => y * e.largura + x;
export const dentro = (e: Pick<Estado, "largura" | "altura">, x: number, y: number) => x >= 0 && y >= 0 && x < e.largura && y < e.altura;
export const celula = (e: Estado, x: number, y: number): Celula => (dentro(e, x, y) ? e.grade[idx(e, x, y)] : "pilar");

/** Pontos de partida: os 4 cantos e, com mais de 4 jogadores, o meio de cada borda. */
export function largadas(largura: number, altura: number): [number, number][] {
  const l = largura - 2, a = altura - 2, mx = Math.floor(largura / 2), my = Math.floor(altura / 2);
  const meioX = mx % 2 === 1 ? mx : mx + 1;
  const meioY = my % 2 === 1 ? my : my + 1;
  return [[1, 1], [l, a], [l, 1], [1, a], [meioX, 1], [meioX, a], [1, meioY], [l, meioY]];
}

const PESOS_ITENS: [PowerUp, number][] = [
  ["bomba", 26], ["fogo", 26], ["patins", 14], ["chute", 8], ["luva", 6], ["detonador", 4], ["escudo", 6], ["fogoTotal", 3], ["caveira", 7],
];

function sortearItem(r: number): PowerUp {
  const total = PESOS_ITENS.reduce((s, [, p]) => s + p, 0);
  let alvo = r * total;
  for (const [tipo, p] of PESOS_ITENS) {
    if ((alvo -= p) < 0) return tipo;
  }
  return "bomba";
}

export function novaPartida(c: Configuracao): Estado {
  const n = Math.max(1, Math.min(MAX_JOGADORES, c.jogadores.length));
  const largura = n > 4 ? 17 : 15;
  const altura = n > 4 ? 15 : 13;
  const semente = (c.semente ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const e: Estado = {
    largura, altura, bioma: c.bioma, modo: c.modo, grade: [], escondidos: new Map(), jogadores: [], bombas: [], chamas: [], itens: [], moedas: [],
    passo: 0, duracao: (c.segundos ?? (c.modo === "moedas" ? 120 : 180)) * PASSOS_POR_SEGUNDO, semente, proximoId: 1, morteSubita: null,
    terminado: false, vencedor: null, timeVencedor: null, eventos: [],
  };
  const pontos = largadas(largura, altura).slice(0, n);
  const livre = new Set<number>();
  for (const [px, py] of pontos) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) livre.add(idx(e, px + dx, py + dy));
  }
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) {
    const borda = x === 0 || y === 0 || x === largura - 1 || y === altura - 1;
    const pilar = x % 2 === 0 && y % 2 === 0;
    let cel: Celula = borda || pilar ? "pilar" : "chao";
    if (cel === "chao" && !livre.has(idx(e, x, y)) && sortear(e) < 0.72) cel = "caixa";
    e.grade.push(cel);
  }
  for (let i = 0; i < e.grade.length; i++) {
    if (e.grade[i] !== "caixa") continue;
    const r = sortear(e);
    if (c.modo === "moedas" && r < 0.3) e.escondidos.set(i, "moeda");
    else if (r < (c.modo === "moedas" ? 0.5 : 0.32)) e.escondidos.set(i, sortearItem(sortear(e)));
  }
  const caixasOvo = e.grade.flatMap((cel, i) => cel === "caixa" && e.escondidos.get(i) !== "moeda" ? [i] : []);
  for (const i of caixasOvo.slice(0, 2)) e.escondidos.set(i, "ovo");
  // A sorte não pode gerar um desafio impossível. Só o anfitrião conhece estas caixas.
  if (n === 1 && c.modo === "moedas") {
    let moedas = [...e.escondidos.values()].filter(it => it === "moeda").length;
    const candidatas = e.grade.map((cel, i) => cel === "caixa" && e.escondidos.get(i) !== "moeda" ? i : -1).filter(i => i >= 0);
    while (moedas < META_MOEDAS_SOLO && candidatas.length) {
      const pos = Math.floor(sortear(e) * candidatas.length);
      e.escondidos.set(candidatas.splice(pos, 1)[0], "moeda");
      moedas++;
    }
  }
  e.jogadores = pontos.map(([px, py], i) => ({
    id: i, nome: c.jogadores[i]?.nome ?? `P${i + 1}`, time: c.modo === "times" ? i % 2 : i, bot: c.jogadores[i]?.bot ?? null,
    x: px, y: py, alvoX: px, alvoY: py, direcao: "baixo", vivo: true, bombas: 1, fogo: 2, velocidade: 3.6, chute: false, luva: false,
    detonador: false, escudo: false, maldicao: null, maldicaoAte: 0, moedas: 0, vitorias: 0, respawnEm: 0, invulneravelAte: 0,
    aAnterior: false, bAnterior: false, pensaEm: i * 3, andou: 0,
  }));
  return e;
}

/** Ordem da morte súbita: espiral de fora para dentro, só nas casas que não são pilar. */
export function espiral(largura: number, altura: number): [number, number][] {
  const saida: [number, number][] = [];
  let x0 = 1, y0 = 1, x1 = largura - 2, y1 = altura - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) saida.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) saida.push([x1, y]);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) saida.push([x, y1]);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) saida.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return saida;
}

// ---------------------------------------------------------------- consultas

const naCasa = (j: Jogador) => ({ x: Math.round(j.x), y: Math.round(j.y) });
const bombaEm = (e: Estado, x: number, y: number) => e.bombas.find(b => b.voo === 0 && b.x === x && b.y === y);
const alinhado = (j: Jogador) => Math.abs(j.x - j.alvoX) < 1e-6 && Math.abs(j.y - j.alvoY) < 1e-6;

export function velocidadeEfetiva(j: Jogador): number {
  if (j.maldicao === "lento") return 2.2;
  if (j.maldicao === "rapidoDemais") return 9;
  return j.velocidade * (j.montaria?.impulso ? 1.9 : j.montaria?.tipo === "vento" ? 1.15 : 1);
}

/** A casa bloqueia quem anda (pilar, caixa, bomba ou bloco da morte súbita). A bomba aos pés de quem saiu dela não bloqueia. */
export function bloqueia(e: Estado, x: number, y: number, quem?: Jogador): boolean {
  const c = celula(e, x, y);
  if (c !== "chao") return true;
  const b = bombaEm(e, x, y);
  if (b) {
    if (quem) {
      const aqui = naCasa(quem);
      if (aqui.x === x && aqui.y === y) return false;
    }
    return true;
  }
  return false;
}

/** As casas que a bomba atinge: o centro e as linhas em cruz até o alcance, parando em pilar e na primeira caixa. */
export function alcance(e: Estado, x: number, y: number, fogo: number): { x: number; y: number; eixo: Chama["eixo"]; centro: boolean }[] {
  const casas: { x: number; y: number; eixo: Chama["eixo"]; centro: boolean }[] = [{ x, y, eixo: "c", centro: true }];
  for (const d of LISTA_DIRECOES) {
    const [dx, dy] = DIRECOES[d];
    for (let k = 1; k <= fogo; k++) {
      const cx = x + dx * k, cy = y + dy * k;
      const c = celula(e, cx, cy);
      if (c === "pilar") break;
      casas.push({ x: cx, y: cy, eixo: dx !== 0 ? "h" : "v", centro: false });
      if (c === "caixa") break;
      if (e.itens.some(i => i.x === cx && i.y === cy)) break;
    }
  }
  return casas;
}

// ---------------------------------------------------------------- simulação

export function passo(e: Estado, entradas: Entrada[]): Estado {
  if (e.terminado) return e;
  e.eventos = [];
  e.passo++;

  for (const j of e.jogadores) {
    if (!j.vivo) {
      if (e.modo === "moedas" && j.respawnEm > 0 && e.passo >= j.respawnEm) renascer(e, j);
      else if (!e.campanha) atualizarRevanche(e, j, entradas[j.id] ?? ENTRADA_VAZIA);
      continue;
    }
    if (j.montaria?.impulso) j.montaria.impulso--;
    if (j.maldicao && e.passo >= j.maldicaoAte) j.maldicao = null;
    const ent = j.bot ? pensarBot(e, j) : entradas[j.id] ?? ENTRADA_VAZIA;
    if (!j.bot && ent.eixoX !== undefined && ent.eixoY !== undefined) moverLivre(e, j, ent);
    else mover(e, j, ent.direcao);
    const soltar = ent.a && !j.aAnterior;
    const segundo = ent.b && !j.bAnterior;
    j.aAnterior = ent.a;
    j.bAnterior = ent.b;
    if (soltar || j.maldicao === "diarreia") soltarBomba(e, j);
    if (segundo) acaoB(e, j);
    pegarItens(e, j);
  }

  atualizarBombas(e);
  e.chamas = e.chamas.filter(c => c.ate > e.passo);
  for (const j of e.jogadores) {
    if (!j.vivo || e.passo < j.invulneravelAte) continue;
    const { x, y } = naCasa(j);
    const chamas = e.chamas.filter(c => c.x === x && c.y === y);
    if (chamas.length) {
      atingir(e, j);
      if (!j.vivo) {
        const fonte = chamas.find(c => c.revanche && c.dono !== undefined && !e.jogadores[c.dono]?.vivo && e.jogadores[c.dono]?.time !== j.time);
        if (fonte?.dono !== undefined && !e.morteSubita && !e.campanha) voltarRevanche(e, e.jogadores[fonte.dono], x, y);
      }
    }
  }
  // Itens no chão também queimam (como no clássico); o que acabou de aparecer da caixa fica.
  if (!e.campanha) morteSubita(e);
  conferirFim(e);
  return e;
}

function mover(e: Estado, j: Jogador, d: Direcao | null) {
  const v = velocidadeEfetiva(j) / PASSOS_POR_SEGUNDO;
  if (d) {
    const [dx, dy] = DIRECOES[d];
    const curva = !alinhado(j) && ((j.alvoX !== j.x && dy !== 0) || (j.alvoY !== j.y && dx !== 0));
    j.direcaoPendente = curva ? d : null;
    if (curva) j.direcaoAte = e.passo + BUFFER_CURVA;
  }
  if (!d && alinhado(j) && j.direcaoPendente && (j.direcaoAte ?? 0) >= e.passo) d = j.direcaoPendente;
  if ((j.direcaoAte ?? 0) < e.passo) j.direcaoPendente = null;
  if (d) {
    j.direcao = d;
    const [dx, dy] = DIRECOES[d];
    // Voltar no meio do caminho: o alvo passa a ser a casa de onde veio.
    if (!alinhado(j)) {
      const vx = Math.sign(j.alvoX - j.x), vy = Math.sign(j.alvoY - j.y);
      if (vx === -dx && vy === -dy) {
        j.alvoX -= vx;
        j.alvoY -= vy;
        j.direcaoPendente = null;
      }
    }
    if (alinhado(j)) {
      const nx = j.alvoX + dx, ny = j.alvoY + dy;
      const b = bombaEm(e, nx, ny);
      if (b && j.chute && celula(e, nx, ny) === "chao" && !b.deslizando) {
        b.deslizando = d;
        b.progresso = 0;
        e.eventos.push({ tipo: "chute", x: nx, y: ny });
      } else if (!bloqueia(e, nx, ny, j)) {
        j.alvoX = nx;
        j.alvoY = ny;
        j.direcaoPendente = null;
      }
    }
  }
  if (!alinhado(j)) {
    const ax = j.alvoX - j.x, ay = j.alvoY - j.y;
    const dist = Math.hypot(ax, ay);
    if (dist <= v) {
      j.x = j.alvoX;
      j.y = j.alvoY;
    } else {
      j.x += (ax / dist) * v;
      j.y += (ay / dist) * v;
    }
    j.andou++;
  }
}

/** Movimento em oito direções, normalizado e com colisão circular; nunca corta um canto sólido. */
function moverLivre(e: Estado, j: Jogador, ent: Entrada) {
  let dx = Number.isFinite(ent.eixoX) ? Math.max(-1, Math.min(1, ent.eixoX!)) : 0;
  let dy = Number.isFinite(ent.eixoY) ? Math.max(-1, Math.min(1, ent.eixoY!)) : 0;
  const tamanho = Math.hypot(dx, dy);
  if (tamanho > 1) { dx /= tamanho; dy /= tamanho; }
  const v = velocidadeEfetiva(j) / PASSOS_POR_SEGUNDO;
  const pode = (x: number, y: number) => {
    const r = 0.24;
    for (let cy = Math.floor(y - r + 0.5); cy <= Math.floor(y + r + 0.5); cy++) {
      for (let cx = Math.floor(x - r + 0.5); cx <= Math.floor(x + r + 0.5); cx++) {
        const parede = celula(e, cx, cy) !== "chao";
        if (!parede && !bombaEm(e, cx, cy)) continue;
        const pertoX = Math.max(cx - 0.5, Math.min(cx + 0.5, x));
        const pertoY = Math.max(cy - 0.5, Math.min(cy + 0.5, y));
        const distancia = (x - pertoX) ** 2 + (y - pertoY) ** 2;
        if (distancia < r * r - 1e-8) {
          // Quem já sobrepõe a bomba pode sair completamente, inclusive após cruzar meia casa.
          const ax = Math.max(cx - 0.5, Math.min(cx + 0.5, j.x));
          const ay = Math.max(cy - 0.5, Math.min(cy + 0.5, j.y));
          const anterior = (j.x - ax) ** 2 + (j.y - ay) ** 2;
          if (!parede && anterior < r * r - 1e-8 && distancia >= anterior - 1e-10) continue;
          return false;
        }
      }
    }
    return true;
  };
  if (tamanho > 0) {
    j.direcao = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "direita" : "esquerda") : (dy > 0 ? "baixo" : "cima");
    if (j.chute) {
      const [kx, ky] = DIRECOES[j.direcao];
      const b = bombaEm(e, Math.round(j.x + kx * 0.55), Math.round(j.y + ky * 0.55));
      if (b && !b.deslizando && !(naCasa(j).x === b.x && naCasa(j).y === b.y)) { b.deslizando = j.direcao; b.progresso = 0; e.eventos.push({ tipo: "chute", x: b.x, y: b.y }); }
    }
    const antesX = j.x, antesY = j.y;
    if (pode(j.x + dx * v, j.y)) j.x += dx * v;
    if (pode(j.x, j.y + dy * v)) j.y += dy * v;
    if (Math.hypot(j.x - antesX, j.y - antesY) > 1e-6) j.andou++;
  }
  j.alvoX = j.x; j.alvoY = j.y; j.direcaoPendente = null;
}

function soltarBomba(e: Estado, j: Jogador): boolean {
  const { x, y } = naCasa(j);
  const ativas = e.bombas.filter(b => b.dono === j.id).length;
  if (ativas >= j.bombas || bombaEm(e, x, y) || celula(e, x, y) !== "chao") return false;
  const fogo = j.maldicao === "fogoMinimo" ? 1 : j.fogo;
  e.bombas.push({
    id: e.proximoId++, dono: j.id, x, y, fogo, pavio: j.detonador ? Number.MAX_SAFE_INTEGER : PAVIO, remota: j.detonador,
    deslizando: null, progresso: 0, voo: 0, destinoX: x, destinoY: y, origemX: x, origemY: y,
  });
  e.eventos.push({ tipo: "bomba", x, y });
  return true;
}

function acaoB(e: Estado, j: Jogador) {
  if (j.montaria) {
    const m = j.montaria;
    if (e.passo < m.recargaAte) return;
    if (m.tipo === "vento") { m.impulso = 18; m.recargaAte = e.passo + 90; }
    if (m.tipo === "pedra") { j.invulneravelAte = Math.max(j.invulneravelAte, e.passo + 45); m.recargaAte = e.passo + 240; e.eventos.push({ tipo: "escudo", x: j.x, y: j.y, jogador: j.id }); }
    if (m.tipo === "brasa") {
      const [dx, dy] = DIRECOES[j.direcao], { x, y } = naCasa(j);
      const tx = x + dx * 3, ty = y + dy * 3;
      if (celula(e, tx, ty) === "chao" && !bombaEm(e, tx, ty) && soltarBomba(e, j)) {
        const b = e.bombas[e.bombas.length - 1]; b.voo = 24; b.destinoX = tx; b.destinoY = ty; b.remota = false; b.pavio = PAVIO;
        m.recargaAte = e.passo + 120; e.eventos.push({ tipo: "arremesso", x, y });
      }
    }
    return;
  }
  if (j.detonador) {
    const minha = e.bombas.filter(b => b.dono === j.id && b.remota && b.voo === 0).sort((a, b) => a.id - b.id)[0];
    if (minha) {
      minha.pavio = 0;
      return;
    }
  }
  if (j.luva) {
    const { x, y } = naCasa(j);
    const b = bombaEm(e, x, y);
    if (!b) return;
    const [dx, dy] = DIRECOES[j.direcao];
    // Voa 3 casas à frente; se cair em obstáculo, segue até achar chão livre (dando a volta na arena).
    let tx = x, ty = y;
    for (let k = 3; k < 3 + e.largura * e.altura; k++) {
      tx = ((x + dx * k) % e.largura + e.largura) % e.largura;
      ty = ((y + dy * k) % e.altura + e.altura) % e.altura;
      if (celula(e, tx, ty) === "chao" && !bombaEm(e, tx, ty)) break;
    }
    b.voo = 24;
    b.origemX = x;
    b.origemY = y;
    b.destinoX = tx;
    b.destinoY = ty;
    b.deslizando = null;
    if (!b.remota) b.pavio = Math.max(b.pavio, 40);
    e.eventos.push({ tipo: "arremesso", x, y });
  }
}

function pegarItens(e: Estado, j: Jogador) {
  const { x, y } = naCasa(j);
  const i = e.itens.findIndex(it => it.x === x && it.y === y && (it.tipo !== "ovo" || !j.montaria));
  if (i >= 0) {
    const it = e.itens.splice(i, 1)[0];
    aplicar(e, j, it.tipo);
    e.eventos.push({ tipo: "powerup", x, y, jogador: j.id, item: it.tipo });
  }
  const m = e.moedas.findIndex(mo => mo.x === x && mo.y === y);
  if (m >= 0) {
    e.moedas.splice(m, 1);
    j.moedas++;
    e.eventos.push({ tipo: "moeda", x, y, jogador: j.id });
  }
}

const MALDICOES: Maldicao[] = ["lento", "fogoMinimo", "diarreia", "rapidoDemais"];

export function aplicar(e: Estado, j: Jogador, tipo: PowerUp) {
  switch (tipo) {
    case "ovo": if (!j.montaria) j.montaria = { tipo: (["brasa", "vento", "pedra"] as const)[Math.floor(sortear(e) * 3)], recargaAte: e.passo, impulso: 0 }; break;
    case "bomba": j.bombas = Math.min(8, j.bombas + 1); break;
    case "fogo": j.fogo = Math.min(10, j.fogo + 1); break;
    case "fogoTotal": j.fogo = 10; break;
    case "patins": j.velocidade = Math.min(7, j.velocidade + 0.6); break;
    case "chute": j.chute = true; break;
    case "luva": j.luva = true; break;
    case "detonador": j.detonador = true; break;
    case "escudo": j.escudo = true; break;
    case "caveira":
      j.maldicao = MALDICOES[Math.floor(sortear(e) * MALDICOES.length)];
      j.maldicaoAte = e.passo + 10 * PASSOS_POR_SEGUNDO;
      break;
  }
}

function atualizarBombas(e: Estado) {
  for (const b of e.bombas) {
    if (b.voo > 0) {
      b.voo--;
      if (b.voo === 0) {
        b.x = b.destinoX;
        b.y = b.destinoY;
      }
      continue;
    }
    if (b.deslizando) {
      b.progresso += 8 / PASSOS_POR_SEGUNDO;
      while (b.progresso >= 1 && b.deslizando) {
        const [dx, dy] = DIRECOES[b.deslizando];
        const nx = b.x + dx, ny = b.y + dy;
        const gente = e.jogadores.some(j => j.vivo && naCasa(j).x === nx && naCasa(j).y === ny);
        if (bloqueia(e, nx, ny) || gente || e.itens.some(i => i.x === nx && i.y === ny)) {
          b.deslizando = null;
          b.progresso = 0;
        } else {
          b.x = nx;
          b.y = ny;
          b.progresso -= 1;
        }
      }
    }
    if (b.pavio !== Number.MAX_SAFE_INTEGER) b.pavio--;
  }
  // Explosões (com reação em cadeia: a chama que alcança outra bomba a detona no mesmo passo).
  let explodindo = e.bombas.filter(b => b.voo === 0 && (b.pavio <= 0 || e.chamas.some(c => c.ate > e.passo && c.x === b.x && c.y === b.y)));
  const destruidas: { x: number; y: number }[] = [];
  while (explodindo.length) {
    const proximas: Bomba[] = [];
    for (const b of explodindo) {
      e.bombas = e.bombas.filter(o => o.id !== b.id);
      const casas = alcance(e, b.x, b.y, b.fogo);
      e.eventos.push({ tipo: "explosao", x: b.x, y: b.y, tamanho: b.fogo });
      for (const c of casas) {
        const i = idx(e, c.x, c.y);
        if (e.grade[i] === "caixa") destruidas.push({ x: c.x, y: c.y });
        const item = e.itens.findIndex(it => it.x === c.x && it.y === c.y);
        if (item >= 0 && e.passo > 1) e.itens.splice(item, 1);
        e.chamas.push({ dono: b.dono, revanche: b.revanche, x: c.x, y: c.y, ate: e.passo + DURACAO_CHAMA, centro: c.centro, eixo: c.eixo });
        const outra = bombaEm(e, c.x, c.y);
        if (outra && !proximas.includes(outra) && !explodindo.includes(outra)) proximas.push(outra);
      }
    }
    explodindo = proximas;
  }
  for (const d of destruidas) {
    const i = idx(e, d.x, d.y);
    if (e.grade[i] !== "caixa") continue;
    e.grade[i] = "chao";
    e.eventos.push({ tipo: "caixa", x: d.x, y: d.y });
    const dentroDela = e.escondidos.get(i);
    e.escondidos.delete(i);
    if (dentroDela === "moeda") e.moedas.push({ x: d.x, y: d.y });
    else if (dentroDela) e.itens.push({ x: d.x, y: d.y, tipo: dentroDela });
  }
}

export function atingir(e: Estado, j: Jogador) {
  if (j.montaria) {
    j.montaria = undefined; j.invulneravelAte = e.passo + 75;
    e.eventos.push({ tipo: "escudo", x: j.x, y: j.y, jogador: j.id }); return;
  }
  if (j.escudo) {
    j.escudo = false;
    j.invulneravelAte = e.passo + DURACAO_CHAMA + 30;
    e.eventos.push({ tipo: "escudo", x: j.x, y: j.y, jogador: j.id });
    return;
  }
  j.vivo = false;
  if (!e.campanha && e.modo !== "moedas" && e.jogadores.length > 2 && !e.morteSubita) {
    const borda = bordaRevanche(e);
    let melhor = 0;
    borda.forEach((p, i) => { if (Math.hypot(p.x - j.x, p.y - j.y) < Math.hypot(borda[melhor].x - j.x, borda[melhor].y - j.y)) melhor = i; });
    j.revanche = { posicao: melhor, ativaEm: e.passo + 48, recargaAte: e.passo + 48, alcance: 3 };
    j.aAnterior = j.bAnterior = false;
  }
  e.eventos.push({ tipo: "morte", x: j.x, y: j.y, jogador: j.id });
  if (e.modo === "moedas") {
    // Perde até 3 moedas, que caem nas casas livres em volta; volta depois de 3 s.
    const perde = Math.min(3, j.moedas);
    j.moedas -= perde;
    const { x, y } = naCasa(j);
    let soltas = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      if (soltas >= perde) break;
      if (celula(e, x + dx, y + dy) === "chao" && !e.moedas.some(m => m.x === x + dx && m.y === y + dy)) {
        e.moedas.push({ x: x + dx, y: y + dy });
        soltas++;
      }
    }
    j.respawnEm = e.passo + RESPAWN_MOEDAS;
  }
}

function renascer(e: Estado, j: Jogador) {
  const [px, py] = largadas(e.largura, e.altura)[j.id];
  // Abre espaço na largada se a morte súbita ou caixas fecharam.
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
    const i = idx(e, px + dx, py + dy);
    if (e.grade[i] === "caixa") e.grade[i] = "chao";
  }
  Object.assign(j, {
    montaria: undefined, vivo: true, x: px, y: py, alvoX: px, alvoY: py, bombas: 1, fogo: 2, velocidade: 3.6, chute: false, luva: false, detonador: false, escudo: false,
    maldicao: null, respawnEm: 0, invulneravelAte: e.passo + 2 * PASSOS_POR_SEGUNDO,
    direcaoPendente: null, direcaoAte: 0, aAnterior: false, bAnterior: false,
  });
}

/** Posições públicas dos próximos impactos; não consulta itens escondidos. */
export function avisosMorteSubita(e: Estado): { x: number; y: number; em: number }[] {
  if (e.campanha || e.modo === "moedas" || e.terminado) return [];
  const inicio = e.duracao - MORTE_SUBITA_A_PARTIR;
  if (e.passo < inicio) return [];
  const ordem = e.morteSubita?.ordem ?? espiral(e.largura, e.altura)
    .filter(([x, y]) => celula(e, x, y) !== "pilar").map(([x, y]) => idx(e, x, y));
  const indice = e.morteSubita?.indice ?? 0;
  const avisos: { x: number; y: number; em: number }[] = [];
  for (let n = indice; n < Math.min(ordem.length, indice + 5); n++) {
    const em = inicio + AVISO_MORTE_SUBITA + n * INTERVALO_MORTE_SUBITA - e.passo;
    if (em >= 0 && em <= AVISO_MORTE_SUBITA) avisos.push({ x: ordem[n] % e.largura, y: Math.floor(ordem[n] / e.largura), em });
  }
  return avisos;
}

function morteSubita(e: Estado) {
  if (e.modo === "moedas") return;
  const restante = e.duracao - e.passo;
  if (restante > MORTE_SUBITA_A_PARTIR) return;
  if (!e.morteSubita) {
    e.morteSubita = { ordem: espiral(e.largura, e.altura).filter(([x, y]) => celula(e, x, y) !== "pilar").map(([x, y]) => idx(e, x, y)), indice: 0 };
    e.eventos.push({ tipo: "morteSubita" });
  }
  const ms = e.morteSubita;
  const decorrido = MORTE_SUBITA_A_PARTIR - restante - AVISO_MORTE_SUBITA;
  if (decorrido < 0 || decorrido % INTERVALO_MORTE_SUBITA !== 0 || ms.indice >= ms.ordem.length) return;
  const i = ms.ordem[ms.indice++];
  const x = i % e.largura, y = Math.floor(i / e.largura);
  e.grade[i] = "pilar";
  e.escondidos.delete(i);
  e.itens = e.itens.filter(it => it.x !== x || it.y !== y);
  e.bombas = e.bombas.filter(b => b.x !== x || b.y !== y);
  e.eventos.push({ tipo: "bloco", x, y });
  for (const j of e.jogadores) {
    const c = naCasa(j);
    if (j.vivo && c.x === x && c.y === y) {
      j.escudo = false;
      atingir(e, j);
    }
  }
}

/** Sozinho na Caça às Moedas: a meta para vencer. */
export const META_MOEDAS_SOLO = 10;

function conferirFim(e: Estado) {
  if (e.campanha) return;
  const vivos = e.jogadores.filter(j => j.vivo);
  const acabouTempo = e.passo >= e.duracao;
  // Sozinho (sem bots): Desafio (limpar todas as caixas antes do tempo, sem cair) ou meta de moedas.
  if (e.jogadores.length === 1) {
    const j = e.jogadores[0];
    if (e.modo === "moedas") {
      if (j.moedas >= META_MOEDAS_SOLO) terminar(e, j.id, null);
      else if (acabouTempo) terminar(e, null, null);
    } else if (!j.vivo || acabouTempo) {
      terminar(e, null, null);
    } else if (!e.grade.includes("caixa")) {
      terminar(e, j.id, null);
    }
    return;
  }
  if (e.modo === "moedas") {
    if (!acabouTempo) return;
    const max = Math.max(...e.jogadores.map(j => j.moedas));
    const lideres = e.jogadores.filter(j => j.moedas === max);
    terminar(e, lideres.length === 1 ? lideres[0].id : null, null);
    return;
  }
  if (e.modo === "times") {
    const times = new Set(vivos.map(j => j.time));
    if (times.size <= 1 || acabouTempo) terminar(e, null, times.size === 1 ? [...times][0] : null);
    return;
  }
  if (vivos.length <= 1 || acabouTempo) terminar(e, vivos.length === 1 ? vivos[0].id : null, null);
}

function terminar(e: Estado, vencedor: number | null, time: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.timeVencedor = time;
  e.eventos.push({ tipo: "fim", vencedor, time });
}

// ---------------------------------------------------------------- perigo e bots

/** Em quantos passos cada casa será atingida (Infinity = segura). Considera chamas acesas e a cadeia de bombas. */
export function mapaDePerigo(e: Estado, extra?: { x: number; y: number; fogo: number }): number[] {
  const perigo = new Array<number>(e.grade.length).fill(Infinity);
  for (const aviso of avisosMorteSubita(e)) perigo[idx(e, aviso.x, aviso.y)] = aviso.em;
  for (const c of e.chamas) perigo[idx(e, c.x, c.y)] = 0;
  const bombas = e.bombas.filter(b => b.voo === 0).map(b => ({ x: b.x, y: b.y, fogo: b.fogo, t: b.pavio === Number.MAX_SAFE_INTEGER ? 20 : b.pavio }));
  if (extra) bombas.push({ ...extra, t: PAVIO });
  // Cadeia: uma bomba atingida explode quando a primeira que a alcança explodir.
  let mudou = true;
  for (let volta = 0; mudou && volta < bombas.length; volta++) {
    mudou = false;
    for (const b of bombas) for (const c of alcance(e, b.x, b.y, b.fogo)) {
      const outra = bombas.find(o => o !== b && o.x === c.x && o.y === c.y);
      if (outra && outra.t > b.t) {
        outra.t = b.t;
        mudou = true;
      }
    }
  }
  for (const b of bombas) for (const c of alcance(e, b.x, b.y, b.fogo)) {
    const i = idx(e, c.x, c.y);
    perigo[i] = Math.min(perigo[i], b.t);
  }
  return perigo;
}

interface Caminho { primeiro: Direcao | null; x: number; y: number; dist: number }

/** Busca em largura a partir da casa do jogador, sem pisar em casa que estará em chamas quando ele chegar. */
function buscar(e: Estado, j: Jogador, perigo: number[], objetivo: (x: number, y: number, dist: number) => boolean, limite = 60): Caminho | null {
  const inicio = naCasa(j);
  const passosPorCasa = PASSOS_POR_SEGUNDO / velocidadeEfetiva(j);
  const visto = new Set<number>([idx(e, inicio.x, inicio.y)]);
  const fila: Caminho[] = [{ primeiro: null, x: inicio.x, y: inicio.y, dist: 0 }];
  while (fila.length) {
    const atual = fila.shift()!;
    if (objetivo(atual.x, atual.y, atual.dist)) return atual;
    if (atual.dist >= limite) continue;
    for (const d of LISTA_DIRECOES) {
      const [dx, dy] = DIRECOES[d];
      const nx = atual.x + dx, ny = atual.y + dy;
      const i = idx(e, nx, ny);
      if (!dentro(e, nx, ny) || visto.has(i) || bloqueia(e, nx, ny, j)) continue;
      const chegada = (atual.dist + 1) * passosPorCasa;
      const p = perigo[i];
      // Casa que explode enquanto passo por ela: evitar (margem de meia casa).
      if (p !== Infinity && p <= chegada + passosPorCasa * 0.6 && p + DURACAO_CHAMA >= chegada - passosPorCasa) continue;
      visto.add(i);
      fila.push({ primeiro: atual.primeiro ?? d, x: nx, y: ny, dist: atual.dist + 1 });
    }
  }
  return null;
}

const REACAO: Record<Dificuldade, number> = { facil: 26, medio: 12, dificil: 3 };
const ERRO: Record<Dificuldade, number> = { facil: 0.18, medio: 0.06, dificil: 0 };

/** Decide a entrada do bot (só repensa quando chega numa casa ou quando o tempo de reação passa). */
export function pensarBot(e: Estado, j: Jogador): Entrada {
  const dif = j.bot ?? "medio";
  // Compromete-se com uma casa inteira. Repensar no meio da travessia fazia o bot oscilar e dar meia-volta.
  if (!alinhado(j)) {
    const dx = j.alvoX - j.x, dy = j.alvoY - j.y;
    return { direcao: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "direita" : "esquerda") : (dy > 0 ? "baixo" : "cima"), a: false, b: false };
  }
  if (e.passo < j.pensaEm) return { direcao: null, a: false, b: false };
  j.pensaEm = e.passo + REACAO[dif];
  const r = rng(e.passo * 31 + j.id * 7919);
  const entrada = decidir(e, j, dif, r);
  if (entrada.a) j.pensaEm = e.passo + 1; // Uma bomba recém-plantada pede fuga imediata.
  return entrada;
}

function decidir(e: Estado, j: Jogador, dif: Dificuldade, r: () => number): Entrada {
  const perigo = mapaDePerigo(e);
  const aqui = naCasa(j);
  const iAqui = idx(e, aqui.x, aqui.y);
  const errar = r() < ERRO[dif];

  // 1) Em perigo: fugir para a casa segura mais perto.
  if (perigo[iAqui] !== Infinity && !errar) {
    const fuga = buscar(e, j, perigo, (x, y) => perigo[idx(e, x, y)] === Infinity, 30);
    if (fuga?.primeiro) return { direcao: fuga.primeiro, a: false, b: false };
    return { direcao: null, a: false, b: false };
  }

  // Detonador: explode a bomba remota quando um rival está no alcance e eu não.
  if (j.detonador && dif !== "facil") {
    const minha = e.bombas.find(b => b.dono === j.id && b.remota);
    if (minha) {
      const casas = alcance(e, minha.x, minha.y, minha.fogo);
      const pegoRival = e.jogadores.some(o => o.vivo && o.time !== j.time && casas.some(c => c.x === naCasa(o).x && c.y === naCasa(o).y));
      const pegoEu = casas.some(c => c.x === aqui.x && c.y === aqui.y);
      if (pegoRival && !pegoEu) return { direcao: null, a: false, b: true };
    }
  }

  // 2) Soltar bomba se valer a pena e houver rota de fuga depois.
  const ativas = e.bombas.filter(b => b.dono === j.id).length;
  if (ativas < j.bombas && !bombaEm(e, aqui.x, aqui.y)) {
    const casas = alcance(e, aqui.x, aqui.y, j.fogo);
    const caixas = casas.filter(c => celula(e, c.x, c.y) === "caixa").length;
    const rivais = e.jogadores.filter(o => o.vivo && o.id !== j.id && o.time !== j.time && casas.some(c => c.x === naCasa(o).x && c.y === naCasa(o).y)).length;
    const vale = rivais > 0 || caixas > 0;
    if (vale && (dif !== "facil" || r() < 0.6)) {
      const comBomba = mapaDePerigo(e, { x: aqui.x, y: aqui.y, fogo: j.fogo });
      const fantasma: Estado = { ...e, bombas: [...e.bombas, { id: -1, dono: j.id, x: aqui.x, y: aqui.y, fogo: j.fogo, pavio: PAVIO, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: aqui.x, destinoY: aqui.y, origemX: aqui.x, origemY: aqui.y }] };
      const fuga = buscar(fantasma, j, comBomba, (x, y) => comBomba[idx(e, x, y)] === Infinity, 12);
      if (fuga || errar) return { direcao: null, a: true, b: false };
    }
  }

  // 3) Ir atrás de power-up, de rival (difícil persegue) ou de caixa.
  const seguro = (x: number, y: number) => perigo[idx(e, x, y)] === Infinity;
  const querItem = e.itens.filter(i => i.tipo !== "caveira" || dif === "facil");
  const alvoItem = buscar(e, j, perigo, (x, y, d) => d > 0 && seguro(x, y) && (querItem.some(i => i.x === x && i.y === y) || e.moedas.some(m => m.x === x && m.y === y)), 25);
  if (alvoItem?.primeiro) return { direcao: alvoItem.primeiro, a: false, b: false };
  const rivais = e.jogadores.filter(o => o.vivo && o.time !== j.time && o.id !== j.id);
  if (dif === "dificil" || (dif === "medio" && r() < 0.4)) {
    const perto = buscar(e, j, perigo, (x, y, d) => d > 0 && seguro(x, y) && rivais.some(o => Math.abs(naCasa(o).x - x) + Math.abs(naCasa(o).y - y) <= 1), 40);
    if (perto?.primeiro) return { direcao: perto.primeiro, a: false, b: false };
  }
  const caixa = buscar(e, j, perigo, (x, y, d) => d > 0 && seguro(x, y) && LISTA_DIRECOES.some(dd => celula(e, x + DIRECOES[dd][0], y + DIRECOES[dd][1]) === "caixa"), 40);
  if (caixa?.primeiro) return { direcao: caixa.primeiro, a: false, b: false };
  // Sem caixas: anda em direção a um rival.
  const qualquer = buscar(e, j, perigo, (x, y, d) => d > 0 && seguro(x, y) && rivais.some(o => Math.abs(naCasa(o).x - x) + Math.abs(naCasa(o).y - y) <= 2), 60);
  if (qualquer?.primeiro) return { direcao: qualquer.primeiro, a: false, b: false };
  // Passeio aleatório seguro.
  const opcoes = LISTA_DIRECOES.filter(d => {
    const [dx, dy] = DIRECOES[d];
    return !bloqueia(e, aqui.x + dx, aqui.y + dy, j) && seguro(aqui.x + dx, aqui.y + dy);
  });
  return { direcao: opcoes.length ? opcoes[Math.floor(r() * opcoes.length)] : null, a: false, b: false };
}

/** Tempo restante em segundos (para o relógio da tela). */
export const segundosRestantes = (e: Estado) => Math.max(0, Math.ceil((e.duracao - e.passo) / PASSOS_POR_SEGUNDO));


function bordaRevanche(e: Estado): { x: number; y: number; direcao: Direcao }[] {
  const b: { x: number; y: number; direcao: Direcao }[] = [];
  for (let x = 1; x < e.largura - 1; x++) b.push({ x, y: 0, direcao: "baixo" });
  for (let y = 1; y < e.altura - 1; y++) b.push({ x: e.largura - 1, y, direcao: "esquerda" });
  for (let x = e.largura - 2; x > 0; x--) b.push({ x, y: e.altura - 1, direcao: "cima" });
  for (let y = e.altura - 2; y > 0; y--) b.push({ x: 0, y, direcao: "direita" });
  return b;
}
export function posicaoRevanche(e: Estado, j: Jogador) {
  if (!j.revanche || j.vivo || e.morteSubita || e.terminado || e.passo < j.revanche.ativaEm) return null;
  const b = bordaRevanche(e), n = j.revanche.posicao;
  const p = b[Math.floor(n) % b.length], q = b[(Math.floor(n) + 1) % b.length], f = n % 1;
  return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, direcao: p.direcao };
}
function atualizarRevanche(e: Estado, j: Jogador, ent: Entrada) {
  const r = j.revanche, p = posicaoRevanche(e, j); if (!r || !p) return;
  const b = bordaRevanche(e), d = ent.direcao ? DIRECOES[ent.direcao] : [0, 0];
  const dx = ent.eixoX ?? d[0], dy = ent.eixoY ?? d[1];
  const sentido = p.direcao === "baixo" ? dx : p.direcao === "esquerda" ? dy : p.direcao === "cima" ? -dx : -dy;
  r.posicao = (r.posicao + Math.sign(sentido) * 4 / 60 + b.length) % b.length;
  if (ent.b && !j.bAnterior) r.alcance = r.alcance % 5 + 1;
  if ((ent.a && !j.aAnterior || j.bot && e.passo % 180 === j.id * 13) && e.passo >= r.recargaAte && !e.bombas.some(o => o.dono === j.id && o.revanche)) {
    const origem = b[Math.round(r.posicao) % b.length], [vx, vy] = DIRECOES[origem.direcao];
    for (let k = r.alcance; k >= 1; k--) {
      const x = origem.x + vx * k, y = origem.y + vy * k;
      if (celula(e, x, y) !== "chao" || bombaEm(e, x, y)) continue;
      e.bombas.push({ id: e.proximoId++, dono: j.id, x: origem.x, y: origem.y, origemX: origem.x, origemY: origem.y, destinoX: x, destinoY: y, fogo: 2, pavio: PAVIO, remota: false, deslizando: null, progresso: 0, voo: 24, revanche: true });
      r.recargaAte = e.passo + 90; e.eventos.push({ tipo: "arremesso", x: origem.x, y: origem.y }); break;
    }
  }
  j.aAnterior = ent.a; j.bAnterior = ent.b;
}
function voltarRevanche(e: Estado, j: Jogador, x: number, y: number) {
  if (!j.revanche) return;
  const livres = e.grade.flatMap((c, i) => c === "chao" ? [{ x: i % e.largura, y: Math.floor(i / e.largura) }] : []).filter(p => !bombaEm(e, p.x, p.y) && !e.chamas.some(c => c.x === p.x && c.y === p.y));
  livres.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  const p = livres[0]; if (!p) return;
  Object.assign(j, { montaria: undefined, vivo: true, x: p.x, y: p.y, alvoX: p.x, alvoY: p.y, bombas: 1, fogo: 2, velocidade: 3.6, escudo: false, chute: false, luva: false, detonador: false, maldicao: null, invulneravelAte: e.passo + 120, revanche: undefined, aAnterior: false, bAnterior: false, direcaoPendente: null });
  e.eventos.push({ tipo: "retorno", x: p.x, y: p.y, jogador: j.id });
}
