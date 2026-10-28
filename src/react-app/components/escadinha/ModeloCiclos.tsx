import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { MODELO_PADRAO, type ModeloCiclos as Modelo } from "@/react-app/utils/escadinha";

interface ModeloCiclosProps {
  modelo: Modelo;
  onFechar: () => void;
  /** aplicar: também troca as atividades de todos os ciclos da torre atual (mantendo o status das que têm o mesmo nome). */
  onSalvar: (modelo: Modelo, aplicar: boolean) => Promise<void>;
}

/** Modelo de ciclos da obra: atividades de cada ciclo novo e duração do ciclo; dá para aplicar na torre atual. */
export default function ModeloCiclos({ modelo, onFechar, onSalvar }: ModeloCiclosProps) {
  const [atividades, setAtividades] = useState(modelo.atividades);
  const [dias, setDias] = useState(modelo.diasPorCiclo);
  const [aplicar, setAplicar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mover = (i: number, d: number) => setAtividades(l => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const salvar = async () => {
    const limpas = atividades.map(a => a.trim()).filter(Boolean);
    if (!limpas.length) { setErro("Deixe pelo menos uma atividade."); return; }
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ atividades: limpas, diasPorCiclo: dias }, aplicar);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o modelo.");
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-6" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-modelo" onClick={e => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 id="titulo-modelo" className="text-lg font-bold text-slate-800">Modelo de ciclos</h3>
            <p className="text-sm text-slate-500">Atividades de cada ciclo e quantos dias ele dura, para toda a obra.</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            Dias por ciclo
            <input type="number" min={1} max={60} value={dias} onChange={e => setDias(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 text-sm" />
          </label>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Atividades (na ordem da obra)</p>
          <ol className="space-y-1.5">
            {atividades.map((a, i) => (
              <li key={i} className="flex items-center gap-1">
                <span className="w-5 text-right text-xs font-bold text-slate-400">{i + 1}</span>
                <input value={a} onChange={e => setAtividades(l => l.map((x, k) => (k === i ? e.target.value.slice(0, 80) : x)))}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm" aria-label={`Atividade ${i + 1}`} />
                <button type="button" onClick={() => mover(i, -1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => mover(i, 1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Descer"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setAtividades(l => l.filter((_, k) => k !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAtividades(l => [...l, ""])} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50">
              <Plus className="h-4 w-4" /> Atividade
            </button>
            <button type="button" onClick={() => { setAtividades(MODELO_PADRAO.atividades); setDias(MODELO_PADRAO.diasPorCiclo); }}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">
              Voltar ao padrão
            </button>
          </div>
          <label className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={aplicar} onChange={e => setAplicar(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>Aplicar agora em todos os ciclos desta torre <span className="block text-xs text-slate-500">Atividades com o mesmo nome mantêm o status.</span></span>
          </label>
          {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onFechar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={salvando} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar modelo
          </button>
        </div>
      </div>
    </div>
  );
}
