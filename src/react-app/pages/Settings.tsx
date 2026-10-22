import { useEffect, useState } from "react";
import PreCarregamentoApartamentosEditor from "@/react-app/components/PreCarregamentoApartamentosEditor";
import { listarStatusVistoria } from "@/react-app/services/EndpointsDominioService";
import { CHAVE_PRE_CARREGAMENTO, lerPreCarregamento, type PreCarregamento } from "@/react-app/utils/preCarregamentoApartamentos";
import {
  Settings as SettingsIcon, Save, ChevronDown, ChevronUp,
  Loader2, Building2, Clock, Filter, Database, LayoutDashboard, FolderCog, Wrench, ShieldCheck, Network, KeyRound, LogOut
} from "lucide-react";
import { Link } from "react-router";
import { ControleChavesService, type ObraControleChaves } from "../services/ControleChavesService";
import { OpcoesColaboradorService, type Empresa, type Cargo, type Permissao } from "../services/OpcoesColaboradorService";
import { FerramentaService, type Ferramenta } from "../services/FerramentaService";
import { lerObraControleChaves, salvarObraControleChaves } from "../utils/preferenciasControleChaves";
import CadastroSimples from "../components/CadastroSimples";
import CadastroFerramentas from "../components/CadastroFerramentas";
import AcessosModal from "../components/administracao/AcessosModal";
import ObrasModal from "../components/administracao/ObrasModal";
import EquipeModal from "../components/administracao/EquipeModal";
import { useAuth } from "../hooks/useAuth";
import { podeAcessar } from "../utils/sessao";
import { useObra } from "../hooks/useObra";
import { iniciais } from "../utils/menuLateral";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";

type AbaCadastro = "empresas" | "cargos" | "permissoes" | "ferramentas";

const ROTULOS_OBRAS_CONTROLE_CHAVES: Record<string, string> = {
  N1: "Nord 1",
  N2: "Nord 2",
  EN: "Energy",
};

const normalizarIdObraControleChaves = (id: unknown): string =>
  typeof id === "string" && Object.prototype.hasOwnProperty.call(ROTULOS_OBRAS_CONTROLE_CHAVES, id) ? id : "";

export default function SettingsPage() {
  const { usuario, sair } = useAuth();
  const ehAdmin = podeAcessar(usuario?.permissoes, "ADMINISTRACAO", "ADMIN");
  const [acessosAberto, setAcessosAberto] = useState(false);
  const { fases: fasesDaObra, obra: obraAtual } = useObra();
  const [obrasAberto, setObrasAberto] = useState(false);
  const [equipeAberto, setEquipeAberto] = useState(false);
  const [apartmentList, setApartmentList] = useState("");
  const [timeSlotsList, setTimeSlotsList] = useState("");

  // Novos estados para o Pré-carregamento
  const [activeFilterTab, setActiveFilterTab] = useState<"agenda" | "database">("agenda");
  const [defaultDeliveryCondo, setDefaultDeliveryCondo] = useState("");
  const [defaultDeliveryTime, setDefaultDeliveryTime] = useState("current");
  const [defaultDbCondo, setDefaultDbCondo] = useState("");
  const [defaultDbShowAll, setDefaultDbShowAll] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [showApartmentList, setShowApartmentList] = useState(false);
  const [showTimeSlotsList, setShowTimeSlotsList] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [preCarregamento, setPreCarregamento] = useState<PreCarregamento>(() => lerPreCarregamento(localStorage));
  const [statusConhecidos, setStatusConhecidos] = useState<string[]>([]);
  const [obrasControleChaves, setObrasControleChaves] = useState<ObraControleChaves[]>([]);
  const [obraControleChaves, setObraControleChaves] = useState<string>(() => lerObraControleChaves());
  const [erroObrasControleChaves, setErroObrasControleChaves] = useState("");
  const [carregandoObrasControleChaves, setCarregandoObrasControleChaves] = useState(true);
  const [tentativaObrasControleChaves, setTentativaObrasControleChaves] = useState(0);

  // Cadastros (Empresas, Cargos, Permissões, Ferramentas)
  const [showCadastros, setShowCadastros] = useState(false);
  const [abaCadastro, setAbaCadastro] = useState<AbaCadastro>("empresas");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([]);
  const [carregandoCadastro, setCarregandoCadastro] = useState(false);
  const [erroCadastro, setErroCadastro] = useState<string | null>(null);
  const [tentativaCadastro, setTentativaCadastro] = useState(0);

  useEffect(() => {
    void listarStatusVistoria().then(lista => setStatusConhecidos(lista.map(s => s.nmStatusVistoria)));
    const fetchSettings = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 400)); // Simula o tempo de busca

        setApartmentList(localStorage.getItem("@NordTool:apartamentos") || "101, 102, 201");
        setTimeSlotsList(localStorage.getItem("@NordTool:horarios") || "08:00, 09:00, 10:00");

        // Carregando os filtros
        setDefaultDeliveryCondo(localStorage.getItem("@NordTool:filter_del_condo") || "");
        setDefaultDeliveryTime(localStorage.getItem("@NordTool:filter_del_time") || "current");
        setDefaultDbCondo(localStorage.getItem("@NordTool:filter_db_condo") || "");
        setDefaultDbShowAll(localStorage.getItem("@NordTool:filter_db_showall") === "true");

      } catch {
        setMessage("Erro crítico na leitura da fundação.");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCarregandoObrasControleChaves(true);
    setErroObrasControleChaves("");
    ControleChavesService.listarObras({ signal: controller.signal })
      .then(setObrasControleChaves)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErroObrasControleChaves(error instanceof Error ? error.message : "Falha ao carregar as obras.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregandoObrasControleChaves(false);
      });
    return () => controller.abort();
  }, [tentativaObrasControleChaves]);

  useEffect(() => {
    if (!showCadastros) return;
    let cancelado = false;
    setCarregandoCadastro(true);
    setErroCadastro(null);
    const carregar = async () => {
      try {
        if (abaCadastro === "empresas") setEmpresas(await OpcoesColaboradorService.listarEmpresas());
        else if (abaCadastro === "cargos") setCargos(await OpcoesColaboradorService.listarCargos());
        else if (abaCadastro === "permissoes") setPermissoes(await OpcoesColaboradorService.listarPermissoes());
        else setFerramentas(await FerramentaService.listar());
      } catch (error) {
        if (!cancelado) setErroCadastro(error instanceof Error ? error.message : "Falha ao carregar os registros.");
      } finally {
        if (!cancelado) setCarregandoCadastro(false);
      }
    };
    void carregar();
    return () => { cancelado = true; };
  }, [showCadastros, abaCadastro, tentativaCadastro]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await new Promise(resolve => setTimeout(resolve, 600));

      localStorage.setItem("@NordTool:apartamentos", apartmentList);
      localStorage.setItem("@NordTool:horarios", timeSlotsList);

      // Salvando os filtros
      localStorage.setItem("@NordTool:filter_del_condo", defaultDeliveryCondo);
      localStorage.setItem("@NordTool:filter_del_time", defaultDeliveryTime);
      localStorage.setItem("@NordTool:filter_db_condo", defaultDbCondo);
      localStorage.setItem("@NordTool:filter_db_showall", String(defaultDbShowAll));
      localStorage.setItem(CHAVE_PRE_CARREGAMENTO, JSON.stringify(preCarregamento));
      salvarObraControleChaves(obraControleChaves);

      setMessage("Parâmetros fixados com sucesso!");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Erro ao salvar os dados.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl animate-entrada mx-auto">
      <CabecalhoPagina icone={SettingsIcon} titulo="Configurações" subtitulo="Sua conta, a administração e os parâmetros das frentes de serviço" />

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-2 overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">

          {usuario && (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-5 shadow-sm" aria-labelledby="config-conta">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-base font-black text-white" aria-hidden="true">{iniciais(usuario.nome)}</span>
                <div className="min-w-0">
                  <h3 id="config-conta" className="truncate text-lg font-bold text-slate-800">{usuario.nome}</h3>
                  <p className="truncate text-xs font-medium text-slate-500">{usuario.email}{obraAtual ? ` · ${obraAtual.nmObra}` : ""}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/conta/senha" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <KeyRound className="h-4 w-4" /> Alterar senha
                </Link>
                <button type="button" onClick={sair} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>
            </section>
          )}

          {ehAdmin && (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm" aria-labelledby="config-administracao">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                  <h3 id="config-administracao" className="text-lg font-bold text-slate-800">Administração</h3>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Obras, fases, equipes e o que cada usuário pode ver.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setObrasAberto(true)} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
                  <Building2 className="h-4 w-4" /> Obras e fases
                </button>
                <button type="button" onClick={() => setEquipeAberto(true)} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
                  <Network className="h-4 w-4" /> Equipe e cargos
                </button>
                <button type="button" onClick={() => setAcessosAberto(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                  <ShieldCheck className="h-4 w-4" /> Acessos
                </button>
              </div>
            </section>
          )}

          <section className="border border-emerald-200 rounded-2xl bg-emerald-50/30 p-5 shadow-sm" aria-labelledby="config-controle-chaves">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 id="config-controle-chaves" className="text-lg font-bold text-slate-800">Controle de Chaves</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Obra aplicada ao Dashboard, retiradas recentes e Histórico.</p>
                </div>
                <label htmlFor="obra-controle-chaves" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Obra/Condomínio</label>
                <select
                  id="obra-controle-chaves"
                  value={normalizarIdObraControleChaves(obraControleChaves)}
                  onChange={(event) => setObraControleChaves(event.target.value)}
                  disabled={carregandoObrasControleChaves || !!erroObrasControleChaves}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none shadow-sm disabled:opacity-60"
                >
                  <option value="">Todas as obras</option>
                  {obrasControleChaves
                    .map((obra) => normalizarIdObraControleChaves(obra.idObra))
                    .filter(Boolean)
                    .map((idObra) => (
                      <option key={idObra} value={idObra}>{ROTULOS_OBRAS_CONTROLE_CHAVES[idObra]}</option>
                    ))}
                </select>
                {carregandoObrasControleChaves && <p className="text-sm text-slate-500">Carregando obras...</p>}
                {erroObrasControleChaves && (
                  <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <span>{erroObrasControleChaves}</span>
                    <button type="button" onClick={() => setTentativaObrasControleChaves((valor) => valor + 1)} className="shrink-0 font-semibold underline">Tentar novamente</button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SESSÃO DE CADASTROS */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => setShowCadastros((prev) => !prev)}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-amber-100/50 text-amber-600 rounded-xl">
                  <FolderCog className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-slate-800">Cadastros</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Empresas, cargos, permissões e ferramentas usados no Controle de Chaves
                  </p>
                </div>
              </div>
              <div className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
                {showCadastros ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </div>
            </button>

            {showCadastros && (
              <div className="p-5 pt-0 border-t border-slate-100 bg-slate-50/30">
                <div className="flex flex-wrap gap-1 bg-slate-200/50 rounded-xl border border-slate-200 w-max mb-6 mt-4 p-1">
                  {([
                    ["empresas", "Empresas"],
                    ["cargos", "Cargos"],
                    ["permissoes", "Permissões"],
                    ["ferramentas", "Ferramentas"],
                  ] as [AbaCadastro, string][]).map(([aba, rotulo]) => (
                    <button
                      key={aba}
                      onClick={() => setAbaCadastro(aba)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${abaCadastro === aba ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {aba === "ferramentas" && <Wrench className="w-4 h-4" />} {rotulo}
                    </button>
                  ))}
                </div>

                {abaCadastro === "empresas" && (
                  <CadastroSimples
                    titulo="Empresas"
                    rotuloCampo="Empresa"
                    itens={empresas.map(e => ({ id: e.id, nome: e.nmEmpresa }))}
                    carregando={carregandoCadastro}
                    erro={erroCadastro}
                    onRecarregar={() => setTentativaCadastro(v => v + 1)}
                    onCriar={async (nome) => { await OpcoesColaboradorService.criarEmpresa(nome); setTentativaCadastro(v => v + 1); }}
                    onAlterar={async (id, nome) => { await OpcoesColaboradorService.alterarEmpresa(id, nome); setTentativaCadastro(v => v + 1); }}
                    onExcluir={async (id) => { await OpcoesColaboradorService.excluirEmpresa(id); setTentativaCadastro(v => v + 1); }}
                  />
                )}
                {abaCadastro === "cargos" && (
                  <CadastroSimples
                    titulo="Cargos"
                    rotuloCampo="Cargo"
                    itens={cargos.map(c => ({ id: c.id, nome: c.nmCargo }))}
                    carregando={carregandoCadastro}
                    erro={erroCadastro}
                    onRecarregar={() => setTentativaCadastro(v => v + 1)}
                    onCriar={async (nome) => { await OpcoesColaboradorService.criarCargo(nome); setTentativaCadastro(v => v + 1); }}
                    onAlterar={async (id, nome) => { await OpcoesColaboradorService.alterarCargo(id, nome); setTentativaCadastro(v => v + 1); }}
                    onExcluir={async (id) => { await OpcoesColaboradorService.excluirCargo(id); setTentativaCadastro(v => v + 1); }}
                  />
                )}
                {abaCadastro === "permissoes" && (
                  <CadastroSimples
                    titulo="Permissões"
                    rotuloCampo="Permissão"
                    itens={permissoes.map(p => ({ id: p.id, nome: p.nmPermissao }))}
                    carregando={carregandoCadastro}
                    erro={erroCadastro}
                    onRecarregar={() => setTentativaCadastro(v => v + 1)}
                    onCriar={async (nome) => { await OpcoesColaboradorService.criarPermissao(nome); setTentativaCadastro(v => v + 1); }}
                    onAlterar={async (id, nome) => { await OpcoesColaboradorService.alterarPermissao(id, nome); setTentativaCadastro(v => v + 1); }}
                    onExcluir={async (id) => { await OpcoesColaboradorService.excluirPermissao(id); setTentativaCadastro(v => v + 1); }}
                  />
                )}
                {abaCadastro === "ferramentas" && (
                  <CadastroFerramentas
                    itens={ferramentas}
                    carregando={carregandoCadastro}
                    erro={erroCadastro}
                    onRecarregar={() => setTentativaCadastro(v => v + 1)}
                  />
                )}
              </div>
            )}
          </div>

          {/* SESSÃO DE PRÉ-CARREGAMENTO (FILTROS) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-purple-100/50 text-purple-600 rounded-xl">
                  <Filter className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-slate-800">
                    Pré-carregamento de Filtros
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Defina o que o sistema deve carregar automaticamente ao abrir cada tela
                  </p>
                </div>
              </div>
              <div className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
                {showFilters ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </div>
            </button>

            {showFilters && (
              <div className="p-5 pt-0 border-t border-slate-100 bg-slate-50/30">
                {/* Abas de Seleção */}
                <div className="flex p-1 bg-slate-200/50 rounded-xl border border-slate-200 w-max mb-6 mt-4">
                  <button
                    onClick={() => setActiveFilterTab("agenda")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeFilterTab === "agenda" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <LayoutDashboard className="w-4 h-4" /> Agenda (Entregas)
                  </button>
                  <button
                    onClick={() => setActiveFilterTab("database")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeFilterTab === "database" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <Database className="w-4 h-4" /> Apartamentos
                  </button>
                </div>

                {/* Conteúdo: AGENDA */}
                {activeFilterTab === "agenda" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-da-esquerda">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Obra/Condomínio Padrão</label>
                      <select
                        value={defaultDeliveryCondo}
                        onChange={(e) => setDefaultDeliveryCondo(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
                      >
                        <option value="">Nenhum (Mostrar Todos)</option>
                        {fasesDaObra.map(f => <option key={f.sigla} value={f.sigla}>{f.nome}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Período Padrão</label>
                      <select
                        value={defaultDeliveryTime}
                        onChange={(e) => setDefaultDeliveryTime(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm"
                      >
                        <option value="current">Semana Vigente</option>
                        <option value="next">Próxima Semana</option>
                        <option value="all">Tudo</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Conteúdo: APARTAMENTOS */}
                {activeFilterTab === "database" && (
                  <div className="space-y-6 animate-da-direita">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Obra/Condomínio Padrão</label>
                        <select value={defaultDbCondo} onChange={(e) => setDefaultDbCondo(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none shadow-sm">
                          <option value="">Nenhum (Todos)</option>
                          {fasesDaObra.map(f => <option key={f.sigla} value={f.sigla}>{f.nome}</option>)}
                        </select>
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={defaultDbShowAll} onChange={(e) => setDefaultDbShowAll(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                      Abrir já mostrando os apartamentos "Não liberados" (botão Mostrar Todos)
                    </label>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtros e ordenação carregados automaticamente</label>
                      <PreCarregamentoApartamentosEditor valor={preCarregamento} onChange={setPreCarregamento} statusOpcoes={statusConhecidos} />
                    </div>
                  </div>
                )}
                </div>
              )}
          </div>

          {/* SESSÃO DE HORÁRIOS */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <button onClick={() => setShowTimeSlotsList((prev) => !prev)} className="w-full flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-blue-100/50 text-blue-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-slate-800">Grade de Horários</h3>
                </div>
              </div>
              <div className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
                {showTimeSlotsList ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </div>
            </button>

            {showTimeSlotsList && (
              <div className="p-5 pt-0">
                <textarea value={timeSlotsList} onChange={(e) => setTimeSlotsList(e.target.value)} rows={2} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none resize-none font-mono text-sm" />
              </div>
            )}
          </div>

          {/* SESSÃO DE APARTAMENTOS */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <button onClick={() => setShowApartmentList((prev) => !prev)} className="w-full flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-100/50 text-indigo-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-slate-800">Mapeamento de Unidades</h3>
                </div>
              </div>
              <div className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
                {showApartmentList ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </div>
            </button>

            {showApartmentList && (
              <div className="p-5 pt-0">
                <textarea value={apartmentList} onChange={(e) => setApartmentList(e.target.value)} rows={3} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none resize-none font-mono text-sm" />
              </div>
            )}
          </div>

        </div>

        {/* RODAPÉ */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex-1">
            {message && (
              <span className={`text-sm font-bold px-4 py-2 rounded-lg ${message.includes("sucesso") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {message}
              </span>
            )}
          </div>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 active:scale-95 transition-all">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? "Registrando..." : "Salvar Parâmetros"}
          </button>
        </div>
      </div>
      {acessosAberto && <AcessosModal onFechar={() => setAcessosAberto(false)} />}
      {obrasAberto && <ObrasModal onFechar={() => setObrasAberto(false)} />}
      {equipeAberto && <EquipeModal onFechar={() => setEquipeAberto(false)} />}
    </div>
  );
}
