/**
 * Conversor de arquivos (estilo ILovePDF): operações com PDF feitas no aparelho com o pdf-lib, sem enviar nada ao
 * servidor. Tudo aqui roda também em node (testes).
 */
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export const A4 = { largura: 595.28, altura: 841.89 };

const abrir = (bytes: Uint8Array) => PDFDocument.load(bytes, { ignoreEncryption: true });

/** "1-3, 5, 8-" (8 até o fim) e "todas" → páginas (1…total), na ordem escrita, sem repetir. Erro explica o que corrigir. */
export function lerIntervalos(texto: string, total: number): { paginas: number[] } | { erro: string } {
  const t = texto.trim().toLowerCase();
  if (!t || t === "todas") return { paginas: Array.from({ length: total }, (_, i) => i + 1) };
  const paginas: number[] = [];
  for (const parte of t.split(/[,;]\s*|\s+/).filter(Boolean)) {
    const m = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(parte);
    if (!m || (!m[1] && !m[3])) return { erro: `“${parte}” não é uma página nem um intervalo (ex.: 1-3, 5, 8-).` };
    const ini = m[1] ? Number(m[1]) : 1;
    const fim = m[2] ? (m[3] ? Number(m[3]) : total) : ini;
    if (ini < 1 || fim < 1 || ini > total || fim > total) return { erro: `O PDF tem ${total} página${total === 1 ? "" : "s"}; “${parte}” passa disso.` };
    const passo = ini <= fim ? 1 : -1;
    for (let p = ini; passo > 0 ? p <= fim : p >= fim; p += passo) if (!paginas.includes(p)) paginas.push(p);
  }
  return paginas.length ? { paginas } : { erro: "Escolha pelo menos uma página." };
}

export async function contarPaginas(bytes: Uint8Array): Promise<number> {
  return (await abrir(bytes)).getPageCount();
}

/** Junta os PDFs na ordem da lista. */
export async function juntarPdfs(arquivos: Uint8Array[]): Promise<Uint8Array> {
  const saida = await PDFDocument.create();
  for (const bytes of arquivos) {
    const doc = await abrir(bytes);
    for (const p of await saida.copyPages(doc, doc.getPageIndices())) saida.addPage(p);
  }
  return saida.save();
}

/** Um PDF com as páginas escolhidas (1…n), na ordem dada. */
export async function extrairPaginas(bytes: Uint8Array, paginas: number[]): Promise<Uint8Array> {
  const doc = await abrir(bytes);
  const saida = await PDFDocument.create();
  for (const p of await saida.copyPages(doc, paginas.map(n => n - 1))) saida.addPage(p);
  return saida.save();
}

export interface PaginaOrganizada { pagina: number; giro: number }

/** Reordena, gira (múltiplos de 90°, somados ao giro que a página já tem) e tira páginas (as que não estão na lista). */
export async function organizarPdf(bytes: Uint8Array, ordem: PaginaOrganizada[]): Promise<Uint8Array> {
  const doc = await abrir(bytes);
  const saida = await PDFDocument.create();
  const copias = await saida.copyPages(doc, ordem.map(o => o.pagina - 1));
  copias.forEach((p, i) => {
    const giro = (((p.getRotation().angle + ordem[i].giro) % 360) + 360) % 360;
    p.setRotation(degrees(giro));
    saida.addPage(p);
  });
  return saida.save();
}

export type PosicaoNumero = "rodape-centro" | "rodape-direita" | "topo-direita";

/** Numera as páginas ("1", "1 de 10" ou "Página 1"), a partir de `inicio`. */
export async function numerarPaginas(bytes: Uint8Array, opcoes: { posicao: PosicaoNumero; inicio: number; formato: "n" | "n-de-t" | "pagina-n" }): Promise<Uint8Array> {
  const doc = await abrir(bytes);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const paginas = doc.getPages();
  paginas.forEach((pg, i) => {
    const n = opcoes.inicio + i;
    const total = opcoes.inicio + paginas.length - 1;
    const texto = opcoes.formato === "n-de-t" ? `${n} de ${total}` : opcoes.formato === "pagina-n" ? `Página ${n}` : String(n);
    const { width, height } = pg.getSize();
    const tamanho = Math.max(8, Math.min(14, width / 50));
    const larguraTexto = fonte.widthOfTextAtSize(texto, tamanho);
    const margem = Math.max(18, width * 0.04);
    const x = opcoes.posicao === "rodape-centro" ? (width - larguraTexto) / 2 : width - margem - larguraTexto;
    const y = opcoes.posicao === "topo-direita" ? height - margem - tamanho : margem;
    pg.drawText(texto, { x, y, size: tamanho, font: fonte, color: rgb(0.2, 0.2, 0.2) });
  });
  return doc.save();
}

/** Texto em diagonal no meio de cada página, translúcido. Sem acentos fora do Latin-1 (fonte padrão do PDF). */
export async function marcaDagua(bytes: Uint8Array, texto: string, opacidade = 0.18): Promise<Uint8Array> {
  const doc = await abrir(bytes);
  const fonte = await doc.embedFont(StandardFonts.HelveticaBold);
  const limpo = texto.replace(/[^ -ÿ]/g, "").slice(0, 60) || "CONFIDENCIAL";
  for (const pg of doc.getPages()) {
    const { width, height } = pg.getSize();
    const diagonal = Math.hypot(width, height);
    const tamanho = Math.min(120, (diagonal * 0.7) / Math.max(4, limpo.length) * 1.6);
    const largura = fonte.widthOfTextAtSize(limpo, tamanho);
    const angulo = Math.atan2(height, width);
    // Centro da página, girando o texto em volta do próprio meio.
    const x = width / 2 - (Math.cos(angulo) * largura) / 2 + (Math.sin(angulo) * tamanho) / 3;
    const y = height / 2 - (Math.sin(angulo) * largura) / 2 - (Math.cos(angulo) * tamanho) / 3;
    pg.drawText(limpo, { x, y, size: tamanho, font: fonte, color: rgb(0.85, 0.1, 0.1), opacity: opacidade, rotate: degrees((angulo * 180) / Math.PI) });
  }
  return doc.save();
}

export interface ImagemParaPdf { bytes: Uint8Array; tipo: "jpg" | "png"; largura: number; altura: number }

/**
 * Uma imagem por página. "a4": a imagem cabe numa A4 (deitada se a imagem for mais larga), com margem; "original":
 * a página tem o tamanho da imagem (a 96 dpi).
 */
export async function imagensParaPdf(imagens: ImagemParaPdf[], modo: "a4" | "original", margem = 24): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const im of imagens) {
    const img = im.tipo === "png" ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
    if (modo === "original") {
      const w = im.largura * 0.75, h = im.altura * 0.75;
      doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
      continue;
    }
    const deitada = im.largura > im.altura;
    const [pw, ph] = deitada ? [A4.altura, A4.largura] : [A4.largura, A4.altura];
    const escala = Math.min((pw - 2 * margem) / im.largura, (ph - 2 * margem) / im.altura);
    const w = im.largura * escala, h = im.altura * escala;
    doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return doc.save();
}

/** Tamanho legível: 0,8 MB, 120 KB. */
export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`;
}

/** Nome do resultado: "relatorio.pdf" + "comprimido" → "relatorio-comprimido.pdf". */
export function nomeResultado(original: string, sufixo: string, extensao: string): string {
  const base = original.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "arquivo";
  return `${base}${sufixo ? `-${sufixo}` : ""}.${extensao}`;
}
