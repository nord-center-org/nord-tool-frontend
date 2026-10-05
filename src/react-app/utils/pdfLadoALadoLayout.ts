/** Layout puro do PDF "lado a lado" (A4 paisagem). Sem dependências: testável em node. */

export const PAGINA_A4_PAISAGEM = { largura: 841.89, altura: 595.28 } as const;

export interface Area { x: number; y: number; w: number; h: number }

/** Termo à esquerda, foto à direita; margem de 34 pt e divisória em x = 420. */
export const AREA_TERMO: Area = { x: 34, y: 112, w: 374, h: 402 };
export const AREA_FOTO: Area = { x: 434, y: 112, w: 374, h: 402 };
export const MAX_LINHAS_LEGENDA = 5;
export const LIMITE_AVISO_BYTES = 20 * 1024 * 1024; // limite comum de e-mail

export interface Ajuste { x: number; y: number; width: number; height: number; scale: number }

/** Encaixa (width × height) dentro da área, centralizado e sem distorcer. */
export function ajustar(width: number, height: number, area: Area): Ajuste {
  const scale = Math.min(area.w / width, area.h / height);
  return {
    x: area.x + (area.w - width * scale) / 2,
    y: area.y + (area.h - height * scale) / 2,
    width: width * scale,
    height: height * scale,
    scale,
  };
}

/** Ângulo (graus) aplicado ao desenhar a página para anular a rotação gravada nela. */
export function anguloDeDesenho(rotacaoDaPagina: number): number {
  return (360 - (rotacaoDaPagina % 360)) % 360;
}

export function ehRetrato90(angulo: number): boolean {
  return angulo === 90 || angulo === 270;
}

/** Ponto de ancoragem de `drawPage` quando a página é girada em torno da origem. */
export function origemPaginaGirada(angulo: number, area: { x: number; y: number; width: number; height: number }) {
  return {
    x: area.x + (angulo === 90 || angulo === 180 ? area.width : 0),
    y: area.y + (angulo === 180 || angulo === 270 ? area.height : 0),
  };
}

export interface ItemDeFoto { pagina: number; ordem: number; id: number }

export interface Folha<T extends ItemDeFoto> {
  pagina: number;
  foto: T | null;
  /** posição da foto entre as da mesma página (1..total); 0 quando não há foto. */
  numeroDaFoto: number;
  fotosNaPagina: number;
}

/**
 * Uma folha por foto, repetindo a página do termo à esquerda quando há várias fotos na mesma página.
 * Página sem foto vira uma folha "sem foto" (ou é omitida se `incluirPaginasSemFoto` for falso).
 */
export function montarFolhas<T extends ItemDeFoto>(
  totalPaginas: number,
  fotos: T[],
  incluirPaginasSemFoto: boolean,
): Folha<T>[] {
  const folhas: Folha<T>[] = [];
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    const daPagina = fotos
      .filter(f => f.pagina === pagina)
      .sort((a, b) => a.ordem - b.ordem || a.id - b.id);
    if (daPagina.length === 0) {
      if (incluirPaginasSemFoto) folhas.push({ pagina, foto: null, numeroDaFoto: 0, fotosNaPagina: 0 });
      continue;
    }
    daPagina.forEach((foto, i) => folhas.push({ pagina, foto, numeroDaFoto: i + 1, fotosNaPagina: daPagina.length }));
  }
  return folhas;
}

/** Quebra o texto em linhas de no máximo `largura`, respeitando \n e partindo palavras maiores que a linha. */
export function quebrarTexto(texto: string, largura: number, medir: (t: string) => number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let linha = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      if (medir(`${linha} ${palavra}`) > largura && linha) {
        linhas.push(linha);
        linha = "";
      }
      if (medir(palavra) > largura) {
        for (const caractere of palavra) {
          if (medir(linha + caractere) > largura && linha) {
            linhas.push(linha);
            linha = "";
          }
          linha += caractere;
        }
      } else {
        linha += (linha ? " " : "") + palavra;
      }
    }
    linhas.push(linha);
  }
  return linhas;
}

/** Limita a quantidade de linhas, sinalizando o corte com reticências. */
export function limitarLinhas(linhas: string[], max = MAX_LINHAS_LEGENDA): string[] {
  if (linhas.length <= max) return linhas;
  const cortadas = linhas.slice(0, max);
  cortadas[max - 1] = `${cortadas[max - 1].replace(/\s+$/, "")}...`;
  return cortadas;
}

/** Estimativa do PDF final: o termo + as fotos + um pequeno custo por folha. */
export function estimarTamanho(bytesPdf: number, bytesFotos: number[], nrFolhas: number): number {
  return bytesPdf + bytesFotos.reduce((a, b) => a + b, 0) + nrFolhas * 3000;
}

export function excedeLimiteEmail(bytes: number): boolean {
  return bytes > LIMITE_AVISO_BYTES;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function nomeArquivoRelatorio(codigoSeguro: string, nrTermo: number): string {
  return `${codigoSeguro || "apartamento"}-termo-${nrTermo}.pdf`;
}
