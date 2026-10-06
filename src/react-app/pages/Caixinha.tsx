import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Download, Loader2, Paperclip, Pencil, PiggyBank, Plus, Trash2, Users, X } from "lucide-react";
import * as XLSX from "xlsx";

import type { CaixinhaLancamento, CaixinhaResponsavel, CaixinhaResumo, SituacaoCaixinha } from "@/shared/types";
import { ColumnFilter } from "@/react-app/components/ColumnFilter";
import ComprovantesModal from "@/react-app/components/caixinha/ComprovantesModal";
import LancamentoModal from "@/react-app/components/caixinha/LancamentoModal";
import ResponsaveisModal from "@/react-app/components/caixinha/ResponsaveisModal";
import { useFiltrosColuna } from "@/react-app/hooks/useFiltrosColuna";
import { useSincronizacao } from "@/react-app/hooks/useSincronizacao";
import { ApiError } from "@/react-app/services/apiClient";
import { caixinhaService, type FiltroCaixinha, type LancamentoForm } from "@/react-app/services/CaixinhaService";
import {
  COLUNAS_PLANILHA, ROTULO_SITUACAO, filtrarPorBusca, hojeSaoPaulo, linhasPlanilha, periodoDoMes, totaisCaixinha,
} from "@/react-app/utils/caixinha";
import { dataBrParaIso, formatarMoeda } from "@/react-app/utils/casamento";
import { aplicarFiltrosColuna, valoresUnicos, type ColunasFiltro } from "@/react-app/utils/filtroColuna";

type Coluna = "data" | "responsavel" | "insumo" | "valor" | "lancado" | "pago";

const COLUNAS: ColunasFiltro<CaixinhaLancamento, Coluna> = {
  data: { valor: l => l.dtLancamento, ordem: l => dataBrParaIso(l.dtLancamento) ?? "" },
  responsavel: { valor: l => l.nmResponsavel },
  insumo: { valor: l => l.txInsumo },
  valor: { valor: l => formatarMoeda(l.vlValor), ordem: l => l.vlValor },
  lancado: { valor: l => (l.inLancado ? "Sim" : "Não") },
  pago: { valor: l => (l.inPago ? "Sim" : "Não") },
};

const classeControle = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20";

export default function CaixinhaPage() {
  const sync = useSincronizacao();
  const [lancamentos, setLancamentos] = useState<CaixinhaLancamento[]>([]);
  const [responsaveis, setResponsaveis] = useState<CaixinhaResponsavel[]>([]);
  const [resumo, setResumo] = useState<CaixinhaResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [responsavel, setResponsavel] = useState("");
  const [situacao, setSituacao] = useState<SituacaoCaixinha>("TODOS");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");

  const [modal, setModal] = useState<{ lancamento?: CaixinhaLancamento } | null>(null);
  const [gerenciando, setGerenciando] = useState(false);
  const [idComprovantes, setIdComprovantes] = useState<number | null>(null);
  // Linhas com salvamento em andamento ficam travadas: a próxima marcação usaria uma versão velha (409).
  const [ocupados, setOcupados] = useState<number[]>([]);

  const { filtros, ordenacao, aplicarFiltro, ordenar, limpar } = useFiltrosColuna<Coluna>({}, { coluna: "data", direcao: "desc" });
  const requisicao = useRef(0);

  const filtroServidor = useMemo<FiltroCaixinha>(
    () => ({ responsavel: responsavel || undefined, situacao, de: de || undefined, ate: ate || undefined }),
    [responsavel, situacao, de, ate],
  );

  const recarregar = useCallback(async (silencioso = false) => {
    const minha = ++requisicao.current;
    if (!silencioso) setCarregando(true);
    try {
      const [lista, novoResumo] = await Promise.all([caixinhaService.listar(filtroServidor), caixinhaService.resumo(filtroServidor)]);
      if (minha !== requisicao.current) return; // chegou uma resposta mais nova
      setLancamentos(lista.lancamentos);
      setResponsaveis(lista.responsaveis);
      setResumo(novoResumo);
      setErroCarga(null);
    } catch (e) {
      if (minha !== requisicao.current) return;
      setErroCarga(e instanceof Error && e.message ? e.message : "Não foi possível carregar a Caixinha.");
    } finally {
      if (minha === requisicao.current) setCarregando(false);
    }
  }, [filtroServidor]);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const comBusca = useMemo(() => filtrarPorBusca(lancamentos, busca), [lancamentos, busca]);
  const visiveis = useMemo(() => aplicarFiltrosColuna(comBusca, COLUNAS, filtros, ordenacao), [comBusca, filtros, ordenacao]);
  const totalVisivel = useMemo(() => totaisCaixinha(visiveis), [visiveis]);
  const filtrosAtivos = Object.keys(filtros).length > 0 || busca.trim() !== "" || responsavel !== "" || situacao !== "TODOS" || de !== "" || ate !== "";

  const limparTudo = () => { limpar(); setBusca(""); setResponsavel(""); setSituacao("TODOS"); setDe(""); setAte(""); };

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

  const ocupar = (id: number, ocupado: boolean) =>
    setOcupados(l => (ocupado ? [...l, id] : l.filter(x => x !== id)));

  /** Marcar/desmarcar na tabela: otimista, com rollback da linha e tratamento do 409. */
  const marcar = (l: CaixinhaLancamento, campo: "lancado" | "pago", valor: boolean) => {
    if (ocupados.includes(l.idLancamento)) return;
    ocupar(l.idLancamento, true);
    let conflito = false;
    const substituir = (novo: CaixinhaLancamento) =>
      setLancamentos(lista => lista.map(x => (x.idLancamento === l.idLancamento ? novo : x)));
    void sync.executar({
      aplicar: () => substituir({ ...l, inLancado: campo === "lancado" ? valor : l.inLancado, inPago: campo === "pago" ? valor : l.inPago }),
      desfazer: () => substituir(l),
      enviar: async () => {
        try {
          return await caixinhaService.marcar(l.idLancamento, { [campo]: valor }, l.nrVersao);
        } catch (e) {
          conflito = e instanceof ApiError && e.status === 409;
          throw e;
        }
      },
    }).then(r => {
      ocupar(l.idLancamento, false);
      if (r.ok) { substituir(r.valor); void caixinhaService.resumo(filtroServidor).then(setResumo).catch(() => undefined); }
      else if (conflito) void recarregar(true);
    });
  };

  const excluir = (l: CaixinhaLancamento) => {
    const pdfs = l.qtComprovantes > 0 ? `\n\nOs ${l.qtComprovantes} PDF(s) deste lançamento também serão excluídos.` : "";
    if (!window.confirm(`Excluir o lançamento "${l.txInsumo}" (${formatarMoeda(l.vlValor)})?${pdfs}`)) return;
    ocupar(l.idLancamento, true);
    const antes = lancamentos;
    let conflito = false;
    void sync.executar({
      aplicar: () => setLancamentos(lista => lista.filter(x => x.idLancamento !== l.idLancamento)),
      desfazer: () => setLancamentos(antes),
      enviar: async () => {
        try {
          await caixinhaService.excluir(l.idLancamento, l.nrVersao);
        } catch (e) {
          conflito = e instanceof ApiError && e.status === 409;
          throw e;
        }
      },
    }).then(r => {
      ocupar(l.idLancamento, false);
      if (r.ok) void caixinhaService.resumo(filtroServidor).then(setResumo).catch(() => undefined);
      else if (conflito) void recarregar(true);
    });
  };

  /** Devolve a mensagem de erro para o modal (ou null se salvou). Em 409 fecha o modal, avisa e recarrega. */
  const salvarLancamento = async (form: LancamentoForm, atual?: CaixinhaLancamento): Promise<string | null> => {
    try {
      if (atual) await caixinhaService.alterar(atual.idLancamento, form);
      else await caixinhaService.criar(form);
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
    XLSX.utils.book_append_sheet(livro, planilha, "Caixinha");
    XLSX.writeFile(livro, "NordTool_Caixinha.xlsx");
  };

  const esteMes = () => { const p = periodoDoMes(hojeSaoPaulo()); setDe(p.de); setAte(p.ate); };

  const lancamentoComprovantes = lancamentos.find(l => l.idLancamento === idComprovantes) ?? null;

  const controlesLinha = (l: CaixinhaLancamento) => {
    const ocupado = ocupados.includes(l.idLancamento);
    return {
      lancado: <input type="checkbox" aria-label={`Lançado: ${l.txInsumo}`} checked={l.inLancado} disabled={ocupado} onChange={e => marcar(l, "lancado", e.target.checked)} className="h-4 w-4 accent-blue-600" />,
      pago: <input type="checkbox" aria-label={`Pago: ${l.txInsumo}`} checked={l.inPago} disabled={ocupado} onChange={e => marcar(l, "pago", e.target.checked)} className="h-4 w-4 accent-green-600" />,
      comprovantes: (
        <button type="button" onClick={() => setIdComprovantes(l.idLancamento)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">
          <Paperclip className="h-3.5 w-3.5" /> {l.qtComprovantes > 0 ? `PDFs (${l.qtComprovantes})` : "Anexar PDF"}
        </button>
      ),
      acoes: (
        <>
          <button type="button" disabled={ocupado} onClick={() => setModal({ lancamento: l })} aria-label={`Editar ${l.txInsumo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"><Pencil className="h-4 w-4" /></button>
          <button type="button" disabled={ocupado} onClick={() => excluir(l)} aria-label={`Excluir ${l.txInsumo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
        </>
      ),
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <header className="mx-auto mb-4 max-w-7xl rounded-2xl bg-slate-900 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <PiggyBank className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-blue-400">Caixinha</h1>
              <p className="text-sm text-slate-400">Controle de despesas</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setGerenciando(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"><Users className="h-4 w-4" /> Responsáveis</button>
            <button type="button" onClick={exportar} disabled={visiveis.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"><Download className="h-4 w-4" /> Exportar</button>
            <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700"><Plus className="h-4 w-4" /> Novo lançamento</button>
          </div>
        </div>
      </header>

      <div className="mx-auto mb-4 flex max-w-7xl justify-end px-1" role="status" aria-live="polite">
        {sync.estado === "salvando" && <span className="flex items-center gap-2 text-xs font-medium text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" /> Salvando…</span>}
        {sync.estado === "ocioso" && <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400"><Check className="h-3.5 w-3.5" /> Tudo salvo</span>}
        {sync.estado === "erro" && (
          <span role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {sync.erro}
            <button type="button" onClick={sync.limparErro} aria-label="Dispensar erro" className="rounded p-0.5 hover:bg-red-100"><X className="h-3.5 w-3.5" /></button>
          </span>
        )}
      </div>

      <main className="mx-auto max-w-7xl space-y-4">
        {aviso && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>{aviso} A lista foi atualizada.</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Dispensar aviso" className="rounded p-0.5 hover:bg-amber-100"><X className="h-4 w-4" /></button>
          </div>
        )}

        <section aria-label="Resumo" className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-400">Total de despesas</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{resumo ? formatarMoeda(resumo.total) : "—"}</p>
            <p className="text-xs text-slate-400">{resumo ? `${resumo.qtLancamentos} lançamento(s)` : ""}</p>
          </article>
          <article className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-green-600">Pago</p>
            <p className="mt-1 text-2xl font-black text-green-700">{resumo ? formatarMoeda(resumo.pago) : "—"}</p>
            <p className="text-xs text-green-600/80">{resumo ? `${resumo.qtPagos} pago(s)` : ""}</p>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-amber-600">A pagar</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{resumo ? formatarMoeda(resumo.aPagar) : "—"}</p>
            <p className="text-xs text-amber-600/80">{resumo ? `${resumo.qtPendentes} pendente(s)` : ""}</p>
          </article>
        </section>

        <section aria-label="Filtros" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Responsável
            <select value={responsavel} onChange={e => setResponsavel(e.target.value)} className={`${classeControle} mt-1 block`}>
              <option value="">Todos</option>
              {responsaveis.map(r => <option key={r.idResponsavel} value={r.nmResponsavel}>{r.nmResponsavel}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Situação
            <select value={situacao} onChange={e => setSituacao(e.target.value as SituacaoCaixinha)} className={`${classeControle} mt-1 block`}>
              {(Object.keys(ROTULO_SITUACAO) as SituacaoCaixinha[]).map(s => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">De
            <input type="date" value={de} max={ate || undefined} onChange={e => setDe(e.target.value)} className={`${classeControle} mt-1 block`} />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Até
            <input type="date" value={ate} min={de || undefined} onChange={e => setAte(e.target.value)} className={`${classeControle} mt-1 block`} />
          </label>
          <button type="button" onClick={esteMes} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Este mês</button>
          <label className="min-w-[12rem] flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Buscar insumo
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: cimento" className={`${classeControle} mt-1 block w-full`} />
          </label>
          {filtrosAtivos && <button type="button" onClick={limparTudo} className="pb-2 text-xs font-bold text-blue-600 hover:underline">Limpar filtros</button>}
        </section>

        <p className="px-1 text-sm text-slate-500" aria-live="polite">
          {visiveis.length} lançamento(s) · <strong className="text-slate-700">{formatarMoeda(totalVisivel.total)}</strong>
          {" "}(pago {formatarMoeda(totalVisivel.pago)} · a pagar {formatarMoeda(totalVisivel.aPagar)})
        </p>

        {carregando ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
        ) : erroCarga ? (
          <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-bold text-slate-800">Não foi possível carregar a Caixinha</h3>
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
                    <th className="px-4 py-3">{filtro("responsavel", "Responsável")}</th>
                    <th className="px-4 py-3">{filtro("insumo", "Insumo")}</th>
                    <th className="px-4 py-3 text-right">{filtro("valor", "Valor")}</th>
                    <th className="px-4 py-3 text-center">{filtro("lancado", "Lançado")}</th>
                    <th className="px-4 py-3 text-center">{filtro("pago", "Pago")}</th>
                    <th className="px-4 py-3">Comprovantes</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiveis.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      {lancamentos.length === 0 && !filtrosAtivos ? "Nenhum lançamento. Cadastre o primeiro." : "Nenhum lançamento com os filtros atuais."}
                    </td></tr>
                  )}
                  {visiveis.map(l => {
                    const c = controlesLinha(l);
                    return (
                      <tr key={l.idLancamento} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{l.dtLancamento}</td>
                        <td className="px-4 py-3 text-slate-600">{l.nmResponsavel}</td>
                        <td className="max-w-xs px-4 py-3 font-semibold text-slate-700">{l.txInsumo}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">{formatarMoeda(l.vlValor)}</td>
                        <td className="px-4 py-3 text-center">{c.lancado}</td>
                        <td className="px-4 py-3 text-center">{c.pago}</td>
                        <td className="px-4 py-3">{c.comprovantes}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{c.acoes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden" aria-label="Lançamentos">
              {visiveis.length === 0 && <li className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">Nenhum lançamento.</li>}
              {visiveis.map(l => {
                const c = controlesLinha(l);
                return (
                  <li key={l.idLancamento} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-700">{l.txInsumo}</p>
                        <p className="text-xs text-slate-400">{l.dtLancamento} · {l.nmResponsavel}</p>
                      </div>
                      <p className="shrink-0 font-black tabular-nums text-slate-800">{formatarMoeda(l.vlValor)}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <label className="inline-flex items-center gap-1.5">{c.lancado} Lançado</label>
                        <label className="inline-flex items-center gap-1.5">{c.pago} Pago</label>
                      </div>
                      <div className="flex items-center gap-1">{c.comprovantes}{c.acoes}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      {modal && (
        <LancamentoModal
          key={modal.lancamento?.idLancamento ?? "novo"}
          lancamento={modal.lancamento}
          responsaveis={responsaveis}
          onSalvar={form => salvarLancamento(form, modal.lancamento)}
          onGerenciarResponsaveis={() => setGerenciando(true)}
          onFechar={() => setModal(null)}
        />
      )}
      {gerenciando && (
        <ResponsaveisModal responsaveis={responsaveis} onAlterado={() => void recarregar(true)} onFechar={() => setGerenciando(false)} />
      )}
      {lancamentoComprovantes && (
        <ComprovantesModal lancamento={lancamentoComprovantes} onAlterado={() => void recarregar(true)} onFechar={() => setIdComprovantes(null)} />
      )}
    </div>
  );
}
