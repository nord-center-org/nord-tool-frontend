import { interpretarApartamento, nomeArquivoSeguro } from "./apartamentoNome";

export interface TermoEmBranco {
  bytes: Uint8Array;
  nome: string;
}

/**
 * Gera no navegador um termo de reprova em branco (A4, 1 página) para o apartamento,
 * para ser enviado pelo mesmo POST do PDF anexado (port de `createBlankTerm` do Lugia).
 */
export async function criarTermoEmBranco(codigoApartamento: string): Promise<TermoEmBranco> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const apto = interpretarApartamento(codigoApartamento);

  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.08, 0.16, 0.25);

  pagina.drawText("TERMO DE REPROVA – ENTREGA DAT", { x: 56, y: 775, size: 18, font: negrito, color: tinta });
  pagina.drawText(`Empreendimento: ${apto.empreendimento || "-"}`, { x: 56, y: 728, size: 12, font: regular, color: tinta });
  pagina.drawText(`Torre / Bloco: ${apto.torre || "-"}     Apartamento: ${apto.unidade}`, { x: 56, y: 704, size: 12, font: regular, color: tinta });
  pagina.drawText("Pendências a registrar:", { x: 56, y: 656, size: 12, font: negrito, color: tinta });
  for (let y = 628; y > 180; y -= 42) {
    pagina.drawLine({ start: { x: 56, y }, end: { x: 539, y }, thickness: 0.6, color: rgb(0.65, 0.69, 0.73) });
  }
  pagina.drawText(`Criado no NordTool em ${new Date().toLocaleDateString("pt-BR")}`, {
    x: 56, y: 86, size: 9, font: regular, color: rgb(0.35, 0.41, 0.46),
  });

  return {
    bytes: await pdf.save(),
    nome: nomeArquivoSeguro(`Termo-DAT-${apto.codigo || "apartamento"}.pdf`),
  };
}
