/**
 * Sumô dos Hexágonos: regras puras (sem desenho), 60 passos por segundo, com as mesmas regras do gênero de "pisos
 * que caem" e do sumô de arena.
 *
 * - Queda: três camadas de hexágonos empilhadas. O piso pisado brilha, racha e cai pouco depois; quem cai passa para a
 *   camada de baixo, e quem cai da última está fora. Vence o último em pé.
 * - Sumô: uma camada só; a borda da arena desmorona de tempos em tempos e o dash empurra os rivais para fora.
 * - Sozinho (sem bots): sobreviva 60 s na Queda.
 *
 * Coordenadas: x e z no chão, y para cima; hexágonos de raio 1 (axiais q, r, ponta para cima).
 */
import type { Dificuldade, Direcao, Entrada } from "./bombas.ts";
import { rng } from "./bombas.ts";

export const PASSOS_POR_SEGUNDO = 60;
const DT = 1 / PASSOS_POR_SEGUNDO;
export const RAIO_HEX = 1;
export const ALTURA_CAMADA = 6;
export const RAIO_JOGADOR = 0.38;
/** Passos entre pisar e o piso cair (≈ 0,7 s). */
export const CAI_APOS = 42;
export const DURACAO_PADRAO = 180 * PASSOS_POR_SEGUNDO;
export const DURACAO_SOLO = 60 * PASSOS_POR_SEGUNDO;
/** Sumô: a cada tantos passos a borda da arena começa a desmoronar. */
export const INTERVALO_BORDA = 7 * PASSOS_POR_SEGUNDO;

const VEL_MAX = 4.6;
const GRAVIDADE = 20;
const PULO = 7.2;
const DASH = 10;
const DASH_DURA = 12;
const DASH_ESPERA = 75;
const QUEDA_LIMITE = -10;

export type ModoHex = "queda" | "sumo";

export interface Piso { q: number; r: number; camada: number; x: number; z: number; pisadoEm: number | null; caiuEm: number | null }

export interface JogadorHex {
  id: number;
  nome: string;
  bot: Dificuldade | null;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Para onde olha (para o dash e o desenho). */
  direcao: Direcao;
  noChao: boolean;
  vivo: boolean;
  dashPronto: number;
  dashAte: number;
  /** Empurrado por um dash: perde o controle por um instante. */
  empurradoAte: number;
  aAnterior: boolean;
  bAnterior: boolean;
  /** Bot: alvo atual e quando pensa de novo. */
  alvo: { x: number; z: number; piso: number } | null;
  pensaEm: number;
  /** Andou neste passo (animação). */
  andando: boolean;
}

export type EventoHex =
  | { tipo: "pisou"; piso: number }
  | { tipo: "caiu"; piso: number }
  | { tipo: "dash"; jogador: number }
  | { tipo: "pulo"; jogador: number }
  | { tipo: "empurrao"; x: number; y: number; z: number; forca: number }
  | { tipo: "morte"; jogador: number; x: number; y: number; z: number }
  | { tipo: "borda" }
  | { tipo: "fim"; vencedor: number | null };

export interface EstadoHex {
  modo: ModoHex;
  camadas: number;
  raio: number;
  pisos: Piso[];
  indice: Map<string, number>;
  jogadores: JogadorHex[];
  passo: number;
  duracao: number;
  proximaBorda: number;
  terminado: boolean;
  vencedor: number | null;
  eventos: EventoHex[];
  sortear: () => number;
}

export interface ConfiguracaoHex { modo: ModoHex; jogadores: { nome: string; bot: Dificuldade | null }[]; semente?: number }

const chave = (q: number, r: number, camada: number) => `${q},${r},${camada}`;
export const posicaoDoHex = (q: number, r: number) => ({ x: RAIO_HEX * Math.sqrt(3) * (q + r / 2), z: RAIO_HEX * 1.5 * r });
export const alturaDaCamada = (camada: number) => -camada * ALTURA_CAMADA;

/** O hexágono (q, r) que contém o ponto (x, z). */
export function hexNoPonto(x: number, z: number): { q: number; r: number } {
  const qf = (Math.sqrt(3) / 3 * x - z / 3) / RAIO_HEX;
  const rf = (2 / 3 * z) / RAIO_HEX;
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q + 0, r: r + 0 };
}

export function novaPartidaHex(c: ConfiguracaoHex): EstadoHex {
  const n = Math.max(1, Math.min(8, c.jogadores.length));
  const solo = n === 1;
  const modo: ModoHex = solo ? "queda" : c.modo;
  const camadas = modo === "queda" ? 3 : 1;
  const raio = n > 4 ? 6 : 5;
  const sortear = rng((c.semente ?? Math.floor(Math.random() * 2 ** 31)) >>> 0);
  const pisos: Piso[] = [];
  const indice = new Map<string, number>();
  for (let camada = 0; camada < camadas; camada++) {
    const R = modo === "sumo" ? raio + 1 : raio;
    for (let q = -R; q <= R; q++) {
      for (let r = -R; r <= R; r++) {
        if (Math.abs(q + r) > R) continue;
        const { x, z } = posicaoDoHex(q, r);
        indice.set(chave(q, r, camada), pisos.length);
        pisos.push({ q, r, camada, x, z, pisadoEm: null, caiuEm: null });
      }
    }
  }
  // Largadas num círculo em volta do centro, olhando para dentro.
  const jogadores: JogadorHex[] = Array.from({ length: n }, (_, i) => {
    const ang = (i / n) * Math.PI * 2 + Math.PI / 2;
    const dist = solo ? 0 : raio * RAIO_HEX * 1.1;
    const alvo = hexNoPonto(Math.cos(ang) * dist, Math.sin(ang) * dist);
    const p = posicaoDoHex(alvo.q, alvo.r);
    return {
      id: i, nome: c.jogadores[i]?.nome ?? `P${i + 1}`, bot: c.jogadores[i]?.bot ?? null,
      x: p.x, y: 0, z: p.z, vx: 0, vy: 0, vz: 0, direcao: "baixo", noChao: true, vivo: true,
      dashPronto: 0, dashAte: 0, empurradoAte: 0, aAnterior: false, bAnterior: false, alvo: null, pensaEm: i * 4, andando: false,
    };
  });
  return {
    modo, camadas, raio, pisos, indice, jogadores, passo: 0, duracao: solo ? DURACAO_SOLO : DURACAO_PADRAO,
    proximaBorda: INTERVALO_BORDA, terminado: false, vencedor: null, eventos: [], sortear,
  };
}

/** O piso inteiro (ainda no lugar) em (x, z) na camada, se houver. */
export function pisoEm(e: EstadoHex, x: number, z: number, camada: number): Piso | null {
  const { q, r } = hexNoPonto(x, z);
  const i = e.indice.get(chave(q, r, camada));
  if (i === undefined) return null;
  const p = e.pisos[i];
  return p.caiuEm === null ? p : null;
}

const VETOR: Record<Direcao, [number, number]> = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] };

export const camadaDoJogador = (j: JogadorHex) => Math.max(0, Math.round(-j.y / ALTURA_CAMADA));

function mover(e: EstadoHex, j: JogadorHex, ent: Entrada) {
  const [dx, dz] = ent.direcao ? VETOR[ent.direcao] : [0, 0];
  if (ent.direcao) j.direcao = ent.direcao;
  j.andando = !!ent.direcao && j.noChao;
  const dashando = e.passo < j.dashAte;
  const empurrado = e.passo < j.empurradoAte;
  const controle = empurrado ? 0.015 : j.noChao ? (dashando ? 0.04 : 0.28) : 0.07;
  j.vx += (dx * VEL_MAX - j.vx) * controle;
  j.vz += (dz * VEL_MAX - j.vz) * controle;
  // Dash (A): arrancada curta na direção em que olha.
  const apertouA = ent.a && !j.aAnterior;
  const apertouB = ent.b && !j.bAnterior;
  j.aAnterior = ent.a;
  j.bAnterior = ent.b;
  if (apertouA && e.passo >= j.dashPronto) {
    const [fx, fz] = VETOR[j.direcao];
    j.vx = fx * DASH;
    j.vz = fz * DASH;
    j.dashAte = e.passo + DASH_DURA;
    j.dashPronto = e.passo + DASH_ESPERA;
    e.eventos.push({ tipo: "dash", jogador: j.id });
  }
  // Pulo (B): só do chão.
  if (apertouB && j.noChao) {
    j.vy = PULO;
    j.noChao = false;
    e.eventos.push({ tipo: "pulo", jogador: j.id });
  }
}

function fisica(e: EstadoHex, j: JogadorHex) {
  const yAntes = j.y;
  j.vy -= GRAVIDADE * DT;
  j.x += j.vx * DT;
  j.z += j.vz * DT;
  j.y += j.vy * DT;
  // Chão: a camada mais alta que o jogador cruzou neste passo e que tem piso embaixo.
  j.noChao = false;
  for (let k = 0; k < e.camadas; k++) {
    const topo = alturaDaCamada(k);
    if (yAntes >= topo - 0.001 && j.y <= topo) {
      const piso = pisoEm(e, j.x, j.z, k);
      if (piso) {
        j.y = topo;
        j.vy = 0;
        j.noChao = true;
        if (e.modo === "queda" && piso.pisadoEm === null) {
          piso.pisadoEm = e.passo;
          e.eventos.push({ tipo: "pisou", piso: e.indice.get(chave(piso.q, piso.r, piso.camada)) as number });
        }
        break;
      }
    }
  }
  if (j.y < alturaDaCamada(e.camadas - 1) + QUEDA_LIMITE) {
    j.vivo = false;
    e.eventos.push({ tipo: "morte", jogador: j.id, x: j.x, y: j.y, z: j.z });
  }
}

/** Esbarrões: ninguém atravessa ninguém; quem está no dash empurra forte. */
function colisoes(e: EstadoHex) {
  const vivos = e.jogadores.filter(j => j.vivo);
  for (let a = 0; a < vivos.length; a++) {
    for (let b = a + 1; b < vivos.length; b++) {
      const p = vivos[a], o = vivos[b];
      if (Math.abs(p.y - o.y) > 1.2) continue;
      const dx = o.x - p.x, dz = o.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d >= RAIO_JOGADOR * 2 || d === 0) continue;
      const nx = dx / d, nz = dz / d;
      const sobra = RAIO_JOGADOR * 2 - d;
      p.x -= nx * sobra / 2; p.z -= nz * sobra / 2;
      o.x += nx * sobra / 2; o.z += nz * sobra / 2;
      const pDash = e.passo < p.dashAte, oDash = e.passo < o.dashAte;
      if (pDash || oDash) {
        const forca = pDash && oDash ? 7 : 11;
        if (pDash) { o.vx += nx * forca; o.vz += nz * forca; p.vx *= 0.3; p.vz *= 0.3; o.empurradoAte = e.passo + 22; }
        if (oDash) { p.vx -= nx * forca; p.vz -= nz * forca; o.vx *= 0.3; o.vz *= 0.3; p.empurradoAte = e.passo + 22; }
        p.dashAte = 0; o.dashAte = 0;
        e.eventos.push({ tipo: "empurrao", x: (p.x + o.x) / 2, y: p.y, z: (p.z + o.z) / 2, forca });
      } else {
        // Troca o que vai um contra o outro (esbarrão comum).
        const rel = (o.vx - p.vx) * nx + (o.vz - p.vz) * nz;
        if (rel < 0) {
          p.vx += nx * rel; p.vz += nz * rel;
          o.vx -= nx * rel; o.vz -= nz * rel;
        }
      }
    }
  }
}

function pisos(e: EstadoHex) {
  for (let i = 0; i < e.pisos.length; i++) {
    const p = e.pisos[i];
    if (p.caiuEm === null && p.pisadoEm !== null && e.passo - p.pisadoEm >= CAI_APOS) {
      p.caiuEm = e.passo;
      e.eventos.push({ tipo: "caiu", piso: i });
    }
  }
  // Sumô: a borda desmorona (aviso piscando e queda logo depois).
  if (e.modo === "sumo" && e.passo >= e.proximaBorda) {
    e.proximaBorda += INTERVALO_BORDA;
    const vivos = e.pisos.filter(p => p.caiuEm === null && p.pisadoEm === null);
    const maior = Math.max(...vivos.map(p => Math.max(Math.abs(p.q), Math.abs(p.r), Math.abs(p.q + p.r))));
    if (maior > 1) {
      for (const p of vivos) if (Math.max(Math.abs(p.q), Math.abs(p.r), Math.abs(p.q + p.r)) === maior) p.pisadoEm = e.passo - CAI_APOS + 72;
      e.eventos.push({ tipo: "borda" });
    }
  }
}

function conferirFim(e: EstadoHex) {
  const vivos = e.jogadores.filter(j => j.vivo);
  const acabou = e.passo >= e.duracao;
  if (e.jogadores.length === 1) {
    if (!vivos.length) terminar(e, null);
    else if (acabou) terminar(e, 0);
    return;
  }
  if (vivos.length <= 1) terminar(e, vivos.length === 1 ? vivos[0].id : null);
  else if (acabou) {
    // No fim do tempo, vence quem está mais alto (camada de cima); empate se houver mais de um.
    const melhor = Math.min(...vivos.map(camadaDoJogador));
    const lideres = vivos.filter(j => camadaDoJogador(j) === melhor);
    terminar(e, lideres.length === 1 ? lideres[0].id : null);
  }
}

function terminar(e: EstadoHex, vencedor: number | null) {
  e.terminado = true;
  e.vencedor = vencedor;
  e.eventos.push({ tipo: "fim", vencedor });
}

export const ENTRADA_PARADA: Entrada = { direcao: null, a: false, b: false };

/** Um passo do jogo; {@code entradas[i]} = controle da vaga i (bots pensam sozinhos). */
export function passoHex(e: EstadoHex, entradas: Entrada[]): EstadoHex {
  if (e.terminado) return e;
  e.eventos = [];
  e.passo++;
  for (const j of e.jogadores) {
    if (!j.vivo) continue;
    mover(e, j, j.bot ? pensarBotHex(e, j) : entradas[j.id] ?? ENTRADA_PARADA);
  }
  for (const j of e.jogadores) if (j.vivo) fisica(e, j);
  colisoes(e);
  pisos(e);
  conferirFim(e);
  return e;
}

// ---------------------------------------------------------------- bots

const REACAO: Record<Dificuldade, number> = { facil: 30, medio: 14, dificil: 5 };
const ERRO: Record<Dificuldade, number> = { facil: 0.35, medio: 0.12, dificil: 0.02 };

/** Vizinhos inteiros de um piso (quanto mais, mais seguro ficar ali). */
function vizinhosInteiros(e: EstadoHex, p: Piso): number {
  let n = 0;
  for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]) {
    const i = e.indice.get(chave(p.q + dq, p.r + dr, p.camada));
    if (i !== undefined && e.pisos[i].caiuEm === null && e.pisos[i].pisadoEm === null) n++;
  }
  return n;
}

const direcaoPara = (dx: number, dz: number): Direcao | null => {
  if (Math.hypot(dx, dz) < 0.25) return null;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "direita" : "esquerda") : (dz > 0 ? "baixo" : "cima");
};

/**
 * Bot: escolhe um piso seguro (inteiro, ainda não pisado, com vizinhos inteiros e perto do centro), anda até ele, pula
 * buraco no caminho e, no Médio/Difícil, dá dash em quem está perto e na direção certa.
 */
export function pensarBotHex(e: EstadoHex, j: JogadorHex): Entrada {
  const dif = j.bot ?? "medio";
  const camada = camadaDoJogador(j);
  // Mantém o alvo até chegar; só troca se ele rachar (percebido depois do tempo de reação) ou mudar de camada.
  const alvoAtual = j.alvo ? e.pisos[j.alvo.piso] : null;
  const chegou = j.alvo && Math.hypot(j.alvo.x - j.x, j.alvo.z - j.z) < 0.45;
  const perdeu = !alvoAtual || alvoAtual.camada !== camada || alvoAtual.caiuEm !== null || alvoAtual.pisadoEm !== null;
  if (!j.alvo || chegou || (perdeu && e.passo >= j.pensaEm)) {
    j.pensaEm = e.passo + REACAO[dif] + Math.floor(e.sortear() * 6);
    let melhor: Piso | null = null;
    let nota = -Infinity;
    const aqui = hexNoPonto(j.x, j.z);
    for (const p of e.pisos) {
      if (p.camada !== camada || p.caiuEm !== null || p.pisadoEm !== null) continue;
      const distAqui = Math.hypot(p.x - j.x, p.z - j.z);
      if (distAqui > 5.5 || (p.q === aqui.q && p.r === aqui.r)) continue;
      // Área aberta em volta (pisos ainda não pisados num raio de 2) vale mais que ficar perto do centro.
      let aberto = 0;
      for (const o of e.pisos) {
        if (o.camada === camada && o.caiuEm === null && o.pisadoEm === null && Math.hypot(o.x - p.x, o.z - p.z) < 3.6) aberto++;
      }
      const leitura = dif === "facil" ? 0.4 : dif === "medio" ? 0.8 : 1.2;
      const n = aberto * leitura + vizinhosInteiros(e, p) * 0.8 - Math.hypot(p.x, p.z) * 0.15 - Math.abs(distAqui - 1.8) * 1.1
        + (e.sortear() - 0.5) * 8 * ERRO[dif];
      if (n > nota) { nota = n; melhor = p; }
    }
    j.alvo = melhor ? { x: melhor.x, z: melhor.z, piso: e.indice.get(chave(melhor.q, melhor.r, melhor.camada)) as number } : { x: 0, z: 0, piso: 0 };
  }
  const alvo = j.alvo as { x: number; z: number };
  let direcao = direcaoPara(alvo.x - j.x, alvo.z - j.z);
  // No pulo do gato: se o piso logo à frente caiu, pula; se o piso embaixo racha, sai andando.
  let b = false;
  if (direcao && j.noChao) {
    const [fx, fz] = VETOR[direcao];
    const frente = pisoEm(e, j.x + fx * 1.1, j.z + fz * 1.1, camada);
    if (!frente && e.sortear() > ERRO[dif]) b = true;
  }
  const embaixo = pisoEm(e, j.x, j.z, camada);
  if (embaixo && embaixo.pisadoEm !== null && !direcao) direcao = (["cima", "baixo", "esquerda", "direita"] as Direcao[])[Math.floor(e.sortear() * 4)];
  // Dash: no Médio/Difícil, em quem está perto, na frente e na mesma altura.
  let a = false;
  if (dif !== "facil" && e.passo >= j.dashPronto) {
    for (const o of e.jogadores) {
      if (o === j || !o.vivo || Math.abs(o.y - j.y) > 0.8) continue;
      const dx = o.x - j.x, dz = o.z - j.z;
      if (Math.hypot(dx, dz) > (dif === "dificil" ? 2.6 : 1.8)) continue;
      const d = direcaoPara(dx, dz);
      if (d && e.sortear() > ERRO[dif] * 2) { direcao = d; j.direcao = d; a = true; break; }
    }
  }
  return { direcao, a, b };
}

export const segundosRestantesHex = (e: EstadoHex) => Math.max(0, Math.ceil((e.duracao - e.passo) / PASSOS_POR_SEGUNDO));
