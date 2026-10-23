/** Desenho em canvas (pixel art) do Davi Job: cenário, gatos, ratos, bolinhas, cordinhas e efeitos. */
import { pontaDaCorda, type Bola, type Corda, type Plataforma } from "./motor.ts";
import { ALTURA, CHAO_Y, LARGURA, prateleiras, type Mapa } from "./mundo.ts";
import { GATO_H, GATO_W, RATO_H, RATO_W, montarGato, montarRato, pelagemPorId, type Grade, type QuadroGato } from "./sprites.ts";

const MADEIRA = { topo: "#d29a5f", brilho: "#e8b77f", frente: "#ad723e", sombra: "#7c4d26", escuro: "#5b3a20" };
const cacheSprites = new Map<string, HTMLCanvasElement>();

function spriteDe(chave: string, grade: () => Grade, w: number, h: number): HTMLCanvasElement {
  let c = cacheSprites.get(chave);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    grade().forEach((linha, y) => linha.forEach((cor, x) => { if (cor) { ctx.fillStyle = cor; ctx.fillRect(x, y, 1, 1); } }));
    cacheSprites.set(chave, c);
  }
  return c;
}

export function desenharGato(ctx: CanvasRenderingContext2D, pelagem: string, q: QuadroGato, x: number, y: number, virado: -1 | 1) {
  const chave = `g:${pelagem}:${q.pose}:${q.cauda}:${q.fechado ? 1 : 0}:${q.cabecaBaixa ? 1 : 0}`;
  const s = spriteDe(chave, () => montarGato(pelagemPorId(pelagem), q), GATO_W, GATO_H);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y) - GATO_H + 1);
  if (virado < 0) ctx.scale(-1, 1);
  ctx.drawImage(s, -GATO_W / 2, 0);
  ctx.restore();
}

export function desenharRato(ctx: CanvasRenderingContext2D, quadro: 0 | 1, x: number, y: number, virado: -1 | 1, cor = "#7c8594") {
  const s = spriteDe(`r:${quadro}:${cor}`, () => montarRato(quadro, cor), RATO_W, RATO_H);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y) - RATO_H + 1);
  if (virado < 0) ctx.scale(-1, 1);
  ctx.drawImage(s, -RATO_W / 2, 0);
  ctx.restore();
}

function prateleira(ctx: CanvasRenderingContext2D, p: Plataforma) {
  const x = Math.round(p.x), y = Math.round(p.y), w = Math.round(p.w);
  // Suportes (cantoneiras) embaixo.
  ctx.fillStyle = "#a3acb9";
  for (const bx of [x + 6, x + w - 9]) {
    ctx.fillRect(bx, y + 5, 3, 7);
    ctx.fillRect(bx - 2, y + 5, 7, 1);
    ctx.fillStyle = "#7b8594";
    ctx.fillRect(bx + 2, y + 6, 1, 6);
    ctx.fillStyle = "#a3acb9";
  }
  ctx.fillStyle = "rgba(15,23,42,0.08)";
  ctx.fillRect(x + 2, y + 13, w - 2, 3);
  ctx.fillStyle = MADEIRA.sombra;
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = MADEIRA.frente;
  ctx.fillRect(x, y + 1, w, 4);
  ctx.fillStyle = MADEIRA.topo;
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = MADEIRA.brilho;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillStyle = MADEIRA.sombra;
  for (let i = x + 9; i < x + w - 4; i += 17) ctx.fillRect(i, y + 2, 1, 3);
}

function degrau(ctx: CanvasRenderingContext2D, p: Plataforma) {
  const x = Math.round(p.x), y = Math.round(p.y), w = Math.ceil(p.w);
  ctx.fillStyle = MADEIRA.sombra;
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = MADEIRA.topo;
  ctx.fillRect(x, y, w, 2);
}

function ponte(ctx: CanvasRenderingContext2D, tabuas: Plataforma[]) {
  if (!tabuas.length) return;
  const [a, b] = [tabuas[0], tabuas[tabuas.length - 1]];
  ctx.strokeStyle = "#8b5e34";
  ctx.lineWidth = 1;
  for (const off of [-9, -5]) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + off);
    for (const t of tabuas) ctx.lineTo(t.x + t.w / 2, t.y + off);
    ctx.lineTo(b.x + b.w, b.y + off);
    ctx.stroke();
  }
  for (const t of tabuas) {
    ctx.strokeStyle = "rgba(139,94,52,0.7)";
    ctx.beginPath();
    ctx.moveTo(t.x + t.w / 2 + 0.5, t.y - 9);
    ctx.lineTo(t.x + t.w / 2 + 0.5, t.y);
    ctx.stroke();
    ctx.fillStyle = MADEIRA.sombra;
    ctx.fillRect(Math.round(t.x) + 1, Math.round(t.y), Math.max(2, Math.round(t.w) - 2), 4);
    ctx.fillStyle = MADEIRA.topo;
    ctx.fillRect(Math.round(t.x) + 1, Math.round(t.y), Math.max(2, Math.round(t.w) - 2), 2);
  }
  for (const [px, py] of [[a.x, a.y], [b.x + b.w, b.y]]) {
    ctx.fillStyle = MADEIRA.sombra;
    ctx.fillRect(Math.round(px) - 2, Math.round(py) - 12, 4, 13);
    ctx.fillStyle = MADEIRA.topo;
    ctx.fillRect(Math.round(px) - 2, Math.round(py) - 12, 2, 13);
  }
}

function caixa(ctx: CanvasRenderingContext2D, c: { x: number; y: number; w: number; h: number }) {
  const { x, y, w, h } = c;
  ctx.fillStyle = MADEIRA.sombra;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = MADEIRA.frente;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 3);
  ctx.fillStyle = MADEIRA.topo;
  ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = MADEIRA.brilho;
  ctx.fillRect(x + 1, y, w - 2, 1);
  // Entrada com o formato de cabeça de gato.
  const cx = x + Math.min(w / 2, 22), cy = y + h * 0.58, r = Math.min(9, h * 0.32);
  ctx.fillStyle = MADEIRA.escuro;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r + 1, cy - r * 0.3); ctx.lineTo(cx - r + 2, cy - r - 4); ctx.lineTo(cx - 2, cy - r + 1);
  ctx.moveTo(cx + r - 1, cy - r * 0.3); ctx.lineTo(cx + r - 2, cy - r - 4); ctx.lineTo(cx + 2, cy - r + 1);
  ctx.fill();
  if (w > 60) {
    ctx.fillStyle = MADEIRA.escuro;
    ctx.fillRect(x + w * 0.55, y + 6, w * 0.38, h - 9);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + w * 0.55 + 2, y + 8, 2, h - 13);
  }
}

function arranhador(ctx: CanvasRenderingContext2D, a: { x: number; topo: number; base: number }, balanco: number) {
  const x = Math.round(a.x + Math.sin(balanco * 30) * balanco * 6);
  ctx.fillStyle = MADEIRA.sombra;
  ctx.fillRect(Math.round(a.x) - 8, a.base - 3, 16, 3);
  ctx.fillStyle = MADEIRA.topo;
  ctx.fillRect(Math.round(a.x) - 8, a.base - 3, 16, 1);
  for (let y = a.topo; y < a.base - 3; y++) {
    ctx.fillStyle = (y - a.topo) % 3 === 0 ? "#b39a6b" : "#dcc69a";
    ctx.fillRect(x - 3, y, 7, 1);
  }
  ctx.fillStyle = "#8c7650";
  ctx.fillRect(x + 3, a.topo, 1, a.base - a.topo - 3);
  ctx.fillStyle = MADEIRA.frente;
  ctx.fillRect(x - 5, a.topo - 2, 11, 3);
}

function pote(ctx: CanvasRenderingContext2D, p: { x: number; y: number; cor: string }) {
  const x = Math.round(p.x), y = Math.round(p.y);
  ctx.fillStyle = "#6b3f1d";
  ctx.fillRect(x - 5, y - 6, 10, 2);
  ctx.fillStyle = "#8a5326";
  ctx.fillRect(x - 4, y - 7, 2, 1); ctx.fillRect(x + 1, y - 7, 3, 1);
  ctx.fillStyle = p.cor;
  ctx.fillRect(x - 7, y - 5, 14, 2);
  ctx.fillRect(x - 6, y - 3, 12, 2);
  ctx.fillRect(x - 5, y - 1, 10, 1);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(x - 6, y - 5, 4, 1);
}

/** Camada fixa (desenhada uma vez): parede, chão, prateleiras, escadas, pontes, caixas e potes. */
export function desenharCenario(ctx: CanvasRenderingContext2D, m: Mapa, tema: "hub" | "arena" = "hub") {
  ctx.fillStyle = tema === "hub" ? "#f6f7fb" : "#1e1b4b";
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  if (tema === "hub") {
    ctx.fillStyle = "#eef1f7";
    for (let x = 0; x < LARGURA; x += 24) ctx.fillRect(x, 0, 12, CHAO_Y);
  } else {
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = i % 3 ? "rgba(255,255,255,0.35)" : "rgba(250,204,21,0.6)";
      ctx.fillRect((i * 97) % LARGURA, (i * 53) % (CHAO_Y - 40), 1, 1);
    }
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = 0; x < LARGURA; x += 32) ctx.fillRect(x, 0, 16, CHAO_Y);
  }
  ctx.fillStyle = tema === "hub" ? "#dde3ec" : "#312e81";
  ctx.fillRect(0, CHAO_Y, LARGURA, ALTURA - CHAO_Y);
  ctx.fillStyle = tema === "hub" ? "#c5cedb" : "#4338ca";
  ctx.fillRect(0, CHAO_Y, LARGURA, 1);
  for (const c of m.caixas) caixa(ctx, c);
  const pontes = new Map<string, Plataforma[]>();
  for (const p of m.plataformas) {
    if (p.tipo === "ponte") {
      const id = p.id.split("-")[0];
      pontes.set(id, [...(pontes.get(id) ?? []), p]);
    } else if (p.tipo === "degrau") degrau(ctx, p);
  }
  pontes.forEach(t => ponte(ctx, t));
  for (const p of prateleiras(m)) prateleira(ctx, p);
  for (const p of m.potes) pote(ctx, p);
}

export function desenharArranhadores(ctx: CanvasRenderingContext2D, m: Mapa, balancos: number[]) {
  m.arranhadores.forEach((a, i) => arranhador(ctx, a, balancos[i] ?? 0));
}

export function desenharPorta(ctx: CanvasRenderingContext2D, porta: { x: number; y: number; w: number; h: number }, abertura: number) {
  const { x, y, w, h } = porta;
  ctx.fillStyle = "#6b4a2e";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 3);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(250,204,21,0.25)";
  ctx.fillRect(x + 2, y + h - 6, w - 4, 6);
  // Portinha de vaivém: abre conforme o gato chega perto.
  ctx.fillStyle = "rgba(203,213,225,0.85)";
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 1);
  ctx.lineTo(x + w - 1, y + 1);
  ctx.lineTo(x + w - 1 - abertura * 6, y + h - 1 - abertura * (h - 8));
  ctx.lineTo(x + 1 + abertura * 6, y + h - 1 - abertura * (h - 8));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x + 4, y + 3, 2, Math.max(2, (h - 8) * (1 - abertura)));
}

export function desenharCorda(ctx: CanvasRenderingContext2D, c: Corda) {
  const p = pontaDaCorda(c);
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x + 0.5, c.y);
  ctx.lineTo(p.x + 0.5, p.y);
  ctx.stroke();
  ctx.fillStyle = c.cor;
  ctx.beginPath();
  ctx.arc(p.x, p.y + 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y), 1, 1);
}

export function desenharBola(ctx: CanvasRenderingContext2D, b: Bola) {
  if (!b.quica) { desenharRato(ctx, 0, b.x, b.y + b.r, b.vx < 0 ? -1 : 1, b.cor); return; }
  ctx.fillStyle = "rgba(15,23,42,0.12)";
  ctx.fillRect(Math.round(b.x) - 3, Math.round(b.y + b.r), 6, 1);
  ctx.fillStyle = b.cor;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) + 1, 4, 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 2, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r - 1.5, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
}

export interface Particula { x: number; y: number; vx: number; vy: number; vida: number; total: number; cor: string; tipo: "ponto" | "coracao" | "z" | "texto"; texto?: string }

export function desenharParticulas(ctx: CanvasRenderingContext2D, ps: Particula[]) {
  for (const p of ps) {
    const a = Math.max(0, p.vida / p.total);
    ctx.globalAlpha = Math.min(1, a * 1.5);
    ctx.fillStyle = p.cor;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.tipo === "coracao") {
      ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1);
    } else if (p.tipo === "z") {
      ctx.font = "6px 'Press Start 2P', monospace";
      ctx.fillText("z", x, y);
    } else if (p.tipo === "texto") {
      ctx.font = "8px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#1e1b4b";
      ctx.fillText(p.texto ?? "", x + 1, y + 1);
      ctx.fillStyle = p.cor;
      ctx.fillText(p.texto ?? "", x, y);
      ctx.textAlign = "start";
    } else {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

export function passoParticulas(ps: Particula[], dt: number): Particula[] {
  return ps.map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.tipo === "ponto" ? p.vy + 300 * dt : p.vy, vida: p.vida - dt })).filter(p => p.vida > 0);
}

/** Setinha em cima do gato controlado. */
export function desenharMarcador(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const dy = Math.round(Math.sin(t * 5) * 1.5);
  const bx = Math.round(x), by = Math.round(y) - GATO_H - 8 + dy;
  ctx.fillStyle = "#1e1b4b";
  ctx.fillRect(bx - 3, by - 1, 7, 1); ctx.fillRect(bx - 2, by, 5, 1); ctx.fillRect(bx - 1, by + 1, 3, 1); ctx.fillRect(bx, by + 2, 1, 1);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(bx - 2, by - 1, 5, 1); ctx.fillRect(bx - 1, by, 3, 1); ctx.fillRect(bx, by + 1, 1, 1);
}
