/**
 * Repertório v12 — desenha a imagem da cifra (PNG) a partir do plano: faixa colorida com o título, o artista e o tom;
 * a cifra em fonte de largura fixa (os acordes ficam em cima da sílaba certa), os acordes em laranja, as seções
 * em etiquetas; e o rodapé do NordTool. Também baixa ou abre o compartilhar do aparelho.
 */
import { MEDIDAS, alturaItem, nomeDaImagem, planoDaImagem, type ItemImagem } from "@/react-app/utils/musica/imagemCifra";

export interface InfoCifra { titulo: string; artista: string; tom: string | null; texto: string }

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function arredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Corta o texto com reticências para caber na largura. */
function caber(ctx: CanvasRenderingContext2D, texto: string, largura: number): string {
  if (ctx.measureText(texto).width <= largura) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) t = t.slice(0, -1);
  return `${t}…`;
}

function desenharItem(ctx: CanvasRenderingContext2D, it: ItemImagem, x: number, y: number, fonte: number, letraL: number) {
  const linha = alturaItem(it.tipo) * fonte;
  if (it.tipo === "espaco") return linha;
  if (it.tipo === "secao") {
    ctx.font = `700 ${Math.round(fonte * 0.8)}px ${SANS}`;
    const w = ctx.measureText(it.texto).width + fonte * 1.1;
    ctx.fillStyle = "#fff7ed";
    arredondado(ctx, x, y + fonte * 0.35, w, fonte * 1.25, fonte * 0.6);
    ctx.fill();
    ctx.fillStyle = "#c2410c";
    ctx.textBaseline = "middle";
    ctx.fillText(it.texto, x + fonte * 0.55, y + fonte * 0.98);
    if (it.resto) {
      ctx.font = `700 ${fonte}px ${MONO}`;
      ctx.fillStyle = "#ea580c";
      ctx.fillText(it.resto, x + w + fonte * 0.6, y + fonte * 0.98);
    }
    ctx.textBaseline = "alphabetic";
    return linha;
  }
  if (it.tipo === "acordes") {
    ctx.font = `700 ${fonte}px ${MONO}`;
    ctx.fillStyle = "#ea580c";
    // cada acorde na coluna dele (a fonte é de largura fixa: coluna × largura de uma letra)
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(it.texto))) ctx.fillText(m[0], x + m.index * letraL, y + fonte);
    return linha;
  }
  ctx.font = `400 ${fonte}px ${MONO}`;
  ctx.fillStyle = "#1e293b";
  ctx.fillText(it.texto, x, y + fonte * 1.05);
  return linha;
}

/** A imagem da cifra num canvas. */
export function desenharCifra(info: InfoCifra, agora = new Date()): HTMLCanvasElement {
  const plano = planoDaImagem(info.texto);
  const { margem, cabecalho, entreColunas } = MEDIDAS;
  const c = document.createElement("canvas");
  c.width = plano.largura;
  c.height = plano.altura;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  // fundo e faixa do título
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  const g = ctx.createLinearGradient(0, 0, c.width, cabecalho);
  g.addColorStop(0, "#fb923c");
  g.addColorStop(1, "#dc2626");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, cabecalho - 40);
  // notas musicais de enfeite
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.font = `700 84px ${SANS}`;
  ctx.fillText("♫", c.width - 250, 196);
  ctx.font = `700 64px ${SANS}`;
  ctx.fillText("♪", c.width - 140, 192);

  const larguraTitulo = c.width - 2 * margem - (info.tom ? 220 : 0);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 58px ${SANS}`;
  ctx.fillText(caber(ctx, info.titulo || "Música", larguraTitulo), margem, 105);
  if (info.artista) {
    ctx.font = `500 32px ${SANS}`;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(caber(ctx, info.artista, larguraTitulo), margem, 155);
  }
  if (info.tom) {
    ctx.font = `800 34px ${SANS}`;
    const rot = `Tom: ${info.tom}`;
    const w = ctx.measureText(rot).width + 44;
    ctx.fillStyle = "#ffffff";
    arredondado(ctx, c.width - margem - w, 70, w, 62, 31);
    ctx.fill();
    ctx.fillStyle = "#c2410c";
    ctx.fillText(rot, c.width - margem - w + 22, 113);
  }

  // a cifra
  ctx.font = `400 ${plano.fonte}px ${MONO}`;
  const letraL = ctx.measureText("M").width;
  plano.colunas.forEach((col, k) => {
    const x = margem + k * (plano.larguraColuna + entreColunas);
    let y = cabecalho;
    for (const it of col) y += desenharItem(ctx, it, x, y, plano.fonte, letraL);
  });
  if (plano.colunas.length > 1) {
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.width / 2, cabecalho);
    ctx.lineTo(c.width / 2, c.height - 110);
    ctx.stroke();
  }

  // rodapé
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, c.height - 80, c.width, 80);
  ctx.font = `600 24px ${SANS}`;
  ctx.fillStyle = "#64748b";
  ctx.fillText("NordTool · Repertório", margem, c.height - 32);
  const data = agora.toLocaleDateString("pt-BR");
  ctx.fillText(data, c.width - margem - ctx.measureText(data).width, c.height - 32);
  return c;
}

export const pngDaCifra = (info: InfoCifra): Promise<Blob> =>
  new Promise((ok, erro) => desenharCifra(info).toBlob(b => (b ? ok(b) : erro(new Error("Não deu para gerar a imagem."))), "image/png"));

/** Baixa o PNG. */
export function baixarImagem(blob: Blob, titulo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeDaImagem(titulo);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** O aparelho sabe compartilhar arquivos (celular: WhatsApp, Instagram…)? */
export function podeCompartilharArquivo(): boolean {
  try {
    const f = new File([new Uint8Array(1)], "x.png", { type: "image/png" });
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

/** Abre o compartilhar do aparelho com a imagem; devolve false se a pessoa cancelou ou não deu. */
export async function compartilharImagem(blob: Blob, titulo: string): Promise<boolean> {
  const arquivo = new File([blob], nomeDaImagem(titulo), { type: "image/png" });
  try {
    await navigator.share({ files: [arquivo], title: titulo });
    return true;
  } catch {
    return false;
  }
}
