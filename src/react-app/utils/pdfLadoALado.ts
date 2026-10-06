import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

import { interpretarApartamento } from "./apartamentoNome.ts";
import {
  AREA_FOTO, AREA_TERMO, MAX_LINHAS_LEGENDA, PAGINA_A4_PAISAGEM,
  ajustar, anguloDeDesenho, ehRetrato90, limitarLinhas, montarFolhas, origemPaginaGirada, quebrarTexto,
} from "./pdfLadoALadoLayout.ts";
import { rotuloSituacao } from "./termoRegras.ts";

export interface FotoParaPdf {
  id: number;
  pagina: number;
  ordem: number;
  legenda: string | null;
  bytes: Uint8Array;
  tipo: "image/jpeg" | "image/png";
}

export interface DadosRelatorio {
  /** Código do apartamento no NordTool, ex.: "EN-02-1307". */
  codigoApartamento: string;
  nrTermo: number;
  /** PENDENTE | EM_ANDAMENTO | CONCLUIDO */
  situacao: string;
  pdfBytes: Uint8Array;
  fotos: FotoParaPdf[];
  geradoEm?: Date;
}

export interface OpcoesRelatorio {
  incluirPaginasSemFoto: boolean;
}

const TINTA = rgb(0.08, 0.16, 0.25);
const SUAVE = rgb(0.35, 0.41, 0.46);

/**
 * Gera o PDF "lado a lado" no navegador (A4 paisagem): 1 folha por foto, com a página do termo à esquerda
 * (repetida quando há várias fotos na mesma página) e a foto + legenda à direita. Port de `createDatReport` do Lugia.
 */
export async function gerarPdfLadoALado(dados: DadosRelatorio, opcoes: OpcoesRelatorio): Promise<Uint8Array> {
  const origem = await PDFDocument.load(dados.pdfBytes, { updateMetadata: false });
  const saida = await PDFDocument.create();
  const fonte = await saida.embedFont(StandardFonts.Helvetica);
  const negrito = await saida.embedFont(StandardFonts.HelveticaBold);

  const apto = interpretarApartamento(dados.codigoApartamento);
  const cabecalho = apto.empreendimento
    ? `Entrega DAT | ${apto.empreendimento} | Torre ${apto.torre} | Apto ${apto.unidade}`
    : `Entrega DAT | Apto ${apto.codigo}`;
  const dataGeracao = (dados.geradoEm ?? new Date()).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  saida.setTitle(`Entrega DAT - ${apto.codigo} - Termo ${dados.nrTermo}`);
  saida.setCreator("NordTool");

  // Helvetica (WinAnsi) não cobre todo Unicode: caracteres sem glifo viram "?".
  const limpar = (texto: string) =>
    Array.from(texto).map(c => { try { fonte.encodeText(c); return c; } catch { return "?"; } }).join("");
  const truncar = (texto: string, largura: number, tamanho: number) => {
    let valor = limpar(texto);
    while (valor && fonte.widthOfTextAtSize(valor, tamanho) > largura) valor = valor.slice(0, -1);
    return valor;
  };

  const folhas = montarFolhas(origem.getPageCount(), dados.fotos, opcoes.incluirPaginasSemFoto);
  if (folhas.length === 0) {
    throw new Error("Não há nada para gerar: o termo não tem fotos e as páginas sem foto foram omitidas.");
  }

  type PaginaIncorporada = Awaited<ReturnType<typeof saida.embedPage>>;
  // null = página sem conteúdo (o pdf-lib não consegue incorporá-la): sai como página em branco.
  const incorporadas = new Map<number, PaginaIncorporada | null>();
  const imagens = new Map<number, Awaited<ReturnType<typeof saida.embedJpg>>>();

  let numeroFolha = 0;
  for (const folha of folhas) {
    numeroFolha++;
    const paginaOrigem = origem.getPage(folha.pagina - 1);
    if (!incorporadas.has(folha.pagina)) {
      // O pdf-lib só embute páginas com /Contents (falha ao salvar); sem conteúdo = página em branco.
      const temConteudo = Boolean(paginaOrigem.node.normalizedEntries().Contents);
      incorporadas.set(folha.pagina, temConteudo ? await saida.embedPage(paginaOrigem) : null);
    }
    const incorporada = incorporadas.get(folha.pagina) ?? null;
    const angulo = anguloDeDesenho(paginaOrigem.getRotation().angle);

    const pagina = saida.addPage([PAGINA_A4_PAISAGEM.largura, PAGINA_A4_PAISAGEM.altura]);
    pagina.drawText(truncar(cabecalho, 774, 14), { x: 34, y: 560, size: 14, font: negrito, color: TINTA });
    pagina.drawText(`Termo ${dados.nrTermo} | Termo de reprova - página ${folha.pagina}`, { x: 34, y: 534, size: 11, font: negrito, color: TINTA });
    const tituloFoto = folha.fotosNaPagina > 1
      ? `Pendência resolvida - foto ${folha.numeroDaFoto} de ${folha.fotosNaPagina}`
      : "Pendência resolvida - registro fotográfico";
    pagina.drawText(tituloFoto, { x: 434, y: 534, size: 11, font: negrito, color: TINTA });

    // Termo (esquerda), com suporte a páginas giradas.
    if (incorporada) {
      const girada = ehRetrato90(angulo);
      const esquerda = ajustar(girada ? incorporada.height : incorporada.width, girada ? incorporada.width : incorporada.height, AREA_TERMO);
      const origemDesenho = origemPaginaGirada(angulo, esquerda);
      pagina.drawPage(incorporada, {
        x: origemDesenho.x,
        y: origemDesenho.y,
        width: incorporada.width * esquerda.scale,
        height: incorporada.height * esquerda.scale,
        rotate: degrees(angulo),
      });
    } else {
      pagina.drawText('(página em branco no termo)', { x: 140, y: 315, size: 10, font: fonte, color: SUAVE });
    }
    pagina.drawLine({ start: { x: 420, y: 112 }, end: { x: 420, y: 514 }, thickness: 0.5, color: rgb(0.8, 0.84, 0.87) });

    if (folha.foto) {
      let imagem = imagens.get(folha.foto.id);
      if (!imagem) {
        try {
          imagem = folha.foto.tipo === "image/png"
            ? await saida.embedPng(folha.foto.bytes)
            : await saida.embedJpg(folha.foto.bytes);
        } catch {
          throw new Error(
            `Uma das fotos (página ${folha.pagina}) não pôde ser incluída no PDF porque a imagem está inválida. Troque essa foto e tente de novo.`,
          );
        }
        imagens.set(folha.foto.id, imagem);
      }
      const area = ajustar(imagem.width, imagem.height, AREA_FOTO);
      pagina.drawImage(imagem, { x: area.x, y: area.y, width: area.width, height: area.height });
      const legenda = folha.foto.legenda?.trim();
      if (legenda) {
        const linhas = limitarLinhas(quebrarTexto(limpar(legenda), 374, t => fonte.widthOfTextAtSize(t, 10)), MAX_LINHAS_LEGENDA);
        linhas.forEach((linha, n) => pagina.drawText(linha, { x: 434, y: 94 - n * 12, size: 10, font: fonte, color: TINTA }));
      }
    } else {
      pagina.drawText("Sem foto anexada para esta página.", { x: 455, y: 315, size: 11, font: fonte, color: SUAVE });
    }

    pagina.drawText(`Termo ${dados.nrTermo} | Situação: ${rotuloSituacao(dados.situacao)} | Gerado em ${dataGeracao}`, { x: 34, y: 26, size: 9, font: fonte, color: SUAVE });
    pagina.drawText(String(numeroFolha), { x: 798, y: 26, size: 9, font: fonte, color: SUAVE });
  }

  return saida.save();
}
