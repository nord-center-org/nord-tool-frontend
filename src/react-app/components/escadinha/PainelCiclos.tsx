import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, ListChecks, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  dataCurta, progresso, statusCiclo, ROTULO_STATUS, type Ciclo, type Pavimento, type StatusAtividade,
} from "@/react-app/utils/escadinha";

const CHIP: Record<StatusAtividade, string> = {
  pendente: "border-amber-200 bg-amber-50 text-amber-700",
  andamento: "border-blue-200 bg-blue-50 text-blue-700",
  finalizado: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const BARRA: Record<StatusAtividade, string> = { pendente: "bg-amber-400", andamento: "bg-blue-500", finalizado: "bg-emerald-500" };

function IconeStatus({ status, className = "h-4 w-4" }: { status: StatusAtividade; className?: string }) {
  if (status === "finalizado") return <CheckCircle2 className={`${className} text-emerald-600`} aria-hidden="true" />;
  if (status === "andamento") return <Clock3 className={`${className} text-blue-600`} aria-hidden="true" />;
  return <AlertTriangle className={`${className} text-amber-500`} aria-hidden="true" />;
}

interface PainelCiclosProps {
  pavimentos: Pavimento[];
  ciclos: Ciclo[];
  /** Pavimento aberto em 2D: o painel mostra só o ciclo dele. */
  selecionado: string | null;
  onAlternar: (idAtividade: string) => void;
  onVerTudo: () => void;
  onAnexar: () => void;
  onFechar: () => void;
  onFocar: (idPavimento: string) => void;
}

/** Lista de ciclos da escadinha (um por pavimento) com as atividades; com um pavimento selecionado, só o ciclo dele. */
export default function PainelCiclos({ pavimentos, ciclos, selecionado, onAlternar, onVerTudo, onAnexar, onFechar, onFocar }: PainelCiclosProps) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  useEffect(() => { if (selecionado) setAbertos(new Set([selecionado])); }, [selecionado]);

  const visiveis = pavimentos.filter(p => !selecionado || p.id === selecionado);
  const alternarGrupo = (id: string) => setAbertos(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm animate-da-direita" aria-label="Ciclos e atividades da escadinha">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{selecionado ? "Ciclo do pavimento" : "Escadinha completa"}</p>
          <h3 className="text-lg font-bold text-slate-800">Ciclos e atividades</h3>
        </div>
        <button type="button" onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar lista de ciclos">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2 border-b border-slate-100 p-4">
        <button type="button" onClick={onAnexar} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Anexar projeto
        </button>
        {selecionado && (
          <button type="button" onClick={onVerTudo} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <ListChecks className="h-4 w-4" /> Ver escadinha completa
          </button>
        )}
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {visiveis.map(p => {
          const ciclo = ciclos.find(c => c.idPavimento === p.id);
          if (!ciclo) return null;
          const status = statusCiclo(ciclo);
          const pct = Math.round(progresso(ciclo) * 100);
          const aberto = abertos.has(p.id);
          return (
            <li key={p.id} className={`rounded-2xl border ${p.id === selecionado ? "border-orange-300 ring-2 ring-orange-100" : "border-slate-200"}`}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" onClick={() => alternarGrupo(p.id)} aria-expanded={aberto} aria-controls={`ciclo-${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${aberto ? "" : "-rotate-90"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{p.nome}</span>
                    <span className="block text-[11px] font-medium text-slate-400">Início {dataCurta(ciclo.inicio)} · {pct}%</span>
                  </span>
                </button>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Andamento ${p.nome}`}>
                  <div className={`h-full rounded-full ${BARRA[status]}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                </div>
                <span title={ROTULO_STATUS[status]}><IconeStatus status={status} /></span>
                {!selecionado && (
                  <button type="button" onClick={() => onFocar(p.id)} className="rounded-lg px-1.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50" aria-label={`Abrir ${p.nome} em 2D`}>
                    2D
                  </button>
                )}
              </div>
              {aberto && (
                <ul id={`ciclo-${p.id}`} className="space-y-1 border-t border-slate-100 px-3 py-2 animate-entrada">
                  {ciclo.atividades.map(a => (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="min-w-0 truncate text-sm text-slate-600">{a.nome}</span>
                      <button type="button" onClick={() => onAlternar(a.id)} title="Tocar para mudar o status"
                        className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${CHIP[a.status]}`}>
                        <IconeStatus status={a.status} className="h-3 w-3" />
                        {ROTULO_STATUS[a.status]}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
