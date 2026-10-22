import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";

import ModalBase from "@/react-app/components/casamento/ModalBase";
import { ApiError } from "@/react-app/services/apiClient";
import { treinoService, type Treino } from "@/react-app/services/TreinoService";
import { lerValor } from "@/react-app/utils/caixinha";
import { DIAS_CURTOS, DIAS_NOMES, diasDeTexto, textoDeDias } from "@/react-app/utils/treinos";

const campo = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20";
interface Linha { chave: number; id?: number; nome: string; series: string; reps: string; carga: string; descanso: string; obs: string }

interface Props { treino: Treino | null; onSalvo: (t: Treino) => void; onExcluido: (id: number) => void; onFechar: () => void }

/** Ficha de treino: nome, dias e exercícios (séries, repetições, carga, descanso). */
export default function EditorTreino({ treino, onSalvo, onExcluido, onFechar }: Props) {
  const [nome, setNome] = useState(treino?.nmTreino ?? "");
  const [obs, setObs] = useState(treino?.txObservacao ?? "");
  const [dias, setDias] = useState<number[]>(diasDeTexto(treino?.txDias));
  const [ativo, setAtivo] = useState(treino?.inAtivo ?? true);
  const [linhas, setLinhas] = useState<Linha[]>(() => (treino?.exercicios ?? []).map((e, i) => ({
    chave: i, id: e.id, nome: e.nmExercicio, series: String(e.nrSeries), reps: e.txRepeticoes ?? "",
    carga: e.vlCarga == null ? "" : String(e.vlCarga).replace(".", ","), descanso: e.nrDescansoSeg == null ? "" : String(e.nrDescansoSeg), obs: e.txObservacao ?? "",
  })));
  const [proxima, setProxima] = useState(linhas.length);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const alterar = (chave: number, m: Partial<Linha>) => setLinhas(l => l.map(x => (x.chave === chave ? { ...x, ...m } : x)));
  const mover = (i: number, d: number) => setLinhas(l => { const a = i + d; if (a < 0 || a >= l.length) return l; const c = [...l]; [c[i], c[a]] = [c[a], c[i]]; return c; });

  const salvar = async () => {
    if (!nome.trim()) return setErro("Dê um nome ao treino (ex.: Treino A – Peito).");
    const ruim = linhas.findIndex(l => !l.nome.trim() || !(Number(l.series) >= 1 && Number(l.series) <= 20) || (l.carga.trim() !== "" && lerValor(l.carga) === null && l.carga.trim() !== "0")
      || (l.descanso.trim() !== "" && !(Number(l.descanso) >= 0 && Number(l.descanso) <= 900)));
    if (ruim >= 0) return setErro(`Exercício ${ruim + 1}: confira nome, séries (1–20), carga e descanso (0–900 s).`);
    setSalvando(true);
    setErro(null);
    const form = {
      nmTreino: nome.trim(), txObservacao: obs.trim() || null, txDias: textoDeDias(dias), inAtivo: ativo, nrVersao: treino?.nrVersao,
      exercicios: linhas.map(l => ({
        id: l.id, nmExercicio: l.nome.trim(), nrSeries: Number(l.series), txRepeticoes: l.reps.trim() || null,
        vlCarga: l.carga.trim() === "" ? null : l.carga.trim() === "0" ? 0 : lerValor(l.carga), nrDescansoSeg: l.descanso.trim() === "" ? null : Number(l.descanso),
        txObservacao: l.obs.trim() || null,
      })),
    };
    try {
      onSalvo(treino ? await treinoService.alterar(treino.id, form) : await treinoService.criar(form));
    } catch (e) {
      setErro(e instanceof ApiError && e.status === 409 ? "Este treino foi alterado em outra tela. Feche e abra de novo." : e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!treino || !window.confirm(`Excluir a ficha "${treino.nmTreino}"? O histórico de treinos feitos continua.`)) return;
    try { await treinoService.excluir(treino.id, treino.nrVersao); onExcluido(treino.id); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível excluir."); }
  };

  return (
    <ModalBase titulo={treino ? "Editar treino" : "Novo treino"} onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome</span>
          <input autoFocus value={nome} maxLength={80} onChange={e => setNome(e.target.value)} placeholder="Ex.: Treino A – Peito e tríceps" className={`mt-1 ${campo} py-2`} /></label>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dias</span>
          <div className="mt-1 flex gap-1.5" role="group" aria-label="Dias do treino">
            {DIAS_CURTOS.map((d, i) => (
              <button key={i} type="button" aria-label={DIAS_NOMES[i]} aria-pressed={dias.includes(i + 1)} onClick={() => setDias(x => (x.includes(i + 1) ? x.filter(y => y !== i + 1) : [...x, i + 1]))}
                className={`h-9 w-9 rounded-full text-sm font-bold ${dias.includes(i + 1) ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-500"}`}>{d}</button>
            ))}
          </div>
        </div>
        <label className="block"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observação</span>
          <input value={obs} maxLength={500} onChange={e => setObs(e.target.value)} placeholder="Ex.: aquecer 10 min na esteira" className={`mt-1 ${campo} py-2`} /></label>

        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Exercícios</h3>
          <ol className="space-y-2" aria-label="Exercícios">
            {linhas.map((l, i) => (
              <li key={l.chave} className="rounded-xl border border-slate-200 p-2">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 text-center text-xs font-black text-slate-400">{i + 1}</span>
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[2fr_repeat(4,1fr)]">
                    <input aria-label={`Exercício ${i + 1}`} value={l.nome} maxLength={100} placeholder="Exercício" onChange={e => alterar(l.chave, { nome: e.target.value })} className={`${campo} col-span-2 sm:col-span-1`} />
                    <input aria-label={`Séries ${i + 1}`} inputMode="numeric" value={l.series} placeholder="Séries" onChange={e => alterar(l.chave, { series: e.target.value.replace(/\D/g, "") })} className={campo} />
                    <input aria-label={`Repetições ${i + 1}`} value={l.reps} maxLength={20} placeholder="Reps (8-12)" onChange={e => alterar(l.chave, { reps: e.target.value })} className={campo} />
                    <input aria-label={`Carga ${i + 1}`} inputMode="decimal" value={l.carga} placeholder="Carga kg" onChange={e => alterar(l.chave, { carga: e.target.value })} className={campo} />
                    <input aria-label={`Descanso ${i + 1}`} inputMode="numeric" value={l.descanso} placeholder="Descanso s" onChange={e => alterar(l.chave, { descanso: e.target.value.replace(/\D/g, "") })} className={campo} />
                  </div>
                  <div className="flex flex-col">
                    <button type="button" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Descer" onClick={() => mover(i, 1)} disabled={i === linhas.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label="Remover exercício" onClick={() => setLinhas(x => x.filter(y => y.chave !== l.chave))} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => { setLinhas(l => [...l, { chave: proxima, nome: "", series: "3", reps: "", carga: "", descanso: "60", obs: "" }]); setProxima(p => p + 1); }}
            className="mt-2 inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"><Plus className="h-4 w-4" /> Adicionar exercício</button>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativo (aparece em "Treino de hoje")</label>
        <div className="flex items-center justify-between gap-2">
          {treino ? <button type="button" onClick={() => void excluir()} className="text-sm font-semibold text-red-600 hover:underline">Excluir ficha</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onFechar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button>
            <button type="button" onClick={() => void salvar()} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
