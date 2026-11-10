/**
 * PDF no bloco de notas: importar (cada página do PDF vira uma página do caderno com a imagem dela de fundo, para
 * anotar por cima) e exportar (cada página desenhada vira uma página do PDF, no tamanho dela).
 */
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import { desenharItem, desenharPagina } from "@/react-app/components/bloco/desenho";
import { paginasDoDocumento } from "@/react-app/components/bloco/documento";
import { fundoDaPagina, imagemDoBloco } from "@/react-app/components/bloco/imagensBloco";
import { bytesDoPdf, desenharPaginaPdf, guardarPdf } from "@/react-app/components/bloco/pdfOriginal";
import { blocoNotasService as servico, type PaginaBloco } from "@/react-app/services/BlocoNotasService";
import { PAGINA_DOCUMENTO, documentoVazio, lerConteudo, tamanhoDaPaginaPdf, type Item } from "@/react-app/utils/blocoNotas";

/**
 * Prévia da página (aparece enquanto o PDF original abre e nas miniaturas): ~1200 px no lado maior. Sem o original
 * (PDF acima de 15 MB), a página fica só na imagem, então ela sai maior (~2400 px, ≈ 220 dpi no A4).
 */
const LADO_PREVIA = 1200;
const LADO_SEM_ORIGINAL = 2400;
/** Limite do PDF original guardado (o mesmo do servidor). */
export const MAX_PDF_ORIGINAL = 15 * 1024 * 1024;
const MAX_PAGINAS_PDF = 200;

const jpeg = (canvas: HTMLCanvasElement, qualidade: number) =>
  new Promise<Blob>((ok, falha) => canvas.toBlob(b => (b ? ok(b) : falha(new Error("Não foi possível gerar a imagem da página."))), "image/jpeg", qualidade));

/**
 * Importa as páginas do PDF para o caderno, a partir da posição dada (ou no fim). Chama `progresso(feitas, total)` a
 * cada página e devolve as páginas criadas, na ordem.
 */
export async function importarPdf(idCaderno: number, arquivo: File, posicao: number | undefined,
  progresso: (feitas: number, total: number) => void): Promise<PaginaBloco[]> {
  if (arquivo.size > 60 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 60 MB.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise
    .catch(() => { throw new Error("Não foi possível abrir o PDF (está protegido ou corrompido?)."); });
  // O original fica guardado (até 15 MB): a página é desenhada dele, nítida em qualquer zoom.
  let idPdf: number | null = null;
  if (arquivo.size <= MAX_PDF_ORIGINAL) {
    idPdf = await servico.enviarPdf(idCaderno, arquivo, arquivo.name);
    guardarPdf(idPdf, bytes);
  }
  const lado = idPdf ? LADO_PREVIA : LADO_SEM_ORIGINAL;
  try {
    const total = Math.min(doc.numPages, MAX_PAGINAS_PDF);
    const criadas: PaginaBloco[] = [];
    for (let n = 1; n <= total; n++) {
      const pagina = await doc.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const escala = lado / Math.max(base.width, base.height);
      const vista = pagina.getViewport({ scale: escala });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vista.width);
      canvas.height = Math.round(vista.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport: vista, canvas }).promise;
      let imagem = await jpeg(canvas, 0.85);
      if (imagem.size > 4.8 * 1024 * 1024) imagem = await jpeg(canvas, 0.6);
      const { largura, altura } = tamanhoDaPaginaPdf(base.width, base.height);
      criadas.push(await servico.paginaDePdf(idCaderno, imagem, largura, altura, posicao === undefined ? undefined : posicao + n - 1,
        idPdf ? { idPdf, nrPagina: n } : undefined));
      pagina.cleanup();
      progresso(n, total);
    }
    return criadas;
  } finally {
    void doc.destroy();
  }
}

/** Itens de uma página: os da tela, se aberta, ou os salvos no servidor. */
export type ItensDaPagina = (pagina: PaginaBloco) => Promise<Item[]>;

/**
 * Gera o PDF do caderno (as páginas em imagem, a ~200 dpi), com progresso. v2: o documento de texto (se tiver) entra
 * primeiro, em folhas A4.
 */
export async function exportarPdf(paginas: PaginaBloco[], itensDe: ItensDaPagina, progresso: (feitas: number, total: number) => void,
  documentoHtml?: string): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  let feitas = 0;
  if (documentoHtml && !documentoVazio(documentoHtml)) {
    for (const canvas of await paginasDoDocumento(documentoHtml)) {
      const img = await pdf.embedJpg(new Uint8Array(await (await jpeg(canvas, 0.9)).arrayBuffer()));
      const pg = pdf.addPage([PAGINA_DOCUMENTO.largura * 0.75, PAGINA_DOCUMENTO.altura * 0.75]);
      pg.drawImage(img, { x: 0, y: 0, width: PAGINA_DOCUMENTO.largura * 0.75, height: PAGINA_DOCUMENTO.altura * 0.75 });
    }
  }
  // PDFs originais abertos pelo pdf-lib (para copiar as páginas como estão).
  const originais = new Map<number, Promise<import("pdf-lib").PDFDocument | null>>();
  const original = (idPdf: number) => {
    if (!originais.has(idPdf)) originais.set(idPdf, bytesDoPdf(idPdf).then(b => (b ? PDFDocument.load(b, { ignoreEncryption: true }) : null)).catch(() => null));
    return originais.get(idPdf)!;
  };
  for (const p of paginas) {
    const itens = await itensDe(p);
    const imagens = new Map<number, CanvasImageSource>();
    for (const i of itens) {
      if (i.t === "im" && !imagens.has(i.img)) {
        const bmp = await imagemDoBloco(i.img);
        if (bmp) imagens.set(i.img, bmp);
      }
    }
    const giro = p.nrRotacao ?? 0;
    // v2: página de PDF sem giro → a página original entra como está (vetorial) e o desenho vai por cima, transparente.
    const doc = p.idPdf && p.nrPaginaPdf && giro === 0 ? await original(p.idPdf) : null;
    const origem = doc && p.nrPaginaPdf! <= doc.getPageCount() ? doc.getPage(p.nrPaginaPdf! - 1) : null;
    if (doc && origem && origem.getRotation().angle % 360 === 0) {
      const [copia] = await pdf.copyPages(doc, [p.nrPaginaPdf! - 1]);
      pdf.addPage(copia);
      if (itens.length) {
        const caixa = copia.getCropBox();
        const escala = Math.min(3, 6000 / Math.max(p.nrLargura, p.nrAltura));
        const camada = document.createElement("canvas");
        camada.width = Math.round(p.nrLargura * escala);
        camada.height = Math.round(p.nrAltura * escala);
        const ctx = camada.getContext("2d")!;
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        for (const i of itens) desenharItem(ctx, i, imagens);
        const png = await new Promise<Blob>((ok, falha) => camada.toBlob(b => (b ? ok(b) : falha(new Error("Não foi possível gerar a página."))), "image/png"));
        const img = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()));
        copia.drawImage(img, { x: caixa.x, y: caixa.y, width: caixa.width, height: caixa.height });
      }
      progresso(++feitas, paginas.length);
      continue;
    }
    // As outras: imagem da página. Com PDF original (girada), desenhada dele em alta resolução.
    const escala = p.idPdf ? Math.min(3, 6000 / Math.max(p.nrLargura, p.nrAltura)) : Math.min(2, 3000 / Math.max(p.nrLargura, p.nrAltura));
    const canvas = document.createElement("canvas");
    let fundo: CanvasImageSource | null = null;
    if (p.idPdf && p.nrPaginaPdf) {
      const c = document.createElement("canvas");
      if (await desenharPaginaPdf(c, p.idPdf, p.nrPaginaPdf, giro, p.nrLargura, { x: 0, y: 0, w: p.nrLargura, h: p.nrAltura, escala })) fundo = c;
    }
    if (!fundo && p.inFundo) fundo = await fundoDaPagina(p.id);
    canvas.width = Math.round(p.nrLargura * escala);
    canvas.height = Math.round(p.nrAltura * escala);
    // O fundo vindo do PDF já está girado pelo pdf.js.
    desenharPagina(canvas.getContext("2d")!, escala, p.idPdf && fundo ? { ...p, nrRotacao: 0 } : p, itens, imagens, fundo);
    const imagem = await pdf.embedJpg(new Uint8Array(await (await jpeg(canvas, 0.92)).arrayBuffer()));
    // px a 96 dpi → pontos a 72 dpi
    const pagina = pdf.addPage([p.nrLargura * 0.75, p.nrAltura * 0.75]);
    pagina.drawImage(imagem, { x: 0, y: 0, width: p.nrLargura * 0.75, height: p.nrAltura * 0.75 });
    progresso(++feitas, paginas.length);
  }
  pdf.setTitle("Bloco de notas");
  pdf.setProducer("NordTool");
  return pdf.save();
}

/** Itens salvos de uma página (para exportar as que não foram abertas na tela). */
export async function itensSalvos(idPagina: number): Promise<Item[]> {
  return lerConteudo((await servico.pagina(idPagina)).conteudo).itens;
}
