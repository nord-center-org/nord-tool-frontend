import { DragEvent, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, LayoutGrid, List, CalendarClock, Search, PlusCircle, X } from "lucide-react";
import {
  CronogramaSemanalService,
  type CronogramaSemanalItem,
  type Status,
  type Categoria,
} from "../services/CronogramaSemanalService";

type Page = "kanban" | "lista" | "rotina";

const statuses: { id: Status; label: string; hint: string }[] = [
  { id: "pendentes", label: "Pendentes", hint: "Ainda não iniciadas" },
  { id: "executar", label: "Executar", hint: "Prontas para ação" },
  { id: "aguardar", label: "Aguardar retorno", hint: "Dependem de terceiros" },
  { id: "acompanhar", label: "Acompanhar andamento", hint: "Em execução ou monitoramento" },
  { id: "finalizada", label: "Finalizada", hint: "Histórico concluído" },
];

const categorias: Categoria[] = ["Pessoal", "Acadêmica", "Atlética", "Musical", "Devocional", "Engenharia", "Programação"];

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

  const abrirNovo = () => {
    setDraft(vazio());
    setErroModal(null);
    setCriando(true);
  };

  const abrirEdicao = (item: CronogramaSemanalItem) => {
    setEditando(item);
    setDraft({ ...item, dtPrazo: paraIso(item.dtPrazo) });
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
              <button onClick={abrirNovo} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition-colors">
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
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center">
            <p className="text-sm text-slate-500">Aba Lista chega na próxima etapa do plano.</p>
          </div>
        )}

        {page === "rotina" && (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center">
            <p className="text-sm text-slate-500">Aba Rotina chega na próxima etapa do plano.</p>
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
