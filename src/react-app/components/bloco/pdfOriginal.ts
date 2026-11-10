/**
 * Bloco de notas v2: o PDF original das páginas importadas, aberto com o pdf.js uma vez por PDF. A página é desenhada
 * do PDF (vetorial) na resolução que a tela pedir — inteira, ou só o pedaço visível quando o zoom é grande — e por
 * isso continua nítida no zoom, como nos leitores de PDF.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import { blocoNotasService as servico } from "@/react-app/services/BlocoNotasService";

const documentos = new Map<number, Promise<PDFDocumentProxy | null>>();
const bytesPdf = new Map<number, Promise<Uint8Array | null>>();

/** Bytes do PDF original (cache por id). */
export function bytesDoPdf(idPdf: number): Promise<Uint8Array | null> {
  if (!bytesPdf.has(idPdf)) {
    bytesPdf.set(idPdf, servico.pdf(idPdf).then(async b => new Uint8Array(await b.arrayBuffer())).catch(() => null));
  }
  return bytesPdf.get(idPdf)!;
}

export function documentoPdf(idPdf: number): Promise<PDFDocumentProxy | null> {
  if (!documentos.has(idPdf)) {
    documentos.set(idPdf, (async () => {
      const bytes = await bytesDoPdf(idPdf);
      if (!bytes) return null;
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise.catch(() => null);
    })());
  }
  return documentos.get(idPdf)!;
}

/** Guarda os bytes já lidos na hora de importar (não precisa baixar de novo). */
export function guardarPdf(idPdf: number, bytes: Uint8Array) {
  bytesPdf.set(idPdf, Promise.resolve(bytes));
}

export interface PedacoPdf {
  /** Região da página, em px da página do caderno. */
  x: number; y: number; w: number; h: number;
  /** px do canvas por px da página. */
  escala: number;
}

/**
 * Desenha a página `nr` do PDF (com o giro da página do caderno) no canvas: a região pedida, na escala pedida. O
 * tamanho da página do caderno é o da página do PDF a 96 dpi (pontos × 4/3), já girado.
 */
export async function desenharPaginaPdf(canvas: HTMLCanvasElement, idPdf: number, nr: number, giro: number, larguraPagina: number, pedaco: PedacoPdf,
  sinal?: { cancelado: boolean }): Promise<boolean> {
  const doc = await documentoPdf(idPdf);
  if (!doc || sinal?.cancelado) return false;
  const pagina = await doc.getPage(nr);
  if (sinal?.cancelado) return false;
  // Escala do pdf.js para a página caber na largura do caderno; o giro do caderno soma ao do próprio PDF.
  const base = pagina.getViewport({ scale: 1, rotation: (pagina.rotate + giro) % 360 });
  const s = (larguraPagina / base.width) * pedaco.escala;
  const vista = pagina.getViewport({ scale: s, rotation: (pagina.rotate + giro) % 360 });
  canvas.width = Math.max(1, Math.round(pedaco.w * pedaco.escala));
  canvas.height = Math.max(1, Math.round(pedaco.h * pedaco.escala));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tarefa = pagina.render({ canvasContext: ctx, viewport: vista, canvas, transform: [1, 0, 0, 1, -pedaco.x * pedaco.escala, -pedaco.y * pedaco.escala] });
  if (sinal) {
    const verificar = () => { if (sinal.cancelado) tarefa.cancel(); };
    const t = window.setInterval(verificar, 50);
    try { await tarefa.promise; } catch { return false; } finally { window.clearInterval(t); }
  } else {
    await tarefa.promise;
  }
  return !sinal?.cancelado;
}
