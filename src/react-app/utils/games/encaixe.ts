/**
 * Encaixe Versus: regras puras do puzzle de peças que caem, no padrão do gênero (60 passos por segundo).
 *
 * - Tabuleiro 10 × 20 (mais 2 linhas escondidas em cima), 7 peças sorteadas em sacos de 7 (todos recebem a mesma
 *   sequência), rotação com chutes de parede no padrão do gênero, segurar peça, queda rápida e queda suave.
 * - Versus: linhas limpas mandam lixo para um rival (2 → 1, 3 → 2, 4 → 4, mais combo e "seguida" de 4 linhas);
 *   o lixo pendente sobe quando a pessoa encaixa sem limpar linha. Topo cheio: está fora. Vence o último.
 * - Sprint: 40 linhas; vence quem chegar primeiro. Maratona (sozinho): a velocidade sobe a cada 10 linhas; chegar a
 *   50 linhas cumpre o desafio.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const LARGURA = 10;
export const ALTURA = 20;
const ESCONDIDAS = 2;
const LINHAS_TOTAL = ALTURA + ESCONDIDAS;
export const PASSOS_POR_SEGUNDO = 60;
export const META_SPRINT = 40;
export const META_MARATONA = 50;
export const DURACAO_VERSUS = 5 * 60 * PASSOS_POR_SEGUNDO;
const ATRASO_TRAVA = 30;
const MAX_REINICIOS_TRAVA = 15;
const DAS = 10;
const ARR = 2;

export type TipoPeca = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const TIPOS: TipoPeca[] = ["I", "O", "T", "S", "Z", "J", "L"];
/** Célula: 0 vazia, 1–7 peça (índice em TIPOS + 1), 8 lixo. */
export type Celula = number;
export const LIXO = 8;

export type ModoEncaixe = "versus" | "sprint" | "maratona";

/** Formas nas 4 rotações (coordenadas [x, y] dentro de uma caixa, y para baixo). */
const FORMAS: Record<TipoPeca, [number, number][][]> = {
  I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
  O: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]],
  T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
  S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
  Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
  J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
  L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
};

/** Chutes de parede (padrão do gênero) para girar no sentido horário: de r para r+1; y para cima nas tabelas. */
const CHUTES_JLSTZ: [number, number][][] = [
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
];
const CHUTES_I: [number, number][][] = [
  [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
];

export const celulasDaPeca = (tipo: TipoPeca, rot: number, x: number, y: number) => FORMAS[tipo][((rot % 4) + 4) % 4].map(([cx, cy]) => [x + cx, y + cy] as [number, number]);

export interface Peca { tipo: TipoPeca; rot: number; x: number; y: number }

export interface Tabuleiro {
  id: number;
  bot: Dificuldade | null;
  grade: Celula[][];
  peca: Peca | null;
  guardada: TipoPeca | null;
  podeGuardar: boolean;
  fila: TipoPeca[];
  saco: () => number;
  gravidade: number;
  travaEm: number;
  reinicios: number;
  lixoPendente: number[];
  combo: number;
  seguida: boolean;
  linhas: number;
  pontos: number;
  vivo: boolean;
  terminouEm: number | null;
  alvo: number;
  // controles
  segurando: Direcao | null;
  segurandoDesde: number;
  aAnterior: boolean;
  bAnterior: boolean;
  cimaAnterior: boolean;
  // bot
  plano: { rot: number; x: number; guardar: boolean } | null;
  proximaAcao: number;
}

export type EventoEncaixe =
  | { tipo: "travou"; tabuleiro: number }
  | { tipo: "linhas"; tabuleiro: number; quantas: number; linhasY: number[]; ataque: number }
  | { tipo: "lixo"; tabuleiro: number; quantas: number }
  | { tipo: "girou"; tabuleiro: number }
  | { tipo: "nocaute"; tabuleiro: number }
  | { tipo: "fim"; vencedor: number | null };

export interface EstadoEncaixe {
  modo: ModoEncaixe;
  tabuleiros: Tabuleiro[];
  passo: number;
  duracao: number;
  terminado: boolean;
  vencedor: number | null;
  eventos: EventoEncaixe[];
  sortear: () => number;
}

const gradeVazia = (): Celula[][] => Array.from({ length: LINHAS_TOTAL }, () => Array<Celula>(LARGURA).fill(0));

/** Saco de 7: cada peça aparece uma vez a cada 7 (sequência igual para todos com a mesma semente). */
function encherFila(t: Tabuleiro) {
  while (t.fila.length < 7) {
    const saco = [...TIPOS];
    for (let i = saco.length - 1; i > 0; i--) {
      const k = Math.floor(t.saco() * (i + 1));
      [saco[i], saco[k]] = [saco[k], saco[i]];
    }
    t.fila.push(...saco);
  }
}

export const cabe = (grade: Celula[][], tipo: TipoPeca, rot: number, x: number, y: number) =>
  celulasDaPeca(tipo, rot, x, y).every(([cx, cy]) => cx >= 0 && cx < LARGURA && cy < LINHAS_TOTAL && (cy < 0 || grade[cy][cx] === 0));

/** Velocidade da queda (passos por linha) pelo nível. */
export const passosPorLinha = (nivel: number) => Math.max(2, Math.round(48 * Math.pow(0.82, nivel - 1)));
export const nivelDe = (t: Tabuleiro) => 1 + Math.floor(t.linhas / 10);

function novaPeca(e: EstadoEncaixe, t: Tabuleiro, tipo?: TipoPeca) {
  encherFila(t);
  const proximo = tipo ?? (t.fila.shift() as TipoPeca);
  const x = proximo === "O" ? 3 : 3;
  const y = 0;
  t.peca = { tipo: proximo, rot: 0, x, y };
  t.gravidade = 0;
  t.travaEm = 0;
  t.reinicios = 0;
  t.plano = null;
  if (!cabe(t.grade, proximo, 0, x, y)) nocaute(e, t);
}

function nocaute(e: EstadoEncaixe, t: Tabuleiro) {
  if (!t.vivo) return;
  t.vivo = false;
  t.peca = null;
  t.terminouEm = e.passo;
  e.eventos.push({ tipo: "nocaute", tabuleiro: t.id });
}

export interface ConfiguracaoEncaixe { modo: ModoEncaixe; jogadores: { bot: Dificuldade | null }[]; semente?: number }

export function novaPartidaEncaixe(c: ConfiguracaoEncaixe): EstadoEncaixe {
  const n = Math.max(1, Math.min(8, c.jogadores.length));
  const semente = (c.semente ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const modo: ModoEncaixe = n === 1 ? (c.modo === "versus" ? "maratona" : c.modo) : c.modo === "maratona" ? "versus" : c.modo;
  const e: EstadoEncaixe = {
    modo, tabuleiros: [], passo: 0, duracao: modo === "versus" ? DURACAO_VERSUS : 30 * 60 * PASSOS_POR_SEGUNDO,
    terminado: false, vencedor: null, eventos: [], sortear: rng(semente ^ 0x9e3779b9),
  };
  e.tabuleiros = Array.from({ length: n }, (_, i) => ({
    id: i, bot: c.jogadores[i]?.bot ?? null, grade: gradeVazia(), peca: null, guardada: null, podeGuardar: true, fila: [],
    saco: rng(semente), gravidade: 0, travaEm: 0, reinicios: 0, lixoPendente: [], combo: -1, seguida: false, linhas: 0, pontos: 0,
    vivo: true, terminouEm: null, alvo: (i + 1) % n, segurando: null, segurandoDesde: 0, aAnterior: false, bAnterior: false,
    cimaAnterior: false, plano: null, proximaAcao: 0,
  }));
  e.tabuleiros.forEach(t => novaPeca(e, t));
  return e;
}

/** Onde a peça pararia se caísse agora (fantasma). */
export function alturaDeQueda(t: Tabuleiro): number {
  const p = t.peca;
  if (!p) return 0;
  let y = p.y;
  while (cabe(t.grade, p.tipo, p.rot, p.x, y + 1)) y++;
  return y;
}

function mover(t: Tabuleiro, dx: number): boolean {
  const p = t.peca;
  if (!p || !cabe(t.grade, p.tipo, p.rot, p.x + dx, p.y)) return false;
  p.x += dx;
  reiniciarTrava(t);
  return true;
}

function reiniciarTrava(t: Tabuleiro) {
  if (t.travaEm > 0 && t.reinicios < MAX_REINICIOS_TRAVA) { t.travaEm = 0; t.reinicios++; }
}

/** Gira no sentido horário com os chutes de parede do padrão. */
export function girar(t: Tabuleiro): boolean {
  const p = t.peca;
  if (!p || p.tipo === "O") return false;
  const de = ((p.rot % 4) + 4) % 4;
  const tabela = p.tipo === "I" ? CHUTES_I : CHUTES_JLSTZ;
  for (const [kx, ky] of tabela[de]) {
    if (cabe(t.grade, p.tipo, de + 1, p.x + kx, p.y - ky)) {
      p.rot = (de + 1) % 4;
      p.x += kx;
      p.y -= ky;
      reiniciarTrava(t);
      return true;
    }
  }
  return false;
}

function guardar(e: EstadoEncaixe, t: Tabuleiro) {
  if (!t.peca || !t.podeGuardar) return;
  const atual = t.peca.tipo;
  const antes = t.guardada;
  t.guardada = atual;
  t.podeGuardar = false;
  novaPeca(e, t, antes ?? undefined);
  t.podeGuardar = false;
}

/** Ataque das linhas limpas (padrão do gênero) com combo e seguida de 4 linhas. */
export function ataqueDe(quantas: number, combo: number, seguida: boolean, limpouTudo: boolean): number {
  const base = [0, 0, 1, 2, 4][quantas] ?? 4;
  const bonusCombo = combo >= 6 ? 3 : combo >= 4 ? 2 : combo >= 2 ? 1 : 0;
  return base + bonusCombo + (seguida && quantas === 4 ? 1 : 0) + (limpouTudo ? 10 : 0);
}

function travar(e: EstadoEncaixe, t: Tabuleiro) {
  const p = t.peca;
  if (!p) return;
  const cor = TIPOS.indexOf(p.tipo) + 1;
  let acimaDoTopo = true;
  for (const [cx, cy] of celulasDaPeca(p.tipo, p.rot, p.x, p.y)) {
    if (cy >= 0) t.grade[cy][cx] = cor;
    if (cy >= ESCONDIDAS) acimaDoTopo = false;
  }
  e.eventos.push({ tipo: "travou", tabuleiro: t.id });
  // Linhas completas.
  const cheias: number[] = [];
  t.grade.forEach((linha, y) => { if (linha.every(c => c !== 0)) cheias.push(y); });
  if (cheias.length) {
    t.grade = t.grade.filter((_l, y) => !cheias.includes(y));
    while (t.grade.length < LINHAS_TOTAL) t.grade.unshift(Array<Celula>(LARGURA).fill(0));
    t.combo++;
    const limpouTudo = t.grade.every(l => l.every(c => c === 0));
    let ataque = ataqueDe(cheias.length, t.combo, t.seguida, limpouTudo);
    t.seguida = cheias.length === 4;
    t.linhas += cheias.length;
    t.pontos += ([0, 100, 300, 500, 800][cheias.length] ?? 800) * nivelDe(t) + Math.max(0, t.combo) * 50;
    // O ataque primeiro cancela o lixo que estava para subir.
    while (ataque > 0 && t.lixoPendente.length) {
      t.lixoPendente[0]--;
      ataque--;
      if (t.lixoPendente[0] <= 0) t.lixoPendente.shift();
    }
    e.eventos.push({ tipo: "linhas", tabuleiro: t.id, quantas: cheias.length, linhasY: cheias, ataque });
    if (ataque > 0 && e.modo === "versus") enviarLixo(e, t, ataque);
  } else {
    t.combo = -1;
    subirLixo(e, t);
  }
  t.podeGuardar = true;
  t.peca = null;
  if (acimaDoTopo) { nocaute(e, t); return; }
  novaPeca(e, t);
}

/** Manda o lixo para o próximo rival vivo, em rodízio. */
function enviarLixo(e: EstadoEncaixe, de: Tabuleiro, quantas: number) {
  const vivos = e.tabuleiros.filter(o => o.vivo && o.id !== de.id);
  if (!vivos.length) return;
  let alvo = e.tabuleiros[de.alvo];
  if (!alvo || !alvo.vivo || alvo.id === de.id) alvo = vivos[0];
  alvo.lixoPendente.push(quantas);
  const ordem = vivos.map(o => o.id);
  de.alvo = ordem[(ordem.indexOf(alvo.id) + 1) % ordem.length];
}

function subirLixo(e: EstadoEncaixe, t: Tabuleiro) {
  let total = 0;
  while (t.lixoPendente.length) {
    const n = Math.min(t.lixoPendente.shift() as number, LINHAS_TOTAL);
    const buraco = Math.floor(e.sortear() * LARGURA);
    for (let k = 0; k < n; k++) {
      const topo = t.grade.shift();
      if (topo && topo.some(c => c !== 0)) { nocaute(e, t); }
      const linha = Array<Celula>(LARGURA).fill(LIXO);
      linha[buraco] = 0;
      t.grade.push(linha);
    }
    total += n;
  }
  if (total) e.eventos.push({ tipo: "lixo", tabuleiro: t.id, quantas: total });
}

function controlar(e: EstadoEncaixe, t: Tabuleiro, ent: Entrada) {
  const p = t.peca;
  if (!p) return;
  // Esquerda/direita com repetição (DAS/ARR); baixo acelera; cima cai de vez.
  const lado = ent.direcao === "esquerda" ? -1 : ent.direcao === "direita" ? 1 : 0;
  if (ent.direcao !== t.segurando) {
    t.segurando = ent.direcao;
    t.segurandoDesde = e.passo;
    if (lado) mover(t, lado);
  } else if (lado) {
    const segurou = e.passo - t.segurandoDesde;
    if (segurou >= DAS && (segurou - DAS) % ARR === 0) mover(t, lado);
  }
  const cima = ent.direcao === "cima";
  if (cima && !t.cimaAnterior) {
    const destino = alturaDeQueda(t);
    t.pontos += (destino - p.y) * 2;
    p.y = destino;
    t.cimaAnterior = cima;
    travar(e, t);
    return;
  }
  t.cimaAnterior = cima;
  if (ent.a && !t.aAnterior && girar(t)) e.eventos.push({ tipo: "girou", tabuleiro: t.id });
  if (ent.b && !t.bAnterior) guardar(e, t);
  t.aAnterior = ent.a;
  t.bAnterior = ent.b;
}

function cair(e: EstadoEncaixe, t: Tabuleiro, suave: boolean) {
  const p = t.peca;
  if (!p) return;
  t.gravidade += suave ? Math.max(1, passosPorLinha(nivelDe(t)) / 2) : 1;
  const limite = suave ? Math.min(2, passosPorLinha(nivelDe(t))) : passosPorLinha(nivelDe(t));
  if (t.gravidade >= limite) {
    t.gravidade = 0;
    if (cabe(t.grade, p.tipo, p.rot, p.x, p.y + 1)) {
      p.y++;
      if (suave) t.pontos += 1;
      t.travaEm = 0;
    }
  }
  if (!cabe(t.grade, p.tipo, p.rot, p.x, p.y + 1)) {
    t.travaEm++;
    if (t.travaEm >= ATRASO_TRAVA) travar(e, t);
  }
}

function conferirFim(e: EstadoEncaixe) {
  const vivos = e.tabuleiros.filter(t => t.vivo);
  const n = e.tabuleiros.length;
  const acabou = e.passo >= e.duracao;
  if (e.modo === "sprint") {
    const chegou = e.tabuleiros.find(t => t.linhas >= META_SPRINT);
    if (chegou) return terminar(e, chegou.id);
    if (!vivos.length || acabou) return terminar(e, null);
    if (n > 1 && vivos.length === 1 && e.tabuleiros.every(t => t.vivo || t.linhas < META_SPRINT)) {
      // Todos os outros caíram: quem sobrou vence o sprint.
      return terminar(e, vivos[0].id);
    }
    return;
  }
  if (e.modo === "maratona") {
    const t = e.tabuleiros[0];
    if (t.linhas >= META_MARATONA) return terminar(e, t.id);
    if (!t.vivo) return terminar(e, null);
    return;
  }
  if (vivos.length <= 1) return terminar(e, vivos.length === 1 ? vivos[0].id : null);
  if (acabou) {
    // No fim do tempo, vence quem tem o tabuleiro mais baixo.
    const altura = (t: Tabuleiro) => t.grade.findIndex(l => l.some(c => c !== 0));
    const melhor = Math.max(...vivos.map(t => (altura(t) < 0 ? LINHAS_TOTAL : altura(t))));
    const lideres = vivos.filter(t => (altura(t) < 0 ? LINHAS_TOTAL : altura(t)) === melhor);
    terminar(e, lideres.length === 1 ? lideres[0].id : null);
  }
}

function terminar(e: EstadoEncaixe, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.eventos.push({ tipo: "fim", vencedor });
}

const PARADO: Entrada = { direcao: null, a: false, b: false };

export function passoEncaixe(e: EstadoEncaixe, entradas: Entrada[]): EstadoEncaixe {
  if (e.terminado) return e;
  e.eventos = [];
  e.passo++;
  for (const t of e.tabuleiros) {
    if (!t.vivo || !t.peca) continue;
    const ent = t.bot ? pensarBotEncaixe(e, t) : entradas[t.id] ?? PARADO;
    controlar(e, t, ent);
    if (t.vivo && t.peca) cair(e, t, ent.direcao === "baixo");
  }
  conferirFim(e);
  return e;
}

// ---------------------------------------------------------------- bots

/** Nota de um tabuleiro (heurística clássica do gênero): altura, buracos, irregularidade e linhas. */
export function notaDaGrade(grade: Celula[][], linhas: number): number {
  const alturas = Array.from({ length: LARGURA }, (_, x) => {
    const y = grade.findIndex(l => l[x] !== 0);
    return y < 0 ? 0 : LINHAS_TOTAL - y;
  });
  let buracos = 0;
  for (let x = 0; x < LARGURA; x++) {
    let teto = false;
    for (let y = 0; y < LINHAS_TOTAL; y++) {
      if (grade[y][x] !== 0) teto = true;
      else if (teto) buracos++;
    }
  }
  const soma = alturas.reduce((a, b) => a + b, 0);
  let irregular = 0;
  for (let x = 0; x < LARGURA - 1; x++) irregular += Math.abs(alturas[x] - alturas[x + 1]);
  return -0.51 * soma + 0.76 * linhas - 0.36 * buracos - 0.18 * irregular;
}

/** Melhor encaixe (rotação e coluna) para a peça, simulando a queda. */
export function melhorEncaixe(grade: Celula[][], tipo: TipoPeca, ruido = 0, sortear: () => number = Math.random): { rot: number; x: number; nota: number } {
  let melhor = { rot: 0, x: 3, nota: -Infinity };
  for (let rot = 0; rot < 4; rot++) {
    for (let x = -2; x < LARGURA; x++) {
      if (!cabe(grade, tipo, rot, x, 0)) continue;
      let y = 0;
      while (cabe(grade, tipo, rot, x, y + 1)) y++;
      const g = grade.map(l => [...l]);
      for (const [cx, cy] of celulasDaPeca(tipo, rot, x, y)) if (cy >= 0) g[cy][cx] = 1;
      const cheias = g.filter(l => l.every(c => c !== 0)).length;
      const restante = g.filter(l => !l.every(c => c !== 0));
      while (restante.length < LINHAS_TOTAL) restante.unshift(Array<Celula>(LARGURA).fill(0));
      const nota = notaDaGrade(restante, cheias) + (sortear() - 0.5) * ruido;
      if (nota > melhor.nota) melhor = { rot, x, nota };
    }
  }
  return melhor;
}

const INTERVALO_BOT: Record<Dificuldade, number> = { facil: 14, medio: 6, dificil: 2 };
// Um pouco de variação até no Difícil: com a mesma sequência de peças, cada bot joga do seu jeito.
const RUIDO_BOT: Record<Dificuldade, number> = { facil: 6, medio: 2, dificil: 0.5 };

/** Bot: planeja o encaixe ao receber a peça e vai girando/andando até lá, uma ação por vez. */
export function pensarBotEncaixe(e: EstadoEncaixe, t: Tabuleiro): Entrada {
  const dif = t.bot ?? "medio";
  const p = t.peca;
  if (!p) return PARADO;
  if (!t.plano) {
    const agora = melhorEncaixe(t.grade, p.tipo, RUIDO_BOT[dif], e.sortear);
    t.plano = { rot: agora.rot, x: agora.x, guardar: false };
    // No Difícil, compara com a peça guardada (ou a próxima) e troca se for melhor.
    if (dif === "dificil" && t.podeGuardar) {
      const outra = t.guardada ?? t.fila[0];
      if (outra && melhorEncaixe(t.grade, outra).nota > agora.nota + 1) t.plano.guardar = true;
    }
  }
  if (e.passo < t.proximaAcao) return { direcao: t.segurando === "baixo" ? "baixo" : null, a: false, b: false };
  t.proximaAcao = e.passo + INTERVALO_BOT[dif];
  // Solta os botões entre uma ação e outra (cada aperto conta uma vez).
  if (t.aAnterior || t.bAnterior || t.cimaAnterior || t.segurando) return PARADO;
  if (t.plano.guardar) { t.plano.guardar = false; return { direcao: null, a: false, b: true }; }
  if (p.rot % 4 !== t.plano.rot) return { direcao: null, a: true, b: false };
  if (p.x < t.plano.x) return { direcao: "direita", a: false, b: false };
  if (p.x > t.plano.x) return { direcao: "esquerda", a: false, b: false };
  return dif === "facil" ? { direcao: "baixo", a: false, b: false } : { direcao: "cima", a: false, b: false };
}

export const segundosRestantesEncaixe = (e: EstadoEncaixe) => Math.max(0, Math.ceil((e.duracao - e.passo) / PASSOS_POR_SEGUNDO));
export const linhaVisivel = (y: number) => y - ESCONDIDAS;
export { ESCONDIDAS };
