/**
 * Cubicagem: o PDF do projeto fica só no aparelho. Aqui ele é aberto com o pdf.js e o texto de cada página vira linhas
 * (para achar as peças) com a escala impressa na folha.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import {
  GradePontos, IDENTIDADE, acharEscala, montarLinhas, multiplicar, verticesDoCaminho, type LinhaPdf, type Matriz, type TrechoPdf,
} from "@/react-app/utils/cubicagem";

export interface ProjetoPdf {
  nome: string;
  doc: PDFDocumentProxy;
  paginas: number;
  /** Linhas de texto de todas as páginas (vazio se o PDF não tem texto, só desenho). */
  linhas: LinhaPdf[];
  /** Escala achada em cada página (índice = página − 1). */
  escalas: (number | null)[];
}

export const MAX_PDF_PROJETO = 80 * 1024 * 1024;

export async function abrirProjeto(arquivo: File, progresso?: (pagina: number, total: number) => void): Promise<ProjetoPdf> {
  if (arquivo.size > MAX_PDF_PROJETO) throw new Error("O PDF passa de 80 MB.");
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") throw new Error("Esse arquivo não é um PDF.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise
    .catch(() => { throw new Error("Não deu para abrir o PDF (pode estar com senha ou corrompido)."); });
  const linhas: LinhaPdf[] = [];
  const escalas: (number | null)[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    progresso?.(n, doc.numPages);
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    const trechos: TrechoPdf[] = [];
    for (const it of conteudo.items) {
      if (!("str" in it) || !it.str) continue;
      const [a, b, , , e, f] = it.transform as number[];
      // Texto deitado (a ≈ 0) também entra: a posição é a do começo do texto.
      const altura = Math.hypot(a, b) || it.height || 1;
      trechos.push({ str: it.str, x: e, y: f, w: it.width || it.str.length * altura * 0.5, h: altura });
    }
    const daPagina = montarLinhas(trechos, n);
    linhas.push(...daPagina);
    escalas.push(acharEscala(daPagina.map(l => l.texto)));
    pagina.cleanup();
  }
  return { nome: arquivo.name, doc, paginas: doc.numPages, linhas, escalas };
}

const grades = new WeakMap<PDFDocumentProxy, Map<number, Promise<GradePontos>>>();

/**
 * Vértices do desenho da página (pontas de linhas, cantos de retângulos e polilinhas), para o ímã da medida. Lido
 * uma vez por página; segue save/restore, transform e os blocos (form XObject) do PDF.
 */
export function gradeDaPagina(doc: PDFDocumentProxy, n: number): Promise<GradePontos> {
  let porPagina = grades.get(doc);
  if (!porPagina) { porPagina = new Map(); grades.set(doc, porPagina); }
  const pronta = porPagina.get(n);
  if (pronta) return pronta;
  const nova = (async () => {
    const { OPS } = await import("pdfjs-dist");
    const pagina = await doc.getPage(n);
    const lista = await pagina.getOperatorList();
    const grade = new GradePontos(20);
    const pilha: Matriz[] = [];
    let ctm: Matriz = IDENTIDADE;
    for (let i = 0; i < lista.fnArray.length && grade.total < 400_000; i++) {
      const f = lista.fnArray[i];
      const a = lista.argsArray[i] as unknown[];
      if (f === OPS.save) pilha.push(ctm);
      else if (f === OPS.restore) ctm = pilha.pop() ?? IDENTIDADE;
      else if (f === OPS.transform) ctm = multiplicar(a as unknown as Matriz, ctm);
      else if (f === OPS.paintFormXObjectBegin) { pilha.push(ctm); if (Array.isArray(a[0]) && a[0].length === 6) ctm = multiplicar(a[0] as Matriz, ctm); }
      else if (f === OPS.paintFormXObjectEnd) ctm = pilha.pop() ?? IDENTIDADE;
      else if (f === OPS.constructPath) {
        const dados = (a[1] as ArrayLike<number>[] | undefined)?.[0];
        if (dados) verticesDoCaminho(dados, ctm).forEach(p => grade.adicionar(p));
      }
    }
    return grade;
  })().catch(() => new GradePontos(20));
  porPagina.set(n, nova);
  return nova;
}
