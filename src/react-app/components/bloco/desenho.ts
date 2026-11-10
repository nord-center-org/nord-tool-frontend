/**
 * Desenha uma página do bloco de notas num canvas 2D: papel, fundo do PDF, traços, formas, textos e imagens. O mesmo
 * desenho serve à tela (em qualquer zoom) e à exportação em PDF.
 */
import {
  ALFA_MARCA, diagramarTexto, larguraNaPressao, linhasDoFundo, pontasDaSeta, pontosDoFundo, recuoDaLinha, type Fundo, type Item, type Medidor,
  type Texto, type Traco,
} from "@/react-app/utils/blocoNotas";

export const FONTE_TEXTO = `Inter, "Segoe UI", Roboto, Arial, sans-serif`;
const fonte = (s: number, b: boolean, i: boolean) => `${i ? "italic " : ""}${b ? "700 " : ""}${s}px ${FONTE_TEXTO}`;

/** Medidor com o canvas de verdade (a quebra de linha da tela e do PDF é a mesma). */
let canvasMedida: CanvasRenderingContext2D | null = null;
export const medirNoCanvas: Medidor = (t, s, b, i) => {
  canvasMedida ??= document.createElement("canvas").getContext("2d");
  if (!canvasMedida) return t.length * s * 0.55;
  canvasMedida.font = fonte(s, b, i);
  return canvasMedida.measureText(t).width;
};

/** v2: texto formatado (negrito, itálico, sublinhado, cor e tamanho por trecho) com o alinhamento da caixa. */
export function desenharTexto(ctx: CanvasRenderingContext2D, i: Texto) {
  ctx.save();
  ctx.textBaseline = "alphabetic";
  let y = i.y;
  for (const l of diagramarTexto(i, medirNoCanvas)) {
    const base = y + l.tamanho * 1.05;
    const x0 = i.x + recuoDaLinha(l, i.w, i.al);
    for (const p of l.pecas) {
      const s = p.tr.s ?? i.s;
      ctx.font = fonte(s, !!p.tr.b, !!p.tr.i);
      ctx.fillStyle = p.tr.c ?? i.c;
      ctx.fillText(p.t, x0 + p.x, base);
      if (p.tr.u && p.t.trim()) {
        ctx.fillRect(x0 + p.x, base + s * 0.12, medirNoCanvas(p.t.trimEnd(), s, !!p.tr.b, !!p.tr.i), Math.max(1, s / 14));
      }
    }
    y += l.altura;
  }
  ctx.restore();
}

export type ImagensCarregadas = Map<number, CanvasImageSource>;

/**
 * Papel: branco com as linhas do fundo, ou a imagem da página do PDF — girada junto com a página (v2): a imagem foi
 * guardada sem giro, então em 90°/270° ela é desenhada com largura e altura trocadas.
 */
export function desenharPapel(ctx: CanvasRenderingContext2D, fundo: Fundo, largura: number, altura: number, imagemFundo?: CanvasImageSource | null, giro = 0) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  if (imagemFundo) {
    ctx.save();
    if (giro === 90) { ctx.translate(largura, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(imagemFundo, 0, 0, altura, largura); }
    else if (giro === 180) { ctx.translate(largura, altura); ctx.rotate(Math.PI); ctx.drawImage(imagemFundo, 0, 0, largura, altura); }
    else if (giro === 270) { ctx.translate(0, altura); ctx.rotate(-Math.PI / 2); ctx.drawImage(imagemFundo, 0, 0, altura, largura); }
    else ctx.drawImage(imagemFundo, 0, 0, largura, altura);
    ctx.restore();
    return;
  }
  ctx.lineWidth = 1;
  for (const l of linhasDoFundo(fundo, largura, altura)) {
    ctx.strokeStyle = l.forte ? "rgba(239,68,68,0.45)" : "rgba(96,165,250,0.35)";
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(100,116,139,0.45)";
  for (const p of pontosDoFundo(fundo, largura, altura)) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Traço com a espessura variando pela pressão (caneta) ou constante e translúcido (marca-texto). */
export function desenharTraco(ctx: CanvasRenderingContext2D, t: Traco) {
  const p = t.p;
  if (p.length < 3) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = t.c;
  ctx.fillStyle = t.c;
  if (t.marca) {
    // Um caminho só: as voltas do mesmo traço não escurecem umas às outras.
    ctx.globalAlpha = ALFA_MARCA;
    ctx.globalCompositeOperation = "multiply";
    ctx.lineCap = "butt";
    ctx.lineWidth = t.w;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let k = 3; k + 2 < p.length; k += 3) ctx.lineTo(p[k], p[k + 1]);
    if (p.length === 3) ctx.lineTo(p[0] + 0.1, p[1]);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (p.length === 3) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], larguraNaPressao(t.w, p[2]) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // Segmentos curvos (pelo meio dos pontos) com a largura média da pressão de cada trecho.
  let mx = p[0], my = p[1];
  for (let k = 3; k + 2 < p.length; k += 3) {
    const x = p[k], y = p[k + 1];
    const nx = k + 5 < p.length ? (x + p[k + 3]) / 2 : x;
    const ny = k + 5 < p.length ? (y + p[k + 4]) / 2 : y;
    ctx.lineWidth = larguraNaPressao(t.w, (p[k - 1] + p[k + 2]) / 2);
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(x, y, nx, ny);
    ctx.stroke();
    mx = nx; my = ny;
  }
  ctx.restore();
}

export function desenharItem(ctx: CanvasRenderingContext2D, i: Item, imagens: ImagensCarregadas) {
  if (i.t === "tr") return desenharTraco(ctx, i);
  ctx.save();
  if (i.t === "fo") {
    ctx.strokeStyle = i.c;
    ctx.lineWidth = i.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (i.f === "linha" || i.f === "seta") {
      ctx.moveTo(i.x1, i.y1);
      ctx.lineTo(i.x2, i.y2);
      if (i.f === "seta") {
        const [a, b] = pontasDaSeta(i);
        ctx.moveTo(a.x, a.y); ctx.lineTo(i.x2, i.y2); ctx.lineTo(b.x, b.y);
      }
    } else if (i.f === "ret") {
      ctx.rect(Math.min(i.x1, i.x2), Math.min(i.y1, i.y2), Math.abs(i.x2 - i.x1), Math.abs(i.y2 - i.y1));
    } else {
      ctx.ellipse((i.x1 + i.x2) / 2, (i.y1 + i.y2) / 2, Math.abs(i.x2 - i.x1) / 2, Math.abs(i.y2 - i.y1) / 2, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  } else if (i.t === "tx") {
    desenharTexto(ctx, i);
  } else {
    const img = imagens.get(i.img);
    if (img) ctx.drawImage(img, i.x, i.y, i.w, i.h);
    else {
      ctx.fillStyle = "rgba(148,163,184,0.25)";
      ctx.fillRect(i.x, i.y, i.w, i.h);
    }
  }
  ctx.restore();
}

/** A página inteira na escala dada (px do canvas por px da página). */
export function desenharPagina(
  ctx: CanvasRenderingContext2D, escala: number, pagina: { cdFundo: Fundo; nrLargura: number; nrAltura: number; nrRotacao?: number },
  itens: Item[], imagens: ImagensCarregadas, imagemFundo?: CanvasImageSource | null,
) {
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  desenharPapel(ctx, pagina.cdFundo, pagina.nrLargura, pagina.nrAltura, imagemFundo, pagina.nrRotacao ?? 0);
  for (const i of itens) desenharItem(ctx, i, imagens);
}
