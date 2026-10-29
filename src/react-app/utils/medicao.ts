/** Medição na planta: distância (polilinha), área e perímetro, com ímã nos vértices do croqui para medir com precisão. */
import type { Ponto } from "./escadinha.ts";
import { medidas } from "./escadinha3d.ts";

export const distancia = (a: Ponto, b: Ponto) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Comprimento da polilinha (soma dos trechos). */
export const comprimentoTotal = (pontos: Ponto[]) => pontos.slice(1).reduce((s, p, i) => s + distancia(pontos[i], p), 0);

/** Área e perímetro do polígono fechado pelos pontos (precisa de 3 ou mais). */
export function areaMedida(pontos: Ponto[]): { area: number; perimetro: number } | null {
  return pontos.length >= 3 ? medidas(pontos) : null;
}

/** Ímã: o vértice mais perto dentro da tolerância (m) ou o próprio ponto. */
export function imantar(p: Ponto, candidatos: Ponto[], tolerancia: number): Ponto {
  let melhor: Ponto = p, d = tolerancia;
  for (const c of candidatos) {
    const dc = distancia(p, c);
    if (dc <= d) { melhor = c; d = dc; }
  }
  return melhor;
}

/** "12,35 m", "48,2 m²", "1,94 m³" (vírgula decimal). */
export const fmtM = (v: number, casas = 2) => `${v.toFixed(casas).replace(".", ",")} m`;
export const fmtM2 = (v: number) => `${v.toFixed(2).replace(".", ",")} m²`;
export const fmtM3 = (v: number) => `${v.toFixed(2).replace(".", ",")} m³`;
