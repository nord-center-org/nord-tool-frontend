import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { Download, Loader2, Minus, Plus, X } from "lucide-react";

interface PreviaPdfProps {
  /** O PDF já gerado (o mesmo que seria baixado). */
  bytes: Uint8Array;
  titulo: string;
  onBaixar: () => void;
  onFechar: () => void;
}

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2;

/** Uma página: só desenha quando chega perto da tela (relatório com muitas fotos abre rápido). */
function Pagina({ documento, numero, zoom }: { documento: PDFDocumentProxy; numero: number; zoom: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [proporcao, setProporcao] = useState(297 / 210);
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisivel(true); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); obs.disconnect(); } }, { rootMargin: "600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    let cancelado = false;
    let tarefa: { cancel: () => void } | undefined;
    void documento.getPage(numero).then(pg => {
      const base = pg.getViewport({ scale: 1 });
      setProporcao(base.height / base.width);
      const largura = caixa.current?.clientWidth ?? base.width;
      // Nitidez: desenha na resolução da tela (até 2x), não na do zoom do navegador.
      const escala = (largura / base.width) * Math.min(2, window.devicePixelRatio || 1);
      const viewport = pg.getViewport({ scale: escala });
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (cancelado || !c || !ctx) return;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      const r = pg.render({ canvasContext: ctx, canvas: c, viewport });
      tarefa = r;
      return r.promise.then(() => { if (!cancelado) setPronta(true); });
    }).catch(() => {});
    return () => { cancelado = true; tarefa?.cancel(); };
  }, [documento, numero, visivel, zoom]);

  return (
    <div ref={caixa} data-pagina={numero} className="relative mx-auto w-full overflow-hidden rounded-md bg-white shadow-lg shadow-black/30" style={{ aspectRatio: `1 / ${proporcao}` }}>
      {!pronta && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-slate-200" />}
      <canvas ref={canvas} aria-label={`Página ${numero}`} className="block h-full w-full" />
    </div>
  );
}

/** Pré-visualização do PDF na própria tela (funciona no celular, sem baixar). */
export default function PreviaPdf({ bytes, titulo, onBaixar, onFechar }: PreviaPdfProps) {
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [atual, setAtual] = useState(1);
  const rolagem = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        // slice(): o pdf.js transfere o buffer para o worker; os bytes ficam para o "Baixar".
        doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
        if (vivo) setDocumento(doc); else void doc.destroy();
      } catch {
        if (vivo) setErro("Não foi possível mostrar a prévia. Baixe o PDF para ver.");
      }
    })();
    return () => { vivo = false; void doc?.destroy(); };
  }, [bytes]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = antes; };
  }, [onFechar]);

  // Página atual = a que está mais no meio da área de rolagem.
  const aoRolar = () => {
    const area = rolagem.current;
    if (!area) return;
    const meio = area.getBoundingClientRect().top + area.clientHeight / 2;
    let melhor = 1, menor = Infinity;
    area.querySelectorAll<HTMLElement>("[data-pagina]").forEach(el => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - meio);
      if (d < menor) { menor = d; melhor = Number(el.dataset.pagina); }
    });
    setAtual(melhor);
  };

  const total = documento?.numPages ?? 0;
  const mudarZoom = (d: number) => setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + d) * 10) / 10)));

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900/95" role="dialog" aria-modal="true" aria-label={`Prévia do PDF: ${titulo}`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-white sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{titulo}</p>
          <p className="text-xs text-white/60">{total ? `Página ${atual} de ${total}` : "Preparando a prévia…"}</p>
        </div>
        <div className="flex items-center rounded-xl bg-white/10" role="group" aria-label="Zoom">
          <button type="button" onClick={() => mudarZoom(-0.2)} disabled={zoom <= ZOOM_MIN} aria-label="Diminuir" className="rounded-l-xl p-2 hover:bg-white/10 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
          <span className="w-12 text-center text-xs font-bold tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => mudarZoom(0.2)} disabled={zoom >= ZOOM_MAX} aria-label="Aumentar" className="rounded-r-xl p-2 hover:bg-white/10 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={onBaixar} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold hover:bg-blue-500">
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">Baixar</span>
        </button>
        <button type="button" onClick={onFechar} aria-label="Fechar prévia" className="rounded-xl p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>

      <div ref={rolagem} onScroll={aoRolar} className="flex-1 overflow-auto px-3 py-4 sm:px-6">
        {erro ? (
          <p role="alert" className="mx-auto mt-10 max-w-sm rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">{erro}</p>
        ) : !documento ? (
          <div className="flex h-full items-center justify-center text-white/70"><Loader2 className="h-8 w-8 animate-spin" aria-label="Carregando" /></div>
        ) : (
          <div className="mx-auto space-y-4" style={{ width: `min(${Math.round(zoom * 100)}%, ${Math.round(820 * zoom)}px)` }}>
            {Array.from({ length: total }, (_, i) => <Pagina key={`${i}-${zoom}`} documento={documento} numero={i + 1} zoom={zoom} />)}
          </div>
        )}
      </div>
    </div>
  );
}
