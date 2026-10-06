import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { validarArquivoPdf, validarPaginasPdf, validarTamanhoPdf } from "./pdfTermoRegras";

export interface PdfLido {
  documento: PDFDocumentProxy;
  nrPaginas: number;
  /** Bytes originais (para reuso na geração do PDF lado a lado). */
  bytes: Uint8Array;
}

/**
 * Lê um PDF (File, Blob ou bytes) com pdf.js. Valida ≤ 15 MB e ≤ 80 páginas.
 * Quem chama deve chamar `documento.destroy()` ao terminar.
 */
export async function lerPdf(origem: File | Blob | Uint8Array): Promise<PdfLido> {
  if (typeof File !== "undefined" && origem instanceof File) {
    validarArquivoPdf(origem);
  }
  const bytes = origem instanceof Uint8Array ? origem : new Uint8Array(await origem.arrayBuffer());
  validarTamanhoPdf(bytes.length);

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let documento: PDFDocumentProxy;
  try {
    // slice(): o pdf.js transfere o buffer para o worker; mantemos os bytes originais.
    documento = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  } catch {
    throw new Error("Não foi possível ler o PDF. Verifique se o arquivo está íntegro.");
  }

  try {
    validarPaginasPdf(documento.numPages);
  } catch (erro) {
    await documento.destroy();
    throw erro;
  }
  return { documento, nrPaginas: documento.numPages, bytes };
}
