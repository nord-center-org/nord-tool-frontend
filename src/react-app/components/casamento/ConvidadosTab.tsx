import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, MessageCircle, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";

import type { CasamentoConvidado, ImportacaoConvidados, StatusConvidado } from "@/shared/types";
import { ColumnFilter } from "@/react-app/components/ColumnFilter";
import ConvidadoModal from "@/react-app/components/casamento/ConvidadoModal";
import { useFiltrosColuna } from "@/react-app/hooks/useFiltrosColuna";
import type { Sincronizacao } from "@/react-app/hooks/useSincronizacao";
import { casamentoService, type ConvidadoForm } from "@/react-app/services/CasamentoService";
import {
  COLUNAS_PLANILHA, ROTULO_STATUS_CONVIDADO, SEM_GRUPO, SEM_MESA, linhasPlanilha, linkWhatsapp,
  resumoPorGrupo, resumoPorMesa, totaisConvidados,
} from "@/react-app/utils/convidados";
import { aplicarFiltrosColuna, valoresUnicos, type ColunasFiltro } from "@/react-app/utils/filtroColuna";

type Coluna = "nome" | "grupo" | "telefone" | "relacao" | "status" | "mesa";

const COLUNAS: ColunasFiltro<CasamentoConvidado, Coluna> = {
  nome: { valor: c => c.nmConvidado },
  grupo: { valor: c => c.nmGrupo ?? SEM_GRUPO },
  telefone: { valor: c => c.nrTelefone },
  relacao: { valor: c => c.nmRelacao },
  status: { valor: c => ROTULO_STATUS_CONVIDADO[c.nmStatus] },
  mesa: { valor: c => c.nmMesa ?? SEM_MESA },
};

const COR_STATUS: Record<StatusConvidado, string> = {
  NAO_CONVIDADO: "bg-slate-100 text-slate-600",
  CONVIDADO: "bg-blue-100 text-blue-700",
  CONFIRMADO: "bg-green-100 text-green-700",
  NAO_IRA: "bg-red-100 text-red-700",
};

const paraForm = (c: CasamentoConvidado, extra: Partial<ConvidadoForm> = {}): ConvidadoForm => ({
  nmConvidado: c.nmConvidado,
  nmGrupo: c.nmGrupo ?? "",
  nrTelefone: c.nrTelefone ?? "",
  nmRelacao: c.nmRelacao ?? "",
  nmStatus: c.nmStatus,
  nrAcompanhantes: c.nrAcompanhantes,
  nmMesa: c.nmMesa ?? "",
  ...extra,
});

export default function ConvidadosTab({ sync }: { sync: Sincronizacao }) {
  const [itens, setItens] = useState<CasamentoConvidado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [modal, setModal] = useState<{ convidado?: CasamentoConvidado } | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [relatorio, setRelatorio] = useState<ImportacaoConvidados | null>(null);
  const [erroImportacao, setErroImportacao] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const { filtros, ordenacao, aplicarFiltro, ordenar, limpar } = useFiltrosColuna<Coluna>({}, { coluna: "nome", direcao: "asc" });

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      setItens(await casamentoService.listarConvidados());
      setErroCarga(null);
    } catch (e) {
      setErroCarga(e instanceof Error && e.message ? e.message : "Não foi possível carregar os convidados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const visiveis = useMemo(() => aplicarFiltrosColuna(itens, COLUNAS, filtros, ordenacao), [itens, filtros, ordenacao]);
  const totais = useMemo(() => totaisConvidados(itens), [itens]);
  const porGrupo = useMemo(() => resumoPorGrupo(itens), [itens]);
  const porMesa = useMemo(() => resumoPorMesa(itens), [itens]);
  const grupos = useMemo(() => porGrupo.map(g => g.grupo).filter(g => g !== SEM_GRUPO), [porGrupo]);
  const filtrosAtivos = Object.keys(filtros).length > 0;

  const filtro = (coluna: Coluna, label: string, emptyLabel?: string) => (
    <ColumnFilter
      label={label}
      emptyLabel={emptyLabel}
      values={valoresUnicos(itens, COLUNAS[coluna])}
      selected={filtros[coluna] ?? null}
      sortDirection={ordenacao?.coluna === coluna ? ordenacao.direcao : null}
      onApply={valores => aplicarFiltro(coluna, valores)}
      onSort={direcao => ordenar(coluna, direcao)}
    />
  );

  const salvar = (form: ConvidadoForm, atual?: CasamentoConvidado) => {
    void sync.executar({
      aplicar: () => undefined,
      desfazer: () => undefined,
      enviar: () => (atual ? casamentoService.alterarConvidado(atual.idConvidado, form) : casamentoService.criarConvidado(form)),
    }).then(r => { if (r.ok) void carregar(true); });
  };

  const mudarStatus = (c: CasamentoConvidado, nmStatus: StatusConvidado) => {
    if (nmStatus === c.nmStatus) return;
    const antes = itens;
    void sync.executar({
      aplicar: () => setItens(l => l.map(x => (x.idConvidado === c.idConvidado ? { ...x, nmStatus } : x))),
      desfazer: () => setItens(antes),
      enviar: () => casamentoService.alterarConvidado(c.idConvidado, paraForm(c, { nmStatus })),
    });
  };

  const excluir = (c: CasamentoConvidado) => {
    if (!window.confirm(`Excluir o convidado "${c.nmConvidado}"?`)) return;
    const antes = itens;
    void sync.executar({
      aplicar: () => setItens(l => l.filter(x => x.idConvidado !== c.idConvidado)),
      desfazer: () => setItens(antes),
      enviar: () => casamentoService.excluirConvidado(c.idConvidado),
    });
  };

  const importar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setImportando(true);
    setErroImportacao(null);
    setRelatorio(null);
    try {
      setRelatorio(await casamentoService.importarConvidados(arquivo));
      await carregar(true);
    } catch (e) {
      setErroImportacao(e instanceof Error && e.message ? e.message : "Não foi possível importar a planilha.");
    } finally {
      setImportando(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  };

  const baixarPlanilha = (linhas: Record<string, string | number>[], arquivo: string, aba: string) => {
    const planilha = XLSX.utils.json_to_sheet(linhas, { header: [...COLUNAS_PLANILHA] });
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, aba);
    XLSX.writeFile(livro, arquivo);
    setMenuAberto(false);
  };

  const planilhaModelo = () => baixarPlanilha([{
    Nome: "Maria Silva", Grupo: "Família", Telefone: "(11) 90000-0000", "Relação": "Prima",
    Status: "Convidado", Acompanhantes: 1, Mesa: "3",
  }], "NordTool_Modelo_Convidados.xlsx", "Convidados");

  // A exportação respeita os filtros e a ordenação da tabela.
  const exportar = () => baixarPlanilha(linhasPlanilha(visiveis), "NordTool_Convidados.xlsx", "Convidados");

  if (carregando) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>;
  }

  if (erroCarga) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-lg font-bold text-slate-800">Não foi possível carregar os convidados</h3>
        <p className="mt-1 text-sm text-slate-500">{erroCarga}</p>
        <button type="button" onClick={() => void carregar()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section aria-label="Resumo por grupo" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Total</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{totais.qtConfirmados}<span className="text-base font-bold text-slate-400"> / {totais.qtConvidados}</span></p>
          <p className="text-xs text-slate-500">confirmados · <strong>{totais.qtPessoas}</strong> pessoas ({totais.qtPessoasConfirmadas} confirmadas)</p>
        </div>
        {porGrupo.map(g => (
          <div key={g.grupo} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400" title={g.grupo}>{g.grupo}</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{g.qtConfirmados}<span className="text-base font-bold text-slate-400"> / {g.qtConvidados}</span></p>
            <p className="text-xs text-slate-500">{g.qtPessoas} pessoas</p>
          </div>
        ))}
      </section>

      {porMesa.length > 0 && (
        <section aria-label="Resumo por mesa" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pessoas por mesa</h3>
          <ul className="flex flex-wrap gap-2">
            {porMesa.map(m => (
              <li key={m.mesa} className={`rounded-full px-3 py-1 text-xs font-bold ${m.mesa === SEM_MESA ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                {m.mesa === SEM_MESA ? m.mesa : `Mesa ${m.mesa}`}: {m.qtPessoas}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {visiveis.length} de {itens.length} convidados
          {filtrosAtivos && <button type="button" onClick={limpar} className="ml-3 text-xs font-bold text-blue-600 hover:underline">Limpar filtros</button>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input ref={inputArquivo} type="file" accept=".xlsx" hidden onChange={e => void importar(e.target.files?.[0])} />
            <button type="button" aria-haspopup="menu" aria-expanded={menuAberto} onClick={() => setMenuAberto(a => !a)} disabled={importando}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Planilha
            </button>
            {menuAberto && (
              <div role="menu" className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <button role="menuitem" type="button" onClick={() => { setMenuAberto(false); inputArquivo.current?.click(); }} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-xs text-slate-700 hover:bg-slate-50"><Upload className="h-4 w-4 text-blue-500" /> Importar planilha</button>
                <button role="menuitem" type="button" onClick={exportar} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-xs text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4 text-green-500" /> Exportar (filtro atual)</button>
                <button role="menuitem" type="button" onClick={planilhaModelo} className="flex w-full items-center gap-3 px-4 py-3 text-xs text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4 text-amber-500" /> Planilha modelo</button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Novo convidado
          </button>
        </div>
      </div>

      {erroImportacao && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroImportacao}</p>}
      {relatorio && (
        <section aria-label="Relatório da importação" className={`rounded-xl border px-4 py-3 text-sm ${relatorio.rejeitados.length ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          <div className="flex items-start justify-between gap-3">
            <p><strong>{relatorio.importados}</strong> convidado(s) importado(s){relatorio.rejeitados.length > 0 && <> · <strong>{relatorio.rejeitados.length}</strong> linha(s) rejeitada(s)</>}.</p>
            <button type="button" onClick={() => setRelatorio(null)} aria-label="Fechar relatório" className="rounded p-0.5 hover:bg-black/5"><X className="h-4 w-4" /></button>
          </div>
          {relatorio.rejeitados.length > 0 && (
            <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
              {relatorio.rejeitados.map(r => <li key={`${r.linha}-${r.motivo}`}>Linha {r.linha}: {r.motivo}</li>)}
            </ul>
          )}
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">{filtro("nome", "Nome")}</th>
              <th className="px-4 py-3">{filtro("grupo", "Grupo")}</th>
              <th className="px-4 py-3">{filtro("telefone", "Telefone", "Sem telefone")}</th>
              <th className="px-4 py-3">{filtro("relacao", "Relação", "Sem relação")}</th>
              <th className="px-4 py-3">{filtro("status", "Confirmação")}</th>
              <th className="px-4 py-3 text-right">Acomp.</th>
              <th className="px-4 py-3">{filtro("mesa", "Mesa")}</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                {itens.length === 0 ? "Nenhum convidado cadastrado. Cadastre ou importe uma planilha." : "Nenhum convidado com os filtros atuais."}
              </td></tr>
            )}
            {visiveis.map(c => {
              const whats = linkWhatsapp(c.nrTelefone);
              return (
                <tr key={c.idConvidado} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-semibold text-slate-700">{c.nmConvidado}</td>
                  <td className="px-4 py-3 text-slate-600">{c.nmGrupo || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.nrTelefone || "—"}
                    {whats && <a href={whats} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${c.nmConvidado}`} title="Abrir no WhatsApp" className="ml-2 inline-flex align-middle text-green-600 hover:text-green-700"><MessageCircle className="h-4 w-4" /></a>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.nmRelacao || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Confirmação de ${c.nmConvidado}`}
                      value={c.nmStatus}
                      onChange={e => mudarStatus(c, e.target.value as StatusConvidado)}
                      className={`rounded-full border-0 px-3 py-1 text-xs font-bold outline-none ${COR_STATUS[c.nmStatus]}`}
                    >
                      {(Object.keys(ROTULO_STATUS_CONVIDADO) as StatusConvidado[]).map(s => <option key={s} value={s}>{ROTULO_STATUS_CONVIDADO[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.nrAcompanhantes}</td>
                  <td className="px-4 py-3 text-slate-600">{c.nmMesa || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setModal({ convidado: c })} aria-label={`Editar ${c.nmConvidado}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => excluir(c)} aria-label={`Excluir ${c.nmConvidado}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ConvidadoModal
          key={modal.convidado?.idConvidado ?? "novo"}
          convidado={modal.convidado}
          grupos={grupos}
          onSalvar={form => salvar(form, modal.convidado)}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
