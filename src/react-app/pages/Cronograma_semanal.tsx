import { DragEvent, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, LayoutGrid, List, CalendarClock, Search, PlusCircle, X } from "lucide-react";
import {
  CronogramaSemanalService,
  type CronogramaSemanalItem,
  type Status,
  type Categoria,
} from "../services/CronogramaSemanalService";
import { HistoricoColumnFilter, type DirecaoOrdenacao } from "../components/HistoricoColumnFilter";

type Page = "kanban" | "lista" | "rotina";
type ColunaLista = "status" | "dtPrazo" | "nmCronogramaSemanal" | "nmCategoria" | "nmTag";
type OrdenacaoLista = { coluna: ColunaLista; direcao: DirecaoOrdenacao } | null;

const statuses: { id: Status; label: string; hint: string }[] = [
  { id: "pendentes", label: "Pendentes", hint: "Ainda não iniciadas" },
  { id: "executar", label: "Executar", hint: "Prontas para ação" },
  { id: "aguardar", label: "Aguardar retorno", hint: "Dependem de terceiros" },
  { id: "acompanhar", label: "Acompanhar andamento", hint: "Em execução ou monitoramento" },
  { id: "finalizada", label: "Finalizada", hint: "Histórico concluído" },
];

const categorias: Categoria[] = ["Pessoal", "Acadêmica", "Atlética", "Musical", "Devocional", "Engenharia", "Programação"];

// Dias cadastrados em dia_semana (id 6 = "Sem agendamento", não é um dia real; "Domingo" ainda não existe na tabela).
const diasSemanaOpcoes: { id: number; label: string }[] = [
  { id: 1, label: "Segunda-Feira" },
  { id: 2, label: "Terça-Feira" },
  { id: 3, label: "Quarta-Feira" },
  { id: 4, label: "Quinta-Feira" },
  { id: 5, label: "Sexta-Feira" },
  { id: 7, label: "Sábado" },
];

const diasDaSemanaCalendario = ["Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado", "Domingo"];

const doisDigitosLocal = (valor: number) => String(valor).padStart(2, "0");
const ymd = (data: Date) => `${data.getFullYear()}-${doisDigitosLocal(data.getMonth() + 1)}-${doisDigitosLocal(data.getDate())}`;
const nomeDiaSemana = (data: Date) => diasDaSemanaCalendario[(data.getDay() + 6) % 7];

const formatarData = (valor?: string | null) => {
  if (!valor) return null;
  const [data] = valor.split(" ");
  return data ?? null;
};

const paraIso = (valor?: string | null): string | null => {
  const data = formatarData(valor);
  if (!data) return null;
  if (data.includes("-")) return data;
  const [dia, mes, ano] = data.split("/");
  return dia && mes && ano ? `${ano}-${mes}-${dia}` : null;
};

const paraDatetimeLocal = (valor?: string | null): string => {
  if (!valor) return "";
  if (valor.includes("T")) return valor.slice(0, 16);
  const [data, hora] = valor.split(" ");
  const iso = paraIso(data);
  return iso ? `${iso}T${(hora ?? "09:00").slice(0, 5)}` : "";
};

const vazio = (): CronogramaSemanalItem => ({
  nmCronogramaSemanal: "",
  nmCategoria: "Engenharia",
  nmStatusCronograma: "pendentes",
  nmTag: "",
  txObservacao: "",
  dtPrazo: null,
  flFixo: false,
});

export default function NordToolDashboard() {
  const [page, setPage] = useState<Page>("kanban");
  const [items, setItems] = useState<CronogramaSemanalItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<Categoria | "Todas">("Todas");
  const [busca, setBusca] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [editando, setEditando] = useState<CronogramaSemanalItem | null>(null);
  const [criando, setCriando] = useState(false);
  const [draft, setDraft] = useState<CronogramaSemanalItem>(vazio());
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [statusEmMassa, setStatusEmMassa] = useState<Status>("executar");
  const [filtrosColuna, setFiltrosColuna] = useState<Partial<Record<ColunaLista, string[]>>>({});
  const [ordenacao, setOrdenacao] = useState<OrdenacaoLista>(null);
  const [visaoCalendario, setVisaoCalendario] = useState<"semana" | "mes">("semana");
  const [dataCalendario, setDataCalendario] = useState(new Date());
  const [categoriasRotina, setCategoriasRotina] = useState<Categoria[]>([]);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await CronogramaSemanalService.listar();
      setItems(dados);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao carregar o cronograma.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return items.filter(item =>
      (categoria === "Todas" || item.nmCategoria === categoria) &&
      (!termo || [item.nmCronogramaSemanal, item.txObservacao ?? "", item.nmTag ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(termo))
    );
  }, [items, categoria, busca]);

  const valorColuna = (item: CronogramaSemanalItem, coluna: ColunaLista): string => {
    if (coluna === "status") return statuses.find(s => s.id === item.nmStatusCronograma)?.label ?? item.nmStatusCronograma;
    if (coluna === "dtPrazo") return formatarData(item.dtPrazo) ?? "Sem data";
    if (coluna === "nmTag") return item.nmTag || "(Em branco)";
    if (coluna === "nmCronogramaSemanal") return item.nmCronogramaSemanal;
    return item.nmCategoria;
  };

  const valoresDaColuna = (coluna: ColunaLista) =>
    [...new Set(filtrados.map(item => valorColuna(item, coluna)))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  const listaFiltrada = useMemo(() => filtrados.filter(item =>
    (Object.entries(filtrosColuna) as [ColunaLista, string[]][]).every(([coluna, permitidos]) => permitidos.includes(valorColuna(item, coluna)))
  ), [filtrados, filtrosColuna]);

  const listaOrdenada = useMemo(() => [...listaFiltrada].sort((a, b) => {
    if (ordenacao) {
      const comparacao = valorColuna(a, ordenacao.coluna).localeCompare(valorColuna(b, ordenacao.coluna), "pt-BR", { numeric: true });
      return ordenacao.direcao === "asc" ? comparacao : -comparacao;
    }
    const ordemStatus = statuses.findIndex(s => s.id === a.nmStatusCronograma) - statuses.findIndex(s => s.id === b.nmStatusCronograma);
    return ordemStatus || (formatarData(a.dtPrazo) ?? "9999-12-31").localeCompare(formatarData(b.dtPrazo) ?? "9999-12-31");
  }), [listaFiltrada, ordenacao]);

  const configurarFiltroColuna = (coluna: ColunaLista, valores: string[] | null) => {
    setFiltrosColuna(atual => {
      const proximo = { ...atual };
      if (valores === null) delete proximo[coluna]; else proximo[coluna] = valores;
      return proximo;
    });
  };

  const alternarSelecao = (id: number) => setSelecionados(atual => atual.includes(id) ? atual.filter(i => i !== id) : [...atual, id]);

  const moverSelecionadas = async () => {
    if (!selecionados.length) return;
    const anteriores = items;
    const idsSelecionados = new Set(selecionados);
    setItems(current => current.map(i => (i.id && idsSelecionados.has(i.id) ? { ...i, nmStatusCronograma: statusEmMassa } : i)));
    try {
      await CronogramaSemanalService.moverStatus(selecionados, statusEmMassa, anteriores);
      setSelecionados([]);
    } catch (err) {
      setItems(anteriores);
      setErro(err instanceof Error ? err.message : "Falha ao mover as demandas selecionadas.");
    }
  };

  const abrirNovo = (dataAgendamento?: Date) => {
    setDraft(dataAgendamento ? { ...vazio(), dtAgendamento: `${ymd(dataAgendamento)}T09:00` } : vazio());
    setErroModal(null);
    setCriando(true);
  };

  const semanaAtual = useMemo(() => {
    const inicio = new Date(dataCalendario);
    inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d; });
  }, [dataCalendario]);

  const celulasDoMes = useMemo(() => {
    const primeiroDia = new Date(dataCalendario.getFullYear(), dataCalendario.getMonth(), 1);
    const inicio = new Date(primeiroDia);
    inicio.setDate(primeiroDia.getDate() - ((primeiroDia.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d; });
  }, [dataCalendario]);

  const itensDoDia = (data: Date) => {
    const diaSemana = nomeDiaSemana(data);
    const chave = ymd(data);
    const fixos = items.filter(item => item.flFixo && item.nmDiaSemana === diaSemana);
    const pontuais = items.filter(item => !item.flFixo && item.dtAgendamento && (paraIso(item.dtAgendamento) === chave));
    return [...fixos, ...pontuais]
      .filter(item => !categoriasRotina.length || categoriasRotina.includes(item.nmCategoria))
      .sort((a, b) => (a.flFixo ? a.nmHorario ?? "" : a.dtAgendamento?.split(" ")[1] ?? "").localeCompare(b.flFixo ? b.nmHorario ?? "" : b.dtAgendamento?.split(" ")[1] ?? ""));
  };

  const moverCalendario = (quantidade: number) => {
    const data = new Date(dataCalendario);
    if (visaoCalendario === "semana") data.setDate(data.getDate() + quantidade * 7);
    else data.setMonth(data.getMonth() + quantidade);
    setDataCalendario(data);
  };

  const alternarCategoriaRotina = (categoria: Categoria) => setCategoriasRotina(current => current.includes(categoria) ? current.filter(c => c !== categoria) : [...current, categoria]);

  const hoje = () => ymd(new Date());

  const abrirEdicao = (item: CronogramaSemanalItem) => {
    setEditando(item);
    setDraft({ ...item, dtPrazo: paraIso(item.dtPrazo), dtAgendamento: item.dtAgendamento ? paraDatetimeLocal(item.dtAgendamento) : null });
    setErroModal(null);
  };

  const fecharModal = () => {
    setCriando(false);
    setEditando(null);
    setErroModal(null);
    setSalvando(false);
  };

  const salvar = async () => {
    if (!draft.nmCronogramaSemanal.trim()) {
      setErroModal("Informe um título para a demanda.");
      return;
    }
    setSalvando(true);
    setErroModal(null);
    try {
      if (editando?.id) {
        await CronogramaSemanalService.alterar({ ...draft, id: editando.id });
      } else {
        await CronogramaSemanalService.criar(draft);
      }
      await carregar();
      fecharModal();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : "Falha ao salvar a demanda.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!editando?.id) return;
    if (!window.confirm(`Excluir a demanda "${editando.nmCronogramaSemanal}"? Esta ação não pode ser desfeita.`)) return;
    setSalvando(true);
    try {
      await CronogramaSemanalService.excluir(editando.id);
      await carregar();
      fecharModal();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : "Falha ao excluir a demanda.");
    } finally {
      setSalvando(false);
    }
  };

  const mudarStatus = async (item: CronogramaSemanalItem, status: Status) => {
    if (!item.id || item.nmStatusCronograma === status) return;
    const anteriores = items;
    setItems(current => current.map(i => (i.id === item.id ? { ...i, nmStatusCronograma: status } : i)));
    try {
      await CronogramaSemanalService.alterar({ ...item, nmStatusCronograma: status });
    } catch (err) {
      setItems(anteriores);
      setErro(err instanceof Error ? err.message : "Falha ao mover a demanda.");
    }
  };

  const soltar = (event: DragEvent<HTMLElement>, status: Status) => {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/item-id")) || dragging;
    const item = items.find(i => i.id === id);
    if (item) void mudarStatus(item, status);
    setDragging(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px] rounded-[2rem] border border-slate-200 bg-[#111827] p-8 text-slate-200 shadow-2xl">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative rounded-2xl bg-violet-600 p-3 shadow-lg">
              <CalendarDays className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cronograma Semanal</h1>
              <p className="text-sm text-slate-400">Gestão de demandas e rotina</p>
            </div>
          </div>

          <div className="flex rounded-xl bg-slate-900 p-1.5 border border-slate-700">
            <button onClick={() => setPage("kanban")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${page === "kanban" ? "bg-violet-600 text-white" : "text-slate-400"}`}>
              <LayoutGrid size={16} /> Kanban
            </button>
            <button onClick={() => setPage("lista")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${page === "lista" ? "bg-violet-600 text-white" : "text-slate-400"}`}>
              <List size={16} /> Lista
            </button>
            <button onClick={() => setPage("rotina")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${page === "rotina" ? "bg-violet-600 text-white" : "text-slate-400"}`}>
              <CalendarClock size={16} /> Rotina
            </button>
          </div>
        </div>

        {page === "kanban" && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar demanda ou observação..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value as Categoria | "Todas")}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="Todas">Todas as categorias</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => abrirNovo()} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition-colors">
                <PlusCircle size={16} /> Nova demanda
              </button>
            </div>

            {erro && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                <span>{erro}</span>
                <button onClick={() => void carregar()} className="font-semibold">Tentar novamente</button>
              </div>
            )}

            {carregando ? (
              <p className="py-12 text-center text-sm text-slate-500">Carregando cronograma...</p>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key="kanban" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-5">
                  {statuses.map(status => {
                    const itensDaColuna = filtrados
                      .filter(item => item.nmStatusCronograma === status.id)
                      .sort((a, b) => (formatarData(a.dtPrazo) ?? "9999-12-31").localeCompare(formatarData(b.dtPrazo) ?? "9999-12-31"));
                    return (
                      <section
                        key={status.id}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => soltar(e, status.id)}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3"
                      >
                        <header className="flex items-center justify-between px-1">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">{status.label}</h3>
                            <p className="text-[10px] text-slate-500">{status.hint}</p>
                          </div>
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">{itensDaColuna.length}</span>
                        </header>

                        <div className="flex flex-col gap-3 min-h-[80px]">
                          {itensDaColuna.map(item => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={e => { e.dataTransfer.setData("text/item-id", String(item.id)); setDragging(item.id ?? null); }}
                              onDragEnd={() => setDragging(null)}
                              onClick={() => abrirEdicao(item)}
                              className={`cursor-pointer rounded-2xl border border-slate-800 bg-[#151921] p-4 shadow-xl transition-transform hover:scale-[1.02] ${dragging === item.id ? "opacity-50" : ""}`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-violet-300">{item.nmCategoria}</span>
                                {item.nmTag && <span className="text-[10px] text-slate-500">{item.nmTag}</span>}
                              </div>
                              <p className="text-sm font-semibold leading-snug">{item.nmCronogramaSemanal}</p>
                              {item.txObservacao && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.txObservacao}</p>}
                              {item.dtPrazo && <p className="mt-2 text-[10px] font-bold text-emerald-500">Prazo {formatarData(item.dtPrazo)}</p>}
                            </div>
                          ))}
                          {!itensDaColuna.length && (
                            <div className="rounded-2xl border border-dashed border-slate-800 bg-transparent p-4 text-center">
                              <p className="text-[10px] font-bold text-slate-700 uppercase">Solte aqui</p>
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}

        {page === "lista" && (
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar demanda ou observação..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value as Categoria | "Todas")}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="Todas">Todas as categorias</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => abrirNovo()} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition-colors">
                <PlusCircle size={16} /> Nova demanda
              </button>
            </div>

            {erro && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                <span>{erro}</span>
                <button onClick={() => void carregar()} className="font-semibold">Tentar novamente</button>
              </div>
            )}

            {selecionados.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-800 bg-violet-950/30 px-4 py-3 text-sm text-slate-200">
                <strong>{selecionados.length} {selecionados.length === 1 ? "demanda selecionada" : "demandas selecionadas"}</strong>
                <label className="flex items-center gap-2">
                  Mover para
                  <select
                    value={statusEmMassa}
                    onChange={e => setStatusEmMassa(e.target.value as Status)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 outline-none"
                  >
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <button onClick={() => void moverSelecionadas()} className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white hover:bg-violet-700">Mover selecionadas</button>
                <button onClick={() => setSelecionados([])} className="text-slate-400 hover:text-slate-200">Limpar seleção</button>
              </div>
            )}

            {carregando ? (
              <p className="py-12 text-center text-sm text-slate-500">Carregando cronograma...</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-slate-900/60">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={listaOrdenada.length > 0 && listaOrdenada.every(i => i.id && selecionados.includes(i.id))}
                          onChange={e => setSelecionados(e.target.checked ? listaOrdenada.map(i => i.id!).filter(Boolean) : [])}
                        />
                      </th>
                      {([
                        ["status", "Fila"],
                        ["dtPrazo", "Data"],
                        ["nmCronogramaSemanal", "Demanda"],
                        ["nmCategoria", "Categoria"],
                        ["nmTag", "Frente"],
                      ] as [ColunaLista, string][]).map(([coluna, label]) => (
                        <th key={coluna} className="px-4 py-3">
                          <HistoricoColumnFilter
                            label={label}
                            values={valoresDaColuna(coluna)}
                            selected={filtrosColuna[coluna] ?? null}
                            sortDirection={ordenacao?.coluna === coluna ? ordenacao.direcao : null}
                            onApply={valores => configurarFiltroColuna(coluna, valores)}
                            onSort={direcao => setOrdenacao({ coluna, direcao })}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listaOrdenada.map(item => {
                      const expandido = expandidoId === item.id;
                      const marcado = !!item.id && selecionados.includes(item.id);
                      return (
                        <tr key={item.id} onClick={() => setExpandidoId(expandido ? null : item.id ?? null)} className={`cursor-pointer border-t border-slate-800 transition-colors hover:bg-slate-900/40 ${marcado ? "bg-violet-950/20" : ""}`}>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={marcado} onChange={() => item.id && alternarSelecao(item.id)} />
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-violet-300">{statuses.find(s => s.id === item.nmStatusCronograma)?.label}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{formatarData(item.dtPrazo) ?? "—"}</td>
                          <td className="px-4 py-3 text-sm">
                            <strong className="text-slate-200">{item.nmCronogramaSemanal}</strong>
                            {expandido && item.txObservacao && <p className="mt-1 text-xs text-slate-500">{item.txObservacao}</p>}
                            {expandido && (
                              <button onClick={e => { e.stopPropagation(); abrirEdicao(item); }} className="mt-2 text-xs font-semibold text-violet-400 hover:text-violet-300">Abrir e editar</button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{item.nmCategoria}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{item.nmTag || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!listaOrdenada.length && <div className="p-8 text-center text-sm text-slate-500">Nenhuma demanda encontrada.</div>}
              </div>
            )}
          </div>
        )}

        {page === "rotina" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-700">
                <button onClick={() => setVisaoCalendario("semana")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${visaoCalendario === "semana" ? "bg-violet-600 text-white" : "text-slate-400"}`}>Semana</button>
                <button onClick={() => setVisaoCalendario("mes")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${visaoCalendario === "mes" ? "bg-violet-600 text-white" : "text-slate-400"}`}>Mês</button>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-300">
                <button onClick={() => moverCalendario(-1)} className="rounded-lg border border-slate-700 px-2 py-1 hover:bg-slate-800">‹</button>
                <span>
                  {visaoCalendario === "semana"
                    ? `${semanaAtual[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${semanaAtual[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
                    : dataCalendario.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                <button onClick={() => moverCalendario(1)} className="rounded-lg border border-slate-700 px-2 py-1 hover:bg-slate-800">›</button>
              </div>
              <button onClick={() => abrirNovo(dataCalendario)} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition-colors">
                <PlusCircle size={16} /> Novo compromisso
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {categorias.map(c => (
                <button key={c} onClick={() => alternarCategoriaRotina(c)} className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${categoriasRotina.includes(c) ? "border-violet-500 bg-violet-600/30 text-violet-200" : "border-slate-700 text-slate-400"}`}>
                  {c}
                </button>
              ))}
              {categoriasRotina.length > 0 && <button onClick={() => setCategoriasRotina([])} className="text-[10px] font-bold text-slate-500 hover:text-slate-300">× Limpar</button>}
            </div>

            {erro && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                <span>{erro}</span>
                <button onClick={() => void carregar()} className="font-semibold">Tentar novamente</button>
              </div>
            )}

            {visaoCalendario === "semana" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:grid-cols-7">
                {semanaAtual.map(data => {
                  const itens = itensDoDia(data);
                  return (
                    <section key={data.toISOString()} className={`flex flex-col gap-2 rounded-2xl border p-3 ${ymd(data) === hoje() ? "border-violet-600 bg-violet-950/10" : "border-slate-800"}`}>
                      <header className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">{nomeDiaSemana(data).replace("-Feira", "")}</span>
                        <strong className="text-sm text-slate-200">{data.getDate()}</strong>
                      </header>
                      <div className="flex flex-col gap-2">
                        {itens.map(item => (
                          <button key={`${item.flFixo ? "f" : "p"}-${item.id}`} onClick={() => abrirEdicao(item)} className="rounded-xl border border-slate-800 bg-[#151921] p-2 text-left hover:border-violet-700">
                            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                              {item.flFixo ? "📌" : "◷"} {item.flFixo ? item.nmHorario : item.dtAgendamento?.split(" ")[1]?.slice(0, 5)}
                            </div>
                            <p className="text-xs font-semibold text-slate-200 leading-snug">{item.nmCronogramaSemanal}</p>
                          </button>
                        ))}
                        {!itens.length && <div className="rounded-xl border border-dashed border-slate-800 p-3 text-center text-[10px] font-bold uppercase text-slate-700">Livre</div>}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {celulasDoMes.map(data => {
                  const itens = itensDoDia(data);
                  const foraDoMes = data.getMonth() !== dataCalendario.getMonth();
                  return (
                    <section key={data.toISOString()} className={`min-h-[90px] rounded-xl border p-2 ${foraDoMes ? "border-slate-900 opacity-40" : "border-slate-800"} ${ymd(data) === hoje() ? "border-violet-600" : ""}`}>
                      <header className="mb-1 text-[10px] font-bold text-slate-400">{data.getDate()}</header>
                      <div className="flex flex-col gap-1">
                        {itens.slice(0, 3).map(item => (
                          <button key={`${item.flFixo ? "f" : "p"}-${item.id}`} onClick={() => abrirEdicao(item)} className="truncate rounded-lg bg-slate-900 px-1.5 py-0.5 text-left text-[9px] text-slate-300 hover:bg-slate-800">
                            {item.flFixo ? "📌" : "◷"} {item.nmCronogramaSemanal}
                          </button>
                        ))}
                        {itens.length > 3 && <span className="text-[9px] text-slate-500">+{itens.length - 3} compromissos</span>}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {(criando || editando) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={fecharModal}>
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#111827] p-6 text-slate-200 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editando ? "Editar demanda" : "Nova demanda"}</h2>
              <button onClick={fecharModal} className="text-slate-500 hover:text-slate-300"><X size={20} /></button>
            </div>

            {erroModal && <div className="mb-3 rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{erroModal}</div>}

            <label className="mb-3 block text-xs font-semibold text-slate-400">
              Título
              <input
                autoFocus
                value={draft.nmCronogramaSemanal}
                onChange={e => setDraft({ ...draft, nmCronogramaSemanal: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
              />
            </label>

            <label className="mb-3 block text-xs font-semibold text-slate-400">
              Descrição/Observação
              <textarea
                rows={3}
                value={draft.txObservacao ?? ""}
                onChange={e => setDraft({ ...draft, txObservacao: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
              />
            </label>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-400">
                Categoria
                <select
                  value={draft.nmCategoria}
                  onChange={e => setDraft({ ...draft, nmCategoria: e.target.value as Categoria })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                >
                  {categorias.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Fila
                <select
                  value={draft.nmStatusCronograma}
                  onChange={e => setDraft({ ...draft, nmStatusCronograma: e.target.value as Status })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                >
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-400">
                Frente/Projeto
                <input
                  value={draft.nmTag ?? ""}
                  onChange={e => setDraft({ ...draft, nmTag: e.target.value })}
                  placeholder="Ex.: Obra, NordTool"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Data planejada
                <input
                  type="date"
                  value={draft.dtPrazo ?? ""}
                  onChange={e => setDraft({ ...draft, dtPrazo: e.target.value || null })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                />
              </label>
            </div>

            <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400">
              <input
                type="checkbox"
                checked={!!draft.flFixo}
                onChange={e => setDraft({ ...draft, flFixo: e.target.checked, idDiaSemana: e.target.checked ? draft.idDiaSemana : null, dtAgendamento: e.target.checked ? null : draft.dtAgendamento })}
              />
              📌 Atividade fixa (recorrente toda semana)
            </label>

            {draft.flFixo ? (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-400">
                  Dia da semana
                  <select
                    value={draft.idDiaSemana ?? ""}
                    onChange={e => setDraft({ ...draft, idDiaSemana: e.target.value ? Number(e.target.value) : null })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                  >
                    <option value="" disabled>Selecione</option>
                    {diasSemanaOpcoes.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-400">
                  Horário
                  <input
                    value={draft.nmHorario ?? ""}
                    onChange={e => setDraft({ ...draft, nmHorario: e.target.value })}
                    placeholder="Ex.: 07:00–17:00"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </label>
              </div>
            ) : (
              <label className="mb-3 block text-xs font-semibold text-slate-400">
                Agendar na Rotina (data e horário)
                <input
                  type="datetime-local"
                  value={paraDatetimeLocal(draft.dtAgendamento)}
                  onChange={e => setDraft({ ...draft, dtAgendamento: e.target.value || null })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-violet-600"
                />
                <span className="mt-1 block font-normal normal-case text-slate-500">Opcional — deixe em branco para a demanda ficar só no Kanban/Lista.</span>
              </label>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void salvar()}
                disabled={salvando}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              {editando && (
                <button onClick={() => void excluir()} disabled={salvando} className="rounded-xl border border-red-800 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-950/40 disabled:opacity-50">
                  Excluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
