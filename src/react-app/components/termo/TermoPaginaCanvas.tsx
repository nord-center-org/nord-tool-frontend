import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { escalaRender } from "@/react-app/utils/pdfTermoRegras";

interface TermoPaginaCanvasProps {
  documento: PDFDocumentProxy;
  pagina: number;
}

/** Renderiza uma página do PDF do termo em <canvas> (port de DatTermPage do Lugia). */
export default function TermoPaginaCanvas({ documento, pagina }: TermoPaginaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderizando, setRenderizando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let tarefa: { cancel: () => void } | undefined;
    setErro(null);
    setRenderizando(true);

    documento
      .getPage(pagina)
      .then(pg => {
        const canvas = canvasRef.current;
        if (cancelado || !canvas) return;
        const viewport = pg.getViewport({ scale: escalaRender(pg.getViewport({ scale: 1 }).width) });
        const contexto = canvas.getContext("2d");
        if (!contexto) throw new Error("Não foi possível mostrar esta página.");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const renderizacao = pg.render({ canvasContext: contexto, canvas, viewport });
        tarefa = renderizacao;
        return renderizacao.promise.then(() => {
          if (!cancelado) setRenderizando(false);
        });
      })
      .catch(e => {
        if (cancelado) return;
        // Cancelar o render ao trocar de página não é erro.
        if (e && (e as { name?: string }).name === "RenderingCancelledException") return;
        setErro(e instanceof Error ? e.message : "Não foi possível mostrar a página.");
        setRenderizando(false);
      });

    return () => {
      cancelado = true;
      tarefa?.cancel();
    };
  }, [documento, pagina]);

  if (erro) {
    return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>;
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      {renderizando && <div aria-busy="true" className="absolute inset-0 animate-pulse bg-slate-100" />}
      <canvas ref={canvasRef} aria-label={`Página ${pagina} do termo de reprova`} className="block h-auto w-full" />
    </div>
  );
}
