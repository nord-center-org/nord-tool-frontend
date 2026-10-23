/** Física do Davi Job (pura, testável): corpos que andam e pulam em puleiros, bolinhas e cordinhas. */

export interface Plataforma { id: string; x: number; y: number; w: number; tipo: "chao" | "prateleira" | "ponte" | "degrau" | "caixa" }

export interface Corpo {
  x: number; // centro
  y: number; // base (pés)
  vx: number;
  vy: number;
  w: number;
  noChao: boolean;
  plataforma: string | null;
  /** Até quando atravessa os puleiros (descer com S). */
  atravessarAte: number;
  virado: -1 | 1;
}

export interface Entrada { dir: number; pular: boolean; descer: boolean }

export interface Parametros { velocidade: number; pulo: number; gravidade: number; largura: number; altura: number }

export const PARAMETROS_GATO: Parametros = { velocidade: 92, pulo: 285, gravidade: 820, largura: 480, altura: 270 };

/** Degrau máximo que o corpo sobe andando (escadinhas e pontes). */
const DEGRAU = 9;

export const novoCorpo = (x: number, y: number, w = 14): Corpo =>
  ({ x, y, vx: 0, vy: 0, w, noChao: false, plataforma: null, atravessarAte: 0, virado: 1 });

const sobre = (c: { x: number }, p: Plataforma, folga = 3) => c.x >= p.x - folga && c.x <= p.x + p.w + folga;

/** Avança o corpo `dt` segundos. Puleiros são de mão única: só seguram quem cai por cima. */
export function passoCorpo(c: Corpo, plats: Plataforma[], dt: number, e: Entrada, agora: number, p: Parametros = PARAMETROS_GATO): Corpo {
  const n = { ...c };
  const alvoVx = Math.max(-1, Math.min(1, e.dir)) * p.velocidade;
  // Aceleração suave no chão, mais solta no ar.
  const acel = n.noChao ? 14 : 6;
  n.vx += (alvoVx - n.vx) * Math.min(1, acel * dt);
  if (Math.abs(e.dir) > 0.1) n.virado = e.dir > 0 ? 1 : -1;
  const atual = plats.find(pl => pl.id === n.plataforma);
  if (e.descer && n.noChao && atual && atual.tipo !== "chao") {
    n.atravessarAte = agora + 0.28;
    n.noChao = false;
    n.plataforma = null;
    n.y += 1;
  }
  if (e.pular && n.noChao) {
    n.vy = -p.pulo;
    n.noChao = false;
    n.plataforma = null;
  }
  const atravessando = agora < n.atravessarAte;
  let x = n.x + n.vx * dt;
  x = Math.max(n.w / 2, Math.min(p.largura - n.w / 2, x));
  if (x === n.w / 2 || x === p.largura - n.w / 2) n.vx = 0;

  if (n.noChao) {
    // Andando: sobe degraus baixos e cai quando sai da beirada.
    const degrau = plats.find(pl => pl.y < n.y && n.y - pl.y <= DEGRAU && sobre({ x }, pl, 1) && !sobre(n, pl, 1));
    if (degrau) { n.y = degrau.y; n.plataforma = degrau.id; }
    const apoio = plats.find(pl => Math.abs(pl.y - n.y) < 0.5 && sobre({ x }, pl));
    if (apoio) { n.plataforma = apoio.id; n.x = x; return n; }
    n.noChao = false;
    n.plataforma = null;
  }
  n.vy = Math.min(n.vy + p.gravidade * dt, 900);
  const y = n.y + n.vy * dt;
  if (n.vy >= 0) {
    // Pousa no puleiro mais alto que foi cruzado neste passo.
    const cruzados = plats.filter(pl => (pl.tipo === "chao" || !atravessando) && sobre({ x }, pl) && n.y <= pl.y + 0.5 && y >= pl.y);
    const pouso = cruzados.sort((a, b) => a.y - b.y)[0];
    if (pouso) {
      return { ...n, x, y: pouso.y, vy: 0, noChao: true, plataforma: pouso.id };
    }
  }
  return { ...n, x, y };
}

export interface Bola { x: number; y: number; vx: number; vy: number; r: number; segurada: boolean; cor: string; quica: boolean }

/** Bolinha (ou ratinho de brinquedo, que não quica): gravidade, quica nos puleiros e nas paredes, rola com atrito. */
export function passoBola(b: Bola, plats: Plataforma[], dt: number, p: Parametros = PARAMETROS_GATO): Bola {
  if (b.segurada) return b;
  const n = { ...b };
  n.vy = Math.min(n.vy + p.gravidade * dt, 900);
  let x = n.x + n.vx * dt;
  const y = n.y + n.vy * dt;
  if (x < n.r) { x = n.r; n.vx = Math.abs(n.vx) * 0.7; }
  if (x > p.largura - n.r) { x = p.largura - n.r; n.vx = -Math.abs(n.vx) * 0.7; }
  let noChao = false;
  if (n.vy >= 0) {
    const pouso = plats.filter(pl => x >= pl.x && x <= pl.x + pl.w && n.y + n.r <= pl.y + 0.5 && y + n.r >= pl.y).sort((a, b2) => a.y - b2.y)[0];
    if (pouso) {
      n.y = pouso.y - n.r;
      n.vy = n.quica && n.vy > 90 ? -n.vy * 0.55 : 0;
      noChao = n.vy === 0;
      n.x = x;
      if (noChao) n.vx *= Math.max(0, 1 - (n.quica ? 1.2 : 4) * dt);
      if (Math.abs(n.vx) < 2) n.vx = 0;
      return n;
    }
  }
  return { ...n, x, y };
}

export const velocidadeBola = (b: Bola) => Math.hypot(b.vx, b.vy);

export interface Corda { x: number; y: number; comprimento: number; angulo: number; vel: number; cor: string }

/** Pêndulo amortecido. */
export function passoCorda(c: Corda, dt: number, gravidade = PARAMETROS_GATO.gravidade): Corda {
  const acel = -(gravidade / c.comprimento) * Math.sin(c.angulo) - 1.6 * c.vel;
  const vel = c.vel + acel * dt;
  return { ...c, vel, angulo: Math.max(-1.2, Math.min(1.2, c.angulo + vel * dt)) };
}

export const pontaDaCorda = (c: Corda) => ({ x: c.x + Math.sin(c.angulo) * c.comprimento, y: c.y + Math.cos(c.angulo) * c.comprimento });

/** Escadinha de degraus entre (x0, y0) e (x1, y1). */
export function escada(id: string, x0: number, y0: number, x1: number, y1: number, passos: number): Plataforma[] {
  return Array.from({ length: passos }, (_, i) => {
    const t = (i + 0.5) / passos;
    const w = Math.abs(x1 - x0) / passos + 1;
    return { id: `${id}-${i}`, x: Math.min(x0, x1) + (x1 > x0 ? i : passos - 1 - i) * (w - 1), y: Math.round(y0 + (y1 - y0) * t), w, tipo: "degrau" as const };
  });
}

/** Ponte de cordas: tábuas curtas formando uma barriga entre (x0, y) e (x1, y). */
export function ponte(id: string, x0: number, x1: number, y: number, flecha: number, tabuas: number): Plataforma[] {
  const w = (x1 - x0) / tabuas;
  return Array.from({ length: tabuas }, (_, i) => {
    const t = (i + 0.5) / tabuas;
    return { id: `${id}-${i}`, x: x0 + i * w, y: Math.round(y + 4 * flecha * t * (1 - t)), w: w + 0.5, tipo: "ponte" as const };
  });
}

export const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
