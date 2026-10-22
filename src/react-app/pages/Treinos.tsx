import { useCallback, useEffect, useMemo, useState } from "react";
import { Dumbbell, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react";

import EditorTreino from "@/react-app/components/treinos/EditorTreino";
import ModoTreino from "@/react-app/components/treinos/ModoTreino";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { treinoService, type Treino, type TreinoSessao } from "@/react-app/services/TreinoService";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";
import { DIAS_CURTOS, diasDeTexto, formatarCarga, quandoFoi, treinosDoDia, treinosNaSemana } from "@/react-app/utils/treinos";

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

/** Treinos (Gestão Individual): fichas, treino do dia, modo treino e histórico. Cada pessoa vê só os seus. */
export default function TreinosPage() {
  const [treinos, setTreinos] = useState<Treino[] | null>(null);
  const [sessoes, setSessoes] = useState<TreinoSessao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Treino | "novo" | null>(null);
  const [treinando, setTreinando] = useState<Treino | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const hoje = hojeSaoPaulo();

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [t, s] = await Promise.all([treinoService.listar(), treinoService.sessoes(30)]);
      setTreinos(t);
      setSessoes(s);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível carregar os treinos."));
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const deHoje = useMemo(() => treinosDoDia(treinos ?? [], hoje), [treinos, hoje]);
  const naSemana = treinosNaSemana(sessoes, hoje);

  const excluirSessao = async (s: TreinoSessao) => {
    if (!window.confirm(`Apagar o registro de ${s.nmTreino} em ${s.dtSessao.split("-").reverse().join("/")}?`)) return;
    try { await treinoService.excluirSessao(s.id); await carregar(); } catch (e) { setErro(mensagem(e, "Não foi possível apagar.")); }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina icone={Dumbbell} titulo="Treinos" subtitulo={`${naSemana} treino${naSemana === 1 ? "" : "s"} nesta semana`}
        acoes={<button type="button" onClick={() => setEditando("novo")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Nova ficha</button>} />

      {aviso && <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{aviso}</p>}
      {erro && <div role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro} <button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar de novo</button></div>}

      {!treinos ? (!erro && <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>) : (
        <div className="space-y-6">
          {deHoje.length > 0 && (
            <section aria-label="Treino de hoje" className="animate-surgir rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">Treino de hoje</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {deHoje.map(t => (
                  <button key={t.id} type="button" onClick={() => setTreinando(t)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 shadow active:scale-[0.98]">
                    <Play className="h-4 w-4" /> {t.nmTreino}
                  </button>
                ))}
              </div>
            </section>
          )}

          {treinos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              Nenhuma ficha ainda. <button type="button" onClick={() => setEditando("novo")} className="font-bold text-blue-600">Montar a primeira</button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Fichas de treino">
              {treinos.map(t => {
                const dias = diasDeTexto(t.txDias);
                return (
                  <li key={t.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${t.inAtivo ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-800">{t.nmTreino}</p>
                        <p className="text-xs text-slate-500">{t.exercicios.length} exercício(s) · {quandoFoi(t.dtUltimaSessao, hoje)}</p>
                      </div>
                      <button type="button" onClick={() => setEditando(t)} aria-label={`Editar ${t.nmTreino}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-2 flex gap-1" aria-label="Dias">
                      {DIAS_CURTOS.map((d, i) => <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${dias.includes(i + 1) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>{d}</span>)}
                    </div>
                    <ul className="mt-3 space-y-0.5 text-xs text-slate-600">
                      {t.exercicios.slice(0, 4).map(e => <li key={e.id} className="truncate">• {e.nmExercicio} <span className="text-slate-400">{e.nrSeries}×{e.txRepeticoes ?? "?"}{e.vlCarga != null ? ` · ${formatarCarga(e.vlCarga)}` : ""}</span></li>)}
                      {t.exercicios.length > 4 && <li className="text-slate-400">+ {t.exercicios.length - 4} outro(s)</li>}
                    </ul>
                    <button type="button" onClick={() => setTreinando(t)} disabled={t.exercicios.length === 0}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40 active:scale-[0.98]">
                      <Play className="h-4 w-4" /> Treinar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <section aria-label="Histórico" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-slate-800">Histórico</h3>
            {sessoes.length === 0 ? <p className="text-sm text-slate-400">Os treinos que você concluir aparecem aqui.</p> : (
              <ul className="divide-y divide-slate-100">
                {sessoes.map(s => (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{s.nmTreino}</p>
                      <p className="text-xs text-slate-400">{s.dtSessao.split("-").reverse().join("/")}{s.nrDuracaoMin ? ` · ${s.nrDuracaoMin} min` : ""} · {s.exercicios.filter(e => e.inFeito).length}/{s.exercicios.length} feitos</p>
                      {s.txObservacao && <p className="text-xs italic text-slate-500">“{s.txObservacao}”</p>}
                    </div>
                    <button type="button" onClick={() => void excluirSessao(s)} aria-label={`Apagar registro de ${s.nmTreino}`} className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {editando && (
        <EditorTreino treino={editando === "novo" ? null : editando} onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); setAviso("Ficha salva."); void carregar(); }}
          onExcluido={() => { setEditando(null); void carregar(); }} />
      )}
      {treinando && (
        <ModoTreino treino={treinando} onFechar={() => setTreinando(null)}
          onConcluido={s => { setTreinando(null); setAviso(`Treino registrado: ${s.nmTreino} · ${s.nrDuracaoMin ?? 0} min. Bom trabalho!`); void carregar(); }} />
      )}
    </div>
  );
}
