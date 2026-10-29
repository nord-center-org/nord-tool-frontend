import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, RotateCcw, Settings2, Trash2, X } from "lucide-react";
import { useState } from "react";

import { novoId } from "@/react-app/utils/escadinha";
import {
  MODELO_CURY, ROTULO_CAMADA, camadaDaAtividade, lerModeloEscadinha, type Camada, type CicloModelo, type ModeloEscadinha,
} from "@/react-app/utils/escadinhaCury";

interface ModeloEscadinhaEditorProps {
  modelo: ModeloEscadinha;
  onSalvar: (m: ModeloEscadinha) => Promise<void>;
  onFechar: () => void;
}

const mover = <T,>(lista: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
};

/**
 * Ciclos e atividades da escadinha (vale para a obra inteira; só o admin edita): nome, cor, dias e meta de pavimentos
 * de cada ciclo, atividades (nome, instalações, o que acende no 3D), ordem. Os ids das atividades ficam, então o que já
 * foi marcado na grade continua valendo.
 */
export default function ModeloEscadinhaEditor({ modelo, onSalvar, onFechar }: ModeloEscadinhaEditorProps) {
  const [m, setM] = useState<ModeloEscadinha>(modelo);
  const [aberto, setAberto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudarCiclo = (i: number, p: Partial<CicloModelo>) => setM(x => ({ ...x, ciclos: x.ciclos.map((c, k) => (k === i ? { ...c, ...p } : c)) }));
  const mudarAtividade = (i: number, j: number, p: Partial<CicloModelo["atividades"][number]>) =>
    mudarCiclo(i, { atividades: m.ciclos[i].atividades.map((a, k) => (k === j ? { ...a, ...p } : a)) });

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(lerModeloEscadinha(m));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar");
      setSalvando(false);
    }
  };

  const campo = "rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="modelo-titulo" onMouseDown={e => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
        <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Settings2 className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <h2 id="modelo-titulo" className="text-lg font-bold">Ciclos e atividades da escadinha</h2>
            <p className="text-xs text-slate-500">Vale para todas as torres da obra. O que já foi marcado continua valendo.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-slate-500 hover:text-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 text-xs font-semibold text-slate-600">
          <label className="flex items-center gap-2">Período de referência
            <input type="number" min={1} max={60} value={m.diasPeriodo} onChange={e => setM({ ...m, diasPeriodo: Number(e.target.value) })} className={`${campo} w-16`} /> dias
          </label>
          <button type="button" onClick={() => { if (window.confirm("Voltar para a escadinha padrão da Cury? Atividades novas que você criou somem do modelo.")) setM(MODELO_CURY); }}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"><RotateCcw className="h-3.5 w-3.5" /> Padrão Cury</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <ul className="space-y-2">
            {m.ciclos.map((c, i) => (
              <li key={c.id} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ borderLeft: `6px solid ${c.cor}` }}>
                  <input type="color" value={c.cor} onChange={e => mudarCiclo(i, { cor: e.target.value })} aria-label={`Cor do ${c.nome}`} className="h-7 w-8 rounded" />
                  <input value={c.nome} onChange={e => mudarCiclo(i, { nome: e.target.value.slice(0, 80) })} aria-label="Nome do ciclo" className={`${campo} min-w-0 flex-1 font-bold`} />
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    <input type="number" min={1} max={120} value={c.dias} onChange={e => mudarCiclo(i, { dias: Number(e.target.value) })} className={`${campo} w-14`} aria-label="Dias do ciclo" /> dias
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    meta <input type="number" min={1} max={10} value={c.metaPav} onChange={e => mudarCiclo(i, { metaPav: Number(e.target.value) })} className={`${campo} w-12`} aria-label="Meta de pavimentos" /> pav.
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    <input type="checkbox" checked={c.metasAtivas} onChange={e => mudarCiclo(i, { metasAtivas: e.target.checked })} /> metas
                  </label>
                  <button type="button" onClick={() => setM({ ...m, ciclos: mover(m.ciclos, i, -1) })} aria-label="Subir ciclo" className="text-slate-400 hover:text-slate-700"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setM({ ...m, ciclos: mover(m.ciclos, i, 1) })} aria-label="Descer ciclo" className="text-slate-400 hover:text-slate-700"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => { if (window.confirm(`Excluir o ${c.nome} e as atividades dele do modelo?`)) setM({ ...m, ciclos: m.ciclos.filter((_, k) => k !== i) }); }}
                    aria-label="Excluir ciclo" className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setAberto(a => (a === c.id ? null : c.id))} aria-expanded={aberto === c.id}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50">
                    {c.atividades.length} atividades <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto === c.id ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {aberto === c.id && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50">
                    {c.atividades.map((a, j) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                        <input value={a.nome} onChange={e => mudarAtividade(i, j, { nome: e.target.value.slice(0, 160) })} aria-label="Nome da atividade" className={`${campo} min-w-0 flex-1`} />
                        <label className="flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" checked={!!a.install} onChange={e => mudarAtividade(i, j, { install: e.target.checked })} /> Install</label>
                        <select value={a.camada} onChange={e => mudarAtividade(i, j, { camada: e.target.value as Camada })} aria-label="O que acende no 3D" className={`${campo} bg-white`}>
                          {(Object.keys(ROTULO_CAMADA) as Camada[]).map(k => <option key={k} value={k}>3D: {ROTULO_CAMADA[k]}</option>)}
                        </select>
                        <button type="button" onClick={() => mudarCiclo(i, { atividades: mover(c.atividades, j, -1) })} aria-label="Subir" className="text-slate-400 hover:text-slate-700"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => mudarCiclo(i, { atividades: mover(c.atividades, j, 1) })} aria-label="Descer" className="text-slate-400 hover:text-slate-700"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => mudarCiclo(i, { atividades: c.atividades.filter((_, k) => k !== j) })} aria-label="Remover" className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                    <li className="px-3 py-2">
                      <button type="button" onClick={() => mudarCiclo(i, { atividades: [...c.atividades, { id: novoId("a"), nome: "NOVA ATIVIDADE", install: false, camada: camadaDaAtividade("") }] })}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600"><Plus className="h-3.5 w-3.5" /> Atividade</button>
                    </li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setM({ ...m, ciclos: [...m.ciclos, { id: novoId("c"), nome: `Ciclo ${m.ciclos.length + 1}`, cor: "#94a3b8", dias: 15, metaPav: 1, metasAtivas: true, atividades: [{ id: novoId("a"), nome: "NOVA ATIVIDADE", install: false, camada: "inspecao" }] }] })}
            className="mt-3 flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Plus className="h-4 w-4" /> Ciclo</button>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {erro && <p role="alert" className="mr-auto text-sm text-red-700">{erro}</p>}
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={salvando} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar para a obra
          </button>
        </footer>
      </div>
    </div>
  );
}
