/** Lê a prancha (PDF) no navegador: texto de todas as páginas e a página escolhida desenhada para achar a torre. */
import { lerPdf } from "./pdfTermo";
import { lerPavimentosDoTexto, type PavimentosLidos } from "./escadinha";
import { detectarCelulas, detectarContorno, luminancia, type ContornoDetectado } from "./escadinhaPlanta";
import type { Ponto } from "./escadinha";

/** Largura (px) em que a página é desenhada para a detecção. */
const LARGURA_ANALISE = 1400;
/** Largura (px) da imagem da prancha guardada para a planta 2D. */
const LARGURA_IMAGEM = 1000;

export interface ProjetoAnalisado {
  arquivo: string;
  pavimentos: PavimentosLidos;
  paginas: number;
  pagina: number;
  /** Página desenhada (JPEG) para conferir e para o fundo da planta 2D. */
  imagem: string;
  largura: number;
  altura: number;
  /** Luminância da página, para refazer a detecção com recorte sem ler o PDF de novo. */
  lum: Uint8Array;
  deteccao: ContornoDetectado | null;
  /** Células fechadas dentro da torre (px), candidatas a apartamento. */
  celulas: Ponto[][];
  /** Textos da página escolhida com a posição (px), para nomear apartamentos e achar a junta. */
  textos: { texto: string; p: Ponto }[];
}

/** Página mais provável da planta da torre: a que fala em planta chave/tipo; senão a primeira. */
function escolherPagina(textos: string[]): number {
  const nota = (t: string) => (/PLANTA\s+CHAVE/i.test(t) ? 3 : 0) + (/PAV(\.|IMENTO)?\s*TIPO/i.test(t) ? 2 : 0) + (/PLANTA/i.test(t) ? 1 : 0);
  let melhor = 0;
  textos.forEach((t, i) => { if (nota(t) > nota(textos[melhor])) melhor = i; });
  return melhor + 1;
}

export async function analisarProjeto(arquivo: File, paginaEscolhida?: number): Promise<ProjetoAnalisado> {
  const { documento, nrPaginas } = await lerPdf(arquivo);
  try {
    const textos: string[] = [];
    for (let i = 1; i <= Math.min(nrPaginas, 30); i++) {
      const pagina = await documento.getPage(i);
      const conteudo = await pagina.getTextContent();
      textos.push(conteudo.items.map(item => ("str" in item ? item.str : "")).join(" "));
    }
    const numero = Math.min(nrPaginas, Math.max(1, paginaEscolhida ?? escolherPagina(textos)));
    const pagina = await documento.getPage(numero);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: LARGURA_ANALISE / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("O navegador não conseguiu desenhar a prancha.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport, canvas }).promise;

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lum = luminancia(data, canvas.width, canvas.height);
    const deteccao = detectarContorno(lum, canvas.width, canvas.height);
    const celulas = deteccao ? detectarCelulas(lum, canvas.width, canvas.height, deteccao.contorno) : [];
    const conteudo = await pagina.getTextContent();
    const pdfjs = await import("pdfjs-dist");
    const textosPagina = conteudo.items.flatMap(item => {
      if (!("str" in item) || !item.str.trim()) return [];
      const m = pdfjs.Util.transform(viewport.transform, item.transform);
      return [{ texto: item.str.trim(), p: [m[4] + (item.width * viewport.scale) / 2, m[5] - 4] as Ponto }];
    });

    const menor = document.createElement("canvas");
    const fator = Math.min(1, LARGURA_IMAGEM / canvas.width);
    menor.width = Math.round(canvas.width * fator);
    menor.height = Math.round(canvas.height * fator);
    menor.getContext("2d")?.drawImage(canvas, 0, 0, menor.width, menor.height);

    return {
      arquivo: arquivo.name,
      pavimentos: lerPavimentosDoTexto(textos.join("\n")),
      paginas: nrPaginas,
      pagina: numero,
      imagem: menor.toDataURL("image/jpeg", 0.78),
      largura: canvas.width,
      altura: canvas.height,
      lum,
      deteccao,
      celulas,
      textos: textosPagina,
    };
  } finally {
    await documento.destroy();
  }
}
