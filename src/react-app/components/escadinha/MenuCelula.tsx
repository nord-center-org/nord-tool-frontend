import { Eraser, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LEGENDA, MARCACAO_DO_STATUS, type StatusMarcado } from "@/react-app/utils/escadinhaCury";

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

/**
 * Menu de uma célula da escadinha: os status da legenda (executado com data; meta do ciclo é automática), limpar
 * (volta ao cálculo automático) e a opção de aplicar aos dois lados.
 */
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
  const left = Math.max(8, Math.min(alvo.x, window.innerWidth - 296));
  const top = Math.max(8, Math.min(alvo.y, window.innerHeight - 470));
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold hover:bg-slate-100";

  return (
    <div ref={caixa} role="dialog" aria-label={`Status de ${alvo.titulo}`} style={{ left, top }}
      className="fixed z-[70] w-72 rounded-2xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl">
      <div className="flex items-start gap-2 px-1 pb-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-extrabold">{alvo.titulo}</p>
          <p className="text-[11px] text-slate-500">{alvo.subtitulo}</p>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
      </div>
      <ul className="space-y-0.5">
        {LEGENDA.map(l => {
          const marcacao = MARCACAO_DO_STATUS[l.status];
          const bolinha = <span className="h-3.5 w-3.5 shrink-0 rounded border border-slate-300" style={{ background: l.cor }} />;
          if (!marcacao) {
            return (
              <li key={l.status} className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-400" title={l.dica}>
                {bolinha} <span className="flex-1">{l.rotulo.replace(/\s*—\s*automático$/i, "")}</span> <span className="text-[10px] font-bold uppercase">automático</span>
              </li>
            );
          }
          return (
            <li key={l.status} className={marcacao === "E" ? "flex items-center gap-1 rounded-lg bg-emerald-50 p-0.5" : undefined}>
              <button type="button" onClick={() => marcar(marcacao)} title={l.dica} className={`${item} ${marcacao === "E" ? "flex-1 hover:bg-emerald-100" : ""} text-xs`}>
                {bolinha} <span className="leading-tight">{l.rotulo}</span>
              </button>
              {marcacao === "E" && (
                <input type="date" value={data} max={hoje} onChange={e => setData(e.target.value || hoje)} aria-label="Data da execução"
                  className="w-[7.2rem] rounded-md border border-emerald-200 bg-white px-1 py-1 text-xs" />
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => marcar("")} className={`${item} text-red-600`}><Eraser className="h-4 w-4" /> Limpar (volta ao automático)</button>
      {alvo.chaveOutroLado && (
        <label className="mt-1 flex items-center gap-2 border-t border-slate-100 px-2.5 pt-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={doisLados} onChange={e => setDoisLados(e.target.checked)} /> Aplicar nos dois lados (A e B)
        </label>
      )}
    </div>
  );
}
