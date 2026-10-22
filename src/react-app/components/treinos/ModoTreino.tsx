import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Timer, X } from "lucide-react";

import { treinoService, type Treino, type TreinoSessao } from "@/react-app/services/TreinoService";
import { hojeSaoPaulo, lerValor } from "@/react-app/utils/caixinha";
import { formatarSegundos } from "@/react-app/utils/treinos";

interface Item { idExercicio: number | null; nome: string; series: number; reps: string; carga: string; descanso: number | null; feito: boolean }

interface Props { treino: Treino; onConcluido: (s: TreinoSessao) => void; onFechar: () => void }

/** Treinando agora: cronômetro do treino, marcar exercícios, ajustar carga e descanso entre séries. */
export default function ModoTreino({ treino, onConcluido, onFechar }: Props) {
  const [itens, setItens] = useState<Item[]>(() => treino.exercicios.map(e => ({
    idExercicio: e.id ?? null, nome: e.nmExercicio, series: e.nrSeries, reps: e.txRepeticoes ?? "",
    carga: e.vlCarga == null ? "" : String(e.vlCarga).replace(".", ","), descanso: e.nrDescansoSeg, feito: false,
  })));
  const inicio = useRef(Date.now());
  const [agora, setAgora] = useState(Date.now());
  const [descanso, setDescanso] = useState<{ ate: number; nome: string } | null>(null);
  const [atualizarCargas, setAtualizarCargas] = useState(true);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (descanso && agora >= descanso.ate) {
      setDescanso(null);
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ }
    }
  }, [agora, descanso]);

  const decorrido = Math.floor((agora - inicio.current) / 1000);
  const feitos = itens.filter(i => i.feito).length;
  const alterar = (i: number, m: Partial<Item>) => setItens(l => l.map((x, n) => (n === i ? { ...x, ...m } : x)));

  const concluir = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const s = await treinoService.registrar({
        idTreino: treino.id, dtSessao: hojeSaoPaulo(), nrDuracaoMin: Math.max(1, Math.round(decorrido / 60)), txObservacao: obs.trim() || null, atualizarCargas,
        exercicios: itens.map(i => ({ idExercicio: i.idExercicio, nmExercicio: i.nome, txRepeticoes: i.reps.trim() || null, vlCarga: i.carga.trim() === "" ? null : lerValor(i.carga) ?? 0, inFeito: i.feito })),
      });
      onConcluido(s);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível registrar o treino.");
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white animate-aparecer" role="dialog" aria-modal="true" aria-label={`Treinando ${treino.nmTreino}`}>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black">{treino.nmTreino}</p>
          <p className="text-xs text-white/60">{feitos} de {itens.length} feitos</p>
        </div>
        <span className="rounded-xl bg-white/10 px-3 py-1.5 font-mono text-xl font-bold tabular-nums" aria-label="Tempo de treino">{formatarSegundos(decorrido)}</span>
        <button type="button" onClick={() => { if (window.confirm("Sair sem registrar este treino?")) onFechar(); }} aria-label="Sair do treino" className="rounded-lg p-2 text-white/60 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </header>

      {descanso && (
        <div role="status" className="flex items-center justify-between bg-amber-400 px-4 py-2 text-slate-900">
          <span className="text-sm font-bold">Descanso · {descanso.nome}</span>
          <span className="font-mono text-2xl font-black tabular-nums">{formatarSegundos((descanso.ate - agora) / 1000)}</span>
          <button type="button" onClick={() => setDescanso(null)} className="text-xs font-bold underline">Pular</button>
        </div>
      )}

      <ol className="flex-1 space-y-2 overflow-y-auto p-3" aria-label="Exercícios do treino">
        {itens.map((it, i) => (
          <li key={i} className={`rounded-2xl border p-3 transition-colors ${it.feito ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
            <div className="flex items-start gap-3">
              <button type="button" aria-label={`${it.feito ? "Desmarcar" : "Marcar"} ${it.nome}`} aria-pressed={it.feito} onClick={() => alterar(i, { feito: !it.feito })}
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 active:scale-95 ${it.feito ? "border-emerald-400 bg-emerald-400 text-slate-900" : "border-white/30"}`}>
                {it.feito && <Check className="h-5 w-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-bold ${it.feito ? "text-emerald-300 line-through decoration-2" : ""}`}>{it.nome}</p>
                <p className="text-xs text-white/60">{it.series} séries{it.reps ? ` × ${it.reps}` : ""}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-white/60">Carga
                    <input aria-label={`Carga de ${it.nome}`} inputMode="decimal" value={it.carga} onChange={e => alterar(i, { carga: e.target.value })}
                      className="w-20 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-right text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400" /> kg
                  </label>
                  <label className="flex items-center gap-1 text-xs text-white/60">Reps
                    <input aria-label={`Repetições de ${it.nome}`} value={it.reps} onChange={e => alterar(i, { reps: e.target.value })}
                      className="w-16 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-right text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400" />
                  </label>
                  {it.descanso ? (
                    <button type="button" onClick={() => setDescanso({ ate: Date.now() + (it.descanso ?? 0) * 1000, nome: it.nome })}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-bold hover:bg-white/20"><Timer className="h-3.5 w-3.5" /> {formatarSegundos(it.descanso)}</button>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
        {itens.length === 0 && <li className="p-6 text-center text-sm text-white/60">Esta ficha não tem exercícios. Edite a ficha para adicionar.</li>}
      </ol>

      <footer className="space-y-2 border-t border-white/10 p-3">
        {erro && <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{erro}</p>}
        <input aria-label="Observação do treino" value={obs} maxLength={500} onChange={e => setObs(e.target.value)} placeholder="Como foi? (opcional)"
          className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none" />
        <label className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={atualizarCargas} onChange={e => setAtualizarCargas(e.target.checked)} /> Levar as cargas de hoje para a ficha</label>
        <button type="button" onClick={() => void concluir()} disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-base font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
          {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Concluir treino
        </button>
      </footer>
    </div>
  );
}
