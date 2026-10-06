import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";

import type { CasamentoFornecedor, StatusFornecedor } from "@/shared/types";
import { ColumnFilter } from "@/react-app/components/ColumnFilter";
import FornecedorModal from "@/react-app/components/casamento/FornecedorModal";
import { useFiltrosColuna } from "@/react-app/hooks/useFiltrosColuna";
import type { Sincronizacao } from "@/react-app/hooks/useSincronizacao";
import { casamentoService, type FornecedorForm } from "@/react-app/services/CasamentoService";
import { ROTULO_STATUS_FORNECEDOR, formatarMoeda, totaisFornecedores } from "@/react-app/utils/casamento";
import { aplicarFiltrosColuna, valoresUnicos, type ColunasFiltro } from "@/react-app/utils/filtroColuna";

type Coluna = "fornecedor" | "categoria" | "status" | "valor";

const COLUNAS: ColunasFiltro<CasamentoFornecedor, Coluna> = {
  fornecedor: { valor: f => f.nmFornecedor },
  categoria: { valor: f => f.nmCategoria },
  status: { valor: f => ROTULO_STATUS_FORNECEDOR[f.nmStatus] },
  valor: { valor: f => formatarMoeda(f.vlValor), ordem: f => f.vlValor },
};

const COR_STATUS: Record<StatusFornecedor, string> = {
  PESQUISANDO: "bg-slate-100 text-slate-600",
  ORCAMENTO: "bg-amber-100 text-amber-700",
  CONTRATADO: "bg-green-100 text-green-700",
};

const paraForm = (f: CasamentoFornecedor, extra: Partial<FornecedorForm> = {}): FornecedorForm => ({
  nmFornecedor: f.nmFornecedor,
  nmCategoria: f.nmCategoria,
  txContato: f.txContato ?? "",
  nmStatus: f.nmStatus,
  vlValor: f.vlValor,
  txObservacao: f.txObservacao ?? "",
  ...extra,
});

export default function FornecedoresTab({ sync }: { sync: Sincronizacao }) {
  const [itens, setItens] = useState<CasamentoFornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [modal, setModal] = useState<{ fornecedor?: CasamentoFornecedor } | null>(null);
  const { filtros, ordenacao, aplicarFiltro, ordenar, limpar } = useFiltrosColuna<Coluna>({}, { coluna: "categoria", direcao: "asc" });

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      setItens(await casamentoService.listarFornecedores());
      setErroCarga(null);
    } catch (e) {
      setErroCarga(e instanceof Error && e.message ? e.message : "Não foi possível carregar os fornecedores.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const visiveis = useMemo(() => aplicarFiltrosColuna(itens, COLUNAS, filtros, ordenacao), [itens, filtros, ordenacao]);
  const totais = useMemo(() => totaisFornecedores(itens), [itens]);
  const filtrosAtivos = Object.keys(filtros).length > 0;

  const filtro = (coluna: Coluna, label: string) => (
    <ColumnFilter
      label={label}
      values={valoresUnicos(itens, COLUNAS[coluna])}
      selected={filtros[coluna] ?? null}
      sortDirection={ordenacao?.coluna === coluna ? ordenacao.direcao : null}
      onApply={valores => aplicarFiltro(coluna, valores)}
      onSort={direcao => ordenar(coluna, direcao)}
    />
  );

  const salvar = (form: FornecedorForm, atual?: CasamentoFornecedor) => {
    // Criar/editar via modal: sem otimismo (precisa do id/anexos do servidor); recarrega ao fim.
    void sync.executar({
      aplicar: () => undefined,
      desfazer: () => undefined,
      enviar: () => (atual ? casamentoService.alterarFornecedor(atual.idFornecedor, form) : casamentoService.criarFornecedor(form)),
    }).then(r => { if (r.ok) void carregar(true); });
  };

  const mudarStatus = (f: CasamentoFornecedor, nmStatus: StatusFornecedor) => {
    if (nmStatus === f.nmStatus) return;
    const antes = itens;
    void sync.executar({
      aplicar: () => setItens(l => l.map(x => (x.idFornecedor === f.idFornecedor ? { ...x, nmStatus } : x))),
      desfazer: () => setItens(antes),
      enviar: () => casamentoService.alterarFornecedor(f.idFornecedor, paraForm(f, { nmStatus })),
    });
  };

  const excluir = (f: CasamentoFornecedor) => {
    const aviso = f.qtAnexos > 0 ? ` Os ${f.qtAnexos} anexo(s) também serão excluídos.` : "";
    if (!window.confirm(`Excluir o fornecedor "${f.nmFornecedor}"?${aviso}`)) return;
    const antes = itens;
    void sync.executar({
      aplicar: () => setItens(l => l.filter(x => x.idFornecedor !== f.idFornecedor)),
      desfazer: () => setItens(antes),
      enviar: () => casamentoService.excluirFornecedor(f.idFornecedor),
    });
  };

  if (carregando) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>;
  }

  if (erroCarga) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-lg font-bold text-slate-800">Não foi possível carregar os fornecedores</h3>
        <p className="mt-1 text-sm text-slate-500">{erroCarga}</p>
        <button type="button" onClick={() => void carregar()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Contratados</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{totais.qtContratados}<span className="text-base font-bold text-slate-400"> / {totais.qtTotal}</span></p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Valor contratado</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{formatarMoeda(totais.vlContratado)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Valor total cadastrado</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{formatarMoeda(totais.vlEstimado)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {visiveis.length} de {itens.length} fornecedores
          {filtrosAtivos && <button type="button" onClick={limpar} className="ml-3 text-xs font-bold text-blue-600 hover:underline">Limpar filtros</button>}
        </div>
        <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Novo fornecedor
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">{filtro("fornecedor", "Fornecedor")}</th>
              <th className="px-4 py-3">{filtro("categoria", "Categoria")}</th>
              <th className="px-4 py-3">{filtro("status", "Status")}</th>
              <th className="px-4 py-3 text-right">{filtro("valor", "Valor")}</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                {itens.length === 0 ? "Nenhum fornecedor cadastrado." : "Nenhum fornecedor com os filtros atuais."}
              </td></tr>
            )}
            {visiveis.map(f => (
              <tr key={f.idFornecedor} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {f.nmFornecedor}
                  {f.qtAnexos > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-slate-400"><Paperclip className="h-3 w-3" />{f.qtAnexos}</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{f.nmCategoria}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Status de ${f.nmFornecedor}`}
                    value={f.nmStatus}
                    onChange={e => mudarStatus(f, e.target.value as StatusFornecedor)}
                    className={`rounded-full border-0 px-3 py-1 text-xs font-bold outline-none ${COR_STATUS[f.nmStatus]}`}
                  >
                    {(Object.keys(ROTULO_STATUS_FORNECEDOR) as StatusFornecedor[]).map(s => <option key={s} value={s}>{ROTULO_STATUS_FORNECEDOR[s]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatarMoeda(f.vlValor)}</td>
                <td className="px-4 py-3 text-slate-500">{f.txContato || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setModal({ fornecedor: f })} aria-label={`Editar ${f.nmFornecedor}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => excluir(f)} aria-label={`Excluir ${f.nmFornecedor}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <FornecedorModal
          // Recria o modal ao trocar de fornecedor para reiniciar o formulário e os anexos.
          key={modal.fornecedor?.idFornecedor ?? "novo"}
          fornecedor={modal.fornecedor}
          onSalvar={form => salvar(form, modal.fornecedor)}
          onAnexosAlterados={() => void carregar(true)}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
