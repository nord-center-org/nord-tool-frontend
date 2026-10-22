import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { ajustar, quebrarTexto } from "./pdfLadoALadoLayout.ts";
import { celulas, layoutPorCodigo, legendaImpressa, paginarFotos, type ItemRelatorio } from "./relatorioFotografico.ts";

export interface CabecalhoPdf {
  titulo: string;
  local: string | null;
  /** dd/mm/aaaa */
  data: string;
  fase: string | null;
  autor: string | null;
  modelo: string | null;
}

export type FontePdf = "HELVETICA" | "TIMES" | "COURIER";

/** Aparência definida no modelo do relatório. */
export interface AparenciaPdf {
  fonte?: FontePdf;
  /** Cabeçalho padrão (título e dados) no alto de todas as páginas. */
  cabecalho?: boolean;
  /** Marca d'água (JPEG/PNG) no meio de todas as páginas. */
  fundo?: Uint8Array | null;
  /** Opacidade da marca d'água, em % (3 a 60). */
  opacidadeFundo?: number;
  /** Ícone (JPEG/PNG) no canto superior direito de todas as páginas. */
  icone?: Uint8Array | null;
  /** Nome no rodapé: "Feito no NordTool por …". */
  feitoPor?: string | null;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 36;
const TINTA = rgb(0.08, 0.16, 0.25);
const SUAVE = rgb(0.35, 0.41, 0.46);
const LINHA = rgb(0.85, 0.88, 0.91);
const DESTAQUE = rgb(0.15, 0.39, 0.92);
const ALTURA_LEGENDA = 24;
const ALTURA_CABECALHO = 46;
const ALTURA_RODAPE = 22;

const FONTES: Record<FontePdf, [StandardFonts, StandardFonts]> = {
  HELVETICA: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  TIMES: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
  COURIER: [StandardFonts.Courier, StandardFonts.CourierBold],
};

const ehPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50;

/**
 * Gera o PDF do relatório no navegador: capa com os dados e as observações de cada item, depois as fotos
 * no layout escolhido (retrato ou paisagem, texto embaixo ou ao lado). Cabeçalho (com o ícone) e rodapé
 * ("Feito no NordTool por …" e página) se repetem em todas as páginas; a marca d'água vai no fundo de todas.
 * `carregarFoto` devolve os bytes (JPEG ou PNG) de cada foto.
 */
export async function gerarPdfRelatorio(
  cabecalho: CabecalhoPdf,
  itens: ItemRelatorio[],
  codigoLayout: string,
  carregarFoto: (id: number) => Promise<Uint8Array>,
  aparencia: AparenciaPdf = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Relatório fotográfico - ${cabecalho.titulo}`);
  pdf.setCreator("NordTool");
  const [normal, forte] = FONTES[aparencia.fonte ?? "HELVETICA"] ?? FONTES.HELVETICA;
  const fonte = await pdf.embedFont(normal);
  const negrito = await pdf.embedFont(forte);
  const embutir = async (b: Uint8Array) => (ehPng(b) ? pdf.embedPng(b) : pdf.embedJpg(b));
  const fundo = aparencia.fundo?.length ? await embutir(aparencia.fundo) : null;
  const icone = aparencia.icone?.length ? await embutir(aparencia.icone) : null;
  const comCabecalho = aparencia.cabecalho !== false;
  const opacidade = Math.min(60, Math.max(3, aparencia.opacidadeFundo ?? 12)) / 100;

  // As fontes padrão (WinAnsi) não cobrem todo Unicode: caracteres sem glifo viram "?".
  const limpar = (f: PDFFont, t: string) => Array.from(t).map(c => { try { f.encodeText(c); return c; } catch { return "?"; } }).join("");
  const linhas = (f: PDFFont, t: string, largura: number, tamanho: number) =>
    quebrarTexto(limpar(f, t), largura, s => f.widthOfTextAtSize(s, tamanho));

  const layout = layoutPorCodigo(codigoLayout);
  const tamanhoFotos: [number, number] = layout.orientacao === "paisagem" ? [A4[1], A4[0]] : A4;
  // Área útil abaixo do cabeçalho e acima do rodapé.
  const areaUtil = (p: PDFPage) => {
    const { width, height } = p.getSize();
    const topo = comCabecalho || icone ? ALTURA_CABECALHO + 8 : 0;
    return { x: MARGEM, y: MARGEM + ALTURA_RODAPE - 10, w: width - MARGEM * 2, h: height - MARGEM * 2 - topo - ALTURA_RODAPE + 10 };
  };

  const novaPagina = (tamanho: [number, number]) => {
    const p = pdf.addPage(tamanho);
    const { width, height } = p.getSize();
    if (fundo) {
      const caixa = ajustar(fundo.width, fundo.height, { x: MARGEM, y: MARGEM, w: width - MARGEM * 2, h: height - MARGEM * 2 });
      p.drawImage(fundo, { x: caixa.x, y: caixa.y, width: caixa.width, height: caixa.height, opacity: opacidade });
    }
    const topo = height - MARGEM;
    let direita = width - MARGEM;
    if (icone) {
      const caixa = ajustar(icone.width, icone.height, { x: width - MARGEM - 70, y: topo - ALTURA_CABECALHO, w: 70, h: ALTURA_CABECALHO });
      p.drawImage(icone, { x: caixa.x + (70 - caixa.width) / 2, y: caixa.y, width: caixa.width, height: caixa.height });
      direita = width - MARGEM - 80;
    }
    if (comCabecalho) {
      const largura = direita - MARGEM;
      const titulo = linhas(negrito, cabecalho.titulo, largura, 13)[0] ?? "";
      p.drawText(titulo, { x: MARGEM, y: topo - 14, size: 13, font: negrito, color: TINTA });
      const dados = [cabecalho.data, cabecalho.local, cabecalho.fase, cabecalho.autor ? `Responsável: ${cabecalho.autor}` : null].filter(Boolean).join("  ·  ");
      const linhaDados = linhas(fonte, dados, largura, 8.5)[0] ?? "";
      p.drawText(linhaDados, { x: MARGEM, y: topo - 30, size: 8.5, font: fonte, color: SUAVE });
      p.drawRectangle({ x: MARGEM, y: topo - ALTURA_CABECALHO + 2, width: 42, height: 2, color: DESTAQUE });
      p.drawLine({ start: { x: MARGEM + 44, y: topo - ALTURA_CABECALHO + 3 }, end: { x: width - MARGEM, y: topo - ALTURA_CABECALHO + 3 }, thickness: 0.6, color: LINHA });
    }
    return p;
  };

  // ---------- capa ----------
  let pagina = novaPagina(A4);
  const areaCapa = areaUtil(pagina);
  const largura = areaCapa.w;
  let y = areaCapa.y + areaCapa.h - 4;
  pagina.drawText("RELATÓRIO FOTOGRÁFICO", { x: MARGEM, y, size: 9, font: negrito, color: SUAVE });
  y -= 26;
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
    if (y - altura < areaCapa.y) {
      pagina = novaPagina(A4);
      const a = areaUtil(pagina);
      y = a.y + a.h - 10;
    }
    for (const l of titulo) { pagina.drawText(l, { x: MARGEM, y, size: 10, font: negrito, color: TINTA }); y -= 14; }
    for (const l of resposta) { pagina.drawText(l, { x: MARGEM + 12, y, size: 9, font: fonte, color: SUAVE }); y -= 12; }
    y -= 8;
  }

  // ---------- fotos ----------
  const cache = new Map<number, PDFImage>();
  const jaMostrouObservacao = new Set<number>();
  for (const fotosDaPagina of paginarFotos(itens, layout.celulas.length)) {
    pagina = novaPagina(tamanhoFotos);
    const grade = celulas(layout, areaUtil(pagina), 14);
    for (const [i, f] of fotosDaPagina.entries()) {
      const celula = grade[i];
      let imagem = cache.get(f.foto.id);
      if (!imagem) {
        imagem = await embutir(await carregarFoto(f.foto.id));
        cache.set(f.foto.id, imagem);
      }
      if (celula.texto === "direita") {
        // Foto à esquerda; à direita o número e o item, a legenda e (na primeira foto do item) a observação.
        const larguraFoto = celula.w * 0.58;
        const caixa = { x: celula.x, y: celula.y, w: larguraFoto, h: celula.h };
        const ajuste = ajustar(imagem.width, imagem.height, caixa);
        pagina.drawRectangle({ x: caixa.x, y: caixa.y, width: caixa.w, height: caixa.h, borderColor: LINHA, borderWidth: 0.5 });
        pagina.drawImage(imagem, { x: ajuste.x, y: ajuste.y, width: ajuste.width, height: ajuste.height });
        const xt = celula.x + larguraFoto + 12;
        const lt = celula.w - larguraFoto - 12;
        let yt = celula.y + celula.h - 12;
        const base = celula.y + 4;
        const escrever = (f2: PDFFont, t: string, tam: number, cor = TINTA) => {
          for (const l of linhas(f2, t, lt, tam)) {
            if (yt < base) return;
            pagina.drawText(l, { x: xt, y: yt, size: tam, font: f2, color: cor });
            yt -= tam + 3;
          }
        };
        escrever(negrito, `${f.numero}. ${f.item.nmItem}`, 10.5);
        yt -= 2;
        if (f.foto.txLegenda?.trim()) escrever(fonte, f.foto.txLegenda.trim(), 9.5);
        if (f.item.txResposta?.trim() && !jaMostrouObservacao.has(f.item.id)) {
          jaMostrouObservacao.add(f.item.id);
          yt -= 4;
          escrever(fonte, f.item.txResposta.trim(), 8.5, SUAVE);
        }
      } else {
        const caixa = { x: celula.x, y: celula.y + ALTURA_LEGENDA, w: celula.w, h: celula.h - ALTURA_LEGENDA };
        const ajuste = ajustar(imagem.width, imagem.height, caixa);
        pagina.drawRectangle({ x: caixa.x, y: caixa.y, width: caixa.w, height: caixa.h, borderColor: LINHA, borderWidth: 0.5 });
        pagina.drawImage(imagem, { x: ajuste.x, y: ajuste.y, width: ajuste.width, height: ajuste.height });
        const legenda = linhas(fonte, legendaImpressa(f), celula.w, 8).slice(0, 2);
        legenda.forEach((l, n) => pagina.drawText(l, { x: celula.x, y: celula.y + ALTURA_LEGENDA - 11 - n * 10, size: 8, font: fonte, color: TINTA }));
      }
    }
  }

  // ---------- rodapé em todas as páginas ----------
  const paginas = pdf.getPages();
  const feitoPor = `Feito no NordTool${aparencia.feitoPor?.trim() ? ` por ${aparencia.feitoPor.trim()}` : ""}`;
  paginas.forEach((p, i) => {
    const { width } = p.getSize();
    p.drawLine({ start: { x: MARGEM, y: MARGEM + 4 }, end: { x: width - MARGEM, y: MARGEM + 4 }, thickness: 0.5, color: LINHA });
    p.drawText(limpar(fonte, feitoPor), { x: MARGEM, y: MARGEM - 8, size: 8, font: fonte, color: SUAVE });
    const numero = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(numero, { x: width - MARGEM - fonte.widthOfTextAtSize(numero, 8), y: MARGEM - 8, size: 8, font: fonte, color: SUAVE });
  });
  return pdf.save();
}
