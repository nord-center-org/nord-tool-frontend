/**
 * PDF no bloco de notas: importar (cada página do PDF vira uma página do caderno com a imagem dela de fundo, para
 * anotar por cima) e exportar (cada página desenhada vira uma página do PDF, no tamanho dela).
 */
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import { desenharPagina } from "@/react-app/components/bloco/desenho";
import { fundoDaPagina, imagemDoBloco } from "@/react-app/components/bloco/imagensBloco";
import { blocoNotasService as servico, type PaginaBloco } from "@/react-app/services/BlocoNotasService";
import { lerConteudo, tamanhoDaPaginaPdf, type Item } from "@/react-app/utils/blocoNotas";

/** Até ~1650 px no lado maior (≈ 150 dpi no A4): nítido para anotar e cabe nos 5 MB por página. */
const LADO_MAXIMO = 1650;
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
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()), isEvalSupported: false }).promise
    .catch(() => { throw new Error("Não foi possível abrir o PDF (está protegido ou corrompido?)."); });
  try {
    const total = Math.min(doc.numPages, MAX_PAGINAS_PDF);
    const criadas: PaginaBloco[] = [];
    for (let n = 1; n <= total; n++) {
      const pagina = await doc.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const escala = LADO_MAXIMO / Math.max(base.width, base.height);
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
      criadas.push(await servico.paginaDePdf(idCaderno, imagem, largura, altura, posicao === undefined ? undefined : posicao + n - 1));
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

/** Gera o PDF do caderno (as páginas em imagem, a ~200 dpi), com progresso. */
export async function exportarPdf(paginas: PaginaBloco[], itensDe: ItensDaPagina, progresso: (feitas: number, total: number) => void): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  let feitas = 0;
  for (const p of paginas) {
    const itens = await itensDe(p);
    const imagens = new Map<number, CanvasImageSource>();
    for (const i of itens) {
      if (i.t === "im" && !imagens.has(i.img)) {
        const bmp = await imagemDoBloco(i.img);
        if (bmp) imagens.set(i.img, bmp);
      }
    }
    const fundo = p.inFundo ? await fundoDaPagina(p.id) : null;
    const escala = Math.min(2, 3000 / Math.max(p.nrLargura, p.nrAltura));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(p.nrLargura * escala);
    canvas.height = Math.round(p.nrAltura * escala);
    desenharPagina(canvas.getContext("2d")!, escala, p, itens, imagens, fundo);
    const imagem = await pdf.embedJpg(new Uint8Array(await (await jpeg(canvas, 0.9)).arrayBuffer()));
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
