/**
 * Lê o desenho vetorial de uma página de PDF (linhas, áreas pintadas e textos com posição), como sai do AutoCAD/Revit
 * para o Construcode. Coordenadas em pontos da página (1/72"), origem no canto de cima à esquerda, y para baixo.
 * Só depende da interface do pdf.js (getOperatorList/getTextContent), para rodar também em node nos testes manuais.
 */

export interface SegmentoPdf { x1: number; y1: number; x2: number; y2: number; cor: string }
export interface PreenchidoPdf { pts: [number, number][]; cor: string }
/** Retângulo traçado (caminho fechado de 4 cantos, lados horizontais/verticais): blocos, amostras de legenda. */
export interface RetanguloPdf { x0: number; y0: number; x1: number; y1: number; cor: string }
export interface TextoPdf { s: string; x: number; y: number; h: number; vertical: boolean }

export interface PaginaVetorial {
  largura: number;
  altura: number;
  segmentos: SegmentoPdf[];
  retangulos: RetanguloPdf[];
  preenchidos: PreenchidoPdf[];
  textos: TextoPdf[];
}

type Matriz = [number, number, number, number, number, number];

/** Pedaço da interface do pdf.js que usamos (página e tabela OPS). */
export interface PaginaPdfJs {
  getViewport(o: { scale: number }): { width: number; height: number; transform: number[] };
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  getTextContent(): Promise<{ items: unknown[] }>;
}

const mult = (m: Matriz, n: Matriz): Matriz => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const aplicar = (m: Matriz, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// DrawOPS do pdf.js 5 (dentro do constructPath).
const MOVER = 0, LINHA = 1, CURVA = 2, QUADRATICA = 3, FECHAR = 4;

/** Quebra os dados do constructPath em subcaminhos; curvas viram só o ponto final e marcam o subcaminho como curvo. */
export function subcaminhos(dados: ArrayLike<number>): { pts: [number, number][]; fechado: boolean; curvo: boolean }[] {
  const lista: { pts: [number, number][]; fechado: boolean; curvo: boolean }[] = [];
  let atual: { pts: [number, number][]; fechado: boolean; curvo: boolean } | null = null;
  for (let i = 0; i < dados.length;) {
    const op = dados[i++];
    if (op === MOVER) {
      atual = { pts: [[dados[i++], dados[i++]]], fechado: false, curvo: false };
      lista.push(atual);
    } else if (op === LINHA) {
      if (!atual) { atual = { pts: [], fechado: false, curvo: false }; lista.push(atual); }
      atual.pts.push([dados[i++], dados[i++]]);
    } else if (op === CURVA) {
      i += 4;
      atual?.pts.push([dados[i++], dados[i++]]);
      if (atual) atual.curvo = true;
    } else if (op === QUADRATICA) {
      i += 2;
      atual?.pts.push([dados[i++], dados[i++]]);
      if (atual) atual.curvo = true;
    } else if (op === FECHAR) {
      if (atual) atual.fechado = true;
    } else break;
  }
  return lista;
}

/** O subcaminho é um retângulo alinhado? (4 cantos distintos, fechado ou voltando ao início.) */
export function comoRetangulo(pts: [number, number][]): { x0: number; y0: number; x1: number; y1: number } | null {
  const q: [number, number][] = [];
  for (const p of pts) {
    const u = q[q.length - 1];
    if (!u || Math.abs(u[0] - p[0]) > 0.01 || Math.abs(u[1] - p[1]) > 0.01) q.push(p);
  }
  if (q.length === 5 && Math.abs(q[0][0] - q[4][0]) < 0.01 && Math.abs(q[0][1] - q[4][1]) < 0.01) q.pop();
  if (q.length !== 4) return null;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    if (Math.abs(a[0] - b[0]) > 0.02 && Math.abs(a[1] - b[1]) > 0.02) return null;
  }
  const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
  const r = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  return r.x1 - r.x0 > 0.05 && r.y1 - r.y0 > 0.05 ? r : null;
}

/**
 * Retângulos desenhados como 4 linhas seguidas (cada lado um traço, encadeados e voltando ao início), como o AutoCAD
 * exporta blocos de desenho. Complementa os retângulos que vêm como um caminho só.
 */
export function retangulosDosSegmentos(segmentos: SegmentoPdf[]): RetanguloPdf[] {
  const saida: RetanguloPdf[] = [];
  const perto = (a: number, b: number) => Math.abs(a - b) < 0.05;
  for (let i = 0; i + 3 < segmentos.length; i++) {
    const q = [segmentos[i], segmentos[i + 1], segmentos[i + 2], segmentos[i + 3]];
    if (q.some(s => s.cor !== q[0].cor)) continue;
    const encadeado = q.every((s, j) => { const n = q[(j + 1) % 4]; return perto(s.x2, n.x1) && perto(s.y2, n.y1); });
    if (!encadeado || !q.every(s => perto(s.x1, s.x2) || perto(s.y1, s.y2))) continue;
    const xs = q.map(s => s.x1), ys = q.map(s => s.y1);
    const r = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), cor: q[0].cor };
    if (r.x1 - r.x0 > 0.05 && r.y1 - r.y0 > 0.05) saida.push(r);
    i += 3;
  }
  return saida;
}

/** Extrai linhas, áreas pintadas e textos de uma página. `OPS` é a tabela do pdf.js (pdfjs.OPS). */
export async function lerPaginaVetorial(pagina: PaginaPdfJs, OPS: Record<string, number>): Promise<PaginaVetorial> {
  const vp = pagina.getViewport({ scale: 1 });
  const base = vp.transform as Matriz;
  const { fnArray, argsArray } = await pagina.getOperatorList();
  const segmentos: SegmentoPdf[] = [];
  const retangulos: RetanguloPdf[] = [];
  const preenchidos: PreenchidoPdf[] = [];
  const pilha: { m: Matriz; traco: string; fundo: string }[] = [];
  let m: Matriz = base;
  let traco = "#000000", fundo = "#000000";
  const tracar = new Set([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  const pintar = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);

  for (let k = 0; k < fnArray.length; k++) {
    const fn = fnArray[k];
    const args = argsArray[k] as unknown[];
    if (fn === OPS.save) pilha.push({ m, traco, fundo });
    else if (fn === OPS.restore) { const s = pilha.pop(); if (s) ({ m, traco, fundo } = s); }
    else if (fn === OPS.transform) m = mult(m, args as Matriz);
    else if (fn === OPS.paintFormXObjectBegin) {
      pilha.push({ m, traco, fundo });
      const mat = args?.[0] as number[] | null;
      if (mat && mat.length === 6) m = mult(m, mat as Matriz);
    } else if (fn === OPS.paintFormXObjectEnd) { const s = pilha.pop(); if (s) ({ m, traco, fundo } = s); }
    else if (fn === OPS.setStrokeRGBColor) traco = String(args[0]);
    else if (fn === OPS.setFillRGBColor) fundo = String(args[0]);
    else if (fn === OPS.constructPath) {
      const op = args[0] as number;
      const dados = (args[1] as unknown[])?.[0] as ArrayLike<number> | undefined;
      if (!dados || typeof dados !== "object" || !("length" in dados)) continue;
      const partes = subcaminhos(dados);
      if (tracar.has(op)) {
        for (const p of partes) {
          if (p.curvo) continue;
          const pts = p.pts.map(([x, y]) => aplicar(m, x, y));
          const ret = comoRetangulo(p.fechado ? [...pts, pts[0]] : pts);
          if (ret) retangulos.push({ ...ret, cor: traco });
          if (p.fechado && pts.length > 2) pts.push(pts[0]);
          for (let i = 1; i < pts.length; i++) {
            segmentos.push({ x1: pts[i - 1][0], y1: pts[i - 1][1], x2: pts[i][0], y2: pts[i][1], cor: traco });
          }
        }
      }
      if (pintar.has(op)) {
        for (const p of partes) if (p.pts.length > 2) preenchidos.push({ pts: p.pts.map(([x, y]) => aplicar(m, x, y)), cor: fundo });
      }
    }
  }

  const conteudo = await pagina.getTextContent();
  const textos: TextoPdf[] = [];
  for (const item of conteudo.items as { str?: string; transform?: number[] }[]) {
    if (!item.str?.trim() || !item.transform) continue;
    const t = mult(base, item.transform as Matriz);
    textos.push({ s: item.str.trim(), x: t[4], y: t[5], h: Math.hypot(t[2], t[3]), vertical: Math.abs(t[1]) > Math.abs(t[0]) });
  }
  const chave = (r: RetanguloPdf) => `${r.x0.toFixed(1)}|${r.y0.toFixed(1)}|${r.x1.toFixed(1)}|${r.y1.toFixed(1)}|${r.cor}`;
  const vistos = new Set(retangulos.map(chave));
  for (const r of retangulosDosSegmentos(segmentos)) if (!vistos.has(chave(r))) { vistos.add(chave(r)); retangulos.push(r); }
  return { largura: vp.width, altura: vp.height, segmentos, retangulos, preenchidos, textos };
}
