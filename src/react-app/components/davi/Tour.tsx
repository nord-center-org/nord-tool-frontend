import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface PassoTour {
  titulo: string;
  texto: string;
  /** Posição do alvo no mundo do jogo (atualizada enquanto o alvo se mexe). */
  alvo: () => { x: number; y: number } | null;
  raio?: number;
}

/** Apresentação em balõezinhos: destaca cada coisa interativa da tela, um passo por vez. */
interface TourProps {
  passos: PassoTour[];
  /** Converte o ponto do mundo para % da tela (considera a câmera). */
  paraTela: (p: { x: number; y: number }) => { x: number; y: number };
  /** Avisa onde está o alvo do passo (para a câmera ir até ele). */
  onFoco?: (p: { x: number; y: number } | null) => void;
  onFechar: () => void;
}

export default function Tour({ passos, paraTela, onFoco, onFechar }: TourProps) {
  const [i, setI] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const atualizar = () => {
      const alvo = passos[i]?.alvo() ?? null;
      onFoco?.(alvo);
      setPos(alvo ? paraTela(alvo) : null);
    };
    atualizar();
    const t = window.setInterval(atualizar, 80);
    return () => window.clearInterval(t);
  }, [i, passos, paraTela, onFoco]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowRight") setI(v => Math.min(passos.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI(v => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar, passos.length]);
  const passo = passos[i];
  if (!passo) return null;
  const p = pos ?? { x: 50, y: 50 };
  const raio = passo.raio ?? 7;
  const embaixo = p.y < 45;
  return (
    <div className="absolute inset-0 z-30 overflow-hidden rounded-[inherit]" role="dialog" aria-label="Como brincar">
      <div className="absolute rounded-full ring-4 ring-yellow-300 transition-all duration-300 ease-out animate-pulse"
        style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${raio * 2}%`, aspectRatio: "1", transform: "translate(-50%, -50%)", boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)" }} />
      <div key={i} className="absolute w-64 max-w-[86%] animate-surgir rounded-2xl border-4 border-slate-900 bg-white p-3 text-slate-800 shadow-[4px_4px_0_#0f172a] transition-all duration-300"
        style={{ left: `clamp(6px, calc(${p.x}% - 8rem), calc(100% - min(16.5rem, 86%) - 6px))`, top: embaixo ? `calc(${p.y}% + ${raio}% + 8px)` : undefined, bottom: embaixo ? undefined : `calc(${100 - p.y}% + ${raio}% + 8px)` }}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-['Press_Start_2P'] text-[10px] leading-4 text-indigo-700">{passo.titulo}</p>
          <button type="button" onClick={onFechar} aria-label="Fechar tutorial" className="-mr-1 -mt-1 rounded-lg p-0.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1.5 text-sm leading-snug">{passo.texto}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-['Press_Start_2P'] text-[8px] text-slate-400">{i + 1}/{passos.length}</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setI(v => Math.max(0, v - 1))} disabled={i === 0} aria-label="Anterior"
              className="rounded-lg border-2 border-slate-900 bg-white p-1 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            {i < passos.length - 1 ? (
              <button type="button" onClick={() => setI(v => v + 1)} className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-yellow-300 px-2 py-1 text-xs font-black text-slate-900">
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={onFechar} className="rounded-lg border-2 border-slate-900 bg-emerald-400 px-3 py-1 text-xs font-black text-slate-900">Bora brincar!</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
