import { CheckCircle2, CircleAlert, FileStack } from "lucide-react";

import type { ProjetoImportado } from "@/react-app/utils/escadinha";
import type { ResumoBlocos } from "@/react-app/utils/projetoVetorial";

const COR_CATEGORIA: Record<string, string> = {
  estrutural: "#475569", sem_funcao: "#fcd34d", vedacao: "#eab308", corta_fogo: "#a855f7", acustico: "#0ea5e9", canaleta: "#64748b", outro: "#cbd5e1",
};
const n = (v: number) => v.toLocaleString("pt-BR");
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Resumo do projeto importado no painel: blocos da 1ª fiada da torre (pela legenda das pranchas) com o que a escadinha
 * já marcou como alvenaria executada, e o que ainda falta pedir de projeto.
 */
export default function ResumoProjeto({ projeto, resumo }: { projeto: ProjetoImportado; resumo: ResumoBlocos }) {
  const faltam = projeto.checklist.filter(c => !c.ok);
  const pct = resumo.total ? Math.round((resumo.executado / resumo.total) * 100) : 0;
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 p-3">
      <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
        <FileStack className="h-3.5 w-3.5" /> Projeto importado
      </h3>
      <p className="text-[11px] text-slate-500">
        {projeto.pranchas.length} pranchas{projeto.torre ? ` · Torre ${projeto.torre}` : ""} · {dataBr(projeto.importadoEm)}
      </p>
      {resumo.total > 0 && (
        <>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-xs font-bold text-slate-700">Blocos da 1ª fiada</span>
            <span className="text-[11px] text-slate-500">{resumo.pavimentos} pav. · {n(resumo.metros)} m de parede</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" title={`${pct}% assentado`}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{n(resumo.executado)} de {n(resumo.total)} assentados ({pct}%) pela escadinha</p>
          <table className="mt-2 w-full text-[11px]">
            <tbody>
              {resumo.linhas.map(l => (
                <tr key={l.categoria} className="border-t border-slate-100">
                  <td className="py-1 pr-2"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: COR_CATEGORIA[l.categoria] }} />{l.rotulo}</td>
                  <td className="py-1 text-right font-semibold text-slate-700">{n(l.total)}</td>
                  <td className="py-1 pl-2 text-right text-emerald-700">{n(l.executado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-slate-400">Total × executado, só a 1ª fiada (as fiadas de cima vêm das elevações).</p>
        </>
      )}
      {faltam.length > 0 && (
        <details className="mt-2">
          <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-amber-700">
            <CircleAlert className="h-3.5 w-3.5" /> Falta pedir {faltam.length} projeto(s)
          </summary>
          <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
            {projeto.checklist.map(c => (
              <li key={c.item} className="flex gap-1.5">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />}
                <span>{c.item}{!c.ok && <span className="block text-slate-400">{c.detalhe}</span>}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
