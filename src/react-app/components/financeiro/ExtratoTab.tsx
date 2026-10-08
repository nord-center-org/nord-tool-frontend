import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Copy, Download, Loader2, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";

import type { FinanceiroCategoria, FinanceiroLancamento, FinanceiroPessoa, FinanceiroResumo, SituacaoFinanceiro, TipoFluxo } from "@/shared/types";
import { ColumnFilter } from "@/react-app/components/ColumnFilter";
import LancamentoFinanceiroModal from "@/react-app/components/financeiro/LancamentoFinanceiroModal";
import { useAtalhos } from "@/react-app/hooks/useAtalhos";
import { useFiltrosColuna } from "@/react-app/hooks/useFiltrosColuna";
import { useSincronizacao } from "@/react-app/hooks/useSincronizacao";
import { ApiError } from "@/react-app/services/apiClient";
import { financeiroService, type FiltroFinanceiro, type LancamentoFinanceiroForm } from "@/react-app/services/FinanceiroService";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";
import { dataBrParaIso, formatarMoeda } from "@/react-app/utils/casamento";
import {
  COLUNAS_PLANILHA, ROTULO_SITUACAO, ROTULO_TIPO, agruparPorMes, competenciaDaData, deslocarMes, descricaoExibida,
  filtrarPorBusca, linhasPlanilha, rotuloMes, rotuloParcela, totaisFinanceiro, valorAssinado,
} from "@/react-app/utils/financeiro";
import { aplicarFiltrosColuna, valoresUnicos, type ColunasFiltro } from "@/react-app/utils/filtroColuna";

type Coluna = "data" | "categoria" | "descricao" | "pessoa" | "autor" | "valor" | "situacao";

const COLUNAS: ColunasFiltro<FinanceiroLancamento, Coluna> = {
  data: { valor: l => l.dtLancamento, ordem: l => dataBrParaIso(l.dtLancamento) ?? "" },
  categoria: { valor: l => l.nmCategoria },
  descricao: { valor: l => descricaoExibida(l) },
  pessoa: { valor: l => l.nmPessoa },
  autor: { valor: l => l.nmUsuarioCriacao },
  valor: { valor: l => formatarMoeda(valorAssinado(l)), ordem: l => valorAssinado(l) },
  situacao: { valor: l => (l.inRealizado ? "Realizado" : "Previsto") },
};

const classeControle = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20";
const ULTIMA_PESSOA = "@NordTool:financeiro_ultima_pessoa";

function lerUltimaPessoa(): number | null {
  try {
    const n = Number(localStorage.getItem(ULTIMA_PESSOA));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

function gravarUltimaPessoa(id: number) {
  try { localStorage.setItem(ULTIMA_PESSOA, String(id)); } catch { /* sem armazenamento: segue sem lembrar */ }
}

interface ExtratoTabProps {
  pessoas: FinanceiroPessoa[];
  categorias: FinanceiroCategoria[];
  /** Filtro global da tela: 0 = todas as pessoas. */
  idPessoa: number;
  onGerenciarCadastros: () => void;
}

const classeValor = (l: FinanceiroLancamento) => (l.cdTipo === "ENTRADA" ? "text-green-700" : "text-red-600");

export default function ExtratoTab({ pessoas, categorias, idPessoa, onGerenciarCadastros }: ExtratoTabProps) {
  const sync = useSincronizacao();
  const [lancamentos, setLancamentos] = useState<FinanceiroLancamento[]>([]);
  const [resumo, setResumo] = useState<FinanceiroResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [competencia, setCompetencia] = useState(() => competenciaDaData(hojeSaoPaulo()));
  const [todosOsMeses, setTodosOsMeses] = useState(false);
  const [idCategoria, setIdCategoria] = useState<number | "">("");
  const [tipo, setTipo] = useState<TipoFluxo | "">("");
  const [situacao, setSituacao] = useState<SituacaoFinanceiro>("TODOS");
  const [busca, setBusca] = useState("");

  const [modal, setModal] = useState<{ lancamento?: FinanceiroLancamento; modelo?: FinanceiroLancamento } | null>(null);
  // Linhas com salvamento em andamento ficam travadas: a próxima marcação usaria uma versão velha (409).
  const [ocupados, setOcupados] = useState<number[]>([]);

  const { filtros, ordenacao, aplicarFiltro, ordenar, limpar } = useFiltrosColuna<Coluna>({}, { coluna: "data", direcao: "desc" });
  const requisicao = useRef(0);

  const filtroServidor = useMemo<FiltroFinanceiro>(() => ({
    competencia: todosOsMeses ? undefined : competencia,
    idPessoa: idPessoa || undefined,
    idCategoria: idCategoria || undefined,
    tipo: tipo || undefined,
    situacao,
  }), [todosOsMeses, competencia, idPessoa, idCategoria, tipo, situacao]);

  const recarregar = useCallback(async (silencioso = false) => {
    const minha = ++requisicao.current;
    if (!silencioso) setCarregando(true);
    try {
      const lista = await financeiroService.listar(filtroServidor);
      if (minha !== requisicao.current) return; // chegou uma resposta mais nova
      setLancamentos(lista.lancamentos);
      setResumo(lista.resumo);
      setErroCarga(null);
    } catch (e) {
      if (minha !== requisicao.current) return;
      setErroCarga(e instanceof Error && e.message ? e.message : "Não foi possível carregar o extrato.");
    } finally {
      if (minha === requisicao.current) setCarregando(false);
    }
  }, [filtroServidor]);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const atualizarResumo = () => { void financeiroService.resumo(filtroServidor).then(setResumo).catch(() => undefined); };

  const comBusca = useMemo(() => filtrarPorBusca(lancamentos, busca), [lancamentos, busca]);
  const visiveis = useMemo(() => aplicarFiltrosColuna(comBusca, COLUNAS, filtros, ordenacao), [comBusca, filtros, ordenacao]);
  const grupos = useMemo(() => agruparPorMes(visiveis), [visiveis]);
  const totalVisivel = useMemo(() => totaisFinanceiro(visiveis), [visiveis]);
  const filtrosAtivos = Object.keys(filtros).length > 0 || busca.trim() !== "" || idCategoria !== "" || tipo !== "" || situacao !== "TODOS";
  const categoriasFiltro = categorias.filter(c => c.cdProjecao !== "SALDO_ANTERIOR");

  const limparTudo = () => { limpar(); setBusca(""); setIdCategoria(""); setTipo(""); setSituacao("TODOS"); };

  const filtro = (coluna: Coluna, label: string) => (
    <ColumnFilter
      label={label}
      values={valoresUnicos(comBusca, COLUNAS[coluna])}
      selected={filtros[coluna] ?? null}
      sortDirection={ordenacao?.coluna === coluna ? ordenacao.direcao : null}
      onApply={valores => aplicarFiltro(coluna, valores)}
      onSort={direcao => ordenar(coluna, direcao)}
    />
  );

  const ocupar = (id: number, ocupado: boolean) => setOcupados(l => (ocupado ? [...l, id] : l.filter(x => x !== id)));

  /** Marcar/desmarcar "realizado" na tabela: otimista, com rollback da linha e tratamento do 409. */
  const marcar = (l: FinanceiroLancamento, valor: boolean) => {
    if (ocupados.includes(l.idLancamento)) return;
    ocupar(l.idLancamento, true);
    let conflito = false;
    const substituir = (novo: FinanceiroLancamento) =>
      setLancamentos(lista => lista.map(x => (x.idLancamento === l.idLancamento ? novo : x)));
    void sync.executar({
      aplicar: () => substituir({ ...l, inRealizado: valor }),
      desfazer: () => substituir(l),
      enviar: async () => {
        try {
          return await financeiroService.marcarRealizado(l.idLancamento, valor, l.nrVersao);
        } catch (e) {
          conflito = e instanceof ApiError && e.status === 409;
          throw e;
        }
      },
    }).then(r => {
      ocupar(l.idLancamento, false);
      if (r.ok) { substituir(r.valor); atualizarResumo(); }
      else if (conflito) void recarregar(true);
    });
  };

  const excluir = (l: FinanceiroLancamento) => {
    const parcela = rotuloParcela(l) ? ` (parcela ${rotuloParcela(l)}; as outras parcelas não são afetadas)` : "";
    if (!window.confirm(`Excluir "${descricaoExibida(l)}" (${formatarMoeda(l.vlLancamento)}) de ${l.dtLancamento}?${parcela}`)) return;
    ocupar(l.idLancamento, true);
    const antes = lancamentos;
    let conflito = false;
    void sync.executar({
      aplicar: () => setLancamentos(lista => lista.filter(x => x.idLancamento !== l.idLancamento)),
      desfazer: () => setLancamentos(antes),
      enviar: async () => {
        try {
          await financeiroService.excluir(l.idLancamento, l.nrVersao);
        } catch (e) {
          conflito = e instanceof ApiError && e.status === 409;
          throw e;
        }
      },
    }).then(r => {
      ocupar(l.idLancamento, false);
      if (r.ok) atualizarResumo();
      else if (conflito) void recarregar(true);
    });
  };

  /** Devolve a mensagem de erro para o modal (ou null se salvou). Em 409 fecha o modal, avisa e recarrega. */
  const salvarLancamento = async (form: LancamentoFinanceiroForm, atual?: FinanceiroLancamento): Promise<string | null> => {
    try {
      if (atual) await financeiroService.alterar(atual.idLancamento, form);
      else await financeiroService.criar(form);
      gravarUltimaPessoa(form.idPessoa);
      setModal(null);
      await recarregar(true);
      return null;
    } catch (e) {
      const mensagem = e instanceof Error && e.message ? e.message : "Não foi possível salvar o lançamento.";
      if (e instanceof ApiError && e.status === 409) {
        setModal(null);
        setAviso(mensagem);
        await recarregar(true);
        return null;
      }
      return mensagem;
    }
  };

  const exportar = () => {
    const planilha = XLSX.utils.json_to_sheet(linhasPlanilha(visiveis), { header: [...COLUNAS_PLANILHA] });
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Extrato");
    XLSX.writeFile(livro, "NordTool_Financeiro.xlsx");
  };

  const atalhos = useMemo(() => ({ n: () => setModal({}) }), []);
  useAtalhos(atalhos);

  const idPessoaPadrao = idPessoa || lerUltimaPessoa();
  const tituloPeriodo = todosOsMeses ? "Todos os meses" : rotuloMes(competencia);

  const acoes = (l: FinanceiroLancamento) => {
    const ocupado = ocupados.includes(l.idLancamento);
    const nome = descricaoExibida(l);
    return (
      <>
        <button type="button" disabled={ocupado} onClick={() => setModal({ lancamento: l })} aria-label={`Editar ${nome}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"><Pencil className="h-4 w-4" /></button>
        <button type="button" disabled={ocupado} onClick={() => setModal({ modelo: l })} aria-label={`Duplicar ${nome}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"><Copy className="h-4 w-4" /></button>
        <button type="button" disabled={ocupado} onClick={() => excluir(l)} aria-label={`Excluir ${nome}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
      </>
    );
  };

  const realizadoCheck = (l: FinanceiroLancamento) => (
    <input type="checkbox" aria-label={`${l.cdTipo === "ENTRADA" ? "Recebido" : "Pago"}: ${descricaoExibida(l)}`} checked={l.inRealizado}
      disabled={ocupados.includes(l.idLancamento)} onChange={e => marcar(l, e.target.checked)} className="h-4 w-4 accent-green-600" />
  );

  const selo = (l: FinanceiroLancamento) => (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${l.cdTipo === "ENTRADA" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
      {ROTULO_TIPO[l.cdTipo]}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Mês do extrato">
          <button type="button" disabled={todosOsMeses} onClick={() => setCompetencia(c => deslocarMes(c, -1))} aria-label="Mês anterior" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <input type="month" value={competencia} disabled={todosOsMeses} onChange={e => e.target.value && setCompetencia(e.target.value)} aria-label="Mês" className={`${classeControle} w-44`} />
          <button type="button" disabled={todosOsMeses} onClick={() => setCompetencia(c => deslocarMes(c, 1))} aria-label="Próximo mês" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" disabled={todosOsMeses} onClick={() => setCompetencia(competenciaDaData(hojeSaoPaulo()))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Este mês</button>
          <label className="inline-flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={todosOsMeses} onChange={e => setTodosOsMeses(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Todos os meses</label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onGerenciarCadastros} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Settings2 className="h-4 w-4" /> Pessoas e categorias</button>
          <button type="button" onClick={exportar} disabled={visiveis.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download className="h-4 w-4" /> Exportar</button>
          <button type="button" title="Atalho: N" onClick={() => setModal({})} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700"><Plus className="h-4 w-4" /> Novo lançamento</button>
        </div>
      </div>

      <div className="flex justify-end px-1" role="status" aria-live="polite">
        {sync.estado === "salvando" && <span className="flex items-center gap-2 text-xs font-medium text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" /> Salvando…</span>}
        {sync.estado === "ocioso" && <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400"><Check className="h-3.5 w-3.5" /> Tudo salvo</span>}
        {sync.estado === "erro" && (
          <span role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {sync.erro}
            <button type="button" onClick={sync.limparErro} aria-label="Dispensar erro" className="rounded p-0.5 hover:bg-red-100"><X className="h-3.5 w-3.5" /></button>
          </span>
        )}
      </div>

      {aviso && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{aviso} A lista foi atualizada.</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Dispensar aviso" className="rounded p-0.5 hover:bg-amber-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      <section aria-label={`Resumo: ${tituloPeriodo}`} className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-green-600">Entradas</p>
          <p className="mt-1 text-2xl font-black text-green-700">{resumo ? formatarMoeda(resumo.entradas) : "—"}</p>
          <p className="text-xs text-green-600/80">{resumo ? `${formatarMoeda(resumo.entradasRealizadas)} já recebido` : ""}</p>
        </article>
        <article className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-red-500">Saídas</p>
          <p className="mt-1 text-2xl font-black text-red-600">{resumo ? formatarMoeda(resumo.saidas) : "—"}</p>
          <p className="text-xs text-red-500/80">{resumo ? `${formatarMoeda(resumo.saidasRealizadas)} já pago` : ""}</p>
        </article>
        <article className={`rounded-2xl border p-5 shadow-sm ${resumo && resumo.saldo < 0 ? "border-red-300 bg-red-100" : "border-green-300 bg-green-100"}`}>
          <p className={`text-xs font-bold uppercase ${resumo && resumo.saldo < 0 ? "text-red-600" : "text-green-700"}`}>Saldo do período</p>
          <p className={`mt-1 text-2xl font-black ${resumo && resumo.saldo < 0 ? "text-red-700" : "text-green-800"}`}>{resumo ? formatarMoeda(resumo.saldo) : "—"}</p>
          <p className="text-xs text-slate-500">{resumo ? `${resumo.qtLancamentos} lançamento(s) · sem o saldo anterior` : ""}</p>
        </article>
      </section>

      <section aria-label="Filtros" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Categoria
          <select value={idCategoria} onChange={e => setIdCategoria(e.target.value === "" ? "" : Number(e.target.value))} className={`${classeControle} mt-1 block`}>
            <option value="">Todas</option>
            {categoriasFiltro.map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nmCategoria} ({ROTULO_TIPO[c.cdTipo].toLowerCase()})</option>)}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoFluxo | "")} className={`${classeControle} mt-1 block`}>
            <option value="">Entradas e saídas</option>
            <option value="ENTRADA">Só entradas</option>
            <option value="SAIDA">Só saídas</option>
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Situação
          <select value={situacao} onChange={e => setSituacao(e.target.value as SituacaoFinanceiro)} className={`${classeControle} mt-1 block`}>
            {(Object.keys(ROTULO_SITUACAO) as SituacaoFinanceiro[]).map(s => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Buscar
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Descrição, categoria ou pessoa" className={`${classeControle} mt-1 block w-full`} />
        </label>
        {filtrosAtivos && <button type="button" onClick={limparTudo} className="pb-2 text-xs font-bold text-blue-600 hover:underline">Limpar filtros</button>}
      </section>

      <p className="px-1 text-sm text-slate-500" aria-live="polite">
        {visiveis.length} lançamento(s) · saldo <strong className={totalVisivel.saldo < 0 ? "text-red-600" : "text-slate-700"}>{formatarMoeda(totalVisivel.saldo)}</strong>
        {" "}(entradas {formatarMoeda(totalVisivel.entradas)} · saídas {formatarMoeda(totalVisivel.saidas)})
      </p>

      {carregando ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
      ) : erroCarga ? (
        <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-slate-800">Não foi possível carregar o extrato</h3>
          <p className="mt-1 text-sm text-slate-500">{erroCarga}</p>
          <button type="button" onClick={() => void recarregar()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tentar novamente</button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">{filtro("data", "Data")}</th>
                  <th className="px-4 py-3">{filtro("categoria", "Categoria")}</th>
                  <th className="px-4 py-3">{filtro("descricao", "Descrição")}</th>
                  <th className="px-4 py-3">{filtro("pessoa", "De quem é")}</th>
                  <th className="px-4 py-3">{filtro("autor", "Digitado por")}</th>
                  <th className="px-4 py-3 text-right">{filtro("valor", "Valor")}</th>
                  <th className="px-4 py-3 text-center">{filtro("situacao", "Situação")}</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    {lancamentos.length === 0 && !filtrosAtivos ? `Nenhum lançamento em ${tituloPeriodo.toLowerCase()}. Cadastre o primeiro.` : "Nenhum lançamento com os filtros atuais."}
                  </td></tr>
                )}
                {grupos.map(g => (
                  <Fragment key={g.competencia}>
                    <tr className="border-t border-slate-200 bg-slate-100/70">
                      <th scope="colgroup" colSpan={5} className="px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-slate-600">{g.rotulo}</th>
                      <td colSpan={3} className="px-4 py-2 text-right text-xs text-slate-500">
                        <span className="text-green-700">+ {formatarMoeda(g.totais.entradas)}</span>{" · "}
                        <span className="text-red-600">− {formatarMoeda(g.totais.saidas)}</span>{" · "}
                        <strong className={g.totais.saldo < 0 ? "text-red-600" : "text-slate-700"}>saldo {formatarMoeda(g.totais.saldo)}</strong>
                      </td>
                    </tr>
                    {g.itens.map(l => (
                      <tr key={l.idLancamento} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{l.dtLancamento.slice(0, 5)}</td>
                        <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><span className="font-semibold text-slate-700">{l.nmCategoria}</span>{selo(l)}</div></td>
                        <td className="max-w-xs px-4 py-3 text-slate-600">
                          {descricaoExibida(l)}
                          {rotuloParcela(l) && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{rotuloParcela(l)}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{l.nmPessoa}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{l.nmUsuarioCriacao ?? "—"}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${classeValor(l)}`}>{formatarMoeda(valorAssinado(l))}</td>
                        <td className="px-4 py-3 text-center"><label className="inline-flex items-center gap-1.5 text-xs text-slate-500">{realizadoCheck(l)}{l.inRealizado ? (l.cdTipo === "ENTRADA" ? "Recebido" : "Pago") : "Previsto"}</label></td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{acoes(l)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {visiveis.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">Nenhum lançamento.</p>}
            {grupos.map(g => (
              <section key={g.competencia} aria-label={g.rotulo} className="space-y-2">
                <h3 className="px-1 text-xs font-black uppercase tracking-wide text-slate-500">{g.rotulo} · saldo <span className={g.totais.saldo < 0 ? "text-red-600" : "text-slate-700"}>{formatarMoeda(g.totais.saldo)}</span></h3>
                <ul className="space-y-2" aria-label={`Lançamentos de ${g.rotulo}`}>
                  {g.itens.map(l => (
                    <li key={l.idLancamento} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700">{descricaoExibida(l)}{rotuloParcela(l) && <span className="ml-2 text-xs font-bold text-slate-400">{rotuloParcela(l)}</span>}</p>
                          <p className="text-xs text-slate-400">{l.dtLancamento} · {l.nmCategoria} · {l.nmPessoa}</p>
                        </div>
                        <p className={`shrink-0 font-black tabular-nums ${classeValor(l)}`}>{formatarMoeda(valorAssinado(l))}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">{realizadoCheck(l)}{l.cdTipo === "ENTRADA" ? "Recebido" : "Pago"}</label>
                        <div className="flex items-center gap-1">{acoes(l)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {modal && (
        <LancamentoFinanceiroModal
          key={modal.lancamento?.idLancamento ?? (modal.modelo ? `copia-${modal.modelo.idLancamento}` : "novo")}
          lancamento={modal.lancamento}
          modelo={modal.modelo}
          pessoas={pessoas}
          categorias={categorias}
          idPessoaPadrao={idPessoaPadrao}
          onSalvar={form => salvarLancamento(form, modal.lancamento)}
          onGerenciarCadastros={onGerenciarCadastros}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
