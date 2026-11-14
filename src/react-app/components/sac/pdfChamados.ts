/**
 * SAC v4: os chamados escolhidos num PDF para mandar a quem vai fazer as mudanças. Página A4 deitada: no alto, o
 * título, o status e quem abriu; à esquerda o texto (o que precisa mudar e a resposta); à direita os prints,
 * empilhados no tamanho que couber. O que não couber continua na página seguinte.
 */
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";

import { sacService, type Chamado } from "@/react-app/services/SacService";
import { dataChamado, encaixar, paraFontePdf, quebrarTexto, rotuloStatus } from "@/react-app/utils/sac";

const LARG = 842, ALT = 595, MARGEM = 36;
const COL_TEXTO = 360, VAO = 24;
const X_PRINTS = MARGEM + COL_TEXTO + VAO, L_PRINTS = LARG - X_PRINTS - MARGEM;
const CORES_STATUS: Record<string, [number, number, number]> = {
  ABERTO: [0.15, 0.39, 0.92], EM_ANDAMENTO: [0.85, 0.47, 0.02], RESOLVIDO: [0.09, 0.64, 0.29], RECUSADO: [0.86, 0.15, 0.15],
};

export async function gerarPdfChamados(lista: Chamado[], geradoEm: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle("Chamados do SAC — NordTool");
  const normal = await doc.embedFont(StandardFonts.Helvetica), negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const cinza = rgb(0.4, 0.45, 0.52), escuro = rgb(0.12, 0.16, 0.22), linha = rgb(0.88, 0.9, 0.93);
  const paginas: PDFPage[] = [];

  const novaPagina = () => {
    const p = doc.addPage([LARG, ALT]);
    paginas.push(p);
    // faixa do topo
    p.drawRectangle({ x: 0, y: ALT - 26, width: LARG, height: 26, color: rgb(0.06, 0.09, 0.16) });
    p.drawText("NordTool · Chamados do SAC", { x: MARGEM, y: ALT - 17, size: 10, font: negrito, color: rgb(1, 1, 1) });
    const quando = paraFontePdf(`exportado em ${dataChamado(geradoEm)}`);
    p.drawText(quando, { x: LARG - MARGEM - normal.widthOfTextAtSize(quando, 9), y: ALT - 17, size: 9, font: normal, color: rgb(0.8, 0.84, 0.9) });
    return p;
  };
  const escrever = (p: PDFPage, texto: string, x: number, y: number, tam: number, fonte: PDFFont, cor = escuro) =>
    p.drawText(paraFontePdf(texto), { x, y, size: tam, font: fonte, color: cor });

  for (const c of lista) {
    // imagens do chamado (as que não abrirem são puladas)
    const imagens: PDFImage[] = [];
    for (const id of c.imagens) {
      try {
        const blob = await sacService.imagem(id);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        imagens.push(/png/.test(blob.type) || (bytes[0] === 0x89 && bytes[1] === 0x50) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes));
      } catch { /* print que não abriu fica de fora */ }
    }

    // texto da coluna esquerda, já quebrado em linhas
    const blocos: Array<{ texto: string; tam: number; fonte: PDFFont; cor: ReturnType<typeof rgb>; antes: number }> = [];
    const adicionar = (texto: string, tam: number, fonte: PDFFont, cor = escuro, antes = 0) => {
      quebrarTexto(paraFontePdf(texto), COL_TEXTO, t => fonte.widthOfTextAtSize(t, tam)).forEach((l, i) => blocos.push({ texto: l, tam, fonte, cor, antes: i === 0 ? antes : 0 }));
    };
    adicionar("O que precisa mudar", 9, negrito, cinza);
    adicionar(c.txDescricao.trim(), 11, normal, escuro, 2);
    if (c.txResposta?.trim()) {
      adicionar(`Resposta${c.nmUsuarioResposta ? ` (${c.nmUsuarioResposta})` : ""}`, 9, negrito, cinza, 14);
      adicionar(c.txResposta.trim(), 11, normal, escuro, 2);
    }

    let iTexto = 0, iImagem = 0, primeira = true;
    while (primeira || iTexto < blocos.length || iImagem < imagens.length) {
      const p = novaPagina();
      // cabeçalho do chamado
      let y = ALT - 26 - 30;
      const titulo = quebrarTexto(paraFontePdf(`#${c.id} · ${c.nmTitulo}${primeira ? "" : " (continuação)"}`), LARG - 2 * MARGEM - 120, t => negrito.widthOfTextAtSize(t, 16))[0];
      escrever(p, titulo, MARGEM, y, 16, negrito);
      const st = rotuloStatus(c.cdStatus), cor = CORES_STATUS[c.cdStatus] ?? [0.4, 0.45, 0.52];
      const lSt = negrito.widthOfTextAtSize(paraFontePdf(st), 9) + 16;
      p.drawRectangle({ x: LARG - MARGEM - lSt, y: y - 4, width: lSt, height: 18, color: rgb(cor[0], cor[1], cor[2]), borderWidth: 0 });
      escrever(p, st, LARG - MARGEM - lSt + 8, y + 1, 9, negrito, rgb(1, 1, 1));
      y -= 16;
      escrever(p, `Aberto por ${c.nmUsuario} em ${dataChamado(c.dhCriacao)}${c.txTela ? ` · tela ${c.txTela}` : ""}`, MARGEM, y, 9, normal, cinza);
      y -= 10;
      p.drawLine({ start: { x: MARGEM, y }, end: { x: LARG - MARGEM, y }, thickness: 1, color: linha });
      const topo = y - 18, base = MARGEM;
      // coluna de texto
      let yt = topo;
      while (iTexto < blocos.length) {
        const b = blocos[iTexto];
        const passo = b.tam * 1.35 + b.antes;
        if (yt - passo < base) break;
        yt -= passo;
        if (b.texto) escrever(p, b.texto, MARGEM, yt, b.tam, b.fonte, b.cor);
        iTexto++;
      }
      // coluna dos prints (separada do texto por uma linha fina)
      p.drawLine({ start: { x: X_PRINTS - VAO / 2, y: topo + 6 }, end: { x: X_PRINTS - VAO / 2, y: base }, thickness: 0.5, color: linha });
      if (!imagens.length && primeira) escrever(p, "Sem prints.", X_PRINTS, topo - 12, 10, normal, cinza);
      let yi = topo;
      const restantes = imagens.length - iImagem;
      // até 2 prints por página, cada um com a altura que sobrar
      const porPagina = Math.min(2, restantes);
      const altMax = porPagina ? (topo - base - (porPagina - 1) * 14 - porPagina * 14) / porPagina : 0;
      for (let k = 0; k < porPagina; k++) {
        const img = imagens[iImagem];
        const t = encaixar(img.width, img.height, L_PRINTS, altMax);
        escrever(p, `Print ${iImagem + 1} de ${imagens.length}`, X_PRINTS, yi - 9, 8, negrito, cinza);
        yi -= 14 + t.a;
        p.drawRectangle({ x: X_PRINTS - 1, y: yi - 1, width: t.l + 2, height: t.a + 2, borderColor: linha, borderWidth: 1 });
        p.drawImage(img, { x: X_PRINTS, y: yi, width: t.l, height: t.a });
        yi -= 14;
        iImagem++;
      }
      primeira = false;
    }
  }
  // numeração das páginas
  paginas.forEach((p, i) => {
    const t = `${i + 1} / ${paginas.length}`;
    p.drawText(t, { x: LARG - MARGEM - normal.widthOfTextAtSize(t, 8), y: 16, size: 8, font: normal, color: cinza });
  });
  return doc.save();
}
