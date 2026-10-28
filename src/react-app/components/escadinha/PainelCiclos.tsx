import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, Clock3, ListChecks, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  dataCurta, novoId, progresso, statusCiclo, ROTULO_STATUS, type Ciclo, type Pavimento, type StatusAtividade,
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
  editavel: boolean;
  onAlterarCiclos: (ciclos: Ciclo[]) => void;
  onAlternar: (idAtividade: string) => void;
  onVerTudo: () => void;
  onAnexar: () => void;
  onModelo: () => void;
  onFechar: () => void;
  onFocar: (idPavimento: string) => void;
}

const mover = <T,>(lista: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
};

/**
 * Lista de ciclos da escadinha com as atividades; com um pavimento selecionado, só o ciclo dele.
 * No modo de edição: renomear o ciclo, mudar a data de início, adicionar/renomear/reordenar/remover atividades,
 * criar ciclos avulsos e mudar a ordem dos ciclos.
 */
export default function PainelCiclos({
  pavimentos, ciclos, selecionado, editavel, onAlterarCiclos, onAlternar, onVerTudo, onAnexar, onModelo, onFechar, onFocar,
}: PainelCiclosProps) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState(false);
  useEffect(() => { if (selecionado) setAbertos(new Set([selecionado])); }, [selecionado]);

  const nomeDoCiclo = (c: Ciclo) => c.nome?.trim() || pavimentos.find(p => p.id === c.idPavimento)?.nome || "Ciclo";
  const visiveis = ciclos.map((c, i) => ({ c, i })).filter(({ c }) => !selecionado || c.idPavimento === selecionado);
  const alternarGrupo = (id: string) => setAbertos(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const mudarCiclo = (i: number, parcial: Partial<Ciclo>) => onAlterarCiclos(ciclos.map((c, k) => (k === i ? { ...c, ...parcial } : c)));
  const mudarAtividades = (i: number, f: (a: Ciclo["atividades"]) => Ciclo["atividades"]) => mudarCiclo(i, { atividades: f(ciclos[i].atividades) });
  const novoCiclo = () => {
    const ultimo = ciclos[ciclos.length - 1];
    const id = novoId("extra");
    onAlterarCiclos([...ciclos, { idPavimento: id, nome: "Novo ciclo", inicio: ultimo?.inicio ?? new Date().toISOString().slice(0, 10), atividades: [] }]);
    setAbertos(a => new Set(a).add(id));
  };

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm animate-da-direita" aria-label="Ciclos e atividades da escadinha">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{selecionado ? "Ciclo do pavimento" : "Escadinha completa"}</p>
          <h3 className="text-lg font-bold text-slate-800">Ciclos e atividades</h3>
        </div>
        <div className="flex items-center gap-1">
          {editavel && (
            <button type="button" onClick={() => setEditando(e => !e)} aria-pressed={editando} title="Editar ciclos e atividades"
              className={`rounded-xl p-2 ${editando ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar lista de ciclos">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-2 border-b border-slate-100 p-4">
        {editavel && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onAnexar} className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Anexar projeto
            </button>
            <button type="button" onClick={onModelo} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <Settings2 className="h-4 w-4" /> Modelo
            </button>
          </div>
        )}
        {selecionado && (
          <button type="button" onClick={onVerTudo} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <ListChecks className="h-4 w-4" /> Ver escadinha completa
          </button>
        )}
        {editando && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Modo de edição: mude nomes, datas e atividades. Tudo é salvo sozinho.</p>}
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {visiveis.map(({ c: ciclo, i }) => {
          const status = statusCiclo(ciclo);
          const pct = Math.round(progresso(ciclo) * 100);
          const aberto = abertos.has(ciclo.idPavimento) || editando;
          const nome = nomeDoCiclo(ciclo);
          const doPavimento = pavimentos.some(p => p.id === ciclo.idPavimento);
          return (
            <li key={ciclo.idPavimento} className={`rounded-2xl border ${ciclo.idPavimento === selecionado ? "border-orange-300 ring-2 ring-orange-100" : "border-slate-200"}`}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                {editando ? (
                  <div className="min-w-0 flex-1 space-y-1">
                    <input value={ciclo.nome ?? ""} placeholder={nome} onChange={e => mudarCiclo(i, { nome: e.target.value.slice(0, 60) || undefined })}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-bold text-slate-800" aria-label="Nome do ciclo" />
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      Início
                      <input type="date" value={ciclo.inicio} onChange={e => e.target.value && mudarCiclo(i, { inicio: e.target.value })}
                        className="rounded-lg border border-slate-200 px-1.5 py-0.5 text-[11px]" />
                    </label>
                  </div>
                ) : (
                  <button type="button" onClick={() => alternarGrupo(ciclo.idPavimento)} aria-expanded={aberto} aria-controls={`ciclo-${ciclo.idPavimento}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${aberto ? "" : "-rotate-90"}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">{nome}</span>
                      <span className="block text-[11px] font-medium text-slate-400">Início {dataCurta(ciclo.inicio)} · {pct}%</span>
                    </span>
                  </button>
                )}
                {editando ? (
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => onAlterarCiclos(mover(ciclos, i, -1))} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label={`Subir ${nome}`}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => onAlterarCiclos(mover(ciclos, i, 1))} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label={`Descer ${nome}`}><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Andamento ${nome}`}>
                      <div className={`h-full rounded-full ${BARRA[status]}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                    </div>
                    <span title={ROTULO_STATUS[status]}><IconeStatus status={status} /></span>
                  </>
                )}
                {!selecionado && !editando && doPavimento && (
                  <button type="button" onClick={() => onFocar(ciclo.idPavimento)} className="rounded-lg px-1.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50" aria-label={`Abrir ${nome} em 2D`}>
                    2D
                  </button>
                )}
                {editando && (
                  <button type="button" onClick={() => onAlterarCiclos(ciclos.filter((_, k) => k !== i))} className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Excluir ${nome}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {aberto && (
                <ul id={`ciclo-${ciclo.idPavimento}`} className="space-y-1 border-t border-slate-100 px-3 py-2 animate-entrada">
                  {ciclo.atividades.map((a, k) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-0.5">
                      {editando ? (
                        <>
                          <input value={a.nome} onChange={e => mudarAtividades(i, l => l.map(x => (x.id === a.id ? { ...x, nome: e.target.value.slice(0, 80) } : x)))}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700" aria-label="Nome da atividade" />
                          <button type="button" onClick={() => mudarAtividades(i, l => mover(l, k, -1))} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label={`Subir ${a.nome}`}><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => mudarAtividades(i, l => mover(l, k, 1))} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label={`Descer ${a.nome}`}><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => mudarAtividades(i, l => l.filter(x => x.id !== a.id))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${a.nome}`}><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 truncate text-sm text-slate-600">{a.nome}</span>
                          <button type="button" onClick={() => editavel && onAlternar(a.id)} disabled={!editavel} title={editavel ? "Tocar para mudar o status" : ROTULO_STATUS[a.status]}
                            className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${CHIP[a.status]}`}>
                            <IconeStatus status={a.status} className="h-3 w-3" />
                            {ROTULO_STATUS[a.status]}
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                  {!ciclo.atividades.length && !editando && <li className="text-xs text-slate-400">Sem atividades. Use o lápis para adicionar.</li>}
                  {editando && (
                    <li>
                      <button type="button" onClick={() => mudarAtividades(i, l => [...l, { id: novoId(ciclo.idPavimento), nome: "Nova atividade", status: "pendente" }])}
                        className="mt-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50">
                        <Plus className="h-3.5 w-3.5" /> Atividade
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
        {editando && !selecionado && (
          <li>
            <button type="button" onClick={novoCiclo} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 px-3 py-3 text-sm font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600">
              <Plus className="h-4 w-4" /> Novo ciclo
            </button>
          </li>
        )}
      </ul>
    </aside>
  );
}
