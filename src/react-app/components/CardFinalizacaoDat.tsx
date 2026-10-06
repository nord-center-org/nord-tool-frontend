import { AlertCircle, FileX2, Loader2 } from "lucide-react";

import type { ResumoTermos } from "@/react-app/utils/termoLista";
import { formatarPercentual, restantes } from "@/react-app/utils/termoLista";

interface CardFinalizacaoDatProps {
  resumo: ResumoTermos | null;
  carregando: boolean;
  erro: string | null;
}

/** Card "Controle de finalização do DAT" (equivalente ao do Lugia): total, concluídos, restantes, sem termo e progresso. */
export default function CardFinalizacaoDat({ resumo, carregando, erro }: CardFinalizacaoDatProps) {
  return (
    <section aria-label="Controle de finalização do DAT" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-50 pb-3">
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase">Controle de finalização do DAT</h4>
          <p className="mt-1 text-xs text-slate-400">Apartamentos reprovados ou com termo anexado · situação do último termo · todas as obras</p>
        </div>
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-blue-500" aria-label="Carregando" />}
      </div>

      {erro && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </p>
      )}

      {resumo && !erro && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-800">{formatarPercentual(resumo.percentualConcluido)}</span>
              <span className="text-xs font-medium text-slate-400">concluído</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(resumo.percentualConcluido)}
              aria-label="Progresso de finalização do DAT"
              className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, resumo.percentualConcluido))}%` }}
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</dt>
              <dd className="mt-1 text-2xl font-bold text-slate-800">{resumo.totalApartamentosComReprova}</dd>
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-green-600">Concluídos</dt>
              <dd className="mt-1 text-2xl font-bold text-green-700">{resumo.concluidos}</dd>
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Restantes</dt>
              <dd className="mt-1 text-2xl font-bold text-blue-700">{restantes(resumo)}</dd>
              <p className="text-[11px] text-blue-600/80">{resumo.emAndamento} em andamento · {resumo.pendentes} pendentes</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600"><FileX2 className="h-3 w-3" /> Sem termo</dt>
              <dd className="mt-1 text-2xl font-bold text-amber-700">{resumo.semTermo}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
