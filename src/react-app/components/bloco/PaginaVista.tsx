import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PE } from "react";
import { Copy, Loader2, Trash2 } from "lucide-react";

import EditorCaixaTexto, { type EditorCaixaTextoApi } from "@/react-app/components/bloco/EditorCaixaTexto";
import { desenharItem, desenharPagina, desenharPapel, desenharTraco, type ImagensCarregadas } from "@/react-app/components/bloco/desenho";
import { desenharPaginaPdf } from "@/react-app/components/bloco/pdfOriginal";
import { fundoDaPagina, imagemDoBloco } from "@/react-app/components/bloco/imagensBloco";
import type { PaginaBloco } from "@/react-app/services/BlocoNotasService";
import {
  acrescentarPonto, apagarItens, apagarParcial, caixaDoItem, CORES, dentroDaCaixa, duplicarItens, escalarItens,
  formaDoArrasto, itemNoPonto, itensNoLaco, moverItens, novoId, pintarItens, pressao, uniaoCaixas,
  type Item, type Ponto, type Texto, type TipoForma,
} from "@/react-app/utils/blocoNotas";

/** "nenhuma" (v2): lápis solto — o toque só rola a página e nada é desenhado. */
export type Ferramenta = "caneta" | "marca" | "borracha" | "forma" | "texto" | "laco" | "mao" | "nenhuma";

export interface ConfigFerramenta {
  ferramenta: Ferramenta;
  cor: string;
  espessura: number;
  corMarca: string;
  espessuraMarca: number;
  borracha: "traco" | "parcial";
  raioBorracha: number;
  forma: TipoForma;
  tamanhoTexto: number;
  /** Só a caneta (stylus) desenha; o dedo rola a página. */
  soCaneta: boolean;
}

interface Props {
  pagina: PaginaBloco;
  numero: number;
  itens: Item[] | null;
  /** px da tela por px da página. */
  zoom: number;
  config: ConfigFerramenta;
  selecao: Set<string>;
  onItens: (novos: Item[]) => void;
  onSelecao: (ids: Set<string>) => void;
  onCarregar: () => void;
  onVisivel: (fracao: number) => void;
}

/** Lado máximo do canvas em px reais (acima disso o navegador estica, sem pesar a memória). */
const LADO_MAX_CANVAS = 4096;

type Gesto =
  | { tipo: "traco"; item: Item & { t: "tr" } }
  | { tipo: "borracha"; inicio: Item[]; atual: Item[] }
  | { tipo: "forma"; inicio: Ponto; fim: Ponto; reta: boolean }
  | { tipo: "laco"; pontos: Ponto[] }
  | { tipo: "mover"; inicio: Item[]; de: Ponto; atual: Item[] }
  | { tipo: "escalar"; inicio: Item[]; origem: Ponto; largura0: number; atual: Item[] };

/** Uma página do caderno: o desenho salvo num canvas e o gesto em andamento noutro, por cima. */
export default function PaginaVista({ pagina, numero, itens, zoom, config, selecao, onItens, onSelecao, onCarregar, onVisivel }: Props) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const topoRef = useRef<HTMLCanvasElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const [trabalho, setTrabalho] = useState<Item[] | null>(null);
  const [imagens, setImagens] = useState<ImagensCarregadas>(() => new Map());
  const [fundo, setFundo] = useState<ImageBitmap | null>(null);
  const [texto, setTexto] = useState<Texto | null>(null);
  const editorTexto = useRef<EditorCaixaTextoApi>(null);
  const [cursor, setCursor] = useState<Ponto | null>(null);

  const largura = pagina.nrLargura * zoom, altura = pagina.nrAltura * zoom;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const resolucao = Math.min(dpr * zoom, LADO_MAX_CANVAS / Math.max(pagina.nrLargura, pagina.nrAltura));
  const giro = pagina.nrRotacao ?? 0;
  /** v2: a página desenhada do PDF original na resolução da tela (null enquanto não há PDF ou ele carrega). */
  const [fundoPdf, setFundoPdf] = useState<HTMLCanvasElement | null>(null);
  const detalheRef = useRef<HTMLCanvasElement>(null);
  const [detalhe, setDetalhe] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const exibidos = trabalho ?? itens;

  // Carrega quando chega perto da tela; conta quanto dela está visível (para saber a página atual).
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entradas => {
      for (const e of entradas) {
        if (e.isIntersecting && itens === null) onCarregar();
        onVisivel(e.isIntersecting ? e.intersectionRatio : 0);
      }
    }, { rootMargin: "600px 0px", threshold: [0, 0.25, 0.5, 0.75, 1] });
    obs.observe(el);
    return () => obs.disconnect();
  }, [itens, onCarregar, onVisivel]);

  // Fundo do PDF e imagens coladas.
  useEffect(() => {
    let vivo = true;
    if (pagina.inFundo) void fundoDaPagina(pagina.id).then(b => { if (vivo) setFundo(b); });
    return () => { vivo = false; };
  }, [pagina.id, pagina.inFundo]);
  useEffect(() => {
    let vivo = true;
    const faltam = [...new Set((exibidos ?? []).filter(i => i.t === "im").map(i => (i as { img: number }).img))].filter(id => !imagens.has(id));
    for (const id of faltam) {
      void imagemDoBloco(id).then(b => { if (vivo && b) setImagens(m => new Map(m).set(id, b)); });
    }
    return () => { vivo = false; };
  }, [exibidos, imagens]);

  // v2: fundo vindo do PDF original, na resolução do canvas (refeito quando o zoom para de mudar).
  useEffect(() => {
    if (!pagina.idPdf || !pagina.nrPaginaPdf) { setFundoPdf(null); return; }
    const sinal = { cancelado: false };
    const t = window.setTimeout(() => {
      const c = document.createElement("canvas");
      void desenharPaginaPdf(c, pagina.idPdf!, pagina.nrPaginaPdf!, giro, pagina.nrLargura,
        { x: 0, y: 0, w: pagina.nrLargura, h: pagina.nrAltura, escala: resolucao }, sinal)
        .then(ok => { if (ok && !sinal.cancelado) setFundoPdf(c); });
    }, 150);
    return () => { sinal.cancelado = true; window.clearTimeout(t); };
  }, [pagina.idPdf, pagina.nrPaginaPdf, pagina.nrLargura, pagina.nrAltura, giro, resolucao]);

  /**
   * v2: zoom maior que o canvas inteiro aguenta — redesenha só o pedaço visível da página na resolução da tela (PDF
   * vetorial e desenho), como os leitores de PDF. Refaz ao rolar, ao mudar o zoom e quando o desenho muda.
   */
  useEffect(() => {
    const precisa = dpr * zoom > resolucao * 1.05;
    const rolagem = caixaRef.current?.closest("[data-rolagem]") as HTMLElement | null;
    if (!precisa || !rolagem || !exibidos) { setDetalhe(null); return; }
    let sinal = { cancelado: false };
    let t = 0;
    const refazer = () => {
      sinal.cancelado = true;
      sinal = { cancelado: false };
      const meu = sinal;
      window.clearTimeout(t);
      t = window.setTimeout(async () => {
        const el = caixaRef.current, c = detalheRef.current;
        if (!el || !c) return;
        const r = el.getBoundingClientRect(), v = rolagem.getBoundingClientRect();
        const x0 = Math.max(r.left, v.left), y0 = Math.max(r.top, v.top), x1 = Math.min(r.right, v.right), y1 = Math.min(r.bottom, v.bottom);
        if (x1 <= x0 || y1 <= y0) { setDetalhe(null); return; }
        const reg = { x: (x0 - r.left) / zoom, y: (y0 - r.top) / zoom, w: (x1 - x0) / zoom, h: (y1 - y0) / zoom };
        const escala = dpr * zoom;
        const tela = document.createElement("canvas");
        if (pagina.idPdf && pagina.nrPaginaPdf) {
          if (!await desenharPaginaPdf(tela, pagina.idPdf, pagina.nrPaginaPdf, giro, pagina.nrLargura, { ...reg, escala }, meu)) return;
        } else {
          tela.width = Math.round(reg.w * escala);
          tela.height = Math.round(reg.h * escala);
          const cx = tela.getContext("2d")!;
          cx.setTransform(escala, 0, 0, escala, -reg.x * escala, -reg.y * escala);
          desenharPapel(cx, pagina.cdFundo, pagina.nrLargura, pagina.nrAltura, pagina.inFundo ? fundo : null, giro);
        }
        if (meu.cancelado) return;
        const ctx = tela.getContext("2d")!;
        ctx.setTransform(escala, 0, 0, escala, -reg.x * escala, -reg.y * escala);
        for (const i of exibidos) if (i.id !== texto?.id) desenharItem(ctx, i, imagens);
        c.width = tela.width;
        c.height = tela.height;
        c.getContext("2d")!.drawImage(tela, 0, 0);
        setDetalhe(reg);
      }, 140);
    };
    refazer();
    rolagem.addEventListener("scroll", refazer, { passive: true });
    window.addEventListener("resize", refazer);
    return () => { sinal.cancelado = true; window.clearTimeout(t); rolagem.removeEventListener("scroll", refazer); window.removeEventListener("resize", refazer); };
  }, [dpr, zoom, resolucao, exibidos, imagens, fundo, giro, texto?.id, pagina]);

  // Desenho salvo (e o que muda durante borracha/mover).
  useEffect(() => {
    const c = baseRef.current;
    if (!c) return;
    c.width = Math.round(pagina.nrLargura * resolucao);
    c.height = Math.round(pagina.nrAltura * resolucao);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // O texto em edição some do canvas (aparece na caixa de digitar).
    // Fundo: o PDF original (já girado pelo pdf.js) ou, enquanto ele não chega, a imagem de prévia.
    const pag = fundoPdf ? { ...pagina, nrRotacao: 0 } : pagina;
    desenharPagina(ctx, resolucao, pag, (exibidos ?? []).filter(i => i.id !== texto?.id), imagens, fundoPdf ?? (pagina.inFundo ? fundo : null));
  }, [pagina, resolucao, exibidos, imagens, fundo, fundoPdf, texto?.id]);

  const caixaSelecao = useMemo(() => {
    if (!selecao.size || !exibidos) return null;
    return uniaoCaixas(exibidos.filter(i => selecao.has(i.id)).map(caixaDoItem));
  }, [selecao, exibidos]);

  /** Camada de cima: gesto em andamento, cursor da borracha e a caixa da seleção. */
  const desenharTopo = useCallback(() => {
    const c = topoRef.current;
    if (!c) return;
    if (c.width !== Math.round(pagina.nrLargura * resolucao)) {
      c.width = Math.round(pagina.nrLargura * resolucao);
      c.height = Math.round(pagina.nrAltura * resolucao);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(resolucao, 0, 0, resolucao, 0, 0);
    const g = gesto.current;
    if (g?.tipo === "traco") desenharTraco(ctx, g.item);
    if (g?.tipo === "forma") desenharItem(ctx, formaDoArrasto(config.forma, config.cor, config.espessura, g.inicio, g.fim, g.reta), new Map());
    if (g?.tipo === "laco" && g.pontos.length > 1) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      g.pontos.forEach((p, n) => (n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }
    if (config.ferramenta === "borracha" && cursor) {
      ctx.save();
      ctx.strokeStyle = "rgba(100,116,139,0.9)";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, config.raioBorracha, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [pagina.nrLargura, pagina.nrAltura, resolucao, config, cursor, zoom]);
  useEffect(() => { desenharTopo(); }, [desenharTopo]);

  const ponto = (e: PE<HTMLCanvasElement>): Ponto => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * pagina.nrLargura, y: ((e.clientY - r.top) / r.height) * pagina.nrAltura };
  };

  /** Toque de dedo no modo "só caneta" (ou a ferramenta mão): deixa o navegador rolar. */
  const ignorar = (e: PE<HTMLCanvasElement>) => config.ferramenta === "mao" || config.ferramenta === "nenhuma" || (config.soCaneta && e.pointerType === "touch");

  const abrirTexto = (t: Texto) => {
    onSelecao(new Set());
    setTexto(t);
  };

  const fecharTexto = (t: Texto | null) => {
    setTexto(null);
    if (!t || !itens) return;
    const existe = itens.some(i => i.id === t.id);
    const vazio = !t.txt.trim();
    if (vazio) {
      if (existe) onItens(itens.filter(i => i.id !== t.id));
      return;
    }
    const antigo = itens.find(i => i.id === t.id) as Texto | undefined;
    if (antigo && JSON.stringify(antigo) === JSON.stringify(t)) return;
    onItens(existe ? itens.map(i => (i.id === t.id ? t : i)) : [...itens, t]);
  };

  const aoDescer = (e: PE<HTMLCanvasElement>) => {
    if (!itens || ignorar(e) || e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = ponto(e);
    const f = config.ferramenta;
    if (texto) { editorTexto.current?.terminar(); return; }
    if (f === "caneta" || f === "marca") {
      const marca = f === "marca";
      gesto.current = { tipo: "traco", item: { t: "tr", id: novoId(), c: marca ? config.corMarca : config.cor, w: marca ? config.espessuraMarca : config.espessura, ...(marca ? { marca: true } : {}), p: [p.x, p.y, pressao(e.pointerType, e.pressure)] } };
      onSelecao(new Set());
    } else if (f === "borracha") {
      const atual = config.borracha === "parcial" ? apagarParcial(itens, p.x, p.y, config.raioBorracha) : apagarItens(itens, p.x, p.y, config.raioBorracha);
      gesto.current = { tipo: "borracha", inicio: itens, atual };
      setTrabalho(atual);
    } else if (f === "forma") {
      gesto.current = { tipo: "forma", inicio: p, fim: p, reta: e.shiftKey };
    } else if (f === "texto") {
      const tocado = itemNoPonto(itens, p.x, p.y, 2);
      if (tocado?.t === "tx") abrirTexto(tocado);
      else abrirTexto({ t: "tx", id: novoId(), x: p.x, y: p.y - config.tamanhoTexto * 0.6, w: Math.min(360, pagina.nrLargura - p.x - 16), s: config.tamanhoTexto, c: config.cor, txt: "" });
    } else if (f === "laco") {
      const cx = caixaSelecao;
      const alca = cx ? Math.hypot(p.x - (cx.x + cx.w), p.y - (cx.y + cx.h)) <= 14 / zoom + 4 : false;
      if (cx && alca) gesto.current = { tipo: "escalar", inicio: itens, origem: { x: cx.x, y: cx.y }, largura0: Math.max(1, cx.w), atual: itens };
      else if (cx && dentroDaCaixa(p.x, p.y, cx, 6 / zoom)) gesto.current = { tipo: "mover", inicio: itens, de: p, atual: itens };
      else { onSelecao(new Set()); gesto.current = { tipo: "laco", pontos: [p] }; }
    }
    desenharTopo();
  };

  const aoMover = (e: PE<HTMLCanvasElement>) => {
    const p = ponto(e);
    if (config.ferramenta === "borracha" && !ignorar(e)) setCursor(p);
    const g = gesto.current;
    if (!g) return;
    e.preventDefault();
    if (g.tipo === "traco") {
      // Pontos que o navegador juntou entre um evento e outro (traço mais fiel com caneta).
      const eventos = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
      let pts = g.item.p;
      const r = e.currentTarget.getBoundingClientRect();
      for (const ev of eventos.length ? eventos : [e.nativeEvent]) {
        const x = ((ev.clientX - r.left) / r.width) * pagina.nrLargura, y = ((ev.clientY - r.top) / r.height) * pagina.nrAltura;
        pts = acrescentarPonto(pts, x, y, pressao(ev.pointerType, ev.pressure), 0.6 / zoom);
      }
      g.item = { ...g.item, p: pts };
    } else if (g.tipo === "borracha") {
      g.atual = config.borracha === "parcial" ? apagarParcial(g.atual, p.x, p.y, config.raioBorracha) : apagarItens(g.atual, p.x, p.y, config.raioBorracha);
      setTrabalho(g.atual);
    } else if (g.tipo === "forma") {
      g.fim = p;
      g.reta = e.shiftKey;
    } else if (g.tipo === "laco") {
      g.pontos.push(p);
    } else if (g.tipo === "mover") {
      g.atual = moverItens(g.inicio, selecao, p.x - g.de.x, p.y - g.de.y);
      setTrabalho(g.atual);
    } else if (g.tipo === "escalar") {
      g.atual = escalarItens(g.inicio, selecao, g.origem, (p.x - g.origem.x) / g.largura0);
      setTrabalho(g.atual);
    }
    desenharTopo();
  };

  const aoSubir = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || !itens) return;
    if (g.tipo === "traco") onItens([...itens, g.item]);
    else if (g.tipo === "borracha" || g.tipo === "mover" || g.tipo === "escalar") {
      setTrabalho(null);
      if (g.atual !== g.inicio) onItens(g.atual);
    } else if (g.tipo === "forma") {
      if (Math.hypot(g.fim.x - g.inicio.x, g.fim.y - g.inicio.y) > 3) onItens([...itens, formaDoArrasto(config.forma, config.cor, config.espessura, g.inicio, g.fim, g.reta)]);
    } else if (g.tipo === "laco") {
      const ids = itensNoLaco(itens, g.pontos);
      // Um toque sem arrastar seleciona o item embaixo do dedo.
      if (!ids.length && g.pontos.length < 4) {
        const tocado = itemNoPonto(itens, g.pontos[0].x, g.pontos[0].y, 6 / zoom);
        if (tocado) ids.push(tocado.id);
      }
      onSelecao(new Set(ids));
    }
    desenharTopo();
  };

  const acaoSelecao = (acao: "apagar" | "duplicar" | string) => {
    if (!itens) return;
    if (acao === "apagar") { onItens(itens.filter(i => !selecao.has(i.id))); onSelecao(new Set()); }
    else if (acao === "duplicar") { const d = duplicarItens(itens, selecao); onItens(d.itens); onSelecao(new Set(d.novos)); }
    else onItens(pintarItens(itens, selecao, acao));
  };

  const cursorCss = config.ferramenta === "nenhuma" ? "default" : config.ferramenta === "mao" ? "grab" : config.ferramenta === "texto" ? "text" : config.ferramenta === "laco" ? "default" : config.ferramenta === "borracha" ? "none" : "crosshair";

  return (
    <div ref={caixaRef} className="relative mx-auto shadow-md ring-1 ring-slate-300/70" style={{ width: largura, height: altura }}
      data-pagina={pagina.id} aria-label={`Página ${numero}`} role="group">
      <canvas ref={baseRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <canvas ref={detalheRef} aria-hidden="true" className="pointer-events-none absolute"
        style={detalhe ? { left: detalhe.x * zoom, top: detalhe.y * zoom, width: detalhe.w * zoom, height: detalhe.h * zoom } : { display: "none" }} />
      <canvas ref={topoRef} className="absolute inset-0 h-full w-full"
        style={{ touchAction: config.ferramenta === "mao" || config.ferramenta === "nenhuma" || config.soCaneta ? "pan-x pan-y" : "none", cursor: cursorCss }}
        onPointerDown={aoDescer} onPointerMove={aoMover} onPointerUp={aoSubir} onPointerCancel={aoSubir}
        onPointerLeave={() => setCursor(null)} aria-label={`Desenhar na página ${numero}`} />
      {itens === null && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Carregando página" /></div>
      )}
      {texto && (
        <EditorCaixaTexto ref={editorTexto} key={texto.id} texto={texto} zoom={zoom} larguraMaxima={Math.max(40, pagina.nrLargura - texto.x)} onFechar={fecharTexto} />
      )}
      {caixaSelecao && !trabalho && (
        <>
          <div className="pointer-events-none absolute border-2 border-dashed border-violet-500/80"
            style={{ left: caixaSelecao.x * zoom - 4, top: caixaSelecao.y * zoom - 4, width: caixaSelecao.w * zoom + 8, height: caixaSelecao.h * zoom + 8 }} />
          <div className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white bg-violet-600 shadow"
            style={{ left: (caixaSelecao.x + caixaSelecao.w) * zoom - 4, top: (caixaSelecao.y + caixaSelecao.h) * zoom - 4 }} aria-hidden="true" />
          <div className="absolute z-10 flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 shadow-lg"
            style={{ left: Math.max(0, caixaSelecao.x * zoom), top: Math.max(0, caixaSelecao.y * zoom - 46) }}>
            <button type="button" onClick={() => acaoSelecao("apagar")} title="Apagar seleção" aria-label="Apagar seleção" className="rounded-lg p-1.5 text-white hover:bg-white/10"><Trash2 className="h-4 w-4" /></button>
            <button type="button" onClick={() => acaoSelecao("duplicar")} title="Duplicar seleção" aria-label="Duplicar seleção" className="rounded-lg p-1.5 text-white hover:bg-white/10"><Copy className="h-4 w-4" /></button>
            {CORES.slice(0, 5).map(c => (
              <button key={c} type="button" onClick={() => acaoSelecao(c)} aria-label={`Pintar de ${c}`} title="Trocar a cor"
                className="h-5 w-5 rounded-full border border-white/60" style={{ background: c }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
