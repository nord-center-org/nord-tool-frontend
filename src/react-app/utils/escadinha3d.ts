/**
 * Geometria das camadas do 3D a partir do croqui (contorno, apartamentos e lados): paredes de alvenaria, fachada,
 * divisórias de drywall, área molhada (cerâmica/louças), sacada, porta de entrada e prumadas. Tudo em metros no plano
 * da planta (x, y); a altura fica com o componente 3D. Sem three.js, para testar.
 */
import { area, dentro, limites, nucleo, type Apartamento, type DivisaoLados, type Lado, type ParedeReal, type Ponto } from "./escadinha.ts";
import { centroide, ladoDoPonto } from "./escadinhaApto.ts";

/** Trecho de parede no plano; `esp` (m) quando vem do projeto (sem ela, 14 cm). */
export interface Segmento { a: Ponto; b: Ponto; esp?: number }

const r2 = (v: number) => Math.round(v * 100) / 100;
const chaveSeg = (s: Segmento) => {
  const p = [s.a, s.b].map(([x, y]) => `${r2(x)},${r2(y)}`).sort();
  return p.join("|");
};
export const comprimento = (s: Segmento) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);

/** Arestas de um polígono fechado (sem as de tamanho zero). */
export function arestas(poly: Ponto[]): Segmento[] {
  return poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length] })).filter(s => comprimento(s) > 0.01);
}

/** Paredes de alvenaria do lado: perímetro de cada apartamento do lado, sem repetir parede compartilhada. */
export function paredesDoLado(apartamentos: Apartamento[], lado: Lado): Segmento[] {
  const vistos = new Map<string, Segmento>();
  for (const ap of apartamentos) if (ap.lado === lado) for (const s of arestas(ap.contorno)) vistos.set(chaveSeg(s), s);
  return [...vistos.values()];
}

/** Ponto está sobre o segmento (com tolerância)? */
function sobre(p: Ponto, s: Segmento, tol = 0.05): boolean {
  const [x, y] = p, [x1, y1] = s.a, [x2, y2] = s.b;
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(x - x1, y - y1) < tol;
  const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2));
  return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1))) < tol;
}

/** Fachada do lado: arestas da metade que estão no contorno da torre (a linha de divisão dos lados fica de fora). */
export function fachadaDoLado(contorno: Ponto[], metade: Ponto[]): Segmento[] {
  const borda = arestas(contorno);
  return arestas(metade).filter(s => {
    const meio: Ponto = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
    return borda.some(b => sobre(meio, b) && sobre(s.a, b, 0.1) && sobre(s.b, b, 0.1));
  });
}

/** Centro do núcleo (escada/elevadores): referência para porta (de frente para o hall) e sacada (do lado de fora). */
export function centroNucleo(contorno: Ponto[]): Ponto {
  return centroide(nucleo(contorno));
}

/** Caixa alinhada do apartamento. */
function caixa(ap: Apartamento) {
  const l = limites(ap.contorno);
  return { ...l, cx: (l.minX + l.maxX) / 2, cy: (l.minY + l.maxY) / 2 };
}

/** Divisória de drywall: corta o apartamento no maior sentido, a 55% (sala de um lado, dormitórios do outro). */
export function divisoriaDoApto(ap: Apartamento): Segmento {
  const c = caixa(ap);
  if (c.largura >= c.profundidade) {
    const x = c.minX + c.largura * 0.55;
    return { a: [x, c.minY], b: [x, c.maxY] };
  }
  const y = c.minY + c.profundidade * 0.55;
  return { a: [c.minX, y], b: [c.maxX, y] };
}

/** Área molhada (banheiro/cozinha): retângulo de ~35% no canto do apartamento mais perto do núcleo (onde ficam os shafts). */
export function areaMolhada(ap: Apartamento, nucleoC: Ponto): Ponto[] {
  const c = caixa(ap);
  const w = Math.min(c.largura * 0.38, 3.2), d = Math.min(c.profundidade * 0.38, 3.2);
  const x0 = nucleoC[0] < c.cx ? c.minX : c.maxX - w;
  const y0 = nucleoC[1] < c.cy ? c.minY : c.maxY - d;
  return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d], [x0, y0 + d]];
}

/** Sacada: faixa de 1,2 m junto à aresta do apartamento mais longe do núcleo (a de fachada). */
export function sacadaDoApto(ap: Apartamento, nucleoC: Ponto): Ponto[] {
  const c = caixa(ap);
  const prof = Math.min(1.2, c.largura / 3, c.profundidade / 3);
  const dx = c.cx - nucleoC[0], dy = c.cy - nucleoC[1];
  if (Math.abs(dx) * c.profundidade >= Math.abs(dy) * c.largura) {
    const x0 = dx > 0 ? c.maxX - prof : c.minX;
    const y0 = c.minY + c.profundidade * 0.2, y1 = c.maxY - c.profundidade * 0.2;
    return [[x0, y0], [x0 + prof, y0], [x0 + prof, y1], [x0, y1]];
  }
  const y0 = dy > 0 ? c.maxY - prof : c.minY;
  const x0 = c.minX + c.largura * 0.2, x1 = c.maxX - c.largura * 0.2;
  return [[x0, y0], [x1, y0], [x1, y0 + prof], [x0, y0 + prof]];
}

/** Porta de entrada: no meio da aresta do apartamento mais perto do núcleo; ângulo da parede (rad). */
export function portaDoApto(ap: Apartamento, nucleoC: Ponto): { p: Ponto; angulo: number } {
  const melhor = arestas(ap.contorno)
    .map(s => ({ s, meio: [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2] as Ponto }))
    .sort((u, v) => Math.hypot(u.meio[0] - nucleoC[0], u.meio[1] - nucleoC[1]) - Math.hypot(v.meio[0] - nucleoC[0], v.meio[1] - nucleoC[1]))[0];
  if (!melhor) return { p: centroide(ap.contorno), angulo: 0 };
  return { p: melhor.meio, angulo: Math.atan2(melhor.s.b[1] - melhor.s.a[1], melhor.s.b[0] - melhor.s.a[0]) };
}

/** Posições das prumadas do lado (shafts junto ao núcleo), uma por apartamento do lado, dentro da torre. */
export function prumadasDoLado(apartamentos: Apartamento[], lado: Lado, contorno: Ponto[], nucleoC: Ponto): Ponto[] {
  return apartamentos.filter(a => a.lado === lado).map(a => {
    const m = areaMolhada(a, nucleoC);
    const c = centroide(m);
    // Puxa o ponto para o canto do lado do núcleo, onde fica o shaft.
    const p: Ponto = [c[0] + Math.sign(nucleoC[0] - c[0]) * 0.6, c[1] + Math.sign(nucleoC[1] - c[1]) * 0.6];
    return dentro(p, contorno) ? p : c;
  });
}

/** Área (m²) e perímetro (m) de um polígono. */
export function medidas(poly: Ponto[]): { area: number; perimetro: number } {
  return { area: Math.abs(area(poly)), perimetro: arestas(poly).reduce((s, x) => s + comprimento(x), 0) };
}

/** Paredes reais do projeto separadas por lado (pelo meio de cada parede), para a alvenaria subir lado a lado. */
export function paredesPorLado(paredes: ParedeReal[], lados: DivisaoLados): Record<Lado, Segmento[]> {
  const r: Record<Lado, Segmento[]> = { A: [], B: [] };
  for (const p of paredes) r[ladoDoPonto([(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2], lados)].push({ a: p.a, b: p.b, esp: p.esp });
  return r;
}
