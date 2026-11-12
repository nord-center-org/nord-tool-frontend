import { DragEvent, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, CalendarRange, LayoutGrid, List, CalendarClock, Search, PlusCircle, X, Lock, Share2, Bot, Users, ChevronsDownUp, ChevronsUpDown, Sparkles, ImageDown, FilterX } from "lucide-react";
import {
  CronogramaSemanalService,
  type CronogramaEquipe,
  type CronogramaSemanalItem,
  type Status,
  type Categoria,
  type RascunhoDemanda,
} from "../services/CronogramaSemanalService";
import ChatDemanda from "../components/cronograma/ChatDemanda";
import { itemDoRascunho } from "../utils/rascunhoDemanda";
import { HistoricoColumnFilter, type DirecaoOrdenacao } from "../components/HistoricoColumnFilter";
import CompartilharItem from "../components/cronograma/CompartilharItem";
import RelatorioIA from "../components/cronograma/RelatorioIA";
import { ehMeu } from "../utils/compartilhamento";
import { donosDasDemandas, passaFiltroPessoas, type FiltroPessoas as Filtro } from "../utils/filtroPessoas";
import FiltroPessoas from "../components/cronograma/FiltroPessoas";
import EquipesModal from "../components/cronograma/EquipesModal";
import { useObra } from "../hooks/useObra";
import { emOrdem, posicaoNoPeriodo, rotuloDoPeriodo } from "../utils/periodoAgenda";
import { alternarDia, planejarDias } from "../utils/rotinaDias";
import { podeAcessar } from "../utils/sessao";
import { useAuth } from "../hooks/useAuth";
import ExportarImagem, { type DemandaExportada, type DiaExportado } from "../components/cronograma/ExportarImagem";
import { lerPreferenciasCronograma, salvarPreferenciasCronograma, temFiltroAtivo, PREFERENCIAS_PADRAO } from "../utils/preferenciasCronograma";
import { nomeArquivoImagem, resumoFiltros, type ModoExportacao } from "../utils/exportacaoCronograma";

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

const corCategoria: Record<Categoria, string> = {
  Pessoal: "bg-pink-500/15 text-pink-700 border border-pink-500/20",
  Acadêmica: "bg-indigo-500/15 text-indigo-700 border border-indigo-500/20",
  Atlética: "bg-orange-500/15 text-orange-700 border border-orange-500/20",
  Musical: "bg-fuchsia-500/15 text-fuchsia-700 border border-fuchsia-500/20",
  Devocional: "bg-amber-500/15 text-amber-700 border border-amber-500/20",
  Engenharia: "bg-sky-500/15 text-sky-700 border border-sky-500/20",
  Programação: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/20",
};

const corStatus: Record<Status, string> = {
  pendentes: "bg-slate-500/15 text-slate-600 border border-slate-500/20",
  executar: "bg-blue-500/15 text-blue-700 border border-blue-500/20",
  aguardar: "bg-amber-500/15 text-amber-700 border border-amber-500/20",
  acompanhar: "bg-violet-500/15 text-violet-700 border border-violet-500/20",
  finalizada: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/20",
};

// Dias cadastrados em dia_semana (id 6 = "Sem agendamento", não é um dia real; "Domingo" ainda não existe na tabela).
// Ids da tabela dia_semana (o 6 é "Sem agendamento"; não há domingo).
const diasSemanaOpcoes: { id: number; label: string; curto: string }[] = [
  { id: 1, label: "Segunda-Feira", curto: "Seg" },
  { id: 2, label: "Terça-Feira", curto: "Ter" },
  { id: 3, label: "Quarta-Feira", curto: "Qua" },
  { id: 4, label: "Quinta-Feira", curto: "Qui" },
  { id: 5, label: "Sexta-Feira", curto: "Sex" },
  { id: 7, label: "Sábado", curto: "Sáb" },
];

const diasDaSemanaCalendario = ["Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado", "Domingo"];
// O calendário da Rotina começa no domingo.
const DIAS_CABECALHO_MES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const casaBusca = (item: CronogramaSemanalItem, termo: string) =>
  !termo || [item.nmCronogramaSemanal, item.txObservacao ?? "", item.nmTag ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(termo);

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

const armazenamento = () => (typeof window === "undefined" ? undefined : window.localStorage);

export default function NordToolDashboard() {
  const { usuario } = useAuth();
  // A tela abre com a visão e os filtros que a pessoa deixou da última vez (guardados neste aparelho).
  const [salvas] = useState(() => (usuario ? lerPreferenciasCronograma(armazenamento(), usuario.id) : PREFERENCIAS_PADRAO));
  const [page, setPage] = useState<Page>(salvas.visao);
  const [relatorioIA, setRelatorioIA] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);
  const [exportando, setExportando] = useState<ModoExportacao | null>(null);
  const pode = {
    excluir: podeAcessar(usuario?.permissoes, "CRONOGRAMA_EXCLUIR", "ESCRITA"),
    compartilhar: podeAcessar(usuario?.permissoes, "CRONOGRAMA_COMPARTILHAR", "ESCRITA"),
    rotina: podeAcessar(usuario?.permissoes, "CRONOGRAMA_ROTINA", "ESCRITA"),
    relatorioIA: podeAcessar(usuario?.permissoes, "CRONOGRAMA_RELATORIO_IA", "LEITURA"),
    mover: podeAcessar(usuario?.permissoes, "CRONOGRAMA", "ESCRITA"),
    equipes: podeAcessar(usuario?.permissoes, "CRONOGRAMA", "ADMIN"),
  };
  const { obra } = useObra();
  const [equipes, setEquipes] = useState<CronogramaEquipe[]>([]);
  const [equipesAberto, setEquipesAberto] = useState(false);
  const carregarEquipes = () => { CronogramaSemanalService.equipes().then(setEquipes).catch(() => setEquipes([])); };
  useEffect(carregarEquipes, []);
  /** Dias marcados da atividade fixa (vários = uma cópia por dia). */
  const [diasFixos, setDiasFixos] = useState<number[]>([]);
  const [items, setItems] = useState<CronogramaSemanalItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<Categoria | "Todas">(
    salvas.categoria === "Todas" || categorias.includes(salvas.categoria as Categoria) ? (salvas.categoria as Categoria | "Todas") : "Todas");
  const [busca, setBusca] = useState(salvas.busca);
  const [filtroPessoas, setFiltroPessoas] = useState<Filtro>(salvas.pessoas);
  const [dragging, setDragging] = useState<number | null>(null);
  const [editando, setEditando] = useState<CronogramaSemanalItem | null>(null);
  const [criando, setCriando] = useState(false);
  const [draft, setDraft] = useState<CronogramaSemanalItem>(vazio());
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [expandirTodas, setExpandirTodas] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [statusEmMassa, setStatusEmMassa] = useState<Status>("executar");
  const [filtrosColuna, setFiltrosColuna] = useState<Partial<Record<ColunaLista, string[]>>>(salvas.filtrosColuna);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoLista>(salvas.ordenacao);
  const [visaoCalendario, setVisaoCalendario] = useState<"semana" | "mes">(salvas.calendario);
  const [dataCalendario, setDataCalendario] = useState(new Date());
  const [categoriasRotina, setCategoriasRotina] = useState<Categoria[]>(salvas.categoriasRotina.filter((c): c is Categoria => categorias.includes(c as Categoria)));

  const preferencias = useMemo(() => ({
    visao: page, busca, categoria, pessoas: filtroPessoas, filtrosColuna, ordenacao, calendario: visaoCalendario, categoriasRotina,
  }), [page, busca, categoria, filtroPessoas, filtrosColuna, ordenacao, visaoCalendario, categoriasRotina]);
  useEffect(() => {
    if (usuario) salvarPreferenciasCronograma(armazenamento(), usuario.id, preferencias);
  }, [usuario, preferencias]);
  const filtroAtivo = temFiltroAtivo(preferencias);
  const limparFiltros = () => {
    setBusca(""); setCategoria("Todas"); setFiltroPessoas({ tipo: "todos" }); setFiltrosColuna({}); setOrdenacao(null); setCategoriasRotina([]);
  };

  const [ignorados, setIgnorados] = useState<string[]>([]);
  const alternarIgnorado = async (item: CronogramaSemanalItem, chave: string) => {
    if (item.id == null) return;
    const id = `${item.id}|${chave}`;
    const desmarcado = ignorados.includes(id);
    // Atualiza na hora e desfaz se o servidor recusar.
    setIgnorados(atual => desmarcado ? atual.filter(i => i !== id) : [...atual, id]);
    try {
      if (desmarcado) await CronogramaSemanalService.removerExcecao(item.id, chave);
      else await CronogramaSemanalService.incluirExcecao(item.id, chave);
    } catch (err) {
      setIgnorados(atual => desmarcado ? [...atual, id] : atual.filter(i => i !== id));
      setErro(err instanceof Error ? err.message : "Falha ao salvar a exceção do dia.");
    }
  };

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await CronogramaSemanalService.listar();
      setItems(dados);
      // Exceções são acessório: se falhar, a rotina segue sem elas.
      const excecoes = await CronogramaSemanalService.listarExcecoes().catch(() => []);
      setIgnorados(excecoes.map(e => `${e.idCronogramaSemanal}|${e.dtExcecao}`));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao carregar o cronograma.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const termoBusca = busca.trim().toLocaleLowerCase("pt-BR");
  const passaBusca = (item: CronogramaSemanalItem) => casaBusca(item, termoBusca);

  const filtrados = useMemo(() => items.filter(item =>
    passaFiltroPessoas(item, filtroPessoas, usuario?.id) &&
    (categoria === "Todas" || item.nmCategoria === categoria) &&
    casaBusca(item, termoBusca)
  ), [items, categoria, termoBusca, filtroPessoas, usuario?.id]);
  const donos = useMemo(() => donosDasDemandas(items, usuario?.id, "Eu"), [items, usuario?.id]);

  const valorColuna = (item: CronogramaSemanalItem, coluna: ColunaLista): string => {
    if (coluna === "status") return statuses.find(s => s.id === item.nmStatusCronograma)?.label ?? item.nmStatusCronograma;
    if (coluna === "dtPrazo") return formatarData(item.dtPrazo) ?? "Sem data";
    if (coluna === "nmTag") return item.nmTag || "(Em branco)";
    if (coluna === "nmCronogramaSemanal") return item.nmCronogramaSemanal ?? "";
    // Demanda antiga pode vir sem categoria: vira "(Em branco)" em vez de derrubar a lista.
    return item.nmCategoria || "(Em branco)";
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
      await CronogramaSemanalService.moverStatus(selecionados, statusEmMassa);
      setSelecionados([]);
    } catch (err) {
      setItems(anteriores);
      setErro(err instanceof Error ? err.message : "Falha ao mover as demandas selecionadas.");
    }
  };

  // v3: escolher no calendário o primeiro e o último dia da demanda (toque em um, depois no outro).
  const [selecaoDias, setSelecaoDias] = useState<{ inicio: string | null } | null>(null);
  const tocarDia = (data: Date) => {
    if (!selecaoDias) return;
    const dia = ymd(data);
    if (!selecaoDias.inicio) { setSelecaoDias({ inicio: dia }); return; }
    const [inicio, fim] = emOrdem(selecaoDias.inicio, dia);
    setSelecaoDias(null);
    const [a, m, d] = inicio.split("-").map(Number);
    abrirNovo(new Date(a, m - 1, d), fim === inicio ? undefined : fim);
  };
  const propsDia = (data: Date) => selecaoDias ? {
    role: "button" as const, tabIndex: 0, "aria-label": `Escolher ${data.toLocaleDateString("pt-BR")}`,
    onClick: () => tocarDia(data),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tocarDia(data); } },
  } : {};
  const classeSelecao = (data: Date) => !selecaoDias ? "" : selecaoDias.inicio === ymd(data)
    ? " cursor-pointer ring-2 ring-violet-600 bg-violet-100" : " cursor-pointer hover:ring-2 hover:ring-violet-300";

  const abrirNovo = (dataAgendamento?: Date, fim?: string) => {
    setDraft(dataAgendamento ? { ...vazio(), dtAgendamento: `${ymd(dataAgendamento)}T09:00`, dtFimAgendamento: fim ?? null } : vazio());
    setDiasFixos([]);
    setErroModal(null);
    setCriando(true);
  };

  const semanaAtual = useMemo(() => {
    const inicio = new Date(dataCalendario);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d; });
  }, [dataCalendario]);

  const celulasDoMes = useMemo(() => {
    const primeiroDia = new Date(dataCalendario.getFullYear(), dataCalendario.getMonth(), 1);
    const inicio = new Date(primeiroDia);
    inicio.setDate(primeiroDia.getDate() - primeiroDia.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d; });
  }, [dataCalendario]);

  // v3: a demanda pontual pode durar vários dias (do agendamento ao fim).
  const posicaoDoItem = (item: CronogramaSemanalItem, chave: string) => posicaoNoPeriodo(paraIso(item.dtAgendamento), paraIso(item.dtFimAgendamento), chave);

  const horarioNoDia = (item: CronogramaSemanalItem, chave: string) => {
    if (item.flFixo) return item.nmHorario ?? "";
    const posicao = posicaoDoItem(item, chave);
    return posicao === "unico" || posicao === "inicio" ? item.dtAgendamento?.split(" ")[1] ?? "" : posicao ? "00:00" : "";
  };

  const rotuloNoDia = (item: CronogramaSemanalItem, chave: string) => {
    if (item.flFixo) return `📌 ${item.nmHorario ?? ""}`;
    const posicao = posicaoDoItem(item, chave);
    return posicao ? rotuloDoPeriodo(posicao, paraIso(item.dtAgendamento) as string, paraIso(item.dtFimAgendamento), item.dtAgendamento?.split(" ")[1]?.slice(0, 5) ?? "") : "🗓 Prazo";
  };

  const itensDoDia = (data: Date) => {
    const diaSemana = nomeDiaSemana(data);
    const chave = ymd(data);
    const fixos = items.filter(item => item.flFixo && item.nmDiaSemana === diaSemana);
    // Demanda aparece em todos os dias do período agendado (ou só no dia, sem fim) e também no dia do prazo.
    const pontuais = items.filter(item => !item.flFixo && (posicaoDoItem(item, chave) !== null || (item.dtPrazo && paraIso(item.dtPrazo) === chave)));
    return [...fixos, ...pontuais]
      .filter(item => (!categoriasRotina.length || categoriasRotina.includes(item.nmCategoria)) && passaBusca(item))
      .sort((a, b) => horarioNoDia(a, chave).localeCompare(horarioNoDia(b, chave)));
  };

  const moverCalendario = (quantidade: number) => {
    const data = new Date(dataCalendario);
    if (visaoCalendario === "semana") data.setDate(data.getDate() + quantidade * 7);
    else data.setMonth(data.getMonth() + quantidade);
    setDataCalendario(data);
  };

  const alternarCategoriaRotina = (categoria: Categoria) => setCategoriasRotina(current => current.includes(categoria) ? current.filter(c => c !== categoria) : [...current, categoria]);

  const hoje = () => ymd(new Date());

  // ---------- exportar imagem (Lista e Rotina) ----------
  const rotuloStatus = (id: Status) => statuses.find(s => s.id === id)?.label ?? id;
  const rotuloPessoas = (f: Filtro): string | null =>
    f.tipo === "meus" ? "Só as minhas" : f.tipo === "outros" ? "De outras pessoas"
      : f.tipo === "pessoas" ? f.rotulo ?? `${f.ids.length} pessoa${f.ids.length === 1 ? "" : "s"}` : null;
  const paraExportar = (item: CronogramaSemanalItem, chave: string, extra: Partial<DemandaExportada> = {}): DemandaExportada => ({
    chave,
    titulo: item.nmCronogramaSemanal ?? "",
    observacao: item.txObservacao,
    status: rotuloStatus(item.nmStatusCronograma),
    statusId: item.nmStatusCronograma,
    categoria: item.nmCategoria,
    frente: item.nmTag || null,
    prazo: formatarData(item.dtPrazo),
    dono: ehMeu(item) ? null : item.nmDono ?? "outra pessoa",
    ...extra,
  });
  const diasParaExportar = (datas: Date[], mes?: number): DiaExportado[] => datas.map(data => {
    const chave = ymd(data);
    return {
      data,
      hoje: chave === hoje(),
      foraDoMes: mes !== undefined && data.getMonth() !== mes,
      itens: itensDoDia(data).map(item => paraExportar(item, `${item.flFixo ? "f" : "p"}-${item.id}`, {
        quando: rotuloNoDia(item, chave),
        riscada: item.flFixo && ignorados.includes(`${item.id}|${chave}`),
      })),
    };
  });
  // No mês, a última semana só entra se tiver algum dia do mês.
  const celulasParaExportar = celulasDoMes.slice(35).some(d => d.getMonth() === dataCalendario.getMonth()) ? celulasDoMes : celulasDoMes.slice(0, 35);
  const dataCurta = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const periodoExportado = exportando === "lista" ? "Lista de demandas"
    : exportando === "semana" ? `Semana de ${dataCurta(semanaAtual[0])} a ${semanaAtual[6].toLocaleDateString("pt-BR")}`
    : (() => { const t = dataCalendario.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })();
  const ROTULO_COLUNA: Record<ColunaLista, string> = { status: "Fila", dtPrazo: "Data", nmCronogramaSemanal: "Demanda", nmCategoria: "Categoria", nmTag: "Frente" };
  const filtrosExportados = exportando === "lista"
    ? resumoFiltros({
      busca, categoria, pessoas: rotuloPessoas(filtroPessoas),
      colunas: (Object.entries(filtrosColuna) as [ColunaLista, string[]][]).map(([c, v]) => ({ rotulo: ROTULO_COLUNA[c], valores: v })),
    })
    : resumoFiltros({ busca, categorias: categoriasRotina });
  const botaoExportar = (modo: ModoExportacao) => (
    <button type="button" onClick={() => setExportando(modo)} disabled={carregando} title="Gera uma imagem com as demandas (e as observações) para mandar a alguém"
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
      <ImageDown size={16} /> Exportar imagem
    </button>
  );
  const botaoLimpar = filtroAtivo && (
    <button type="button" onClick={limparFiltros} title="Volta os filtros ao padrão"
      className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
      <FilterX size={14} /> Limpar filtros
    </button>
  );

  const abrirEdicao = (item: CronogramaSemanalItem) => {
    // Escolhendo dias no calendário, o toque na demanda vale como toque no dia.
    if (selecaoDias) return;
    setEditando(item);
    setDraft({ ...item, dtPrazo: paraIso(item.dtPrazo), dtAgendamento: item.dtAgendamento ? paraDatetimeLocal(item.dtAgendamento) : null, dtFimAgendamento: paraIso(item.dtFimAgendamento) });
    setDiasFixos(item.flFixo && item.idDiaSemana ? [item.idDiaSemana] : []);
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
    if (draft.flFixo && diasFixos.length === 0) {
      setErroModal("Escolha ao menos um dia da semana.");
      return;
    }
    if (!draft.flFixo && draft.dtFimAgendamento && draft.dtAgendamento && draft.dtFimAgendamento < draft.dtAgendamento.slice(0, 10)) {
      setErroModal("O dia de fim não pode ser antes do dia de início.");
      return;
    }
    setSalvando(true);
    setErroModal(null);
    try {
      // Fixa em vários dias: o item atual fica num dia e os outros dias viram cópias.
      const plano = draft.flFixo ? planejarDias(editando?.id ? (editando.flFixo && editando.idDiaSemana ? editando.idDiaSemana : -1) : null, diasFixos) : null;
      if (editando?.id) {
        await CronogramaSemanalService.alterar({ ...draft, id: editando.id, ...(plano ? { idDiaSemana: plano.manter } : {}) });
      } else if (!plano) {
        await CronogramaSemanalService.criar(draft);
      }
      for (const dia of plano?.criar ?? []) {
        await CronogramaSemanalService.criar({ ...draft, id: undefined, idDiaSemana: dia, idsCompartilhados: undefined });
      }
      await carregar();
      fecharModal();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : "Falha ao salvar a demanda.");
    } finally {
      setSalvando(false);
    }
  };

  /** Demanda montada no chat da Lugia: fixa em vários dias vira um item por dia, como no formulário. */
  const criarDoRascunho = async (rascunho: RascunhoDemanda) => {
    const { item, dias } = itemDoRascunho(rascunho);
    if (item.flFixo) {
      for (const dia of dias) await CronogramaSemanalService.criar({ ...item, idDiaSemana: dia });
    } else {
      await CronogramaSemanalService.criar(item);
    }
    await carregar();
  };

  const revisarRascunho = (rascunho: RascunhoDemanda) => {
    const { item, dias } = itemDoRascunho(rascunho);
    setEditando(null);
    setDraft(item);
    setDiasFixos(dias);
    setErroModal(null);
    setCriando(true);
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
      await CronogramaSemanalService.mudarStatus(item.id, status);
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
    <div className="min-h-screen bg-slate-50 p-0 sm:p-6">
      <div className="mx-auto max-w-[1400px] rounded-3xl sm:rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-8 text-slate-800 shadow-2xl">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative rounded-2xl bg-violet-600 p-3 shadow-lg">
              <CalendarDays className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cronograma Semanal</h1>
              <p className="text-sm text-slate-500">Gestão de demandas e rotina</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:ml-auto sm:mr-3">
          {pode.equipes && <button onClick={() => setEquipesAberto(true)} title="Equipes da obra: quem está na mesma equipe vê as demandas uns dos outros"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Users size={16} /> Equipes
          </button>}
          {pode.mover && <button onClick={() => setChatAberto(true)} title="Escreva o que quer programar e a demanda sai montada (sem IA, na hora)"
            className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
            <Sparkles size={16} /> Criar pelo chat
          </button>}
          {pode.relatorioIA && <button onClick={() => setRelatorioIA(true)} title="Link para o Gemini ou outro assistente ler o seu cronograma"
            className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100">
            <Bot size={16} /> Relatório para IA
          </button>}
          </div>

          <div className="grid grid-cols-3 rounded-xl bg-white p-1.5 border border-slate-200 sm:flex">
            <button onClick={() => setPage("kanban")} className={`flex items-center justify-center gap-2 rounded-lg px-2 sm:px-4 py-2 text-sm font-bold transition-all ${page === "kanban" ? "bg-violet-600 text-white" : "text-slate-500"}`}>
              <LayoutGrid size={16} /> Kanban
            </button>
            <button onClick={() => setPage("lista")} className={`flex items-center justify-center gap-2 rounded-lg px-2 sm:px-4 py-2 text-sm font-bold transition-all ${page === "lista" ? "bg-violet-600 text-white" : "text-slate-500"}`}>
              <List size={16} /> Lista
            </button>
            <button onClick={() => setPage("rotina")} className={`flex items-center justify-center gap-2 rounded-lg px-2 sm:px-4 py-2 text-sm font-bold transition-all ${page === "rotina" ? "bg-violet-600 text-white" : "text-slate-500"}`}>
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
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value as Categoria | "Todas")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="Todas">Todas as categorias</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <FiltroPessoas filtro={filtroPessoas} onMudar={setFiltroPessoas} donos={donos} equipes={equipes} />
              {botaoLimpar}
              <button onClick={() => abrirNovo()} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition-colors">
                <PlusCircle size={16} /> Nova demanda
              </button>
            </div>

            {erro && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{erro}</span>
                <button onClick={() => void carregar()} className="font-semibold">Tentar novamente</button>
              </div>
            )}

            {carregando ? (
              <p className="py-12 text-center text-sm text-slate-500">Carregando cronograma...</p>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key="kanban" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex gap-4 overflow-x-auto pb-2">
                  {statuses.map(status => {
                    const itensDaColuna = filtrados
                      .filter(item => item.nmStatusCronograma === status.id)
                      .sort((a, b) => (formatarData(a.dtPrazo) ?? "9999-12-31").localeCompare(formatarData(b.dtPrazo) ?? "9999-12-31"));
                    return (
                      <section
                        key={status.id}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => soltar(e, status.id)}
                        className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <header className="flex items-center justify-between px-1">
                          <div>
                            <h3 className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-bold uppercase tracking-widest ${corStatus[status.id]}`}>{status.label}</h3>
                            <p className="mt-1 text-[10px] text-slate-500">{status.hint}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{itensDaColuna.length}</span>
                        </header>

                        <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto min-h-[80px] pr-1">
                          {itensDaColuna.map(item => (
                            <div
                              key={item.id}
                              draggable={pode.mover}
                              onDragStart={e => { e.dataTransfer.setData("text/item-id", String(item.id)); setDragging(item.id ?? null); }}
                              onDragEnd={() => setDragging(null)}
                              onClick={() => abrirEdicao(item)}
                              className={`cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-xl transition-transform hover:scale-[1.02] ${dragging === item.id ? "opacity-50" : ""}`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${corCategoria[item.nmCategoria]}`}>{item.nmCategoria}</span>
                                {item.nmTag && <span className="text-[10px] text-slate-500">{item.nmTag}</span>}
                              </div>
                              <p className="text-sm font-semibold leading-snug">{item.nmCronogramaSemanal}</p>
                              {item.txObservacao && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.txObservacao}</p>}
                              {!ehMeu(item) && <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-sky-600"><Lock size={10} /> de {item.nmDono ?? "outra pessoa"}</p>}
                              {ehMeu(item) && (item.idsCompartilhados?.length ?? 0) > 0 && <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-violet-700"><Share2 size={10} /> compartilhado ({item.idsCompartilhados?.length})</p>}
                              {item.dtPrazo && <p className="mt-2 text-[10px] font-bold text-emerald-600">Prazo {formatarData(item.dtPrazo)}</p>}
                            </div>
                          ))}
                          {!itensDaColuna.length && (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-transparent p-4 text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Solte aqui</p>
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
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value as Categoria | "Todas")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="Todas">Todas as categorias</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={() => { setExpandirTodas(v => !v); setExpandidoId(null); }}
                aria-pressed={expandirTodas}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {expandirTodas ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
                {expandirTodas ? "Recolher observações" : "Expandir observações"}
              </button>
              {botaoExportar("lista")}
              {botaoLimpar}
              <button onClick={() => abrirNovo()} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition-colors">
                <PlusCircle size={16} /> Nova demanda
              </button>
            </div>

            {erro && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{erro}</span>
                <button onClick={() => void carregar()} className="font-semibold">Tentar novamente</button>
              </div>
            )}

            {selecionados.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-slate-800">
                <strong>{selecionados.length} {selecionados.length === 1 ? "demanda selecionada" : "demandas selecionadas"}</strong>
                <label className="flex items-center gap-2">
                  Mover para
                  <select
                    value={statusEmMassa}
                    onChange={e => setStatusEmMassa(e.target.value as Status)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none"
                  >
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <button onClick={() => void moverSelecionadas()} className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white hover:bg-violet-700">Mover selecionadas</button>
                <button onClick={() => setSelecionados([])} className="text-slate-500 hover:text-slate-800">Limpar seleção</button>
              </div>
            )}

            {carregando ? (
              <p className="py-12 text-center text-sm text-slate-500">Carregando cronograma...</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                      const expandido = expandirTodas || expandidoId === item.id;
                      const marcado = !!item.id && selecionados.includes(item.id);
                      return (
                        <tr key={item.id} onClick={() => setExpandidoId(expandido ? null : item.id ?? null)} className={`cursor-pointer border-t border-slate-200 transition-colors hover:bg-slate-50 ${marcado ? "bg-violet-50" : ""}`}>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={marcado} onChange={() => item.id && alternarSelecao(item.id)} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${corStatus[item.nmStatusCronograma]}`}>
                              {statuses.find(s => s.id === item.nmStatusCronograma)?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{formatarData(item.dtPrazo) ?? "—"}</td>
                          <td className="px-4 py-3 text-sm">
                            <strong className="text-slate-800">{item.nmCronogramaSemanal}</strong>
                            {expandido && item.txObservacao && <p className="mt-1 text-xs text-slate-500">{item.txObservacao}</p>}
                            {expandido && (
                              <button onClick={e => { e.stopPropagation(); abrirEdicao(item); }} className="mt-2 text-xs font-semibold text-violet-600 hover:text-violet-700">Abrir e editar</button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${corCategoria[item.nmCategoria]}`}>{item.nmCategoria}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{item.nmTag || "—"}</td>
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
              <div className="flex rounded-xl bg-white p-1 border border-slate-200">
                <button onClick={() => setVisaoCalendario("semana")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${visaoCalendario === "semana" ? "bg-violet-600 text-white" : "text-slate-500"}`}>Semana</button>
                <button onClick={() => setVisaoCalendario("mes")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${visaoCalendario === "mes" ? "bg-violet-600 text-white" : "text-slate-500"}`}>Mês</button>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                <button onClick={() => moverCalendario(-1)} className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-100">‹</button>
                <span>
                  {visaoCalendario === "semana"
                    ? `${semanaAtual[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${semanaAtual[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
                    : dataCalendario.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                <button onClick={() => moverCalendario(1)} className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-100">›</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              {botaoExportar(visaoCalendario)}
              <button onClick={() => setSelecaoDias(s => (s ? null : { inicio: null }))} aria-pressed={!!selecaoDias}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${selecaoDias ? "border-violet-600 bg-violet-100 text-violet-800" : "border-violet-200 text-violet-700 hover:bg-violet-50"}`}>
                <CalendarRange size={16} /> Selecionar dias
              </button>
              <button onClick={() => abrirNovo(dataCalendario)} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 transition-colors">
                <PlusCircle size={16} /> Novo compromisso
              </button>
              </div>
            </div>

            {selecaoDias && (
              <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-900">
                <span>{selecaoDias.inicio
                  ? <>Início: <strong>{selecaoDias.inicio.split("-").reverse().join("/")}</strong>. Agora toque no último dia (ou no mesmo, para um dia só).</>
                  : "Toque no primeiro dia da demanda no calendário."}</span>
                <button type="button" onClick={() => setSelecaoDias(null)} className="font-bold text-violet-700 hover:underline">Cancelar</button>
              </div>
            )}

            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar compromisso ou observação..."
                aria-label="Buscar na rotina"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {categorias.map(c => (
                <button key={c} onClick={() => alternarCategoriaRotina(c)} className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${categoriasRotina.includes(c) ? "border-violet-500 bg-violet-100 text-violet-700" : "border-slate-200 text-slate-500"}`}>
                  {c}
                </button>
              ))}
              {categoriasRotina.length > 0 && <button onClick={() => setCategoriasRotina([])} className="text-[10px] font-bold text-slate-500 hover:text-slate-800">× Limpar</button>}
              {busca.trim() && <button onClick={() => setBusca("")} className="text-[10px] font-bold text-slate-500 hover:text-slate-800">× Limpar busca</button>}
            </div>

            {erro && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{erro}</span>
                <button onClick={() => void carregar()} className="font-semibold">Tentar novamente</button>
              </div>
            )}

            {visaoCalendario === "semana" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:grid-cols-7">
                {semanaAtual.map(data => {
                  const itens = itensDoDia(data);
                  return (
                    <section key={data.toISOString()} {...propsDia(data)} className={`flex flex-col gap-2 rounded-2xl border p-3 ${ymd(data) === hoje() ? "border-violet-600 bg-violet-50/60" : "border-slate-200"}${classeSelecao(data)}`}>
                      <header className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold uppercase text-slate-500">{nomeDiaSemana(data).replace("-Feira", "")}</span>
                        <strong className="text-sm text-slate-800">{data.getDate()}</strong>
                      </header>
                      <div className="flex flex-col gap-2">
                        {itens.map(item => {
                          const ignorado = item.flFixo && ignorados.includes(`${item.id}|${ymd(data)}`);
                          return (
                            <div key={`${item.flFixo ? "f" : "p"}-${item.id}`} className={`relative rounded-xl p-2 text-left hover:brightness-125 ${corCategoria[item.nmCategoria]} ${ignorado ? "opacity-40" : ""}`}>
                              <button onClick={() => abrirEdicao(item)} className="block w-full text-left">
                                <div className="flex items-center gap-1 text-[9px] font-bold">{rotuloNoDia(item, ymd(data))}</div>
                                <p className={`pr-5 text-xs font-semibold leading-snug text-slate-900 ${ignorado ? "line-through" : ""}`}>{item.nmCronogramaSemanal}</p>
                              </button>
                              {item.flFixo && ehMeu(item) && pode.rotina && (
                                <button
                                  onClick={() => void alternarIgnorado(item, ymd(data))}
                                  title={ignorado ? "Reativar só neste dia" : "Desmarcar só neste dia"}
                                  className="absolute right-1.5 top-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900"
                                >
                                  {ignorado ? "↺" : "×"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {!itens.length && <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-[10px] font-bold uppercase text-slate-700">Livre</div>}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-7 gap-2">
                {DIAS_CABECALHO_MES.map(dia => (
                  <div key={dia} className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">{dia}</div>
                ))}
                {celulasDoMes.map(data => {
                  const itens = itensDoDia(data);
                  const foraDoMes = data.getMonth() !== dataCalendario.getMonth();
                  return (
                    <section key={data.toISOString()} {...propsDia(data)} className={`min-h-[90px] rounded-xl border p-2 ${foraDoMes ? "border-slate-200 opacity-40" : "border-slate-200"} ${ymd(data) === hoje() ? "border-violet-600" : ""}${classeSelecao(data)}`}>
                      <header className="mb-1 text-[10px] font-bold text-slate-500">{data.getDate()}</header>
                      <div className="flex flex-col gap-1">
                        {itens.slice(0, 3).map(item => (
                          <button key={`${item.flFixo ? "f" : "p"}-${item.id}`} onClick={() => abrirEdicao(item)} className={`truncate rounded-lg px-1.5 py-0.5 text-left text-[9px] hover:brightness-125 ${corCategoria[item.nmCategoria]} ${item.flFixo && ignorados.includes(`${item.id}|${ymd(data)}`) ? "line-through opacity-40" : ""}`}>
                            {rotuloNoDia(item, ymd(data)).split(" ")[0]} {item.nmCronogramaSemanal}
                          </button>
                        ))}
                        {itens.length > 3 && <span className="text-[9px] text-slate-500">+{itens.length - 3} compromissos</span>}
                      </div>
                    </section>
                  );
                })}
              </div>
              </div>
            )}
          </div>
        )}
      </div>

      {exportando && (
        <ExportarImagem
          modo={exportando}
          periodo={periodoExportado}
          filtros={filtrosExportados}
          autor={usuario?.nome}
          lista={exportando === "lista" ? listaOrdenada.map(item => paraExportar(item, String(item.id))) : undefined}
          agruparPorStatus={exportando === "lista" && !ordenacao}
          dias={exportando === "semana" ? diasParaExportar(semanaAtual) : exportando === "mes" ? diasParaExportar(celulasParaExportar, dataCalendario.getMonth()) : undefined}
          nomeArquivo={nomeArquivoImagem(exportando, exportando === "semana" ? semanaAtual[0] : exportando === "mes" ? dataCalendario : new Date())}
          onFechar={() => setExportando(null)}
        />
      )}

      {chatAberto && <ChatDemanda hoje={hoje()} onFechar={() => setChatAberto(false)} onCriar={criarDoRascunho} onRevisar={revisarRascunho} />}

      {(criando || editando) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={fecharModal}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editando ? "Editar demanda" : "Nova demanda"}</h2>
              <button onClick={fecharModal} className="text-slate-500 hover:text-slate-800"><X size={20} /></button>
            </div>

            {erroModal && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erroModal}</div>}

            {editando && !ehMeu(editando) && (
              <p className="mb-3 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                <Lock size={14} /> Demanda de {editando.nmDono ?? "outra pessoa"}: só quem criou pode editar o conteúdo.
              </p>
            )}
            {editando?.id != null && !ehMeu(editando) && pode.mover && (
              <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                Mover para a fila
                <select value={draft.nmStatusCronograma} aria-label="Mover para a fila"
                  onChange={e => { const st = e.target.value as Status; setDraft({ ...draft, nmStatusCronograma: st }); void mudarStatus(editando, st); setEditando({ ...editando, nmStatusCronograma: st }); }}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                  {statuses.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
                </select>
              </label>
            )}
            {editando?.id != null && ehMeu(editando) && pode.compartilhar && (
              <CompartilharItem idItem={editando.id} idsAtuais={editando.idsCompartilhados ?? []}
                onCompartilhado={ids => {
                  setEditando(e => (e ? { ...e, idsCompartilhados: ids } : e));
                  setItems(l => l.map(x => (x.id === editando.id ? { ...x, idsCompartilhados: ids } : x)));
                }} />
            )}

            <fieldset disabled={!!editando && !ehMeu(editando)} className="min-w-0">

            <label className="mb-3 block text-xs font-semibold text-slate-500">
              Título
              <input
                autoFocus
                value={draft.nmCronogramaSemanal}
                onChange={e => setDraft({ ...draft, nmCronogramaSemanal: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
              />
            </label>

            <label className="mb-3 block text-xs font-semibold text-slate-500">
              Descrição/Observação
              <textarea
                rows={3}
                value={draft.txObservacao ?? ""}
                onChange={e => setDraft({ ...draft, txObservacao: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
              />
            </label>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-500">
                Categoria
                <select
                  value={draft.nmCategoria}
                  onChange={e => setDraft({ ...draft, nmCategoria: e.target.value as Categoria })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
                >
                  {categorias.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Fila
                <select
                  value={draft.nmStatusCronograma}
                  onChange={e => setDraft({ ...draft, nmStatusCronograma: e.target.value as Status })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
                >
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-500">
                Frente/Projeto
                <input
                  value={draft.nmTag ?? ""}
                  onChange={e => setDraft({ ...draft, nmTag: e.target.value })}
                  placeholder="Ex.: Obra, NordTool"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                Data planejada
                <input
                  type="date"
                  value={draft.dtPrazo ?? ""}
                  onChange={e => setDraft({ ...draft, dtPrazo: e.target.value || null })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
                />
              </label>
            </div>

            {(pode.rotina || draft.flFixo) && (
            <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <input
                type="checkbox"
                checked={!!draft.flFixo}
                disabled={!pode.rotina}
                onChange={e => {
                  setDraft({ ...draft, flFixo: e.target.checked, idDiaSemana: e.target.checked ? draft.idDiaSemana : null, dtAgendamento: e.target.checked ? null : draft.dtAgendamento });
                  if (!e.target.checked) setDiasFixos([]);
                }}
              />
              📌 Atividade fixa (recorrente toda semana)
            </label>
            )}

            {draft.flFixo ? (
              <fieldset disabled={!pode.rotina} className="mb-3 min-w-0">
                <div className="text-xs font-semibold text-slate-500">
                  Dias da semana <span className="font-normal text-slate-400">(marque um ou vários)</span>
                  <div role="group" aria-label="Dias da semana" className="mt-1 grid grid-cols-6 gap-1">
                    {diasSemanaOpcoes.map(d => {
                      const marcado = diasFixos.includes(d.id);
                      return (
                        <button key={d.id} type="button" aria-pressed={marcado} title={d.label} onClick={() => setDiasFixos(l => alternarDia(l, d.id))}
                          className={`rounded-lg border py-2 text-xs font-bold transition-colors ${marcado ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"}`}>
                          {d.curto}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex gap-2 text-[11px] font-semibold">
                    <button type="button" onClick={() => setDiasFixos([1, 2, 3, 4, 5])} className="text-violet-600 hover:underline">Seg a Sex</button>
                    <button type="button" onClick={() => setDiasFixos([1, 2, 3, 4, 5, 7])} className="text-violet-600 hover:underline">Seg a Sáb</button>
                    {diasFixos.length > 0 && <button type="button" onClick={() => setDiasFixos([])} className="text-slate-400 hover:underline">Limpar</button>}
                  </div>
                  {diasFixos.length > 1 && (
                    <span className="mt-1 block font-normal text-slate-500">
                      {editando ? "Os dias novos viram cópias desta atividade (cada dia fica independente)." : `Serão criadas ${diasFixos.length} atividades, uma por dia.`}
                    </span>
                  )}
                </div>
                <label className="mt-3 block text-xs font-semibold text-slate-500">
                  Horário
                  <input
                    value={draft.nmHorario ?? ""}
                    onChange={e => setDraft({ ...draft, nmHorario: e.target.value })}
                    placeholder="Ex.: 07:00–17:00"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </label>
              </fieldset>
            ) : (
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-500">
                  Começa em (dia e horário)
                  <input
                    type="datetime-local"
                    value={paraDatetimeLocal(draft.dtAgendamento)}
                    onChange={e => {
                      const inicio = e.target.value || null;
                      // Sem início não há fim; fim antes do novo início é descartado.
                      const fim = inicio && draft.dtFimAgendamento && draft.dtFimAgendamento >= inicio.slice(0, 10) ? draft.dtFimAgendamento : null;
                      setDraft({ ...draft, dtAgendamento: inicio, dtFimAgendamento: fim });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  Termina em (dia)
                  <input
                    type="date"
                    value={draft.dtFimAgendamento ?? ""}
                    min={draft.dtAgendamento ? draft.dtAgendamento.slice(0, 10) : undefined}
                    disabled={!draft.dtAgendamento}
                    onChange={e => setDraft({ ...draft, dtFimAgendamento: e.target.value || null })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600 disabled:bg-slate-50"
                  />
                </label>
                <span className="block text-xs font-normal normal-case text-slate-500 sm:col-span-2">
                  Opcional. Sem início, a demanda fica só no Kanban/Lista; sem fim, vale só o dia do início. Com os dois, ela aparece na Rotina em todos os dias do período.
                </span>
              </div>
            )}

            </fieldset>

            {(!editando || ehMeu(editando)) && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void salvar()}
                disabled={salvando}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              {editando && pode.excluir && (
                <button onClick={() => void excluir()} disabled={salvando} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Excluir
                </button>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {relatorioIA && <RelatorioIA onFechar={() => setRelatorioIA(false)} />}
      {equipesAberto && usuario && (
        <EquipesModal meuId={usuario.id} meuNome={usuario.nome} nomeObra={obra?.nmObra}
          onFechar={() => setEquipesAberto(false)} onSalvo={() => { carregarEquipes(); void carregar(); }} />
      )}
    </div>
  );
}
