/**
 * Bloco de notas v2: insere qualquer arquivo como página para anotar por cima — PDF (uma página por página), imagem
 * (uma página na proporção dela), Word .docx, planilha (Excel, ODS, CSV) e texto (em folhas A4). Tudo é desenhado no
 * navegador e cada página vira a imagem de fundo dela.
 */
import { paginasDoDocumento } from "@/react-app/components/bloco/documento";
import { importarPdf } from "@/react-app/components/bloco/pdfBloco";
import { blocoNotasService as servico, type PaginaBloco } from "@/react-app/services/BlocoNotasService";
import {
  A4, motivoArquivoNaoSuportado, planilhaParaHtml, tamanhoDaPaginaImagem, textoParaHtml, tipoDoArquivo,
} from "@/react-app/utils/blocoNotas";

export const ACEITA_ARQUIVOS = ".pdf,application/pdf,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,.docx,.xlsx,.xls,.ods,.csv,.txt,.md";
const LADO_MAXIMO = 1650;

const jpeg = (canvas: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((ok, falha) => canvas.toBlob(b => (b ? ok(b) : falha(new Error("Não foi possível gerar a página."))), "image/jpeg", q));

async function enviarCanvas(idCaderno: number, canvas: HTMLCanvasElement, largura: number, altura: number, posicao?: number) {
  let img = await jpeg(canvas, 0.85);
  if (img.size > 4.8 * 1024 * 1024) img = await jpeg(canvas, 0.6);
  return servico.paginaDePdf(idCaderno, img, largura, altura, posicao);
}

/** Folhas A4 (documento, planilha, texto) viram páginas, uma a uma. */
async function enviarFolhas(idCaderno: number, html: string, posicao: number | undefined, progresso: (f: number, t: number) => void, extras: boolean) {
  if (!html.trim()) throw new Error("O arquivo está vazio.");
  const folhas = await paginasDoDocumento(html, 2, extras);
  const criadas: PaginaBloco[] = [];
  for (let n = 0; n < folhas.length; n++) {
    criadas.push(await enviarCanvas(idCaderno, folhas[n], A4.largura, A4.altura, posicao === undefined ? undefined : posicao + n));
    progresso(n + 1, folhas.length);
  }
  return criadas;
}

/** Insere o arquivo a partir da posição dada (ou no fim) e devolve as páginas criadas. */
export async function importarArquivo(idCaderno: number, arquivo: File, posicao: number | undefined,
  progresso: (feitas: number, total: number) => void): Promise<PaginaBloco[]> {
  const tipo = tipoDoArquivo(arquivo.name, arquivo.type);
  if (!tipo) throw new Error(motivoArquivoNaoSuportado(arquivo.name));
  if (arquivo.size > 60 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 60 MB.");
  if (tipo === "pdf") return importarPdf(idCaderno, arquivo, posicao, progresso);

  if (tipo === "imagem") {
    const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" }).catch(() => { throw new Error("Não foi possível abrir a imagem."); });
    const f = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * f);
    canvas.height = Math.round(bmp.height * f);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // PNG transparente fica com fundo branco, como papel
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const tam = tamanhoDaPaginaImagem(bmp.width, bmp.height);
    bmp.close();
    const p = await enviarCanvas(idCaderno, canvas, tam.largura, tam.altura, posicao);
    progresso(1, 1);
    return [p];
  }

  if (tipo === "word") {
    const mammoth = await import("mammoth");
    const r = await mammoth.convertToHtml({ arrayBuffer: await arquivo.arrayBuffer() })
      .catch(() => { throw new Error("Não foi possível ler o documento do Word (.docx)."); });
    return enviarFolhas(idCaderno, r.value, posicao, progresso, true);
  }

  if (tipo === "planilha") {
    const XLSX = await import("xlsx");
    const livro = XLSX.read(new Uint8Array(await arquivo.arrayBuffer()), { type: "array" });
    const html = livro.SheetNames.map(nome =>
      planilhaParaHtml(nome, XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[nome], { header: 1, raw: false, blankrows: false }))).join("");
    return enviarFolhas(idCaderno, html, posicao, progresso, true);
  }

  return enviarFolhas(idCaderno, textoParaHtml(await arquivo.text()), posicao, progresso, false);
}
