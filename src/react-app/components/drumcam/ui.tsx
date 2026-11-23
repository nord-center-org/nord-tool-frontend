import { useEffect, useRef, type ReactNode } from "react";

/** Painel no estilo de mesa de transmissão: título pequeno em caixa alta, ações à direita. */
export function Painel({ titulo, acoes, children, className = "", corpo = "p-2" }: { titulo: string; acoes?: ReactNode; children: ReactNode; className?: string; corpo?: string }) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#181b22] ${className}`} aria-label={titulo}>
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-white/10 bg-[#1f232c] px-2.5">
        <h3 className="mr-auto text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h3>
        {acoes}
      </header>
      <div className={`min-h-0 flex-1 overflow-auto ${corpo}`}>{children}</div>
    </section>
  );
}

/** Controle deslizante com rótulo e valor; duplo clique volta ao padrão. */
export function Deslizador({ rotulo, valor, min, max, passo = 1, padrao, sufixo = "", onChange }: {
  rotulo: string; valor: number; min: number; max: number; passo?: number; padrao: number; sufixo?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block select-none py-1" onDoubleClick={() => onChange(padrao)} title="Duplo clique volta ao padrão">
      <span className="flex justify-between text-[11px] text-slate-400"><span>{rotulo}</span><span className="tabular-nums text-slate-300">{Math.round(valor * 100) / 100}{sufixo}</span></span>
      <input type="range" min={min} max={max} step={passo} value={valor} aria-label={rotulo}
        onChange={e => onChange(Number(e.target.value))} className="nt-deslizador mt-1 w-full accent-sky-500" />
    </label>
  );
}

/** Botão de ícone escuro, com dica. */
export function BotaoIcone({ rotulo, ativo, perigo, onClick, children, disabled }: { rotulo: string; ativo?: boolean; perigo?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" title={rotulo} aria-label={rotulo} aria-pressed={ativo} onClick={onClick} disabled={disabled}
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-bold transition disabled:opacity-40 ${
        perigo ? "bg-red-600 text-white hover:bg-red-500" : ativo ? "bg-sky-600 text-white hover:bg-sky-500" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

/** Medidor de áudio (verde, amarelo, vermelho), atualizado direto no DOM (sem re-renderizar a tela). */
export function Medidor({ ler, vertical = false }: { ler: () => number; vertical?: boolean }) {
  const barra = useRef<HTMLDivElement>(null);
  const pico = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = 0, max = 0, ultimo = 0;
    const passo = (t: number) => {
      if (t - ultimo > 50) {
        ultimo = t;
        const n = Math.max(0, Math.min(1, ler()));
        max = Math.max(n, max - 0.015);
        const pct = `${Math.round(n * 100)}%`, pk = `${Math.round(max * 100)}%`;
        if (barra.current) { if (vertical) barra.current.style.height = pct; else barra.current.style.width = pct; }
        if (pico.current) { if (vertical) pico.current.style.bottom = pk; else pico.current.style.left = pk; }
      }
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [ler, vertical]);
  const gradiente = vertical ? "bg-gradient-to-t" : "bg-gradient-to-r";
  return (
    <div className={`relative overflow-hidden rounded-sm bg-black/60 ${vertical ? "h-full w-2" : "h-2 w-full"}`} aria-hidden>
      <div className={`absolute inset-0 ${gradiente} from-emerald-500 via-yellow-400 to-red-500 opacity-20`} />
      <div ref={barra} className={`absolute ${gradiente} from-emerald-500 via-yellow-400 to-red-500 ${vertical ? "bottom-0 left-0 w-full" : "left-0 top-0 h-full"}`}
        style={vertical ? { height: 0, backgroundSize: "100% 100vh" } : { width: 0 }} />
      <div ref={pico} className={`absolute bg-white ${vertical ? "left-0 h-px w-full" : "top-0 h-full w-px"}`} />
    </div>
  );
}

/** Vídeo de um MediaStream (mudo por padrão: o áudio passa pelo mixer). */
export function VideoAoVivo({ stream, mudo = true, className = "", estilo, aoPronto }: {
  stream: MediaStream | null; mudo?: boolean; className?: string; estilo?: React.CSSProperties; aoPronto?: (v: HTMLVideoElement) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (stream) void v.play().catch(() => undefined);
    if (aoPronto) aoPronto(v);
  }, [stream, aoPronto]);
  return <video ref={ref} muted={mudo} playsInline autoPlay className={className} style={estilo} />;
}
