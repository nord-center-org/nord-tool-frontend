import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { PageViewport, RenderTask } from "pdfjs-dist";

import type { ProjetoPdf } from "@/react-app/components/cubicagem/pdfCubicagem";
import type { GradePontos, Ponto } from "@/react-app/utils/cubicagem";

export type ModoMedida = "nada" | "linha" | "area" | "calibrar";

interface Props {
  projeto: ProjetoPdf;
  pagina: number;
  /** 1 = página na largura da caixa. */
  zoom: number;
  modo: ModoMedida;
  /** Pontos da medida em andamento, em pontos do PDF. */
  pontos: Ponto[];
  onPonto: (p: Ponto) => void;
  /** Caixa (pontos do PDF) da peça achada, para destacar. */
  destaque?: { x: number; y: number; w: number; h: number } | null;
  /** Ímã: vértices do desenho para encaixar o toque (null = desligado). */
  grade?: GradePontos | null;
}

/** Raio do ímã em px da tela. */
const RAIO_IMA = 14;

const MAX_LADO = 4096;

/**
 * Página do projeto desenhada pelo pdf.js no tamanho da tela (até 4096 px), com uma camada SVG por cima para os
 * pontos da medida e o destaque da peça achada. O clique vira coordenada do PDF (respeita a rotação da página).
 */
export default function VistaPdf({ projeto, pagina, zoom, modo, pontos, onPonto, destaque, grade }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [largura, setLargura] = useState(0);
  const [vista, setVista] = useState<PageViewport | null>(null);
  const [desenhando, setDesenhando] = useState(true);
  const [mira, setMira] = useState<Ponto | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargura(el.clientWidth));
    ro.observe(el);
    setLargura(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!largura || !canvas.current) return;
    let tarefa: RenderTask | null = null;
    let vivo = true;
    setDesenhando(true);
    void (async () => {
      const p = await projeto.doc.getPage(pagina);
      if (!vivo) return;
      const base = p.getViewport({ scale: 1 });
      const escalaCss = (largura / base.width) * zoom;
      const css = p.getViewport({ scale: escalaCss });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const px = Math.min(dpr, MAX_LADO / Math.max(css.width, css.height));
      const tela = p.getViewport({ scale: escalaCss * px });
      const c = canvas.current;
      if (!c) return;
      c.width = Math.floor(tela.width);
      c.height = Math.floor(tela.height);
      c.style.width = `${css.width}px`;
      c.style.height = `${css.height}px`;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      tarefa = p.render({ canvasContext: ctx, viewport: tela, canvas: c });
      try { await tarefa.promise; } catch { /* trocou de página no meio */ }
      if (vivo) { setVista(css); setDesenhando(false); }
    })();
    return () => { vivo = false; tarefa?.cancel(); };
  }, [projeto, pagina, zoom, largura]);

  /** Ponto do PDF sob o cursor, encaixado no vértice mais perto do desenho se o ímã estiver ligado. */
  const pontoDe = (e: MouseEvent<SVGSVGElement>): { p: Ponto; encaixou: boolean } | null => {
    if (!vista) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const [x, y] = vista.convertToPdfPoint(e.clientX - r.left, e.clientY - r.top);
    const perto = grade?.maisPerto({ x, y }, RAIO_IMA / vista.scale) ?? null;
    return perto ? { p: perto, encaixou: true } : { p: { x, y }, encaixou: false };
  };
  const clicar = (e: MouseEvent<SVGSVGElement>) => {
    if (modo === "nada") return;
    const r = pontoDe(e);
    if (r) onPonto(r.p);
  };
  const mover = (e: MouseEvent<SVGSVGElement>) => {
    if (modo === "nada" || !grade) { if (mira) setMira(null); return; }
    const r = pontoDe(e);
    setMira(r?.encaixou ? r.p : null);
  };

  const naTela = (p: Ponto) => (vista ? vista.convertToViewportPoint(p.x, p.y) : [0, 0]);
  const telaPts = pontos.map(naTela);
  const cor = modo === "calibrar" ? "#d97706" : "#2563eb";
  let retDestaque: { x: number; y: number; w: number; h: number } | null = null;
  if (destaque && vista) {
    const [x1, y1] = vista.convertToViewportPoint(destaque.x, destaque.y);
    const [x2, y2] = vista.convertToViewportPoint(destaque.x + destaque.w, destaque.y + destaque.h);
    const folga = 6;
    retDestaque = { x: Math.min(x1, x2) - folga, y: Math.min(y1, y2) - folga, w: Math.abs(x2 - x1) + folga * 2, h: Math.abs(y2 - y1) + folga * 2 };
  }

  return (
    <div ref={caixa} className="relative w-full">
      <div className="relative inline-block align-top">
        <canvas ref={canvas} className="block bg-white shadow" aria-label={`Página ${pagina} do projeto`} />
        {vista && (
          <svg width={vista.width} height={vista.height} onClick={clicar} onMouseMove={mover} onMouseLeave={() => setMira(null)} data-medida={modo}
            className={`absolute left-0 top-0 ${modo === "nada" ? "" : "cursor-crosshair"}`} role="img" aria-label="Camada de medida">
            {retDestaque && (
              <rect x={retDestaque.x} y={retDestaque.y} width={retDestaque.w} height={retDestaque.h} rx={4}
                fill="rgba(250,204,21,0.25)" stroke="#ca8a04" strokeWidth={2}>
                <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.4s" repeatCount="3" />
              </rect>
            )}
            {telaPts.length > 1 && (modo === "area"
              ? <polygon points={telaPts.map(p => p.join(",")).join(" ")} fill="rgba(37,99,235,0.15)" stroke={cor} strokeWidth={2} />
              : <polyline points={telaPts.map(p => p.join(",")).join(" ")} fill="none" stroke={cor} strokeWidth={2} />)}
            {telaPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5} fill="white" stroke={cor} strokeWidth={2} />)}
            {mira && modo !== "nada" && (() => { const [x, y] = naTela(mira); return <rect x={x - 7} y={y - 7} width={14} height={14} fill="none" stroke="#16a34a" strokeWidth={2} data-ima="" />; })()}
          </svg>
        )}
      </div>
      {desenhando && <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-bold text-slate-500 shadow">Desenhando a página…</div>}
    </div>
  );
}
