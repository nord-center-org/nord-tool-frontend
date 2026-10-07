import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useOutletContext } from "react-router";
import {
  Loader2,
  Edit2,
  Trash2,
  Search,
  RotateCcw,
  FileSpreadsheet,
  ChevronDown,
  Upload,
  Download
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

import ApartmentModal, { type AbaApartamento } from "@/react-app/components/ApartmentModal";
import { apartamentoVistoriaService } from "@/react-app/services/ApartamentoVistoriaService";
import type { ApartamentoVistoriaDto } from "@/shared/types";
import { ColumnFilter } from "@/react-app/components/ColumnFilter";
import { useFiltrosColuna } from "@/react-app/hooks/useFiltrosColuna";
import { aplicarFiltrosColuna, valoresUnicos, type ColunasFiltro } from "@/react-app/utils/filtroColuna";

import MassUpdateModal from "@/react-app/components/MassUpdateModal";
import MovimentacaoMassaModal from "@/react-app/components/MovimentacaoMassaModal";
import { ClipboardPaste } from "lucide-react";
import {
  classeSituacao, descricaoDoTermo, ordemFotos, progressoPaginas, situacaoDoTermo, valorFotos,
} from "@/react-app/utils/termoLista";

type ColunaApartamento = "apartamento" | "status" | "data" | "horario" | "observacao" | "termo" | "fotos";

const dataIso = (dateValue?: string | null): string => {
  if (!dateValue) return "";
  try {
    let cleanDate = String(dateValue).split('T')[0];
    if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/');
      if (parts.length === 3) cleanDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const date = parseISO(cleanDate);
    return isValid(date) ? format(date, "yyyy-MM-dd") : "";
  } catch {
    return "";
  }
};

const formatarDataParaBusca = (dateValue?: string | null): string => {
  const iso = dataIso(dateValue);
  return iso ? format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR }) : "";
};

const COLUNAS: ColunasFiltro<ApartamentoVistoriaDto, ColunaApartamento> = {
  apartamento: { valor: apt => apt.nmApartamentoVistoria },
  status: { valor: apt => apt.nmStatusVistoria },
  data: {
    valor: apt => formatarDataParaBusca(apt.dtApartamentoVigente),
    ordem: apt => {
      const iso = dataIso(apt.dtApartamentoVigente);
      return iso ? `${iso} ${apt.nmHorarioVistoria || ""}` : null;
    },
  },
  horario: { valor: apt => apt.nmHorarioVistoria },
  observacao: { valor: apt => apt.txObservacaoRevistoria },
  termo: { valor: apt => situacaoDoTermo(apt) },
  fotos: { valor: apt => valorFotos(apt), ordem: apt => ordemFotos(apt) },
};

const lerStatusPadrao = (): string[] => {
  try {
    const salvo = JSON.parse(localStorage.getItem("@NordTool:filter_db_status") || '["Agendado", "Pendente"]');
    return Array.isArray(salvo) ? salvo : [];
  } catch {
    return ["Agendado", "Pendente"];
  }
};

export default function ApartamentosPage() {
  const outletContext = useOutletContext<{ sidebarOpen: boolean }>();
  const sidebarOpen = outletContext?.sidebarOpen ?? false;
  const [apartamentos, setApartamentos] = useState<ApartamentoVistoriaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState<ApartamentoVistoriaDto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [abaModal, setAbaModal] = useState<AbaApartamento>("dados");
  const [searchTerm, setSearchTerm] = useState("");
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [nordSelecionado, setNordSelecionado] = useState<"N1" | "N2" | "EN" | null>(null);
  const [showExcelMenu, setShowExcelMenu] = useState(false);
  const [expandedObsId, setExpandedObsId] = useState<number | null>(null);
  const { filtros, ordenacao, aplicarFiltro, ordenar, limpar } = useFiltrosColuna<ColunaApartamento>(
    {},
    { coluna: "data", direcao: "asc" },
  );
  // Preferências do Settings viram o estado inicial do filtro de Status.
  const statusPadraoRef = useRef<string[]>(lerStatusPadrao());
  const statusAplicadoRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMassUpdateModal, setShowMassUpdateModal] = useState(false);
  // Movimentação em massa: apartamentos marcados na tabela.
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [movendo, setMovendo] = useState(false);

  useEffect(() => {
    const syncSettings = () => {
      // 1. Lê a obra (Condomínio)
      const savedCondo = localStorage.getItem("@NordTool:filter_db_condo"); // Valor deve ser "Nord 1", "Nord 2" ou "Energy"
      
      // 2. Status padrão (aplicado como filtro inicial quando os dados chegam)
      statusPadraoRef.current = lerStatusPadrao();

      // 3. Aplica a obra
      setNordSelecionado(savedCondo as "N1" | "N2" | "EN" | null);
    };

    syncSettings();
    fetchApartamentos();
  }, []);

  const aplicarStatusPadrao = (lista: ApartamentoVistoriaDto[]) => {
    if (statusAplicadoRef.current) return;
    statusAplicadoRef.current = true;
    const padrao = statusPadraoRef.current.map(s => s.toLowerCase());
    if (padrao.length === 0) return;
    const selecionados = valoresUnicos(lista, COLUNAS.status)
      .filter(valor => padrao.some(s => valor.toLowerCase().includes(s)));
    if (selecionados.length > 0) aplicarFiltro("status", selecionados);
  };

  const fetchApartamentos = async () => {
    setLoading(true);
    try {
      const data = await apartamentoVistoriaService.listar();
      setApartamentos(data || []);
      aplicarStatusPadrao(data || []);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  };

  /* =======================
      HELPERS
  ======================= */
  const formatarDataExibicao = (dateValue?: string | null, diaSemana?: string | null) => {
    const formattedDate = formatarDataParaBusca(dateValue);
    if (formattedDate) {
      return diaSemana && diaSemana !== "Sem agendamento" ? `${formattedDate} - ${diaSemana}` : formattedDate;
    }
    return diaSemana || "Sem agendamento";
  };

  const handleDownloadTemplate = () => {
    const header = [
      {
        "nmApartamentoVistoria": "N1-01-0101",
        "nmStatusVistoria": "Agendado",
        "dtApartamentoVistoria": new Date("2026-02-18T12:00:00Z"),
        "nmHorarioVistoria": "14:00",
        "nmObservacaoVistoria": "Exemplo de preenchimento"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(header, { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo_Importacao");
    XLSX.writeFile(wb, "NordTool_Modelo_Importacao.xlsx");
    setShowExcelMenu(false);
  };

  const handleExportData = () => {
    const dadosParaExportar = filteredApartamentos.map(apt => ({
      "Apartamento": apt.nmApartamentoVistoria,
      "Status": apt.nmStatusVistoria,
      "Data": formatarDataParaBusca(apt.dtApartamentoVigente),
      "Dia da Semana": apt.nmDiaSemana,
      "Horário": apt.nmHorarioVistoria || "--:--",
      "Observação": apt.txObservacaoRevistoria || ""
    }));

    const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados_Vistoria");
    XLSX.writeFile(wb, `NordTool_Export_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    setShowExcelMenu(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("Arquivo selecionado para importação:", file.name, file.type, file.size);

    setLoading(true);
    try {
      await apartamentoVistoriaService.importar(file);
      await fetchApartamentos();
      setShowExcelMenu(false);
      alert("Planilha importada com sucesso!");
    } catch (error: unknown) {
      console.error("Erro na importação:", error);
      alert(`Falha na importação: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* =======================
      ACTIONS
  ======================= */
  const handleEdit = (apt: ApartamentoVistoriaDto, aba: AbaApartamento = "dados") => {
    setAbaModal(aba);
    setSelectedApartment(apt);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este registro?")) return;
    try {
      await apartamentoVistoriaService.deletar(id);
      setApartamentos(prev => prev.filter(apt => apt.idApartamentoVistoria !== id));
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Não foi possível excluir o registro.");
    }
  };

  // Correção Cirúrgica: Atualiza localmente a linha editada mantendo a posição e estados
  const fetchApartamentosSilencioso = async () => {
    try {
      const data = await apartamentoVistoriaService.listar();
      setApartamentos(data || []);
    } catch (error) {
      console.error("Erro na atualização silenciosa:", error);
    }
  };

  const handleSaveApartment = async () => {
    setShowModal(false);
    setSelectedApartment(null);
    await fetchApartamentosSilencioso();
  };

  /* =======================
      FILTER & SORT LOGIC
  ======================= */
  const baseApartamentos = useMemo(() => {
    const hiddenStatus = "não liberado";

    return apartamentos.filter((apt) => {
      const statusApt = apt.nmStatusVistoria?.toLowerCase() || "";

      if (!mostrarTodos && statusApt.includes(hiddenStatus)) return false;
      if (nordSelecionado) {
        const nome = apt.nmApartamentoVistoria?.toUpperCase() || "";
        if (!nome.startsWith(nordSelecionado)) return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const searchFields = [
          apt.nmApartamentoVistoria,
          apt.nmStatusVistoria,
          formatarDataParaBusca(apt.dtApartamentoVigente),
          apt.nmHorarioVistoria,
          apt.txObservacaoRevistoria
        ].map(v => v?.toLowerCase() || "").join(" ");
        if (!searchFields.includes(term)) return false;
      }
      return true;
    });
  }, [apartamentos, searchTerm, mostrarTodos, nordSelecionado]);

  const valoresPorColuna = useMemo(() => ({
    apartamento: valoresUnicos(baseApartamentos, COLUNAS.apartamento),
    status: valoresUnicos(baseApartamentos, COLUNAS.status),
    data: valoresUnicos(baseApartamentos, COLUNAS.data),
    horario: valoresUnicos(baseApartamentos, COLUNAS.horario),
    observacao: valoresUnicos(baseApartamentos, COLUNAS.observacao),
    termo: valoresUnicos(baseApartamentos, COLUNAS.termo),
    fotos: valoresUnicos(baseApartamentos, COLUNAS.fotos),
  }), [baseApartamentos]);

  const filteredApartamentos = useMemo(
    () => aplicarFiltrosColuna(
      baseApartamentos,
      COLUNAS,
      filtros,
      ordenacao ?? { coluna: "apartamento", direcao: "asc" },
    ),
    [baseApartamentos, filtros, ordenacao],
  );

  const idsVisiveis = filteredApartamentos.map(a => a.idApartamentoVistoria);
  const todosVisiveisMarcados = idsVisiveis.length > 0 && idsVisiveis.every(id => selecionados.includes(id));
  const algumVisivelMarcado = idsVisiveis.some(id => selecionados.includes(id));
  const alternarSelecao = (id: number) =>
    setSelecionados(atual => (atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]));
  const alternarTodosVisiveis = () =>
    setSelecionados(atual => (todosVisiveisMarcados
      ? atual.filter(id => !idsVisiveis.includes(id))
      : [...new Set([...atual, ...idsVisiveis])]));
  const apartamentosSelecionados = apartamentos.filter(a => selecionados.includes(a.idApartamentoVistoria));

  const filtroColuna = (coluna: ColunaApartamento, label: string, emptyLabel?: string) => (
    <ColumnFilter
      label={label}
      emptyLabel={emptyLabel}
      values={valoresPorColuna[coluna]}
      selected={filtros[coluna] ?? null}
      sortDirection={ordenacao?.coluna === coluna ? ordenacao.direcao : null}
      onApply={(valores) => aplicarFiltro(coluna, valores)}
      onSort={(direcao) => ordenar(coluna, direcao)}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-nowrap">
        <div className={`flex items-center gap-4 shrink-0 transition-all duration-300 ${!sidebarOpen ? 'pl-16' : 'pl-0'}`}>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Apartamentos</h2>
          <div className="flex p-1 bg-slate-200/50 rounded-lg border border-slate-200">
            <button onClick={() => setNordSelecionado(nordSelecionado === "N1" ? null : "N1")} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${nordSelecionado === "N1" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>Nord 1</button>
            <button onClick={() => setNordSelecionado(nordSelecionado === "N2" ? null : "N2")} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${nordSelecionado === "N2" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>Nord 2</button>
            <button onClick={() => setNordSelecionado(nordSelecionado === "EN" ? null : "EN")} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${nordSelecionado === "EN" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>Energy</button>
          </div>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Busca global (ex: 18/02)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setMostrarTodos(!mostrarTodos)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${mostrarTodos ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>{mostrarTodos ? "Ocultando" : "Mostrar Todos"}</button>
          
          <button onClick={() => { 
            setSearchTerm(""); 
            setNordSelecionado(null); 
            limpar();
          }} className="p-2 text-red-600 bg-white border border-slate-200 rounded-xl hover:bg-red-50 shadow-sm"><RotateCcw className="w-4 h-4" /></button>
          
          <div className="relative" ref={menuRef}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportExcel} 
              accept=".xlsx, .xls" 
              className="hidden" 
            />
            <button onClick={() => setShowExcelMenu(!showExcelMenu)} className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-sm transition-all flex items-center gap-1">
              <FileSpreadsheet className="w-4 h-4" />
              <ChevronDown className={`w-3 h-3 transition-transform ${showExcelMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExcelMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <button 
                  onClick={handleImportClick}
                  className="flex items-center gap-3 w-full px-4 py-3 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100"
                >
                  <Upload className="w-4 h-4 text-blue-500" /> Importar planilha
                </button>
                <button 
                  onClick={handleExportData}
                  className="flex items-center gap-3 w-full px-4 py-3 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100"
                >
                  <Download className="w-4 h-4 text-green-500" /> Exportar planilha
                </button>
                <button 
                  onClick={handleDownloadTemplate} 
                  className="flex items-center gap-3 w-full px-4 py-3 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-500" /> Planilha modelo
                </button>
                <button 
                  onClick={() => setShowMassUpdateModal(true)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100"
                >
                  <ClipboardPaste className="w-4 h-4 text-purple-500" /> Atualizar agenda
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="w-12 px-4 py-4 text-center border-r border-slate-100"><input type="checkbox" aria-label="Selecionar todos os apartamentos visíveis" className="rounded text-blue-600" checked={todosVisiveisMarcados} ref={el => { if (el) el.indeterminate = algumVisivelMarcado && !todosVisiveisMarcados; }} onChange={alternarTodosVisiveis} /></th>
                <th className="px-4 py-4 min-w-[150px] text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{filtroColuna("apartamento", "Apartamento")}</th>
                <th className="px-4 py-4 min-w-[120px] text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{filtroColuna("status", "Status")}</th>
                <th className="px-4 py-4 min-w-[140px] text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{filtroColuna("data", "Data", "Sem data")}</th>
                <th className="px-4 py-4 min-w-[120px] text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{filtroColuna("horario", "Horário", "Sem horário")}</th>
                <th className="px-4 py-4 min-w-[150px] text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{filtroColuna("observacao", "Observação", "Sem observação")}</th>
                <th className="px-4 py-4 min-w-[140px] text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{filtroColuna("termo", "Termo")}</th>
                <th className="px-4 py-4 min-w-[140px] text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{filtroColuna("fotos", "Fotos", "Sem termo")}</th>
                <th className="px-4 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></td></tr>
              ) : (
                filteredApartamentos.map((apt) => {
                  const status = apt.nmStatusVistoria?.toLowerCase() || "";
                  let statusClasses = "bg-blue-50 text-blue-600";
                  if (status.includes('aprovado')) statusClasses = "bg-green-50 text-green-700";
                  if (status.includes('reprovado')) statusClasses = "bg-red-50 text-red-700";
                  if (status.includes('agendado')) statusClasses = "bg-slate-100 text-slate-600";
                  if (status.includes('não liberado')) statusClasses = "bg-slate-900 text-white";
                  if (status.includes('pendente')) statusClasses = "bg-yellow-50 text-yellow-700";

                  return (
                    <Fragment key={apt.idApartamentoVistoria}>
                      <tr className={`hover:bg-slate-50/50 transition-colors group ${expandedObsId === apt.idApartamentoVistoria ? 'bg-slate-50' : ''}`}>
                        <td className="px-4 py-4 text-center border-r border-slate-50"><input type="checkbox" aria-label={`Selecionar ${apt.nmApartamentoVistoria}`} className="rounded text-blue-600" checked={selecionados.includes(apt.idApartamentoVistoria)} onChange={() => alternarSelecao(apt.idApartamentoVistoria)} /></td>
                        <td className="px-4 py-4 text-sm font-bold text-slate-700">{apt.nmApartamentoVistoria}</td>
                        <td className="px-4 py-4 text-xs font-bold uppercase">
                          <span className={`px-2.5 py-1 rounded-full ${statusClasses}`}>
                            {apt.nmStatusVistoria}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 font-medium">{formatarDataExibicao(apt.dtApartamentoVigente, apt.nmDiaSemana)}</td>
                        <td className="px-4 py-4 text-sm text-slate-400 font-medium">{apt.nmHorarioVistoria || "--:--"}</td>
                        <td 
                          className="px-4 py-4 text-sm text-slate-500 cursor-pointer hover:bg-slate-100 transition-all max-w-[200px]"
                          onClick={() => setExpandedObsId(expandedObsId === apt.idApartamentoVistoria ? null : apt.idApartamentoVistoria)}
                        >
                          <div className="truncate">
                            {apt.txObservacaoRevistoria || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleEdit(apt, "termo")}
                            title="Abrir o termo de reprova"
                            className="flex flex-col items-start gap-1 text-left"
                          >
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${classeSituacao(situacaoDoTermo(apt))}`}>{situacaoDoTermo(apt)}</span>
                            {descricaoDoTermo(apt) && <span className="text-[11px] text-slate-400">{descricaoDoTermo(apt)}</span>}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleEdit(apt, "termo")}
                            title="Abrir as fotos do termo"
                            className="flex flex-col items-start text-left"
                          >
                            <span className="text-sm font-medium text-slate-600">{valorFotos(apt) ?? "—"}</span>
                            {progressoPaginas(apt) && <span className="text-[11px] text-slate-400">{progressoPaginas(apt)}</span>}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(apt)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(apt.idApartamentoVistoria)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Sub-linha que expande ocupando toda a largura */}
                      {expandedObsId === apt.idApartamentoVistoria && apt.txObservacaoRevistoria && (
                        <tr>
                          <td colSpan={9} className="px-8 py-4 bg-blue-50/30 border-b border-slate-200 shadow-inner">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Observações Completas</div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                              {apt.txObservacaoRevistoria}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selecionados.length > 0 && (
        <div role="region" aria-label="Ações em massa" className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-white shadow-2xl">
          <span className="text-sm font-semibold">{selecionados.length} selecionado(s)</span>
          <button type="button" onClick={() => setMovendo(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-700">Mover de status</button>
          <button type="button" onClick={() => setSelecionados([])} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">Limpar seleção</button>
        </div>
      )}

      {movendo && apartamentosSelecionados.length > 0 && (
        <MovimentacaoMassaModal
          apartamentos={apartamentosSelecionados}
          onConcluir={idsAlterados => {
            setMovendo(false);
            if (idsAlterados.length > 0) {
              setSelecionados(atual => atual.filter(id => !idsAlterados.includes(id)));
              void fetchApartamentosSilencioso();
            }
          }}
        />
      )}

      {showModal && (
        <ApartmentModal
          apartment={selectedApartment}
          abaInicial={abaModal}
          onClose={() => { setShowModal(false); setSelectedApartment(null); }}
          onSave={handleSaveApartment}
          onTermoAlterado={() => void fetchApartamentosSilencioso()}
        />
      )}

      {showMassUpdateModal && (
        <MassUpdateModal
          onClose={() => setShowMassUpdateModal(false)}
          onProcess={async (agendamentos) => {
            setLoading(true);
            try {
              // Prepara o payload para garantir compatibilidade total com o seu Form do Java
              const payload = agendamentos.map(item => ({
                nmApartamentoVistoria: item.nmApartamentoVistoria,
                dtApartamentoVigente: item.dtApartamentoVigente,
                nmHorarioVistoria: item.nmHorarioVistoria,
                idDiaSemana: 1,
                idStatusVistoria: 1
              }));

              console.log("Enviando para o backend:", JSON.stringify(payload));

              await apartamentoVistoriaService.atualizarAgendaEmMassa(payload);

              alert("Agenda atualizada com sucesso!");
              if (typeof fetchApartamentosSilencioso === 'function') {
                await fetchApartamentosSilencioso();
              }
            } catch (err) {
              console.error("Falha na requisição:", err);
              alert(err instanceof Error ? err.message : "Falha de conexão com o servidor.");
            } finally {
              setLoading(false);
              setShowMassUpdateModal(false);
            }
          }}
        />
      )}
    </div>
  );
}
