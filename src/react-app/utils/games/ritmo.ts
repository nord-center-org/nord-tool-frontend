/**
 * Batalha de Banda: regras puras do jogo de ritmo (60 passos por segundo), de 1 a 8 jogadores, cada um na própria
 * pista de 4 trilhas (← ↓ ↑ →). A música é gerada pela semente e pelo andamento; todos tocam a mesma partitura.
 *
 * - A nota cai até a linha; apertar a direção da trilha na hora acerta (perfeito ±50 ms, ótimo ±100 ms, bom ±150 ms).
 *   Nota longa: segure a direção até o fim (pontos a cada passo segurado). Apertar sem nota ou errar quebra o combo.
 * - Combo: o multiplicador sobe a cada 10 acertos seguidos (até ×4). Cada 25 de combo enche um quarto da energia;
 *   B com energia pela metade ou mais liga o Show (pontos em dobro enquanto a energia escoa).
 * - Público (vida da pista): sobe nos acertos, cai nas notas perdidas (e um pouco no toque sem nota); zerado, quem toca
 *   é vaiado e sai da música.
 * - Solo: termine a música sem ser vaiado e com 70% de acertos. Duelo: A com o ataque cheio (a cada 20 de combo)
 *   manda um obstáculo para o líder adversário (neblina, notas aceleradas ou trilhas espelhadas, por 6 s); vence quem
 *   tiver mais pontos sem ser vaiado. Banda: o público é um só e todos somam; a banda vence se terminar a música.
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export type ModoRitmo = "solo" | "duelo" | "banda";
export type Andamento = "lento" | "medio" | "rapido";
export type Ataque = "neblina" | "acelera" | "espelho";
export interface Nota { t: number; l: number; d: number }

export const TRILHAS: Direcao[] = ["esquerda", "baixo", "cima", "direita"];
export const BPM: Record<Andamento, number> = { lento: 100, medio: 128, rapido: 156 };
export const DURACAO = 100 * 60;
export const QUEDA = 96;
export const JANELAS = [3, 6, 9];
export const VALOR = [100, 70, 40];
export const ATAQUE_DURA = 360;
const ACERTO_VIDA = 0.02;
const ERRO_VIDA = 0.05;
/** Apertar sem nota quebra o combo e tira pouco público (não pune tanto quem está aprendendo). */
const TOQUE_VAZIO_VIDA = 0.015;

export interface Musico {
  id: number;
  bot: Dificuldade | null;
  /** Resultado de cada nota: 0 pendente, 1 perfeito, 2 ótimo, 3 bom, 4 errou, 5 nota longa em curso. */
  res: number[];
  proxima: number;
  pontos: number; combo: number; maiorCombo: number; acertos: number; erros: number;
  vida: number; fora: boolean;
  energia: number; show: boolean;
  ataque: number;
  efeito: Ataque | null; efeitoAte: number;
  dirAnterior: Direcao | null; bAnterior: boolean; aAnterior: boolean;
  segurando: number | null;
}

export type EventoRitmo =
  | { tipo: "acerto"; jogador: number; l: number; nota: number; grau: number }
  | { tipo: "erro"; jogador: number; l: number | null }
  | { tipo: "show"; jogador: number }
  | { tipo: "ataque"; jogador: number; alvo: number; ataque: Ataque }
  | { tipo: "vaiado"; jogador: number }
  | { tipo: "batida"; tempo: number }
  | { tipo: "fim" };

export interface EstadoRitmo {
  modo: ModoRitmo;
  andamento: Andamento;
  semente: number;
  bpm: number;
  notas: Nota[];
  musicos: Musico[];
  vidaBanda: number;
  passo: number;
  sorteio: () => number;
  eventos: EventoRitmo[];
  terminado: boolean;
  vencedor: number | null;
  /** Passo da última nota + folga: quando a música acaba. */
  fimMusica: number;
}

/** Partitura da música: compassos com ritmos de colcheia que ficam mais densos, melodia andando entre trilhas e notas longas. */
export function gerarPartitura(semente: number, bpm: number): Nota[] {
  const r = rng(semente ^ 0x5eed);
  const batida = 3600 / bpm;
  const compassos = Math.floor((DURACAO / 60) * bpm / 60 / 4);
  // Ritmos de um compasso em colcheias (8 posições).
  const RITMOS = [
    [0, 4], [0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 3, 4, 6], [0, 1, 2, 4, 6, 7], [0, 2, 4, 5, 6], [0, 1, 2, 3, 4, 6], [0, 2, 3, 5, 6, 7],
  ];
  const notas: Nota[] = [];
  let l = Math.floor(r() * 4);
  for (let c = 1; c < compassos - 1; c++) {
    // Intro calma, meio mais denso, fim forte.
    const fase = c / compassos;
    const nivel = Math.min(RITMOS.length - 1, Math.floor((0.2 + fase * 0.8) * RITMOS.length * (0.7 + r() * 0.5)));
    const ritmo = RITMOS[Math.max(0, nivel)];
    const longa = c % 4 === 3 && r() < 0.6;
    for (let k = 0; k < ritmo.length; k++) {
      const pos = ritmo[k];
      if (longa && pos > 4) break;
      const passo = r();
      const nl = passo < 0.45 ? l + (r() < 0.5 ? 1 : -1) : passo < 0.7 ? l + (r() < 0.5 ? 2 : -2) : passo < 0.85 ? l : Math.floor(r() * 4);
      l = (nl % 4 + 4) % 4;
      const t = Math.round(QUEDA + 60 + (c * 8 + pos) * batida / 2);
      // Mesma trilha seguida precisa de meia batida para soltar e apertar de novo.
      const ant = notas[notas.length - 1];
      if (ant && ant.l === l && t - (ant.t + ant.d) < batida / 2) l = (l + 1 + Math.floor(r() * 3)) % 4;
      const d = longa && pos === 4 ? Math.round(batida * 2.5) : 0;
      notas.push({ t, l, d });
    }
  }
  return notas;
}

export function novaPartidaRitmo(o: { modo: ModoRitmo; andamento: Andamento; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoRitmo {
  const modo: ModoRitmo = o.jogadores.length === 1 ? "solo" : o.modo === "solo" ? "duelo" : o.modo;
  const bpm = BPM[o.andamento];
  const notas = gerarPartitura(o.semente, bpm);
  const ultima = notas[notas.length - 1];
  return {
    modo, andamento: o.andamento, semente: o.semente, bpm, notas, vidaBanda: 0.6,
    musicos: o.jogadores.map((j, id) => ({
      id, bot: j.bot, res: notas.map(() => 0), proxima: 0, pontos: 0, combo: 0, maiorCombo: 0, acertos: 0, erros: 0, vida: 0.6, fora: false,
      energia: 0, show: false, ataque: 0, efeito: null, efeitoAte: 0, dirAnterior: null, bAnterior: false, aAnterior: false, segurando: null,
    })),
    passo: 0, sorteio: rng(o.semente), eventos: [], terminado: false, vencedor: null, fimMusica: ultima.t + ultima.d + 90,
  };
}

export const multiplicador = (m: Musico) => Math.min(4, 1 + Math.floor(m.combo / 10)) * (m.show ? 2 : 1);
const trilhaDe = (m: Musico, d: Direcao) => {
  const l = TRILHAS.indexOf(d);
  return m.efeito === "espelho" ? 3 - l : l;
};

function mudarVida(e: EstadoRitmo, m: Musico, dv: number) {
  if (e.modo === "banda") {
    e.vidaBanda = Math.max(0, Math.min(1, e.vidaBanda + dv / Math.max(1, e.musicos.length * 0.6)));
    return;
  }
  m.vida = Math.max(0, Math.min(1, m.vida + dv));
  if (m.vida <= 0 && !m.fora) { m.fora = true; m.show = false; e.eventos.push({ tipo: "vaiado", jogador: m.id }); }
}

function errar(e: EstadoRitmo, m: Musico, l: number | null, vazio = false) {
  m.combo = 0; m.erros++;
  mudarVida(e, m, vazio ? -TOQUE_VAZIO_VIDA : -ERRO_VIDA);
  e.eventos.push({ tipo: "erro", jogador: m.id, l });
}

function acertar(e: EstadoRitmo, m: Musico, i: number, grau: number) {
  const n = e.notas[i];
  m.res[i] = n.d ? 5 : grau + 1;
  if (n.d) m.segurando = i;
  m.combo++; m.acertos++;
  m.maiorCombo = Math.max(m.maiorCombo, m.combo);
  m.pontos += VALOR[grau] * multiplicador(m);
  if (m.combo % 25 === 0) m.energia = Math.min(1, m.energia + 0.25);
  if (e.modo === "duelo" && m.ataque < 1) m.ataque = Math.min(1, m.ataque + 1 / 20);
  mudarVida(e, m, ACERTO_VIDA);
  e.eventos.push({ tipo: "acerto", jogador: m.id, l: n.l, nota: i, grau });
}

// ---------------------------------------------------------------- bots

const PRECISAO: Record<Dificuldade, { acerta: number; espalha: number }> = {
  facil: { acerta: 0.8, espalha: 7 }, medio: { acerta: 0.92, espalha: 4 }, dificil: { acerta: 0.985, espalha: 2 },
};

/** O bot decide antes, nota a nota, quando vai apertar (ou se vai errar), com a semente da partida. */
export function decisaoDoBot(e: EstadoRitmo, m: Musico): Entrada {
  const p = PRECISAO[m.bot ?? "medio"];
  const b = m.energia >= 0.5 && !m.show;
  const a = m.ataque >= 1 && !m.aAnterior;
  // Segurando nota longa.
  if (m.segurando !== null) {
    const n = e.notas[m.segurando];
    if (e.passo < n.t + n.d - 1) return { direcao: dirPara(m, n.l), a, b };
  }
  for (let i = m.proxima; i < e.notas.length && e.notas[i].t <= e.passo + 12; i++) {
    if (m.res[i] !== 0) continue;
    const n = e.notas[i];
    // Desvio e erro sorteados pela nota (o mesmo bot sempre "planeja" igual aquela nota).
    const h = rng(e.semente * 31 + i * 7 + m.id * 1013);
    const errou = h() > p.acerta;
    const desvio = Math.round((h() - 0.5) * 2 * p.espalha);
    if (errou) continue;
    if (e.passo === n.t + desvio - 1) return { direcao: null, a, b };
    if (e.passo >= n.t + desvio) return { direcao: dirPara(m, n.l), a, b };
  }
  return { direcao: null, a, b };
}
const dirPara = (m: Musico, l: number) => TRILHAS[m.efeito === "espelho" ? 3 - l : l];

// ---------------------------------------------------------------- passo

export function passoRitmo(e: EstadoRitmo, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  const batida = 3600 / e.bpm;
  const t0 = QUEDA + 60;
  if (e.passo >= t0 && Math.floor((e.passo - t0) / batida) !== Math.floor((e.passo - 1 - t0) / batida)) e.eventos.push({ tipo: "batida", tempo: Math.floor((e.passo - t0) / batida) });
  for (const m of e.musicos) {
    if (m.fora) continue;
    const ent = m.bot ? decisaoDoBot(e, m) : entradas[m.id] ?? { direcao: null, a: false, b: false };
    if (m.efeito && e.passo >= m.efeitoAte) m.efeito = null;
    // Nota longa: soltou antes do fim, perde o resto (mas não quebra o combo).
    if (m.segurando !== null) {
      const i = m.segurando, n = e.notas[i];
      const segura = ent.direcao !== null && trilhaDe(m, ent.direcao) === n.l;
      if (segura && e.passo < n.t + n.d) m.pontos += 2 * multiplicador(m);
      if (!segura || e.passo >= n.t + n.d) { m.res[i] = 1; m.segurando = null; }
    }
    // Toque novo (a direção mudou).
    if (ent.direcao && ent.direcao !== m.dirAnterior) {
      const l = trilhaDe(m, ent.direcao);
      let melhor = -1, dist = Infinity;
      for (let i = m.proxima; i < e.notas.length && e.notas[i].t <= e.passo + JANELAS[2]; i++) {
        if (m.res[i] !== 0 || e.notas[i].l !== l) continue;
        const d = Math.abs(e.notas[i].t - e.passo);
        if (d <= JANELAS[2] && d < dist) { melhor = i; dist = d; }
      }
      if (melhor >= 0) acertar(e, m, melhor, JANELAS.findIndex(j => dist <= j));
      else errar(e, m, l, true);
    }
    m.dirAnterior = ent.direcao;
    // Notas que passaram da janela.
    while (m.proxima < e.notas.length && (m.res[m.proxima] !== 0 || e.notas[m.proxima].t < e.passo - JANELAS[2])) {
      if (m.res[m.proxima] === 0) { m.res[m.proxima] = 4; errar(e, m, e.notas[m.proxima].l); }
      m.proxima++;
    }
    // Show (B) e ataque (A, no Duelo).
    if (ent.b && !m.bAnterior && m.energia >= 0.5 && !m.show) { m.show = true; e.eventos.push({ tipo: "show", jogador: m.id }); }
    m.bAnterior = ent.b;
    if (m.show) { m.energia -= 1 / 600; if (m.energia <= 0) { m.energia = 0; m.show = false; } }
    if (ent.a && !m.aAnterior && e.modo === "duelo" && m.ataque >= 1) {
      const alvo = e.musicos.filter(o => o !== m && !o.fora).sort((x, y) => y.pontos - x.pontos)[0];
      if (alvo) {
        const ataque = (["neblina", "acelera", "espelho"] as Ataque[])[Math.floor(e.sorteio() * 3)];
        alvo.efeito = ataque; alvo.efeitoAte = e.passo + ATAQUE_DURA;
        m.ataque = 0;
        e.eventos.push({ tipo: "ataque", jogador: m.id, alvo: alvo.id, ataque });
      }
    }
    m.aAnterior = ent.a;
  }
  if (e.modo === "banda" && e.vidaBanda <= 0) return terminar(e, false);
  if (e.modo !== "banda" && e.musicos.every(m => m.fora)) return terminar(e, false);
  if (e.modo === "duelo" && e.musicos.filter(m => !m.fora).length === 1 && e.musicos.length > 1) return terminar(e, true);
  if (e.passo >= e.fimMusica) terminar(e, true);
}

export const acerto = (m: Musico) => (m.acertos + m.erros ? m.acertos / (m.acertos + m.erros) : 0);

function terminar(e: EstadoRitmo, completou: boolean) {
  e.terminado = true;
  const vivos = e.musicos.filter(m => !m.fora).sort((a, b) => b.pontos - a.pontos);
  if (e.modo === "solo") {
    const m = e.musicos[0];
    e.vencedor = completou && !m.fora && acerto(m) >= 0.7 ? 0 : null;
  } else if (e.modo === "banda") {
    e.vencedor = completou ? e.musicos.slice().sort((a, b) => b.pontos - a.pontos)[0].id : null;
  } else {
    e.vencedor = vivos.length && (vivos.length < 2 || vivos[0].pontos !== vivos[1].pontos) ? vivos[0].id : null;
  }
  e.eventos.push({ tipo: "fim" });
}

export const pontosRitmo = (e: EstadoRitmo) => e.musicos.map(m => m.pontos);
