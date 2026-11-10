/** Documento de texto do caderno (v2): limpeza do HTML e páginas A4 para o PDF. Precisa do navegador (DOM). */
import { toCanvas } from "html-to-image";

import { PAGINA_DOCUMENTO, TAGS_DOCUMENTO, filtrarEstilo } from "@/react-app/utils/blocoNotas";
import { FONTE_TEXTO } from "@/react-app/components/bloco/desenho";

/**
 * Deixa no HTML só o que é formatação de texto: tags da lista, `style` filtrado e, no <font>, cor e tamanho (1 a 7).
 * Scripts, links, imagens, eventos e qualquer outra coisa saem (o texto de dentro fica).
 */
const EXTRAS = new Set(["TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "IMG"]);
const ESTILO_EXTRA: Record<string, string> = {
  TABLE: "border-collapse:collapse;width:100%;font-size:11px;margin:6px 0",
  TH: "border:1px solid #94a3b8;padding:2px 4px;background:#f1f5f9;font-weight:700;text-align:left",
  TD: "border:1px solid #cbd5e1;padding:2px 4px;vertical-align:top",
  IMG: "max-width:100%;height:auto",
};

/**
 * `extras` (só para desenhar a página de um arquivo importado, nunca para o documento guardado) aceita também tabelas
 * e imagens embutidas no próprio arquivo (data:image).
 */
export function sanitizarHtml(html: string, extras = false): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const limpar = (no: Node, destino: Node) => {
    no.childNodes.forEach(filho => {
      if (filho.nodeType === Node.TEXT_NODE) { destino.appendChild(document.createTextNode(filho.textContent ?? "")); return; }
      if (filho.nodeType !== Node.ELEMENT_NODE) return;
      const el = filho as Element;
      const nome = el.tagName.toUpperCase();
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "TEMPLATE", "NOSCRIPT", "HEAD", "TITLE", "META", "LINK"].includes(nome)) return;
      const extra = extras && EXTRAS.has(nome);
      if (!TAGS_DOCUMENTO.has(nome) && !extra) { limpar(el, destino); return; }
      if (nome === "IMG" && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(el.getAttribute("src") ?? "")) return;
      const novo = document.createElement(nome.toLowerCase());
      const estilo = [extra ? ESTILO_EXTRA[nome] : "", filtrarEstilo(el.getAttribute("style") ?? "")].filter(Boolean).join(";");
      if (estilo) novo.setAttribute("style", estilo);
      if (nome === "IMG") novo.setAttribute("src", el.getAttribute("src") ?? "");
      if ((nome === "TD" || nome === "TH") && /^\d{1,2}$/.test(el.getAttribute("colspan") ?? "")) novo.setAttribute("colspan", el.getAttribute("colspan")!);
      if (nome === "FONT") {
        const cor = el.getAttribute("color");
        if (cor && /^#[0-9a-f]{3,6}$/i.test(cor)) novo.setAttribute("color", cor);
        const tam = el.getAttribute("size");
        if (tam && /^[1-7]$/.test(tam)) novo.setAttribute("size", tam);
      }
      destino.appendChild(novo);
      limpar(el, novo);
    });
  };
  const saida = document.createElement("div");
  limpar(doc.body.firstChild ?? doc.body, saida);
  return saida.innerHTML;
}

/** Estilo das páginas do documento (o mesmo na tela e no PDF). */
export const ESTILO_DOCUMENTO = `font-family:${FONTE_TEXTO};font-size:16px;line-height:1.55;color:#111827;word-wrap:break-word;`;

/**
 * Quebra o documento em páginas A4 (bloco por bloco: parágrafo, título, lista…; um bloco maior que a página vai
 * inteiro e é cortado) e devolve cada página como canvas, para o PDF do caderno.
 */
export async function paginasDoDocumento(html: string, escala = 2, extras = false): Promise<HTMLCanvasElement[]> {
  const { largura, altura, margem } = PAGINA_DOCUMENTO;
  const util = altura - 2 * margem;
  const palco = document.createElement("div");
  palco.style.cssText = "position:fixed;left:-30000px;top:0;";
  document.body.appendChild(palco);
  const novaPagina = () => {
    const p = document.createElement("div");
    p.style.cssText = `width:${largura}px;height:${altura}px;padding:${margem}px;box-sizing:border-box;background:#fff;overflow:hidden;${ESTILO_DOCUMENTO}`;
    palco.appendChild(p);
    return p;
  };
  try {
    const fonte = document.createElement("div");
    fonte.innerHTML = sanitizarHtml(html, extras);
    // As imagens embutidas precisam carregar antes de medir as páginas.
    await Promise.all(Array.from(fonte.querySelectorAll("img")).map(img => (img.complete ? null : new Promise(ok => { img.onload = ok; img.onerror = ok; }))));
    const blocos = Array.from(fonte.childNodes);
    const paginas: HTMLDivElement[] = [];
    let atual = novaPagina();
    paginas.push(atual);
    for (const b of blocos) {
      atual.appendChild(b);
      if (atual.scrollHeight - 2 * margem > util && atual.childNodes.length > 1) {
        atual.removeChild(b);
        atual = novaPagina();
        paginas.push(atual);
        atual.appendChild(b);
      }
    }
    const canvases: HTMLCanvasElement[] = [];
    for (const p of paginas) canvases.push(await toCanvas(p, { pixelRatio: escala, width: largura, height: altura, backgroundColor: "#ffffff" }));
    return canvases;
  } finally {
    palco.remove();
  }
}
