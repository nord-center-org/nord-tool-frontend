/**
 * Ferramentas do conversor que precisam do navegador (canvas, pdf.js): PDF → imagens, comprimir, Word/Excel → PDF,
 * converter imagem. Nada é enviado ao servidor.
 */
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import { paginasDoDocumento, sanitizarHtml } from "@/react-app/components/bloco/documento";
import { planilhaParaHtml } from "@/react-app/utils/blocoNotas";
import type { ImagemParaPdf } from "@/react-app/utils/conversor";

export type Progresso = (feitas: number, total: number) => void;

async function abrirPdfJs(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise
    .catch(() => { throw new Error("Não deu para abrir o PDF (pode estar com senha ou corrompido)."); });
}

const paraBlob = (c: HTMLCanvasElement, tipo: string, qualidade?: number) =>
  new Promise<Blob>((ok, falha) => c.toBlob(b => (b ? ok(b) : falha(new Error("Não deu para gerar a imagem."))), tipo, qualidade));

/** Desenha a página n (1…) no tamanho de `dpi` (72 = tamanho do PDF), até 6000 px no lado maior. */
async function desenharPagina(doc: Awaited<ReturnType<typeof abrirPdfJs>>, n: number, dpi: number): Promise<HTMLCanvasElement> {
  const pg = await doc.getPage(n);
  const base = pg.getViewport({ scale: 1 });
  const escala = Math.min(dpi / 72, 6000 / Math.max(base.width, base.height));
  const vista = pg.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vista.width);
  canvas.height = Math.floor(vista.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não deixou desenhar a página.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pg.render({ canvasContext: ctx, viewport: vista, canvas }).promise;
  pg.cleanup();
  return canvas;
}

/** Miniaturas (para organizar páginas): uma imagem pequena por página. */
export async function miniaturas(bytes: Uint8Array, largura = 160, progresso?: Progresso): Promise<string[]> {
  const doc = await abrirPdfJs(bytes);
  const urls: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    const dpi = (largura / pg.getViewport({ scale: 1 }).width) * 72;
    urls.push(URL.createObjectURL(await paraBlob(await desenharPagina(doc, n, dpi), "image/jpeg", 0.7)));
    progresso?.(n, doc.numPages);
  }
  await doc.destroy();
  return urls;
}

/** Cada página vira uma imagem (JPG ou PNG) na resolução escolhida. */
export async function pdfParaImagens(bytes: Uint8Array, formato: "jpg" | "png", dpi: number, paginas: number[], progresso?: Progresso): Promise<{ nome: string; blob: Blob }[]> {
  const doc = await abrirPdfJs(bytes);
  const saida: { nome: string; blob: Blob }[] = [];
  for (const [i, n] of paginas.entries()) {
    const c = await desenharPagina(doc, n, dpi);
    saida.push({ nome: `pagina-${String(n).padStart(3, "0")}.${formato}`, blob: await paraBlob(c, formato === "png" ? "image/png" : "image/jpeg", 0.9) });
    progresso?.(i + 1, paginas.length);
  }
  await doc.destroy();
  return saida;
}

export const NIVEIS_COMPRESSAO = {
  leve: { dpi: 150, qualidade: 0.8, rotulo: "Leve (boa qualidade)" },
  media: { dpi: 110, qualidade: 0.68, rotulo: "Média (recomendada)" },
  forte: { dpi: 80, qualidade: 0.55, rotulo: "Forte (menor arquivo)" },
} as const;
export type NivelCompressao = keyof typeof NIVEIS_COMPRESSAO;

/**
 * Comprime refazendo cada página como imagem JPEG: funciona bem em PDFs escaneados e com fotos. O texto deixa de ser
 * selecionável; por isso a tela mostra o tamanho antes e depois, e a pessoa decide.
 */
export async function comprimirPdf(bytes: Uint8Array, nivel: NivelCompressao, progresso?: Progresso): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const { dpi, qualidade } = NIVEIS_COMPRESSAO[nivel];
  const doc = await abrirPdfJs(bytes);
  const saida = await PDFDocument.create();
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    const tamanho = pg.getViewport({ scale: 1 });
    const c = await desenharPagina(doc, n, dpi);
    const img = await saida.embedJpg(new Uint8Array(await (await paraBlob(c, "image/jpeg", qualidade)).arrayBuffer()));
    saida.addPage([tamanho.width, tamanho.height]).drawImage(img, { x: 0, y: 0, width: tamanho.width, height: tamanho.height });
    progresso?.(n, doc.numPages);
  }
  await doc.destroy();
  return saida.save();
}

/** Folhas A4 (canvas) → PDF. */
async function folhasParaPdf(folhas: HTMLCanvasElement[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const c of folhas) {
    const img = await pdf.embedJpg(new Uint8Array(await (await paraBlob(c, "image/jpeg", 0.9)).arrayBuffer()));
    const pg = pdf.addPage([595.28, 841.89]);
    pg.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return pdf.save();
}

export async function wordParaPdf(arquivo: File): Promise<Uint8Array> {
  const mammoth = await import("mammoth");
  const r = await mammoth.convertToHtml({ arrayBuffer: await arquivo.arrayBuffer() });
  const html = sanitizarHtml(r.value, true);
  if (!html.replace(/<[^>]+>/g, "").trim() && !html.includes("<img")) throw new Error("O Word está vazio.");
  return folhasParaPdf(await paginasDoDocumento(html, 2, true));
}

export async function excelParaPdf(arquivo: File): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const livro = XLSX.read(new Uint8Array(await arquivo.arrayBuffer()), { type: "array" });
  const html = livro.SheetNames.map(nome =>
    planilhaParaHtml(nome, XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[nome], { header: 1, raw: false, blankrows: false }))).join("");
  if (!html) throw new Error("A planilha está vazia.");
  return folhasParaPdf(await paginasDoDocumento(html, 2, true));
}

async function bitmap(arquivo: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(arquivo);
  } catch {
    throw new Error(`Não deu para abrir a imagem ${arquivo.name}. Use JPG, PNG ou WebP.`);
  }
}

/** Imagem pronta para o PDF: JPG e PNG vão como estão; os outros formatos viram PNG. */
export async function lerImagem(arquivo: File): Promise<ImagemParaPdf> {
  const bmp = await bitmap(arquivo);
  const tipo = arquivo.type === "image/jpeg" ? "jpg" : arquivo.type === "image/png" ? "png" : null;
  let bytes: Uint8Array;
  if (tipo) bytes = new Uint8Array(await arquivo.arrayBuffer());
  else {
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d")?.drawImage(bmp, 0, 0);
    bytes = new Uint8Array(await (await paraBlob(c, "image/png")).arrayBuffer());
  }
  const r = { bytes, tipo: tipo ?? "png", largura: bmp.width, altura: bmp.height } as ImagemParaPdf;
  bmp.close();
  return r;
}

/** Converte a imagem para JPG, PNG ou WebP (JPG ganha fundo branco no lugar da transparência). */
export async function converterImagem(arquivo: File, formato: "jpg" | "png" | "webp", qualidade = 0.9): Promise<Blob> {
  const bmp = await bitmap(arquivo);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("O navegador não deixou converter a imagem.");
  if (formato === "jpg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return paraBlob(c, formato === "jpg" ? "image/jpeg" : `image/${formato}`, formato === "png" ? undefined : qualidade);
}

/** Vários arquivos num .zip. */
export async function zipar(arquivos: { nome: string; blob: Blob }[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const a of arquivos) zip.file(a.nome, a.blob);
  return zip.generateAsync({ type: "blob" });
}
