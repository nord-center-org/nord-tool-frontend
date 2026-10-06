import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import type { CasamentoMarco } from "@/shared/types";
import MarcoModal from "@/react-app/components/casamento/MarcoModal";
import type { Sincronizacao } from "@/react-app/hooks/useSincronizacao";
import { casamentoService, type MarcoForm } from "@/react-app/services/CasamentoService";
import { dataBrParaIso, estaAtrasado, hojeIso, ordenarMarcos, percentual } from "@/react-app/utils/casamento";

const paraForm = (m: CasamentoMarco, extra: Partial<MarcoForm> = {}): MarcoForm => ({
  nmTitulo: m.nmTitulo,
  dtPrazo: dataBrParaIso(m.dtPrazo),
  txObservacao: m.txObservacao ?? "",
  ...extra,
});

interface ItemMarcoProps {
  marco: CasamentoMarco;
  atrasado: boolean;
  salvando: boolean;
  onAlterar: (m: CasamentoMarco, alteracao: Partial<CasamentoMarco>, enviar: () => Promise<unknown>) => void;
  onEditar: () => void;
  onExcluir: () => void;
}

function ItemMarco({ marco, atrasado, salvando, onAlterar, onEditar, onExcluir }: ItemMarcoProps) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState(marco.txObservacao ?? "");
  const sujo = rascunho !== (marco.txObservacao ?? "");

  return (
    <li className="relative pl-8">
      <span className={`absolute left-0 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 ${marco.inConcluido ? "border-green-500 bg-green-500 text-white" : atrasado ? "border-red-500 bg-white" : "border-slate-300 bg-white"}`}>
        {marco.inConcluido && <Check className="h-3 w-3" />}
      </span>
      <div className={`rounded-2xl border bg-white p-4 shadow-sm ${atrasado ? "border-red-300" : "border-slate-200"}`}>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            aria-label={`Concluir ${marco.nmTitulo}`}
            checked={marco.inConcluido}
            onChange={e => {
              const concluido = e.target.checked;
              onAlterar(marco, { inConcluido: concluido }, () => casamentoService.concluirMarco(marco.idMarco, concluido));
            }}
            className="h-4 w-4 shrink-0 accent-blue-600"
          />
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-semibold ${marco.inConcluido ? "text-slate-400 line-through" : "text-slate-700"}`}>{marco.nmTitulo}</p>
            <p className={`text-xs ${atrasado ? "font-bold text-red-600" : "text-slate-400"}`}>
              {marco.dtPrazo ? `Prazo: ${marco.dtPrazo}` : "Sem prazo"}{atrasado ? " · atrasado" : ""}
            </p>
          </div>
          <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto} aria-label={`Observações de ${marco.nmTitulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onEditar} aria-label={`Editar ${marco.nmTitulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
          <button type="button" onClick={onExcluir} aria-label={`Excluir ${marco.nmTitulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
        {aberto && (
          <div className="mt-3 space-y-2">
            <textarea
              rows={3}
              maxLength={2000}
              value={rascunho}
              onChange={e => setRascunho(e.target.value)}
              placeholder="Observações do marco…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600">{sujo ? "Alterações não salvas" : ""}</span>
              <button
                type="button"
                disabled={!sujo || salvando}
                onClick={() => onAlterar(marco, { txObservacao: rascunho }, () => casamentoService.alterarMarco(marco.idMarco, paraForm(marco, { txObservacao: rascunho })))}
                className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Salvar observações
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export default function MarcosTab({ sync }: { sync: Sincronizacao }) {
  const [itens, setItens] = useState<CasamentoMarco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [modal, setModal] = useState<{ marco?: CasamentoMarco } | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      setItens(await casamentoService.listarMarcos());
      setErroCarga(null);
    } catch (e) {
      setErroCarga(e instanceof Error && e.message ? e.message : "Não foi possível carregar os marcos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const ordenados = useMemo(() => ordenarMarcos(itens), [itens]);
  const concluidos = itens.filter(m => m.inConcluido).length;
  const hoje = hojeIso();
  const atrasados = itens.filter(m => estaAtrasado(m.dtPrazo, m.inConcluido, hoje)).length;

  const alterar = (m: CasamentoMarco, alteracao: Partial<CasamentoMarco>, enviar: () => Promise<unknown>) => {
    const antes = itens;
    void sync.executar({
      aplicar: () => setItens(l => l.map(x => (x.idMarco === m.idMarco ? { ...x, ...alteracao } : x))),
      desfazer: () => setItens(antes),
      enviar,
    });
  };

  const salvarModal = (form: MarcoForm, atual?: CasamentoMarco) => {
    void sync.executar({
      aplicar: () => undefined,
      desfazer: () => undefined,
      enviar: () => (atual
        ? casamentoService.alterarMarco(atual.idMarco, { ...form, txObservacao: atual.txObservacao ?? "" })
        : casamentoService.criarMarco(form)),
    }).then(r => { if (r.ok) void carregar(true); });
  };

  const excluir = (m: CasamentoMarco) => {
    if (!window.confirm(`Excluir o marco "${m.nmTitulo}"?`)) return;
    const antes = itens;
    void sync.executar({
      aplicar: () => setItens(l => l.filter(x => x.idMarco !== m.idMarco)),
      desfazer: () => setItens(antes),
      enviar: () => casamentoService.excluirMarco(m.idMarco),
    });
  };

  const restaurarPadrao = () => {
    void sync.executar({
      aplicar: () => undefined,
      desfazer: () => undefined,
      enviar: () => casamentoService.criarMarcosPadrao(),
    }).then(r => { if (r.ok) void carregar(true); });
  };

  if (carregando) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>;
  }

  if (erroCarga) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-lg font-bold text-slate-800">Não foi possível carregar os marcos</h3>
        <p className="mt-1 text-sm text-slate-500">{erroCarga}</p>
        <button type="button" onClick={() => void carregar()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {concluidos} de {itens.length} concluídos ({percentual(concluidos, itens.length)}%)
          {atrasados > 0 && <span className="ml-3 font-bold text-red-600">{atrasados} atrasado(s)</span>}
        </p>
        <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Novo marco
        </button>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-bold text-slate-700">Nenhum marco cadastrado</h3>
          <p className="mt-1 text-sm text-slate-400">Comece com a lista padrão de marcos do casamento ou cadastre os seus.</p>
          <button type="button" onClick={restaurarPadrao} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> Restaurar marcos padrão
          </button>
        </div>
      ) : (
        <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[9px] before:top-4 before:w-0.5 before:bg-slate-200" aria-label="Linha do tempo dos marcos">
          {ordenados.map(m => (
            <ItemMarco
              key={m.idMarco}
              marco={m}
              atrasado={estaAtrasado(m.dtPrazo, m.inConcluido, hoje)}
              salvando={sync.estado === "salvando"}
              onAlterar={alterar}
              onEditar={() => setModal({ marco: m })}
              onExcluir={() => excluir(m)}
            />
          ))}
        </ol>
      )}

      {modal && (
        <MarcoModal key={modal.marco?.idMarco ?? "novo"} marco={modal.marco} onSalvar={form => salvarModal(form, modal.marco)} onFechar={() => setModal(null)} />
      )}
    </div>
  );
}
