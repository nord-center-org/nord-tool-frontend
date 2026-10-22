import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { ajustar } from "./pdfLadoALadoLayout.ts";

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 36;
const TINTA = rgb(0.08, 0.16, 0.25);
const SUAVE = rgb(0.35, 0.41, 0.46);
const LINHA = rgb(0.85, 0.88, 0.91);

export interface FotoComprovante { bytes: Uint8Array; tipo: "image/jpeg" | "image/png" }

/** Helvetica (WinAnsi) não cobre todo Unicode: caracteres sem glifo viram "?". */
const limpar = (f: PDFFont, t: string) => Array.from(t).map(c => { try { f.encodeText(c); return c; } catch { return "?"; } }).join("");

const truncar = (f: PDFFont, t: string, largura: number, tamanho: number) => {
  let v = limpar(f, t);
  while (v && f.widthOfTextAtSize(v, tamanho) > largura) v = v.slice(0, -1);
  return v;
};

/**
 * Fotos de recibo viram um PDF (uma foto por página A4, centralizada). O comprovante da Caixinha é sempre PDF:
 * assim a foto tirada na hora entra no mesmo fluxo.
 */
export async function fotosParaPdf(fotos: FotoComprovante[], titulo: string): Promise<Uint8Array> {
  if (fotos.length === 0) throw new Error("Nenhuma foto para converter.");
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setCreator("NordTool");
  for (const foto of fotos) {
    const imagem = foto.tipo === "image/png" ? await pdf.embedPng(foto.bytes) : await pdf.embedJpg(foto.bytes);
    const pagina = pdf.addPage(A4);
    const a = ajustar(imagem.width, imagem.height, { x: MARGEM, y: MARGEM, w: A4[0] - MARGEM * 2, h: A4[1] - MARGEM * 2 });
    pagina.drawImage(imagem, { x: a.x, y: a.y, width: a.width, height: a.height });
  }
  return pdf.save();
}

export interface LancamentoPdf {
  numero: number;
  data: string;
  responsavel: string;
  insumo: string;
  valor: string;
  situacao: string;
  /** PDFs dos comprovantes, na ordem. */
  comprovantes: Uint8Array[];
}

export interface ResumoPdf { titulo: string; periodo: string; total: string; pago: string; aPagar: string }

/**
 * PDF único da Caixinha: capa com o resumo e a lista dos lançamentos, depois os comprovantes de cada
 * lançamento em ordem, com uma faixa no topo da primeira página dizendo de qual lançamento ele é.
 * Comprovante corrompido não derruba o PDF: vira uma página avisando.
 */
export async function pdfUnicoCaixinha(resumo: ResumoPdf, lancamentos: LancamentoPdf[]): Promise<{ bytes: Uint8Array; falhas: number }> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(resumo.titulo);
  pdf.setCreator("NordTool");
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const largura = A4[0] - MARGEM * 2;

  // ---------- capa ----------
  let pagina = pdf.addPage(A4);
  let y = A4[1] - MARGEM - 14;
  pagina.drawText(limpar(negrito, resumo.titulo), { x: MARGEM, y, size: 18, font: negrito, color: TINTA });
  y -= 18;
  pagina.drawText(limpar(fonte, resumo.periodo), { x: MARGEM, y, size: 10, font: fonte, color: SUAVE });
  y -= 24;
  for (const [rotulo, valor] of [["Total", resumo.total], ["Pago", resumo.pago], ["A pagar", resumo.aPagar]] as const) {
    pagina.drawText(limpar(negrito, `${rotulo}: `), { x: MARGEM, y, size: 11, font: negrito, color: TINTA });
    pagina.drawText(limpar(fonte, valor), { x: MARGEM + 70, y, size: 11, font: fonte, color: TINTA });
    y -= 16;
  }
  y -= 8;
  const colunas = [
    { t: "Nº", x: 0, w: 22 }, { t: "Data", x: 24, w: 56 }, { t: "Responsável", x: 82, w: 92 },
    { t: "Insumo", x: 176, w: 180 }, { t: "Valor", x: 358, w: 70 }, { t: "Situação", x: 430, w: 60 }, { t: "PDFs", x: 492, w: 30 },
  ];
  const cabecalho = () => {
    colunas.forEach(c => pagina.drawText(c.t, { x: MARGEM + c.x, y, size: 8, font: negrito, color: SUAVE }));
    y -= 6;
    pagina.drawLine({ start: { x: MARGEM, y }, end: { x: MARGEM + largura, y }, thickness: 0.5, color: LINHA });
    y -= 12;
  };
  cabecalho();
  for (const l of lancamentos) {
    if (y < MARGEM + 20) {
      pagina = pdf.addPage(A4);
      y = A4[1] - MARGEM - 14;
      cabecalho();
    }
    const valores = [String(l.numero), l.data, l.responsavel, l.insumo, l.valor, l.situacao, String(l.comprovantes.length)];
    colunas.forEach((c, i) => pagina.drawText(truncar(fonte, valores[i], c.w, 8.5), { x: MARGEM + c.x, y, size: 8.5, font: fonte, color: TINTA }));
    y -= 13;
  }

  // ---------- comprovantes ----------
  let falhas = 0;
  for (const l of lancamentos) {
    for (const [i, bytes] of l.comprovantes.entries()) {
      const faixa = `Lançamento ${l.numero} · ${l.data} · ${l.insumo} · ${l.valor}${l.comprovantes.length > 1 ? ` · comprovante ${i + 1}/${l.comprovantes.length}` : ""}`;
      try {
        const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await pdf.copyPages(origem, origem.getPageIndices());
        paginas.forEach((p, n) => {
          pdf.addPage(p);
          if (n > 0) return;
          const { width, height } = p.getSize();
          p.drawRectangle({ x: 0, y: height - 18, width, height: 18, color: rgb(1, 1, 1), opacity: 0.85 });
          p.drawText(truncar(fonte, faixa, width - 24, 8), { x: 12, y: height - 13, size: 8, font: fonte, color: TINTA });
        });
      } catch {
        falhas += 1;
        const aviso = pdf.addPage(A4);
        aviso.drawText(truncar(negrito, faixa, largura, 10), { x: MARGEM, y: A4[1] - MARGEM - 14, size: 10, font: negrito, color: TINTA });
        aviso.drawText("Este comprovante não pôde ser incluído (arquivo inválido). Baixe-o separadamente.", { x: MARGEM, y: A4[1] - MARGEM - 32, size: 9, font: fonte, color: SUAVE });
      }
    }
  }
  return { bytes: await pdf.save(), falhas };
}
