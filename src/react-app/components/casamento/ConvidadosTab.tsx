import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, CornerDownRight, Download, FileSpreadsheet, Loader2, MessageCircle, Pencil, Plus, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";

import type { CasamentoConvidado, ImportacaoConvidados, StatusConvidado } from "@/shared/types";
import { ColumnFilter } from "@/react-app/components/ColumnFilter";
import AcoesEmMassaConvidados from "@/react-app/components/casamento/AcoesEmMassaConvidados";
import ConvidadoModal from "@/react-app/components/casamento/ConvidadoModal";
import { useFiltrosColuna } from "@/react-app/hooks/useFiltrosColuna";
import type { Sincronizacao } from "@/react-app/hooks/useSincronizacao";
import { casamentoService, type ConvidadoForm } from "@/react-app/services/CasamentoService";
import {
  COLUNAS_PLANILHA, ROTULO_STATUS_CONVIDADO, SEM_GRUPO, SEM_MESA, filtrarPorBusca, gruposEfetivos, linhasPlanilha, linkWhatsapp,
  organizarEmFamilias, resumirCascata, resumoPorGrupo, resumoPorMesa, totaisConvidados,
} from "@/react-app/utils/convidados";
import { aplicarFiltrosColuna, valoresUnicos, type ColunasFiltro } from "@/react-app/utils/filtroColuna";
import { executarEmLotes } from "@/react-app/utils/movimentacaoMassa";

type Coluna = "nome" | "grupo" | "telefone" | "relacao" | "cortejo" | "status" | "mesa";

const colunasDaTabela = (grupoPorId: Map<number, string>): ColunasFiltro<CasamentoConvidado, Coluna> => ({
  nome: { valor: c => c.nmConvidado },
  grupo: { valor: c => grupoPorId.get(c.idConvidado) ?? SEM_GRUPO },
  telefone: { valor: c => c.nrTelefone },
  relacao: { valor: c => c.nmRelacao },
  cortejo: { valor: c => c.nmCortejo },
  status: { valor: c => ROTULO_STATUS_CONVIDADO[c.nmStatus] },
  mesa: { valor: c => c.nmMesa ?? SEM_MESA },
});

const COR_STATUS: Record<StatusConvidado, string> = {
  NAO_CONVIDADO: "bg-slate-100 text-slate-600",
  CONVIDADO: "bg-blue-100 text-blue-700",
  CONFIRMADO: "bg-green-100 text-green-700",
  NAO_IRA: "bg-red-100 text-red-700",
};

const CASCATA_RECOLHIDA = "@NordTool:casamento_cascata_recolhida";

/** Convidados cuja cascata o usuário recolheu (lembrado no navegador). */
function lerRecolhidos(): number[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CASCATA_RECOLHIDA) ?? "[]");
    return Array.isArray(lista) ? lista.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

const paraForm = (c: CasamentoConvidado, extra: Partial<ConvidadoForm> = {}): ConvidadoForm => ({
  nmConvidado: c.nmConvidado,
  nmGrupo: c.nmGrupo ?? "",
  nrTelefone: c.nrTelefone ?? "",
  nmRelacao: c.nmRelacao ?? "",
  nmStatus: c.nmStatus,
  nrAcompanhantes: c.nrAcompanhantes,
  nmMesa: c.nmMesa ?? "",
  idConvidadoPrincipal: c.idConvidadoPrincipal,
  nmCortejo: c.nmCortejo ?? "",
  ...extra,
});

export default function ConvidadosTab({ sync }: { sync: Sincronizacao }) {
  const [itens, setItens] = useState<CasamentoConvidado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [modal, setModal] = useState<{ convidado?: CasamentoConvidado } | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [massaOcupada, setMassaOcupada] = useState(false);
  const [avisoMassa, setAvisoMassa] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [recolhidos, setRecolhidos] = useState<number[]>(lerRecolhidos);
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

  // Quem foi excluído (ou sumiu numa recarga) sai da seleção.
  useEffect(() => {
    setSelecionados(atual => { const ids = new Set(itens.map(c => c.idConvidado)); const resto = atual.filter(id => ids.has(id)); return resto.length === atual.length ? atual : resto; });
  }, [itens]);

  // Quem acompanha alguém conta no grupo de quem ele acompanha (não existe grupo só de acompanhantes).
  const grupoPorId = useMemo(() => gruposEfetivos(itens), [itens]);
  const COLUNAS = useMemo(() => colunasDaTabela(grupoPorId), [grupoPorId]);

  // Filtros por coluna e depois a busca por texto (nome, grupo, telefone, mesa, cortejo...).
  const visiveis = useMemo(
    () => filtrarPorBusca(aplicarFiltrosColuna(itens, COLUNAS, filtros, ordenacao), busca),
    [itens, COLUNAS, filtros, ordenacao, busca],
  );
  // Cada ligado fica logo abaixo de quem acompanha (cascata), respeitando filtros e ordenação.
  const linhasCompletas = useMemo(() => organizarEmFamilias(visiveis), [visiveis]);
  // Cada convidado com acompanhantes tem uma setinha na própria linha para recolher/mostrar a sua cascata.
  // Ao buscar, tudo o que a busca encontra aparece (senão um ligado achado ficaria escondido).
  const emBusca = busca.trim() !== "";
  const cascata = useMemo(() => resumirCascata(linhasCompletas, emBusca ? new Set<number>() : new Set(recolhidos)), [linhasCompletas, recolhidos, emBusca]);
  const linhas = cascata.visiveis;
  const selecionadosItens = useMemo(() => itens.filter(c => selecionados.includes(c.idConvidado)), [itens, selecionados]);
  const idsVisiveis = useMemo(() => linhas.map(l => l.item.idConvidado), [linhas]);
  const todosMarcados = idsVisiveis.length > 0 && idsVisiveis.every(id => selecionados.includes(id));
  const algunsMarcados = !todosMarcados && idsVisiveis.some(id => selecionados.includes(id));
  const alternarSelecao = (id: number) => setSelecionados(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]));
  const alternarTodos = () => setSelecionados(l => (todosMarcados ? l.filter(id => !idsVisiveis.includes(id)) : [...new Set([...l, ...idsVisiveis])]));

  /** Aplica a mesma alteração a todos os selecionados (3 por vez); uma falha não interrompe as demais. */
  const aplicarEmMassa = (alteracao: Partial<ConvidadoForm>, descricao: string) => {
    const alvo = selecionadosItens;
    if (alvo.length === 0 || massaOcupada) return;
    setMassaOcupada(true);
    setAvisoMassa(null);
    void sync.executar({
      aplicar: () => undefined,
      desfazer: () => undefined,
      enviar: async () => {
        const resultados = await executarEmLotes(alvo, c => casamentoService.alterarConvidado(c.idConvidado, paraForm(c, alteracao)), 3);
        const falhas = resultados.filter(r => r.erro);
        if (falhas.length > 0) {
          throw new Error(`${falhas.length} de ${alvo.length} não foram alterados: ${falhas[0].item.nmConvidado} (${falhas[0].erro})`);
        }
      },
    }).then(r => {
      setMassaOcupada(false);
      void carregar(true);
      if (r.ok) setAvisoMassa(`${alvo.length} convidado(s) atualizado(s): ${descricao}.`);
    });
  };

  const alternarRecolhido = (id: number) => {
    setRecolhidos(atual => {
      const proximo = atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id];
      try { localStorage.setItem(CASCATA_RECOLHIDA, JSON.stringify(proximo)); } catch { /* sem armazenamento: segue sem lembrar */ }
      return proximo;
    });
  };
  const totais = useMemo(() => totaisConvidados(itens), [itens]);
  const porGrupo = useMemo(
    () => resumoPorGrupo(itens.map(c => ({ ...c, nmGrupo: grupoPorId.get(c.idConvidado) === SEM_GRUPO ? null : grupoPorId.get(c.idConvidado) ?? null }))),
    [itens, grupoPorId],
  );
  const porMesa = useMemo(() => resumoPorMesa(itens), [itens]);
  const grupos = useMemo(() => porGrupo.map(g => g.grupo).filter(g => g !== SEM_GRUPO), [porGrupo]);
  const filtrosAtivos = Object.keys(filtros).length > 0;
  // O card de um grupo está "ativo" quando o único filtro de coluna é aquele grupo.
  const filtroGrupo = Object.keys(filtros).length === 1 && filtros.grupo?.length === 1 ? filtros.grupo[0] : null;

  // Clicar num card aplica o filtro dele: limpa o resto (outros filtros e a busca) para a lista bater com o número do card.
  const filtrarPorGrupo = (grupo: string) => {
    const jaAtivo = filtroGrupo === grupo;
    limpar();
    setBusca("");
    if (!jaAtivo) aplicarFiltro("grupo", [grupo]);
  };
  const mostrarTodos = () => { limpar(); setBusca(""); };

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
        <button type="button" onClick={mostrarTodos} aria-pressed={!filtroGrupo && !filtrosAtivos && !busca}
          title="Mostrar todos os convidados (limpa os filtros)"
          className={`rounded-2xl border bg-blue-50 p-4 text-left shadow-sm transition hover:shadow-md ${!filtroGrupo && !filtrosAtivos && !busca ? "border-blue-400 ring-2 ring-blue-200" : "border-blue-200"}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Total</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{totais.qtConfirmados}<span className="text-base font-bold text-slate-400"> / {totais.qtConvidados}</span></p>
          <p className="text-xs text-slate-500">confirmados</p>
        </button>
        {porGrupo.map(g => (
          <button key={g.grupo} type="button" onClick={() => filtrarPorGrupo(g.grupo)} aria-pressed={filtroGrupo === g.grupo}
            title={filtroGrupo === g.grupo ? "Clique para tirar o filtro deste grupo" : `Mostrar só o grupo ${g.grupo}`}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${filtroGrupo === g.grupo ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"}`}>
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400" title={g.grupo}>{g.grupo}</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{g.qtConfirmados}<span className="text-base font-bold text-slate-400"> / {g.qtConvidados}</span></p>
          </button>
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar convidado"
              placeholder="Buscar convidado…"
              className="w-72 max-w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            {busca && (
              <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {visiveis.length} de {itens.length} convidados
            {linhasCompletas.length > linhas.length && <span className="ml-1 text-xs text-slate-400">({linhasCompletas.length - linhas.length} recolhido(s))</span>}
            {(filtrosAtivos || busca) && <button type="button" onClick={() => { limpar(); setBusca(""); }} className="ml-3 text-xs font-bold text-blue-600 hover:underline">Limpar filtros</button>}
          </div>
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

      {avisoMassa && <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{avisoMassa}</p>}
      {selecionadosItens.length > 0 && (
        <AcoesEmMassaConvidados selecionados={selecionadosItens} todos={itens} grupos={grupos} ocupado={massaOcupada}
          onAplicar={aplicarEmMassa} onLimpar={() => setSelecionados([])} />
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-400">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" aria-label="Selecionar todos os convidados da lista" checked={todosMarcados}
                  ref={el => { if (el) el.indeterminate = algunsMarcados; }} onChange={alternarTodos} className="h-4 w-4 accent-blue-600" />
              </th>
              <th className="px-4 py-3">{filtro("nome", "Nome")}</th>
              <th className="px-4 py-3">{filtro("grupo", "Grupo")}</th>
              <th className="px-4 py-3">{filtro("telefone", "Telefone", "Sem telefone")}</th>
              <th className="px-4 py-3">{filtro("relacao", "Relação", "Sem relação")}</th>
              <th className="px-4 py-3">{filtro("cortejo", "Cortejo", "Fora do cortejo")}</th>
              <th className="px-4 py-3">{filtro("status", "Confirmação")}</th>
              <th className="px-4 py-3 text-right">Acomp.</th>
              <th className="px-4 py-3">{filtro("mesa", "Mesa")}</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                {itens.length === 0 ? "Nenhum convidado cadastrado. Cadastre ou importe uma planilha." : "Nenhum convidado com os filtros atuais."}
              </td></tr>
            )}
            {linhas.map(({ item: c, nivel, principalForaDaLista }) => {
              const whats = linkWhatsapp(c.nrTelefone);
              return (
                <tr key={c.idConvidado} className={selecionados.includes(c.idConvidado) ? "bg-blue-50 hover:bg-blue-50" : c.nmCortejo ? "bg-violet-50/50 hover:bg-violet-50" : "hover:bg-slate-50/60"} style={c.nmCortejo ? { boxShadow: "inset 4px 0 0 0 #a78bfa" } : undefined}>
                  <td className="w-10 px-4 py-3">
                    <input type="checkbox" aria-label={`Selecionar ${c.nmConvidado}`} checked={selecionados.includes(c.idConvidado)} onChange={() => alternarSelecao(c.idConvidado)} className="h-4 w-4 accent-blue-600" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-1.5" style={{ paddingLeft: `${nivel * 1.25}rem` }}>
                      {nivel > 0 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-label="Acompanhante" />}
                      {!emBusca && (cascata.abaixo.get(c.idConvidado) ?? 0) > 0 && (
                        <button type="button" onClick={() => alternarRecolhido(c.idConvidado)} aria-expanded={!recolhidos.includes(c.idConvidado)}
                          aria-label={`${recolhidos.includes(c.idConvidado) ? "Mostrar" : "Ocultar"} acompanhantes de ${c.nmConvidado}`}
                          title={recolhidos.includes(c.idConvidado) ? "Mostrar os acompanhantes" : "Ocultar os acompanhantes"}
                          className="-ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                          {recolhidos.includes(c.idConvidado) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                      {c.nmConvidado}
                      {!emBusca && recolhidos.includes(c.idConvidado) && (cascata.abaixo.get(c.idConvidado) ?? 0) > 0 && (
                        <span title={`${cascata.abaixo.get(c.idConvidado)} acompanhante(s) oculto(s)`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">+{cascata.abaixo.get(c.idConvidado)}</span>
                      )}
                    </span>
                    {principalForaDaLista && c.nmConvidadoPrincipal && <span className="block pl-0 text-xs font-normal text-slate-400">acompanha {c.nmConvidadoPrincipal}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600" title={c.idConvidadoPrincipal !== null && c.nmGrupo && c.nmGrupo !== grupoPorId.get(c.idConvidado) ? `Conta no grupo de quem acompanha (grupo cadastrado: ${c.nmGrupo})` : undefined}>
                    {grupoPorId.get(c.idConvidado) === SEM_GRUPO ? "—" : grupoPorId.get(c.idConvidado)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.nrTelefone || "—"}
                    {whats && <a href={whats} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${c.nmConvidado}`} title="Abrir no WhatsApp" className="ml-2 inline-flex align-middle text-green-600 hover:text-green-700"><MessageCircle className="h-4 w-4" /></a>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.nmRelacao || "—"}</td>
                  <td className="px-4 py-3">
                    {c.nmCortejo
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700"><Sparkles className="h-3 w-3" aria-hidden /> {c.nmCortejo}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
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
          convidados={itens}
          onSalvar={form => salvar(form, modal.convidado)}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
