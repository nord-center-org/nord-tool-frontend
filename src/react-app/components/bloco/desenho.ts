/**
 * Desenha uma página do bloco de notas num canvas 2D: papel, fundo do PDF, traços, formas, textos e imagens. O mesmo
 * desenho serve à tela (em qualquer zoom) e à exportação em PDF.
 */
import {
  ALFA_MARCA, larguraNaPressao, linhasDoFundo, linhasDoTexto, pontasDaSeta, pontosDoFundo, type Fundo, type Item, type Traco,
} from "@/react-app/utils/blocoNotas";

export type ImagensCarregadas = Map<number, CanvasImageSource>;

/** Papel: branco com as linhas do fundo, ou a imagem da página do PDF. */
export function desenharPapel(ctx: CanvasRenderingContext2D, fundo: Fundo, largura: number, altura: number, imagemFundo?: CanvasImageSource | null) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  if (imagemFundo) {
    ctx.drawImage(imagemFundo, 0, 0, largura, altura);
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
    ctx.fillStyle = i.c;
    ctx.font = `${i.s}px Inter, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textBaseline = "top";
    linhasDoTexto(i).forEach((linha, n) => ctx.fillText(linha, i.x, i.y + n * i.s * 1.3 + i.s * 0.1));
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
  ctx: CanvasRenderingContext2D, escala: number, pagina: { cdFundo: Fundo; nrLargura: number; nrAltura: number },
  itens: Item[], imagens: ImagensCarregadas, imagemFundo?: CanvasImageSource | null,
) {
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  desenharPapel(ctx, pagina.cdFundo, pagina.nrLargura, pagina.nrAltura, imagemFundo);
  for (const i of itens) desenharItem(ctx, i, imagens);
}
