/**
 * Fuga da Masmorra: regras puras do roguelite de salas em equipe (60 passos por segundo), de 1 a 8 jogadores.
 *
 * - A masmorra é sorteada: salas ligadas por portas num mapa 5 × 4, do início até a sala do chefe. Ao entrar numa sala
 *   com monstros, as portas trancam até todos caírem.
 * - A sala do chefe só abre com a chave, que fica numa sala fora do caminho principal. Há baús com melhorias, moedas,
 *   corações e espinhos que sobem e descem.
 * - Ataque de espada (A) em arco na frente e esquiva rápida (B) que deixa invulnerável por um instante.
 * - Corações: 3 no começo (cada um vale 2 de vida). Quem zera vira fantasma e volta com 1 coração quando a sala for
 *   limpa; todos fantasmas = fim da fuga. Derrotar o chefe = fuga completa.
 * - Desafio Diário: a mesma masmorra para todo mundo no dia (semente da data).
 */
import { rng, type Dificuldade, type Direcao, type Entrada } from "./bombas.ts";

export const SW = 15;
export const SH = 9;
const GW = 5;
const GH = 4;
const RAIO = 0.32;
const VAO = 1.1;

export type ModoMasmorra = "fuga" | "diario";
export type TipoSala = "inicio" | "normal" | "tesouro" | "chave" | "chefe";
export type TipoInimigo = "slime" | "morcego" | "esqueleto" | "chefe";
export type Lado = "n" | "s" | "l" | "o";
export type Item = "coracao" | "vidaMax" | "dano" | "velocidade";

export interface Sala {
  gx: number; gy: number; tipo: TipoSala;
  portas: Record<Lado, boolean>;
  visitada: boolean; limpa: boolean;
  bau: { x: number; y: number; aberto: boolean; item: Item } | null;
  espinhos: { x: number; y: number }[];
}
export interface JogadorM {
  id: number; bot: Dificuldade | null;
  x: number; y: number; olhar: { x: number; y: number };
  hp: number; hpMax: number; fantasma: boolean;
  dano: number; vel: number;
  ataque: number; esquiva: number; esquivaAte: number; invulAte: number;
  moedas: number; pontos: number; abates: number;
  aAnterior: boolean; bAnterior: boolean;
}
export interface Inimigo { id: number; tipo: TipoInimigo; x: number; y: number; hp: number; hpMax: number; vx: number; vy: number; tiroEm: number; atordoadoAte: number; fase: number }
export interface Projetil { x: number; y: number; vx: number; vy: number; vida: number }
export interface Coleta { id: number; tipo: "moeda" | "coracao" | "chave" | Item; x: number; y: number }

export type EventoMasmorra =
  | { tipo: "golpe"; jogador: number }
  | { tipo: "esquiva"; jogador: number }
  | { tipo: "acerto"; x: number; y: number }
  | { tipo: "abate"; x: number; y: number; inimigo: TipoInimigo; jogador: number }
  | { tipo: "ferido"; jogador: number }
  | { tipo: "fantasma"; jogador: number }
  | { tipo: "voltou"; jogador: number }
  | { tipo: "sala"; sala: number; tipoSala: TipoSala }
  | { tipo: "trancou" }
  | { tipo: "limpou" }
  | { tipo: "bau"; item: Item }
  | { tipo: "pegou"; jogador: number; coisa: Coleta["tipo"] }
  | { tipo: "trancada" }
  | { tipo: "chefe" }
  | { tipo: "fim"; venceu: boolean };

export interface EstadoMasmorra {
  modo: ModoMasmorra;
  semente: number;
  salas: Sala[];
  atual: number;
  temChave: boolean;
  jogadores: JogadorM[];
  inimigos: Inimigo[];
  projeteis: Projetil[];
  coletas: Coleta[];
  passo: number;
  proximoId: number;
  sorteio: () => number;
  eventos: EventoMasmorra[];
  terminado: boolean;
  venceram: boolean;
  vencedor: number | null;
}

const VIZ: Record<Lado, [number, number]> = { n: [0, -1], s: [0, 1], l: [-1, 0], o: [1, 0] };
const OPOSTO: Record<Lado, Lado> = { n: "s", s: "n", l: "o", o: "l" };
export const PORTA: Record<Lado, { x: number; y: number }> = { n: { x: SW / 2, y: 0 }, s: { x: SW / 2, y: SH }, l: { x: 0, y: SH / 2 }, o: { x: SW, y: SH / 2 } };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const ITENS: Item[] = ["coracao", "vidaMax", "dano", "velocidade"];

/** Semente do Desafio Diário: a data de hoje (AAAAMMDD). */
export const sementeDoDia = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/** Sorteia a masmorra: caminho principal até o chefe e salas de lado (tesouro e chave). */
export function gerarMasmorra(sorteio: () => number): Sala[] {
  for (;;) {
    const ocupado = new Map<string, number>();
    const salas: Sala[] = [];
    const nova = (gx: number, gy: number, tipo: TipoSala) => {
      const s: Sala = { gx, gy, tipo, portas: { n: false, s: false, l: false, o: false }, visitada: false, limpa: tipo === "inicio", bau: null, espinhos: [] };
      ocupado.set(`${gx},${gy}`, salas.length);
      salas.push(s);
      return s;
    };
    const ligar = (a: Sala, b: Sala) => {
      for (const l of Object.keys(VIZ) as Lado[]) if (a.gx + VIZ[l][0] === b.gx && a.gy + VIZ[l][1] === b.gy) { a.portas[l] = true; b.portas[OPOSTO[l]] = true; }
    };
    let cur = nova(Math.floor(GW / 2), GH - 1, "inicio");
    const caminho = [cur];
    const alvo = 5 + Math.floor(sorteio() * 3);
    for (let tent = 0; caminho.length < alvo && tent < 80; tent++) {
      const lados = (Object.keys(VIZ) as Lado[]).filter(l => {
        const nx = cur.gx + VIZ[l][0], ny = cur.gy + VIZ[l][1];
        return nx >= 0 && ny >= 0 && nx < GW && ny < GH && !ocupado.has(`${nx},${ny}`);
      });
      if (!lados.length) break;
      const l = lados[Math.floor(sorteio() * lados.length)];
      const s = nova(cur.gx + VIZ[l][0], cur.gy + VIZ[l][1], "normal");
      ligar(cur, s);
      caminho.push(s);
      cur = s;
    }
    if (caminho.length < 5) continue;
    caminho[caminho.length - 1].tipo = "chefe";
    // Salas de lado, penduradas no caminho (nunca na do chefe).
    const extras: TipoSala[] = ["chave", "tesouro", "normal"];
    let ok = true;
    for (const tipo of extras) {
      const bases = caminho.slice(0, -1).flatMap(b => (Object.keys(VIZ) as Lado[]).map(l => ({ b, nx: b.gx + VIZ[l][0], ny: b.gy + VIZ[l][1] })))
        .filter(({ nx, ny }) => nx >= 0 && ny >= 0 && nx < GW && ny < GH && !ocupado.has(`${nx},${ny}`));
      if (!bases.length) { if (tipo === "chave") ok = false; break; }
      const { b, nx, ny } = bases[Math.floor(sorteio() * bases.length)];
      ligar(b, nova(nx, ny, tipo));
    }
    if (!ok) continue;
    for (const s of salas) {
      if (s.tipo === "tesouro" || (s.tipo === "normal" && sorteio() < 0.3)) s.bau = { x: SW / 2, y: SH / 2, aberto: false, item: ITENS[Math.floor(sorteio() * ITENS.length)] };
      if (s.tipo === "normal" && sorteio() < 0.5) {
        const n = 2 + Math.floor(sorteio() * 4);
        for (let k = 0; k < n; k++) s.espinhos.push({ x: 2 + Math.floor(sorteio() * (SW - 4)), y: 2 + Math.floor(sorteio() * (SH - 4)) });
      }
    }
    return salas;
  }
}

export function novaPartidaMasmorra(o: { modo: ModoMasmorra; semente: number; jogadores: { bot: Dificuldade | null }[] }): EstadoMasmorra {
  const semente = o.modo === "diario" ? sementeDoDia() : o.semente;
  const sorteio = rng(semente);
  const salas = gerarMasmorra(sorteio);
  const jogadores: JogadorM[] = o.jogadores.map((j, i) => ({
    id: i, bot: j.bot, x: SW / 2 + ((i % 4) - 1.5) * 0.9, y: SH / 2 + (i < 4 ? -0.5 : 0.5), olhar: { x: 0, y: -1 },
    hp: 6, hpMax: 6, fantasma: false, dano: 1, vel: 0.085, ataque: 0, esquiva: 0, esquivaAte: 0, invulAte: 0,
    moedas: 0, pontos: 0, abates: 0, aAnterior: false, bAnterior: false,
  }));
  const e: EstadoMasmorra = {
    modo: o.modo, semente, salas, atual: 0, temChave: false, jogadores, inimigos: [], projeteis: [], coletas: [], passo: 0, proximoId: 1,
    sorteio, eventos: [], terminado: false, venceram: false, vencedor: null,
  };
  salas[0].visitada = true;
  return e;
}

const vizinha = (e: EstadoMasmorra, s: Sala, l: Lado) => e.salas.findIndex(x => x.gx === s.gx + VIZ[l][0] && x.gy === s.gy + VIZ[l][1]);

function povoar(e: EstadoMasmorra, s: Sala) {
  const n = e.jogadores.length;
  const nivel = Math.min(4, Math.abs(s.gx - 2) + (GH - 1 - s.gy));
  if (s.tipo === "chefe") {
    const hp = Math.round(40 * (0.6 + 0.4 * n));
    e.inimigos.push({ id: e.proximoId++, tipo: "chefe", x: SW / 2, y: 2.5, hp, hpMax: hp, vx: 0, vy: 0, tiroEm: e.passo + 120, atordoadoAte: 0, fase: 0 });
    e.eventos.push({ tipo: "chefe" });
    return;
  }
  if (s.tipo === "inicio" || s.tipo === "tesouro") return;
  const qtd = Math.round((3 + nivel + e.sorteio() * 2) * (0.7 + 0.3 * n));
  for (let k = 0; k < qtd; k++) {
    const r = e.sorteio();
    const tipo: TipoInimigo = r < 0.45 ? "slime" : r < 0.75 ? "morcego" : "esqueleto";
    const hp = tipo === "slime" ? 2 + Math.floor(nivel / 2) : tipo === "morcego" ? 1 : 3 + Math.floor(nivel / 2);
    e.inimigos.push({ id: e.proximoId++, tipo, x: 2 + e.sorteio() * (SW - 4), y: 1.5 + e.sorteio() * (SH - 3), hp, hpMax: hp, vx: 0, vy: 0, tiroEm: e.passo + 60 + Math.floor(e.sorteio() * 90), atordoadoAte: e.passo + 45, fase: 0 });
  }
}

function entrar(e: EstadoMasmorra, k: number, pelo: Lado) {
  const s = e.salas[k];
  e.atual = k;
  e.projeteis = [];
  e.coletas = [];
  // Quem entra pela porta de baixo aparece em cima da porta de baixo da nova sala, e assim por diante.
  const pos = { x: pelo === "l" ? SW - 1.2 : pelo === "o" ? 1.2 : SW / 2, y: pelo === "n" ? SH - 1.2 : pelo === "s" ? 1.2 : SH / 2 };
  e.jogadores.forEach((j, i) => { j.x = pos.x + (pelo === "n" || pelo === "s" ? ((i % 4) - 1.5) * 0.7 : 0); j.y = pos.y + (pelo === "l" || pelo === "o" ? ((i % 4) - 1.5) * 0.7 : 0); });
  e.eventos.push({ tipo: "sala", sala: k, tipoSala: s.tipo });
  if (!s.visitada) {
    s.visitada = true;
    if (!s.limpa) {
      povoar(e, s);
      if (e.inimigos.length) e.eventos.push({ tipo: "trancou" });
      else s.limpa = true;
    }
  }
}

function ferir(e: EstadoMasmorra, j: JogadorM, dano: number) {
  if (j.fantasma || e.passo < j.invulAte || e.passo < j.esquivaAte) return;
  j.hp -= dano;
  j.invulAte = e.passo + 60;
  e.eventos.push({ tipo: "ferido", jogador: j.id });
  if (j.hp <= 0) { j.hp = 0; j.fantasma = true; e.eventos.push({ tipo: "fantasma", jogador: j.id }); }
}

const PONTOS: Record<TipoInimigo, number> = { slime: 20, morcego: 15, esqueleto: 40, chefe: 1000 };

function golpe(e: EstadoMasmorra, j: JogadorM) {
  j.ataque = 20;
  e.eventos.push({ tipo: "golpe", jogador: j.id });
  for (const m of e.inimigos) {
    const dx = m.x - j.x, dy = m.y - j.y, d = Math.hypot(dx, dy);
    const alcance = m.tipo === "chefe" ? 2.2 : 1.45;
    if (d > alcance || d < 0.001) continue;
    if ((dx * j.olhar.x + dy * j.olhar.y) / d < 0.25) continue;
    m.hp -= j.dano;
    e.eventos.push({ tipo: "acerto", x: m.x, y: m.y });
    if (m.tipo !== "chefe") { m.vx = (dx / d) * 0.2; m.vy = (dy / d) * 0.2; m.atordoadoAte = e.passo + 12; }
    if (m.hp <= 0) {
      j.pontos += PONTOS[m.tipo]; j.abates++;
      e.eventos.push({ tipo: "abate", x: m.x, y: m.y, inimigo: m.tipo, jogador: j.id });
      if (e.sorteio() < 0.35) e.coletas.push({ id: e.proximoId++, tipo: e.sorteio() < 0.25 ? "coracao" : "moeda", x: m.x, y: m.y });
    }
  }
  e.inimigos = e.inimigos.filter(m => m.hp > 0);
}

function mover(ent: { x: number; y: number }, dx: number, dy: number, salaLimpa: boolean, s: Sala, temChave: boolean, ehJogador: boolean) {
  const naPorta = (x: number, y: number) => (Object.keys(PORTA) as Lado[]).some(l => {
    if (!s.portas[l] || !salaLimpa || !ehJogador) return false;
    const p = PORTA[l];
    return l === "n" || l === "s" ? Math.abs(x - p.x) < VAO && Math.abs(y - p.y) < 1 : Math.abs(y - p.y) < VAO && Math.abs(x - p.x) < 1;
  });
  void temChave;
  const lim = (v: number, max: number, outro: number, ehX: boolean) => {
    const nx = ehX ? v : outro, ny = ehX ? outro : v;
    if (naPorta(nx, ny)) return Math.min(max + 0.6, Math.max(-0.6, v));
    return Math.min(max - 0.5 - RAIO, Math.max(0.5 + RAIO, v));
  };
  ent.x = lim(ent.x + dx, SW, ent.y, true);
  ent.y = lim(ent.y + dy, SH, ent.x, false);
}

function passoInimigos(e: EstadoMasmorra) {
  const vivos = e.jogadores.filter(j => !j.fantasma);
  if (!vivos.length) return;
  const s = e.salas[e.atual];
  for (const m of e.inimigos) {
    const alvo = vivos.reduce((a, b) => (dist(m, b) < dist(m, a) ? b : a));
    const d = Math.max(0.01, dist(m, alvo));
    if (e.passo < m.atordoadoAte) { mover(m, m.vx, m.vy, false, s, false, false); m.vx *= 0.8; m.vy *= 0.8; continue; }
    if (m.tipo === "slime") mover(m, ((alvo.x - m.x) / d) * 0.025, ((alvo.y - m.y) / d) * 0.025, false, s, false, false);
    else if (m.tipo === "morcego") {
      const ang = Math.atan2(alvo.y - m.y, alvo.x - m.x) + Math.sin(e.passo / 9 + m.id) * 1.2;
      mover(m, Math.cos(ang) * 0.06, Math.sin(ang) * 0.06, false, s, false, false);
    } else if (m.tipo === "esqueleto") {
      const fuga = d < 3.5 ? -1 : d > 5.5 ? 1 : 0;
      mover(m, ((alvo.x - m.x) / d) * 0.03 * fuga, ((alvo.y - m.y) / d) * 0.03 * fuga, false, s, false, false);
      if (e.passo >= m.tiroEm) { m.tiroEm = e.passo + 120; e.projeteis.push({ x: m.x, y: m.y, vx: ((alvo.x - m.x) / d) * 0.11, vy: ((alvo.y - m.y) / d) * 0.11, vida: 160 }); }
    } else {
      // Chefe: anda atrás, investe e solta anéis de ossos; na metade da vida chama morcegos.
      if (m.fase === 0 && m.hp < m.hpMax / 2) { m.fase = 1; for (let k = 0; k < 4; k++) e.inimigos.push({ id: e.proximoId++, tipo: "morcego", x: m.x, y: m.y, hp: 1, hpMax: 1, vx: 0, vy: 0, tiroEm: 0, atordoadoAte: e.passo + 30, fase: 0 }); }
      if (e.passo % 240 < 40) mover(m, ((alvo.x - m.x) / d) * 0.12, ((alvo.y - m.y) / d) * 0.12, false, s, false, false);
      else mover(m, ((alvo.x - m.x) / d) * 0.02, ((alvo.y - m.y) / d) * 0.02, false, s, false, false);
      if (e.passo >= m.tiroEm) {
        m.tiroEm = e.passo + (m.fase ? 120 : 170);
        const n = m.fase ? 12 : 8;
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + e.passo; e.projeteis.push({ x: m.x, y: m.y, vx: Math.cos(a) * 0.09, vy: Math.sin(a) * 0.09, vida: 200 }); }
      }
    }
    const raio = m.tipo === "chefe" ? 1.1 : 0.55;
    for (const j of vivos) if (dist(m, j) < raio) ferir(e, j, m.tipo === "chefe" ? 2 : 1);
  }
  for (const p of e.projeteis) {
    p.x += p.vx; p.y += p.vy; p.vida--;
    if (p.x < 0.5 || p.y < 0.5 || p.x > SW - 0.5 || p.y > SH - 0.5) p.vida = 0;
    for (const j of vivos) if (p.vida > 0 && dist(p, j) < 0.4) { ferir(e, j, 1); p.vida = 0; }
  }
  e.projeteis = e.projeteis.filter(p => p.vida > 0);
  // Espinhos: sobem 1 s, descem 1,5 s.
  if (e.passo % 150 < 60) for (const sp of s.espinhos) for (const j of vivos) if (Math.abs(j.x - sp.x - 0.5) < 0.5 && Math.abs(j.y - sp.y - 0.5) < 0.5) ferir(e, j, 1);
}

export const espinhosAltos = (e: EstadoMasmorra) => e.passo % 150 < 60;

// ---------------------------------------------------------------- bots

export function decisaoDoBotM(e: EstadoMasmorra, j: JogadorM): { dir: { x: number; y: number }; a: boolean; b: boolean } {
  const nivel = j.bot ?? "medio";
  const s = e.salas[e.atual];
  const ir = (p: { x: number; y: number }) => { const d = Math.max(0.01, dist(j, p)); return d < 0.25 ? { x: 0, y: 0 } : { x: (p.x - j.x) / d, y: (p.y - j.y) / d }; };
  if (e.inimigos.length) {
    const m = e.inimigos.reduce((a, b) => (dist(j, b) < dist(j, a) ? b : a));
    const d = dist(j, m);
    const perigo = e.projeteis.some(p => dist(p, j) < 1.4);
    const esquiva = nivel !== "facil" && (perigo || (j.hp <= 2 && d < 1.5)) && j.esquiva === 0;
    const quer = m.tipo === "esqueleto" || m.tipo === "chefe" ? 1.2 : 1;
    const dir = d > quer ? ir(m) : j.hp <= 2 ? { x: (j.x - m.x) / d, y: (j.y - m.y) / d } : { x: 0, y: 0 };
    const chance = nivel === "facil" ? 0.04 : nivel === "medio" ? 0.12 : 0.3;
    return { dir: esquiva ? { x: (j.x - m.x) / Math.max(0.01, d), y: (j.y - m.y) / Math.max(0.01, d) } : dir, a: d < 1.5 && e.sorteio() < chance, b: esquiva };
  }
  // Sem monstros: pega o que está no chão, abre o baú, e segue para a sala certa (a chave antes do chefe).
  const c = e.coletas[0];
  if (c) return { dir: ir(c), a: false, b: false };
  if (s.bau && !s.bau.aberto) return { dir: ir(s.bau), a: false, b: false };
  const alvoSala = rumoDosBots(e);
  if (alvoSala) {
    // Mira além da porta, para atravessar de verdade.
    const p = PORTA[alvoSala];
    const [dx, dy] = VIZ[alvoSala];
    return { dir: ir({ x: p.x + dx * 1.5, y: p.y + dy * 1.5 }), a: false, b: false };
  }
  return { dir: { x: 0, y: 0 }, a: false, b: false };
}

/** Porta que os bots tomam: sem chave, rumo à sala da chave; com chave, rumo ao chefe (pelo caminho mais curto). */
function rumoDosBots(e: EstadoMasmorra): Lado | null {
  const s = e.salas[e.atual];
  const destino = e.temChave ? e.salas.findIndex(x => x.tipo === "chefe") : e.salas.findIndex(x => x.tipo === "chave");
  if (destino === e.atual) return null;
  // Busca em largura a partir do destino.
  const d = e.salas.map(() => Infinity);
  d[destino] = 0;
  const fila = [destino];
  while (fila.length) {
    const i = fila.shift()!;
    for (const l of Object.keys(VIZ) as Lado[]) {
      if (!e.salas[i].portas[l]) continue;
      const k = vizinha(e, e.salas[i], l);
      if (k >= 0 && d[k] === Infinity) { d[k] = d[i] + 1; fila.push(k); }
    }
  }
  let melhor: Lado | null = null;
  for (const l of Object.keys(VIZ) as Lado[]) {
    if (!s.portas[l]) continue;
    const k = vizinha(e, s, l);
    if (k >= 0 && (melhor === null || d[k] < d[vizinha(e, s, melhor)])) melhor = l;
  }
  return melhor;
}

// ---------------------------------------------------------------- passo

const VETOR: Record<Direcao, { x: number; y: number }> = { cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 }, esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 } };

export function passoMasmorra(e: EstadoMasmorra, entradas: Entrada[]) {
  e.eventos = [];
  if (e.terminado) return;
  e.passo++;
  const s = e.salas[e.atual];
  const limpa = e.inimigos.length === 0;
  for (const j of e.jogadores) {
    j.ataque = Math.max(0, j.ataque - 1);
    j.esquiva = Math.max(0, j.esquiva - 1);
    let dir = { x: 0, y: 0 }, a = false, b = false;
    if (j.bot) ({ dir, a, b } = decisaoDoBotM(e, j));
    else {
      const ent = entradas[j.id] ?? { direcao: null, a: false, b: false };
      if (ent.direcao) dir = VETOR[ent.direcao];
      a = ent.a; b = ent.b;
    }
    const aBorda = a && !j.aAnterior, bBorda = b && !j.bAnterior;
    j.aAnterior = a; j.bAnterior = b;
    if (dir.x || dir.y) j.olhar = dir;
    const rapido = e.passo < j.esquivaAte ? 3 : 1;
    mover(j, dir.x * j.vel * rapido * (j.fantasma ? 0.8 : 1), dir.y * j.vel * rapido * (j.fantasma ? 0.8 : 1), limpa, s, e.temChave, true);
    if (j.fantasma) continue;
    if (aBorda && j.ataque === 0) golpe(e, j);
    if (bBorda && j.esquiva === 0) { j.esquiva = 50; j.esquivaAte = e.passo + 14; e.eventos.push({ tipo: "esquiva", jogador: j.id }); }
    // Coletas e baú.
    for (const c of e.coletas) {
      if (dist(c, j) > 0.6) continue;
      if (c.tipo === "moeda") { j.moedas++; j.pontos += 10; }
      else if (c.tipo === "coracao") j.hp = Math.min(j.hpMax, j.hp + 2);
      else if (c.tipo === "chave") e.temChave = true;
      else aplicarItem(j, c.tipo);
      e.eventos.push({ tipo: "pegou", jogador: j.id, coisa: c.tipo });
      c.x = -99;
    }
    e.coletas = e.coletas.filter(c => c.x > -50);
    if (s.bau && !s.bau.aberto && limpa && dist(s.bau, j) < 0.9) {
      s.bau.aberto = true;
      e.coletas.push({ id: e.proximoId++, tipo: s.bau.item, x: s.bau.x, y: s.bau.y + 0.8 });
      e.eventos.push({ tipo: "bau", item: s.bau.item });
    }
  }
  passoInimigos(e);
  // Sala limpa: portas abrem, fantasmas voltam, a chave aparece na sala dela.
  if (!s.limpa && e.inimigos.length === 0) {
    s.limpa = true;
    for (const j of e.jogadores) { j.pontos += 50; if (j.fantasma) { j.fantasma = false; j.hp = 2; e.eventos.push({ tipo: "voltou", jogador: j.id }); } }
    e.eventos.push({ tipo: "limpou" });
    if (s.tipo === "chave") e.coletas.push({ id: e.proximoId++, tipo: "chave", x: SW / 2, y: SH / 2 });
    if (s.tipo === "chefe") return terminar(e, true);
  }
  if (s.tipo === "chave" && s.limpa && !e.temChave && !e.coletas.some(c => c.tipo === "chave") && s.visitada && e.passo % 60 === 0) {
    e.coletas.push({ id: e.proximoId++, tipo: "chave", x: SW / 2, y: SH / 2 });
  }
  if (e.jogadores.every(j => j.fantasma)) return terminar(e, false);
  // Passou por uma porta aberta: todos vão para a sala vizinha (a do chefe só com a chave).
  if (e.inimigos.length === 0) {
    for (const j of e.jogadores) {
      if (j.fantasma) continue;
      const l: Lado | null = j.y < 0 ? "n" : j.y > SH ? "s" : j.x < 0 ? "l" : j.x > SW ? "o" : null;
      if (!l) continue;
      const k = vizinha(e, s, l);
      if (k < 0) continue;
      if (e.salas[k].tipo === "chefe" && !e.temChave) {
        j.x = Math.min(SW - 0.9, Math.max(0.9, j.x)); j.y = Math.min(SH - 0.9, Math.max(0.9, j.y));
        if (e.passo % 30 === 0) e.eventos.push({ tipo: "trancada" });
        continue;
      }
      entrar(e, k, l);
      break;
    }
  }
}

function aplicarItem(j: JogadorM, item: Item) {
  if (item === "coracao") j.hp = Math.min(j.hpMax, j.hp + 2);
  else if (item === "vidaMax") { j.hpMax = Math.min(12, j.hpMax + 2); j.hp = Math.min(j.hpMax, j.hp + 2); }
  else if (item === "dano") j.dano += 0.5;
  else j.vel = Math.min(0.13, j.vel + 0.012);
}

function terminar(e: EstadoMasmorra, venceram: boolean) {
  e.terminado = true;
  e.venceram = venceram;
  e.vencedor = venceram ? e.jogadores.reduce((a, b) => (b.pontos > a.pontos ? b : a)).id : null;
  e.eventos.push({ tipo: "fim", venceu: venceram });
}

/** Pontos para o recorde: os do jogo, +500 pela fuga completa e um bônus por terminar rápido. */
export const pontosMasmorra = (e: EstadoMasmorra, j: JogadorM) =>
  j.pontos + (e.venceram ? 500 + Math.max(0, 600 - Math.floor(e.passo / 60)) : 0);
