/**
 * Corrida do Ouro: regras puras da mineração vista de lado (60 passos por segundo), de 1 a 8 mineiros.
 *
 * - O subsolo é uma grade de blocos: terra (1 golpe), cascalho (1 golpe, cai se ficar sem apoio), pedra (2 golpes),
 *   rocha dura (não quebra) e minérios (prata, ouro e diamante, 2 golpes). A picareta (A) cava na direção em que o
 *   mineiro olha (←, →, ↑ ou ↓). ↑ pula e, encostado numa parede, escala.
 * - Minério quebrado vai para a carga (até 8 peças), e cada peça deixa o mineiro mais lento. A carga só vira ponto
 *   quando é entregue num dos carrinhos da superfície, que também repõem a dinamite.
 * - Dinamite (B, 3 por viagem): explode depois de 2 s e abre um buraco (não quebra rocha dura nem minério). Mineiro
 *   pego pela explosão fica tonto e perde metade da carga. Cascalho que cai em alguém também atordoa.
 * - Corrida: 4 minutos, vence quem entregar mais. Sobrevivência: a lava sobe do fundo; quem encosta nela perde a carga
 *   e volta à superfície depois de 5 s. Sozinho, há uma meta de pontos.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const LW = 32;
export const LH = 22;
export const CHAO = 3;
export const TEMPO = 240 * 60;
export const CARGA_MAX = 8;
export const DINAMITES = 3;
export const CARRINHOS = [6, 26];
export const META_SOLO: Record<ModoMineracao, number> = { corrida: 600, sobrevivencia: 400 };
const PAVIO = 120;
const LAVA_A_CADA = 18 * 60;

export type ModoMineracao = "corrida" | "sobrevivencia";
/** 0 ar, 1 terra, 2 cascalho, 3 pedra, 4 rocha dura, 5 prata, 6 ouro, 7 diamante. */
export type Bloco = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const AR = 0, TERRA = 1, CASCALHO = 2, PEDRA = 3, DURA = 4, PRATA = 5, OURO = 6, DIAMANTE = 7;
export const GOLPES: Record<Bloco, number> = { 0: 0, 1: 1, 2: 1, 3: 2, 4: Infinity, 5: 2, 6: 2, 7: 3 };
export const VALOR: Partial<Record<Bloco, number>> = { 5: 15, 6: 40, 7: 100 };
export const ehMinerio = (b: number) => b >= PRATA;

export interface Mineiro {
  id: number;
  bot: Dificuldade | null;
  x: number; y: number;
  vx: number; vy: number;
  lado: 1 | -1;
  olhando: Direcao;
  noChao: boolean;
  carga: Bloco[];
  dinamites: number;
  recarga: number;
  atordoado: number;
  foraAte: number;
  pontos: number;
  entregas: number;
  bAnterior: boolean;
  /** Memória do bot: alvo e há quanto tempo não sai do lugar. */
  alvo: { x: number; y: number } | null;
  alvoDesde: number;
  parado: number;
  ultimo: { x: number; y: number };
}
export interface Dinamite { id: number; x: number; y: number; dono: number; explode: number }

export type EventoMineracao =
  | { tipo: "golpe"; jogador: number; x: number; y: number; bloco: Bloco; quebrou: boolean }
  | { tipo: "minerio"; jogador: number; bloco: Bloco }
  | { tipo: "cheio"; jogador: number }
  | { tipo: "entrega"; jogador: number; valor: number; pecas: number }
  | { tipo: "dinamite"; jogador: number }
  | { tipo: "explosao"; x: number; y: number }
  | { tipo: "tonto"; jogador: number; perdeu: number }
  | { tipo: "cascalho"; x: number; y: number }
  | { tipo: "lava"; nivel: number }
  | { tipo: "queimou"; jogador: number }
  | { tipo: "fim" };

export interface EstadoMineracao {
  modo: ModoMineracao;
  jogadores: Mineiro[];
  blocos: number[];
  danos: number[];
  dinamites: Dinamite[];
  lavaY: number;
  passo: number;
  proximoId: number;
  sorteio: () => number;
  eventos: EventoMineracao[];
  terminado: boolean;
  vencedor: number | null;
}

const MEIA_L = 0.32, MEIA_A = 0.42;

export const bloco = (e: EstadoMineracao, x: number, y: number): number =>
  x < 0 || x >= LW || y >= LH ? DURA : y < 0 ? AR : e.blocos[y * LW + x];
const porBloco = (e: EstadoMineracao, x: number, y: number, b: number) => { e.blocos[y * LW + x] = b; e.danos[y * LW + x] = 0; };
const solido = (e: EstadoMineracao, x: number, y: number) => bloco(e, Math.floor(x), Math.floor(y)) !== AR;
// A caixa de colisão tem uma folga mínima para quem está apoiado exatamente na borda de um bloco não "bater" nele.
const bate = (e: EstadoMineracao, x: number, y: number) => {
  const l = MEIA_L - 0.002, a = MEIA_A - 0.002;
  return solido(e, x - l, y - a) || solido(e, x + l, y - a) || solido(e, x - l, y + a) || solido(e, x + l, y + a);
};

export function novaPartidaMineracao(o: { modo: ModoMineracao; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoMineracao {
  const sorteio = rng(o.semente);
  const blocos: number[] = [];
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const d = y - CHAO;
    let b: number = AR;
    if (y === LH - 1) b = DURA;
    else if (d >= 0) {
      const r = sorteio();
      b = d < 4 ? TERRA : sorteio() < Math.min(0.75, d * 0.07) ? PEDRA : TERRA;
      if (d >= 2 && r < 0.07) b = CASCALHO;
      else if (d >= 6 && r < 0.12) b = DURA;
      else if (d >= 1 && r < 0.18) b = PRATA;
      else if (d >= 5 && r < 0.225) b = OURO;
      else if (d >= 10 && r < 0.245) b = DIAMANTE;
    }
    blocos.push(b);
  }
  const n = o.jogadores.length;
  const jogadores: Mineiro[] = o.jogadores.map((j, i) => {
    const x = Math.floor(((i + 0.5) / n) * (LW - 4) + 2) + 0.5;
    return {
      id: i, bot: j.bot, x, y: CHAO - MEIA_A - 0.01, vx: 0, vy: 0, lado: 1, olhando: "baixo", noChao: true, carga: [], dinamites: DINAMITES,
      recarga: 0, atordoado: 0, foraAte: 0, pontos: 0, entregas: 0, bAnterior: false, alvo: null, alvoDesde: 0, parado: 0, ultimo: { x, y: CHAO },
    };
  });
  return { modo: o.modo, jogadores, blocos, danos: blocos.map(() => 0), dinamites: [], lavaY: LH, passo: 0, proximoId: 1, sorteio, eventos: [], terminado: false, vencedor: null };
}

const VETOR: Record<Direcao, { x: number; y: number }> = { cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 }, esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 } };

/** Célula que a picareta alcança: a vizinha na direção em que o mineiro olha. */
export function alvoDaPicareta(j: Mineiro): { x: number; y: number } {
  const v = VETOR[j.olhando];
  return { x: Math.floor(j.x + v.x * (MEIA_L + 0.4)), y: Math.floor(j.y + v.y * (MEIA_A + 0.4)) };
}

function cavar(e: EstadoMineracao, j: Mineiro) {
  j.recarga = 14;
  const c = alvoDaPicareta(j);
  if (c.y < 0) return;
  const b = bloco(e, c.x, c.y) as Bloco;
  if (b === AR || b === DURA) return;
  if (ehMinerio(b) && j.carga.length >= CARGA_MAX) { e.eventos.push({ tipo: "cheio", jogador: j.id }); return; }
  const i = c.y * LW + c.x;
  e.danos[i]++;
  const quebrou = e.danos[i] >= GOLPES[b];
  e.eventos.push({ tipo: "golpe", jogador: j.id, x: c.x, y: c.y, bloco: b, quebrou });
  if (!quebrou) return;
  porBloco(e, c.x, c.y, AR);
  if (ehMinerio(b)) { j.carga.push(b); e.eventos.push({ tipo: "minerio", jogador: j.id, bloco: b }); }
}

function atordoar(e: EstadoMineracao, j: Mineiro, perder: number) {
  j.atordoado = 80;
  const perdeu = Math.min(j.carga.length, perder);
  j.carga.splice(j.carga.length - perdeu, perdeu);
  e.eventos.push({ tipo: "tonto", jogador: j.id, perdeu });
}

function explodir(e: EstadoMineracao, d: Dinamite) {
  const R = 2.3;
  for (let y = Math.floor(d.y - R); y <= Math.ceil(d.y + R); y++) for (let x = Math.floor(d.x - R); x <= Math.ceil(d.x + R); x++) {
    if (y < 0 || y >= LH || x < 0 || x >= LW || Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) > R) continue;
    const b = bloco(e, x, y);
    if (b !== AR && b !== DURA && !ehMinerio(b)) porBloco(e, x, y, AR);
  }
  for (const j of e.jogadores) if (e.passo >= j.foraAte && Math.hypot(j.x - d.x, j.y - d.y) < R) atordoar(e, j, Math.ceil(j.carga.length / 2));
  e.eventos.push({ tipo: "explosao", x: d.x, y: d.y });
}

/** Cascalho sem apoio desce uma casa; se cai em alguém, atordoa e derruba uma peça. */
function desmoronar(e: EstadoMineracao) {
  for (let y = LH - 2; y >= 0; y--) for (let x = 0; x < LW; x++) {
    if (bloco(e, x, y) !== CASCALHO || bloco(e, x, y + 1) !== AR) continue;
    const vitima = e.jogadores.find(j => e.passo >= j.foraAte && Math.floor(j.x) === x && Math.floor(j.y - MEIA_A) <= y + 1 && Math.floor(j.y + MEIA_A) >= y + 1);
    // Cascalho que cai em alguém esfarela (some) depois de atordoar.
    if (vitima) { atordoar(e, vitima, 1); porBloco(e, x, y, AR); continue; }
    porBloco(e, x, y, AR); porBloco(e, x, y + 1, CASCALHO);
    e.eventos.push({ tipo: "cascalho", x, y: y + 1 });
  }
}

function mover(e: EstadoMineracao, j: Mineiro, ent: { direcao: Direcao | null; a: boolean; b: boolean }) {
  const lento = 1 / (1 + j.carga.length * 0.1);
  const dir = j.atordoado > 0 ? null : ent.direcao;
  if (dir) j.olhando = dir;
  j.vx = dir === "esquerda" ? -0.08 * lento : dir === "direita" ? 0.08 * lento : 0;
  if (j.vx) j.lado = j.vx < 0 ? -1 : 1;
  // ↑/↓ centraliza o mineiro na coluna, para caber no poço que ele cava.
  if (dir === "cima" || dir === "baixo") {
    const meio = Math.floor(j.x) + 0.5, passo = Math.max(-0.06, Math.min(0.06, meio - j.x));
    if (!bate(e, j.x + passo, j.y)) j.x += passo;
  }
  // ↑: escala encostado numa parede (em qualquer altura do corpo), ou pula do chão.
  const parede = [-MEIA_A, 0, MEIA_A].some(dy => solido(e, j.x + (MEIA_L + 0.12), j.y + dy) || solido(e, j.x - (MEIA_L + 0.12), j.y + dy));
  // No subsolo o mineiro sobe pelo túnel com a corda (segurando ↑); na superfície, só pula.
  if (dir === "cima" && (parede || j.y + MEIA_A > CHAO + 0.02)) {
    // Na boca do poço, um pulinho tira o mineiro do buraco.
    j.vy = j.y + MEIA_A < CHAO + 0.35 ? -0.2 : -0.07 * lento;
  }
  else if (dir === "cima" && j.noChao) j.vy = -0.22;
  else j.vy = Math.min(0.3, j.vy + 0.018);
  const nx = j.x + j.vx;
  if (!bate(e, nx, j.y)) j.x = nx;
  const ny = j.y + j.vy;
  j.noChao = false;
  if (!bate(e, j.x, ny)) j.y = ny;
  else {
    // Encosta no bloco: assenta no chão (ou no teto) em vez de parar a meio caminho.
    if (j.vy > 0) { j.noChao = true; const chao = Math.floor(ny + MEIA_A); if (!bate(e, j.x, chao - MEIA_A - 0.001)) j.y = chao - MEIA_A - 0.001; }
    j.vy = 0;
  }
  j.x = Math.max(MEIA_L, Math.min(LW - MEIA_L, j.x));
  j.y = Math.max(MEIA_A, j.y);
  j.recarga = Math.max(0, j.recarga - 1);
  if (j.atordoado > 0) { j.atordoado--; j.bAnterior = ent.b; return; }
  if (ent.a && j.recarga === 0) cavar(e, j);
  if (ent.b && !j.bAnterior && j.dinamites > 0) {
    j.dinamites--;
    e.dinamites.push({ id: e.proximoId++, x: j.x, y: j.y, dono: j.id, explode: e.passo + PAVIO });
    e.eventos.push({ tipo: "dinamite", jogador: j.id });
  }
  j.bAnterior = ent.b;
  // Carrinho: entrega a carga e repõe a dinamite.
  if (j.y < CHAO && CARRINHOS.some(c => Math.abs(c - j.x) < 1.4)) {
    if (j.carga.length) {
      const valor = j.carga.reduce<number>((s, b) => s + (VALOR[b] ?? 0), 0);
      j.pontos += valor; j.entregas += j.carga.length;
      e.eventos.push({ tipo: "entrega", jogador: j.id, valor, pecas: j.carga.length });
      j.carga = [];
    }
    j.dinamites = DINAMITES;
  }
}

// ---------------------------------------------------------------- bots

const VIZINHOS: [number, number, Direcao][] = [[1, 0, "direita"], [-1, 0, "esquerda"], [0, -1, "cima"], [0, 1, "baixo"]];

/**
 * Menor caminho na grade a partir de uma célula (Dijkstra com fila por baldes): andar no ar custa 1, cavar custa
 * mais conforme os golpes do bloco e a rocha dura não passa. Devolve a distância e de onde se veio em cada célula.
 */
export function mapaDeCaminhos(e: EstadoMineracao, sx: number, sy: number): { dist: number[]; prev: number[] } {
  const N = LW * LH;
  const dist = new Array<number>(N).fill(Infinity), prev = new Array<number>(N).fill(-1);
  const baldes: number[][] = [];
  const ini = sy * LW + sx;
  dist[ini] = 0; baldes[0] = [ini];
  for (let d = 0; d < baldes.length; d++) {
    const b = baldes[d];
    if (!b) continue;
    for (const c of b) {
      if (dist[c] !== d) continue;
      const cx = c % LW, cy = (c - cx) / LW;
      for (const [vx, vy] of VIZINHOS) {
        const nx = cx + vx, ny = cy + vy;
        if (nx < 0 || nx >= LW || ny < 1 || ny >= LH - 1) continue;
        const bl = bloco(e, nx, ny) as Bloco;
        if (bl === DURA) continue;
        const custo = bl === AR ? 1 : 1 + GOLPES[bl] * 2;
        const n = ny * LW + nx, nd = d + custo;
        if (nd < dist[n]) { dist[n] = nd; prev[n] = c; (baldes[nd] ??= []).push(n); }
      }
    }
  }
  return { dist, prev };
}

/** O bot escolhe o minério que compensa (valor pela distância real) e segue o caminho, cavando o que estiver nele. */
export function decisaoDoBot(e: EstadoMineracao, j: Mineiro): { direcao: Direcao | null; a: boolean; b: boolean } {
  // A célula do bot é a dos pés: assim "andar de lado" só acontece quando o corpo inteiro cabe na fileira.
  const cx = Math.floor(j.x), cy = Math.max(1, Math.min(LH - 2, Math.floor(j.y + MEIA_A - 0.01)));
  const { dist, prev } = mapaDeCaminhos(e, cx, cy);
  const restante = TEMPO - e.passo;
  const cheio = j.carga.length >= (j.bot === "facil" ? 4 : j.bot === "medio" ? 5 : 6);
  const voltar = cheio || (j.carga.length > 0 && restante < (cy - CHAO + 10) * 70) || (e.lavaY - j.y < 4 && j.y > CHAO);
  let alvo = -1;
  if (voltar) {
    alvo = CARRINHOS.map(c => (CHAO - 1) * LW + c).sort((a, b) => dist[a] - dist[b])[0];
  } else {
    if (j.alvo && ehMinerio(bloco(e, j.alvo.x, j.alvo.y)) && dist[j.alvo.y * LW + j.alvo.x] < Infinity && e.passo - j.alvoDesde < 1200) alvo = j.alvo.y * LW + j.alvo.x;
    else {
      // Cada bot puxa um pouco para a própria faixa do mapa, para não disputarem o mesmo veio.
      const faixa = ((j.id + 0.5) / e.jogadores.length) * LW;
      let nota = Infinity;
      for (let y = CHAO; y < Math.min(LH - 1, e.lavaY - 3); y++) for (let x = 0; x < LW; x++) {
        const b = bloco(e, x, y);
        const d = dist[y * LW + x];
        if (!ehMinerio(b) || d === Infinity) continue;
        const n = (d + Math.abs(x - faixa) * 0.8 + (y - CHAO) * 0.5) / (VALOR[b as Bloco] ?? 1);
        if (n < nota) { nota = n; alvo = y * LW + x; }
      }
      if (alvo >= 0) { j.alvo = { x: alvo % LW, y: Math.floor(alvo / LW) }; j.alvoDesde = e.passo; }
    }
  }
  if (alvo < 0 || dist[alvo] === Infinity) return { direcao: null, a: false, b: false };
  // Volta pelo caminho até achar o primeiro passo.
  let passo = alvo;
  while (prev[passo] !== -1 && prev[passo] !== cy * LW + cx) passo = prev[passo];
  if (passo === cy * LW + cx) return { direcao: null, a: false, b: false };
  const nx = passo % LW, ny = (passo - nx) / LW;
  const d = VIZINHOS.find(([vx, vy]) => vx === nx - cx && vy === ny - cy)![2];
  const b = bloco(e, nx, ny);
  return { direcao: d, a: b !== AR, b: false };
}

// ---------------------------------------------------------------- passo

export function passoMineracao(e: EstadoMineracao, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  for (const j of e.jogadores) {
    if (e.passo < j.foraAte) continue;
    const ent = j.bot ? decisaoDoBot(e, j) : entradas[j.id] ?? { direcao: null, a: false, b: false };
    mover(e, j, ent);
  }
  for (const d of e.dinamites) if (e.passo >= d.explode) explodir(e, d);
  e.dinamites = e.dinamites.filter(d => e.passo < d.explode);
  if (e.passo % 8 === 0) desmoronar(e);
  if (e.modo === "sobrevivencia") {
    if (e.passo % LAVA_A_CADA === 0 && e.lavaY > CHAO + 3) { e.lavaY--; e.eventos.push({ tipo: "lava", nivel: e.lavaY }); }
    for (const j of e.jogadores) {
      if (e.passo < j.foraAte || j.y + MEIA_A < e.lavaY) continue;
      j.carga = []; j.foraAte = e.passo + 300; j.atordoado = 0; j.alvo = null;
      j.y = CHAO - MEIA_A - 0.01; j.x = CARRINHOS[j.id % 2]; j.vy = 0;
      e.eventos.push({ tipo: "queimou", jogador: j.id });
    }
  }
  if (e.passo >= TEMPO) terminar(e);
}

function terminar(e: EstadoMineracao) {
  e.terminado = true;
  if (e.jogadores.length === 1) e.vencedor = e.jogadores[0].pontos >= META_SOLO[e.modo] ? 0 : null;
  else {
    const ord = e.jogadores.slice().sort((a, b) => b.pontos - a.pontos || b.entregas - a.entregas);
    e.vencedor = ord[0].pontos > ord[1].pontos || ord[0].entregas > ord[1].entregas ? ord[0].id : null;
  }
  e.eventos.push({ tipo: "fim" });
}
