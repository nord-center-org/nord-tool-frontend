import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { ajustar, quebrarTexto } from "./pdfLadoALadoLayout.ts";
import { celulas, legendaImpressa, paginarFotos, type FotosPorPagina, type ItemRelatorio } from "./relatorioFotografico.ts";

export interface CabecalhoPdf {
  titulo: string;
  local: string | null;
  /** dd/mm/aaaa */
  data: string;
  fase: string | null;
  autor: string | null;
  modelo: string | null;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 40;
const TINTA = rgb(0.08, 0.16, 0.25);
const SUAVE = rgb(0.35, 0.41, 0.46);
const LINHA = rgb(0.85, 0.88, 0.91);
const ALTURA_LEGENDA = 26;

/**
 * Gera o PDF do relatório no navegador (A4 retrato): capa com os dados e as observações de cada item,
 * depois as fotos na grade escolhida (1, 2, 4 ou 6 por página) com legenda numerada.
 * `carregarFoto` devolve os bytes (JPEG ou PNG) de cada foto.
 */
export async function gerarPdfRelatorio(
  cabecalho: CabecalhoPdf,
  itens: ItemRelatorio[],
  porPagina: FotosPorPagina,
  carregarFoto: (id: number) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Relatório fotográfico - ${cabecalho.titulo}`);
  pdf.setCreator("NordTool");
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Helvetica (WinAnsi) não cobre todo Unicode: caracteres sem glifo viram "?".
  const limpar = (f: PDFFont, t: string) => Array.from(t).map(c => { try { f.encodeText(c); return c; } catch { return "?"; } }).join("");
  const linhas = (f: PDFFont, t: string, largura: number, tamanho: number) =>
    quebrarTexto(limpar(f, t), largura, s => f.widthOfTextAtSize(s, tamanho));

  const largura = A4[0] - MARGEM * 2;
  const rodape = (p: PDFPage, n: number, total: number) => {
    p.drawText(limpar(fonte, `${cabecalho.titulo} · página ${n} de ${total}`), { x: MARGEM, y: 22, size: 8, font: fonte, color: SUAVE });
  };
  const faixa = (p: PDFPage) => {
    p.drawText(limpar(negrito, cabecalho.titulo), { x: MARGEM, y: A4[1] - MARGEM - 4, size: 11, font: negrito, color: TINTA });
    p.drawLine({ start: { x: MARGEM, y: A4[1] - MARGEM - 12 }, end: { x: A4[0] - MARGEM, y: A4[1] - MARGEM - 12 }, thickness: 0.6, color: LINHA });
  };

  // ---------- capa ----------
  let pagina = pdf.addPage(A4);
  let y = A4[1] - MARGEM - 10;
  pagina.drawText("RELATÓRIO FOTOGRÁFICO", { x: MARGEM, y, size: 10, font: negrito, color: SUAVE });
  y -= 30;
  for (const l of linhas(negrito, cabecalho.titulo, largura, 20)) {
    pagina.drawText(l, { x: MARGEM, y, size: 20, font: negrito, color: TINTA });
    y -= 26;
  }
  const dados: Array<[string, string | null]> = [
    ["Data", cabecalho.data], ["Local", cabecalho.local], ["Fase", cabecalho.fase], ["Modelo", cabecalho.modelo], ["Responsável", cabecalho.autor],
  ];
  y -= 4;
  for (const [rotulo, valor] of dados) {
    if (!valor) continue;
    pagina.drawText(limpar(negrito, `${rotulo}:`), { x: MARGEM, y, size: 10, font: negrito, color: TINTA });
    pagina.drawText(limpar(fonte, valor), { x: MARGEM + 80, y, size: 10, font: fonte, color: TINTA });
    y -= 16;
  }
  y -= 10;
  pagina.drawLine({ start: { x: MARGEM, y }, end: { x: A4[0] - MARGEM, y }, thickness: 0.6, color: LINHA });
  y -= 22;
  pagina.drawText("Itens", { x: MARGEM, y, size: 12, font: negrito, color: TINTA });
  y -= 18;

  const ordenados = [...itens].sort((a, b) => a.nrOrdem - b.nrOrdem || a.id - b.id);
  for (const [i, item] of ordenados.entries()) {
    const titulo = linhas(negrito, `${i + 1}. ${item.nmItem} (${item.fotos.length} foto${item.fotos.length === 1 ? "" : "s"})`, largura, 10);
    const resposta = item.txResposta?.trim() ? linhas(fonte, item.txResposta.trim(), largura - 12, 9) : [];
    const altura = titulo.length * 14 + resposta.length * 12 + 8;
    if (y - altura < MARGEM + 20) {
      pagina = pdf.addPage(A4);
      faixa(pagina);
      y = A4[1] - MARGEM - 36;
    }
    for (const l of titulo) { pagina.drawText(l, { x: MARGEM, y, size: 10, font: negrito, color: TINTA }); y -= 14; }
    for (const l of resposta) { pagina.drawText(l, { x: MARGEM + 12, y, size: 9, font: fonte, color: SUAVE }); y -= 12; }
    y -= 8;
  }

  // ---------- fotos ----------
  const area = { x: MARGEM, y: MARGEM + 10, w: largura, h: A4[1] - MARGEM * 2 - 36 };
  const grade = celulas(porPagina, area, 14);
  const cache = new Map<number, PDFImage>();
  for (const fotosDaPagina of paginarFotos(itens, porPagina)) {
    pagina = pdf.addPage(A4);
    faixa(pagina);
    for (const [i, f] of fotosDaPagina.entries()) {
      const celula = grade[i];
      let imagem = cache.get(f.foto.id);
      if (!imagem) {
        const bytes = await carregarFoto(f.foto.id);
        const png = bytes[0] === 0x89 && bytes[1] === 0x50;
        imagem = png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        cache.set(f.foto.id, imagem);
      }
      const caixa = { x: celula.x, y: celula.y + ALTURA_LEGENDA, w: celula.w, h: celula.h - ALTURA_LEGENDA };
      const ajuste = ajustar(imagem.width, imagem.height, caixa);
      pagina.drawRectangle({ x: caixa.x, y: caixa.y, width: caixa.w, height: caixa.h, borderColor: LINHA, borderWidth: 0.5 });
      pagina.drawImage(imagem, { x: ajuste.x, y: ajuste.y, width: ajuste.width, height: ajuste.height });
      const legenda = linhas(fonte, legendaImpressa(f), celula.w, 8).slice(0, 2);
      legenda.forEach((l, n) => pagina.drawText(l, { x: celula.x, y: celula.y + ALTURA_LEGENDA - 11 - n * 10, size: 8, font: fonte, color: TINTA }));
    }
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, i) => rodape(p, i + 1, paginas.length));
  return pdf.save();
}
