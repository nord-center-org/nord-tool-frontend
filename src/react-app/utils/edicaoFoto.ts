/** Regras puras do editor de foto (cortar, girar, marcar). Coordenadas normalizadas (0 a 1) na imagem já girada. */

export interface Ponto { x: number; y: number }
export interface Retangulo { x: number; y: number; w: number; h: number }
export type Ferramenta = "livre" | "circulo" | "quadrado" | "seta";
export interface Marcacao { ferramenta: Ferramenta; cor: string; espessura: number; pontos: Ponto[] }
export type Rotacao = 0 | 90 | 180 | 270;

export const CORES_MARCACAO = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ffffff", "#111827"];
export const RECORTE_INTEIRO: Retangulo = { x: 0, y: 0, w: 1, h: 1 };
const MINIMO = 0.05;

const limitar = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Gira um ponto 90° no sentido horário (coordenadas normalizadas). */
export const girarPonto = (p: Ponto): Ponto => ({ x: 1 - p.y, y: p.x });

export function girarRetangulo(r: Retangulo): Retangulo {
  return { x: 1 - (r.y + r.h), y: r.x, w: r.h, h: r.w };
}

export const proximaRotacao = (r: Rotacao): Rotacao => ((r + 90) % 360) as Rotacao;

/** Largura e altura da imagem depois de girada. */
export function dimensoesGiradas(largura: number, altura: number, rotacao: Rotacao): { largura: number; altura: number } {
  return rotacao === 90 || rotacao === 270 ? { largura: altura, altura: largura } : { largura, altura };
}

/** Retângulo a partir de dois cantos arrastados, sempre com largura/altura positivas e dentro da imagem. */
export function retanguloDe(a: Ponto, b: Ponto): Retangulo {
  const x1 = limitar(Math.min(a.x, b.x)), y1 = limitar(Math.min(a.y, b.y));
  const x2 = limitar(Math.max(a.x, b.x)), y2 = limitar(Math.max(a.y, b.y));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export type Alca = "mover" | "no" | "ne" | "so" | "se";

/** Ajusta o recorte arrastando uma alça (cantos) ou o miolo (mover), sem sair da imagem nem ficar minúsculo. */
export function ajustarRecorte(r: Retangulo, alca: Alca, dx: number, dy: number): Retangulo {
  if (alca === "mover") {
    return { ...r, x: limitar(r.x + dx, 0, 1 - r.w), y: limitar(r.y + dy, 0, 1 - r.h) };
  }
  let { x, y } = r;
  let x2 = r.x + r.w, y2 = r.y + r.h;
  if (alca === "no" || alca === "so") x = limitar(x + dx, 0, x2 - MINIMO);
  if (alca === "ne" || alca === "se") x2 = limitar(x2 + dx, x + MINIMO, 1);
  if (alca === "no" || alca === "ne") y = limitar(y + dy, 0, y2 - MINIMO);
  if (alca === "so" || alca === "se") y2 = limitar(y2 + dy, y + MINIMO, 1);
  return { x, y, w: x2 - x, h: y2 - y };
}

export const recorteMudou = (r: Retangulo) =>
  Math.abs(r.x) > 1e-6 || Math.abs(r.y) > 1e-6 || Math.abs(r.w - 1) > 1e-6 || Math.abs(r.h - 1) > 1e-6;

/** As três pontas da cabeça da seta (em pixels), proporcionais à espessura. */
export function cabecaSeta(de: Ponto, para: Ponto, espessura: number): [Ponto, Ponto, Ponto] {
  const angulo = Math.atan2(para.y - de.y, para.x - de.x);
  const tamanho = Math.max(10, espessura * 4.5);
  const abertura = Math.PI / 7;
  return [
    para,
    { x: para.x - tamanho * Math.cos(angulo - abertura), y: para.y - tamanho * Math.sin(angulo - abertura) },
    { x: para.x - tamanho * Math.cos(angulo + abertura), y: para.y - tamanho * Math.sin(angulo + abertura) },
  ];
}

/** Marcação vale a pena guardar? (um toque sem arrastar não vira forma). */
export function marcacaoValida(m: Marcacao): boolean {
  if (m.pontos.length < 2) return false;
  const a = m.pontos[0], b = m.pontos[m.pontos.length - 1];
  return m.ferramenta === "livre" ? m.pontos.length >= 2 : Math.hypot(b.x - a.x, b.y - a.y) > 0.01;
}
