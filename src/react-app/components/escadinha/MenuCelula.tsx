import { Check, Clock3, Eraser, Slash, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { StatusMarcado } from "@/react-app/utils/escadinhaCury";

export interface AlvoCelula {
  /** Chaves da mesma célula nos lados marcados (A e/ou B). */
  chaves: string[];
  /** A outra lado (para "os dois lados"). */
  chaveOutroLado?: string;
  titulo: string;
  subtitulo: string;
  x: number;
  y: number;
}

interface MenuCelulaProps {
  alvo: AlvoCelula;
  hoje: string;
  onMarcar: (chaves: string[], status: StatusMarcado | "", data?: string) => void;
  onFechar: () => void;
}

/** Menu de uma célula da escadinha: executado (com data), em execução, não se aplica, limpar; opção de aplicar aos dois lados. */
export default function MenuCelula({ alvo, hoje, onMarcar, onFechar }: MenuCelulaProps) {
  const [data, setData] = useState(hoje);
  const [doisLados, setDoisLados] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) onFechar(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [onFechar]);

  const marcar = (s: StatusMarcado | "") => {
    const chaves = doisLados && alvo.chaveOutroLado ? [...alvo.chaves, alvo.chaveOutroLado] : alvo.chaves;
    onMarcar(chaves, s, s === "E" ? data : undefined);
    onFechar();
  };
  // Mantém o menu dentro da tela.
  const left = Math.min(alvo.x, window.innerWidth - 248);
  const top = Math.min(alvo.y, window.innerHeight - 290);
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold hover:bg-slate-100";

  return (
    <div ref={caixa} role="dialog" aria-label={`Status de ${alvo.titulo}`} style={{ left, top }}
      className="fixed z-[70] w-60 rounded-2xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl">
      <div className="flex items-start gap-2 px-1 pb-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-extrabold">{alvo.titulo}</p>
          <p className="text-[11px] text-slate-500">{alvo.subtitulo}</p>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-1 rounded-lg bg-emerald-50 p-1">
        <button type="button" onClick={() => marcar("E")} className={`${item} flex-1 text-emerald-700 hover:bg-emerald-100`}>
          <Check className="h-4 w-4" /> Executado
        </button>
        <input type="date" value={data} max={hoje} onChange={e => setData(e.target.value || hoje)} aria-label="Data da execução"
          className="w-[7.4rem] rounded-md border border-emerald-200 bg-white px-1 py-1 text-xs" />
      </div>
      <button type="button" onClick={() => marcar("X")} className={`${item} text-amber-700`}><Clock3 className="h-4 w-4" /> Em execução</button>
      <button type="button" onClick={() => marcar("N")} className={`${item} text-slate-600`}><Slash className="h-4 w-4" /> Não se aplica</button>
      <button type="button" onClick={() => marcar("")} className={`${item} text-red-600`}><Eraser className="h-4 w-4" /> Limpar</button>
      {alvo.chaveOutroLado && (
        <label className="mt-1 flex items-center gap-2 border-t border-slate-100 px-2.5 pt-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={doisLados} onChange={e => setDoisLados(e.target.checked)} /> Aplicar nos dois lados (A e B)
        </label>
      )}
    </div>
  );
}
