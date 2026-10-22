import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router";
import ErrorBoundary from "@/react-app/components/ErrorBoundary";
import { ExigeModuloDaRota } from "@/react-app/components/RotaProtegida";
import { useAuth } from "@/react-app/hooks/useAuth";
import { useObra } from "@/react-app/hooks/useObra";
import { podeAbrirRota } from "@/react-app/utils/sessao";
import { alternarGrupo, grupoDaRota, iniciais, lerGruposAbertos, salvarGruposAbertos } from "@/react-app/utils/menuLateral";
import { 
  Database, BarChart3, Package, Settings, Menu, ChevronLeft, 
  Home as HomeIcon, Briefcase, GraduationCap,
  ClipboardCheck, AlertTriangle, Camera, FileText, BookOpen, 
  TrendingUp, GitMerge, FileCheck, CalendarDays, Wallet, Dumbbell, Music, Book, Key, Cat, Heart, PiggyBank,
  Ruler, ChevronDown
} from "lucide-react";

const armazenamento = () => (typeof window === "undefined" ? undefined : window.localStorage);

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { usuario } = useAuth();
  const { obras, idObra, obra, trocarObra } = useObra();

  const menuGroups = [
    {
      title: "Visão Geral",
      items: [
        { path: "/", label: "Início", icon: HomeIcon },
      ]
    },
    {
      title: "Entrega",
      items: [
        { path: "/entregas", label: "Agenda", icon: Package },
        { path: "/apartamentos", label: "Apartamentos", icon: Database },
        { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
      ]
    },
    {
      title: "Mapeamentos",
      items: [
        { path: "/mapeamentos/conferencias", label: "Conferências", icon: ClipboardCheck },
        { path: "/mapeamentos/pendencias", label: "Mapeamento de pendências", icon: AlertTriangle },
        { path: "/mapeamentos/relatorio-fotografico", label: "Relatório fotográfico", icon: Camera },
      ]
    },
    {
      title: "Organizacional",
      items: [
        { path: "/organizacional/rte", label: "RTE", icon: FileText },
        { path: "/organizacional/diario-obras", label: "Diário de obras", icon: BookOpen },
        { path: "/organizacional/escadinha", label: "Escadinha", icon: TrendingUp },
        { path: "/organizacional/fluxograma", label: "Fluxo de atividades", icon: GitMerge },
        { path: "/organizacional/controle-chaves", label: "Controle de chaves", icon: Key },
        { path: "/treinamentos", label: "Controle de treinamentos", icon: GraduationCap },
        { path: "/organizacional/fvs", label: "Controle de FVs", icon: FileCheck },
        { path: "/organizacional/projetos", label: "Controle de projetos", icon: Briefcase },
        { path: "/organizacional/cronograma", label: "Cronograma semanal", icon: CalendarDays },
        { path: "/organizacional/medicoes", label: "Medições", icon: Ruler },
      ]
    },
    {
      title: "Gestão Individual",
      items: [
        { path: "/gestao/financeiro", label: "Gestão financeira", icon: Wallet },
        { path: "/gestao/treinos", label: "Organograma de treinos", icon: Dumbbell },
        { path: "/gestao/repertorio", label: "Repertório", icon: Music },
        { path: "/gestao/academico", label: "Desenvolvimento acadêmico", icon: Book },
        { path: "/gestao/casamento", label: "Casamento", icon: Heart },
        { path: "/gestao/caixinha", label: "Caixinha", icon: PiggyBank },
        { path: "/gestao/davi-job", label: "Davi Job", icon: Cat },
      ]
    },
  ];

  const gruposVisiveis = menuGroups
    .map(group => ({ ...group, items: group.items.filter(item => podeAbrirRota(usuario?.permissoes, item.path)) }))
    .filter(group => group.items.length > 0);
  const grupoAtual = grupoDaRota(gruposVisiveis, location.pathname);

  // Grupos começam recolhidos; o menu lembra o que cada pessoa deixou aberto.
  const [abertos, setAbertos] = useState<string[]>([]);
  useEffect(() => {
    if (usuario) setAbertos(lerGruposAbertos(armazenamento(), usuario.id));
  }, [usuario]);
  // Ao entrar numa tela, o grupo dela abre (e pode ser fechado depois).
  useEffect(() => {
    if (!grupoAtual || !usuario) return;
    setAbertos(atual => {
      if (atual.includes(grupoAtual)) return atual;
      const novo = [...atual, grupoAtual];
      salvarGruposAbertos(armazenamento(), usuario.id, novo);
      return novo;
    });
  }, [grupoAtual, usuario]);
  const alternar = (titulo: string) => setAbertos(atual => {
    const novo = alternarGrupo(atual, titulo);
    if (usuario) salvarGruposAbertos(armazenamento(), usuario.id, novo);
    return novo;
  });

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative font-sans">
      
      {/* No celular o menu fica por cima da tela, com fundo escuro que fecha ao tocar. */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 animate-aparecer md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}
      <aside
        className={`bg-white border-r border-slate-200 shadow-2xl transition-all duration-300 ease-in-out flex flex-col overflow-hidden z-50 fixed inset-y-0 left-0 md:static ${
          sidebarOpen ? "w-[85vw] max-w-80 md:w-80 opacity-100" : "w-0 opacity-0 border-none"
        }`}
      >
        <div className="w-[85vw] max-w-80 md:w-80 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-10">
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                <span className="text-slate-800">Nord</span>
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Tool</span>
              </h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {usuario && (
            <div className="border-b border-slate-100 px-6 py-4" aria-label="Usuário e obra">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-black text-white" aria-hidden="true">
                  {iniciais(usuario.nome)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{usuario.nome}</p>
                  {obras.length > 1 ? (
                    <select aria-label="Obra" value={idObra ?? ""} onChange={e => trocarObra(Number(e.target.value))}
                      className="mt-0.5 w-full max-w-[12rem] truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nmObra}</option>)}
                    </select>
                  ) : (
                    <p className="truncate text-xs font-semibold text-blue-600">{obra?.nmObra ?? "Sem obra definida"}</p>
                  )}
                </div>
              </div>
              {obra && obra.fases.length > 0 && (
                <p className="mt-2 truncate text-[11px] text-slate-400" title={obra.fases.map(f => f.nmFase).join(", ")}>
                  Fases: {obra.fases.map(f => f.cdFase ?? f.nmFase).join(" · ")}
                </p>
              )}
            </div>
          )}

          <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4 no-scrollbar" aria-label="Módulos">
            {gruposVisiveis.map(group => {
              // A Visão Geral (só Início) fica sempre à mostra.
              const fixo = group.items.length === 1 && group.items[0].path === "/";
              const aberto = fixo || abertos.includes(group.title);
              const idLista = `menu-${group.title.replace(/\s+/g, "-").toLowerCase()}`;
              return (
                <div key={group.title}>
                  {!fixo && (
                    <button type="button" onClick={() => alternar(group.title)} aria-expanded={aberto} aria-controls={idLista}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600">
                      <span>{group.title}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                  )}
                  {aberto && (
                    <div id={idLista} className="space-y-1 pb-2 pt-1 animate-entrada">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          end={item.path === "/"}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm active:scale-[0.98] ${
                              isActive
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold"
                                : "text-slate-600 hover:bg-slate-50 hover:text-blue-600 font-medium"
                            }`
                          }
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* No rodapé só Configurações; conta, senha e sair ficam lá dentro. */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <NavLink
              to="/configuracoes"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-sm ${
                  isActive
                    ? "bg-slate-800 text-white shadow-md font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`
              }
            >
              <Settings className="w-4 h-4" />
              <span>Configurações</span>
            </NavLink>
          </div>

        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {!sidebarOpen && (
          <div className="absolute left-3 top-3 z-30 flex items-center gap-4 md:left-6 md:top-6">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
              className="p-3 bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl shadow-sm hover:bg-white transition-all group"
            >
              <Menu className="w-5 h-5 text-slate-700 group-hover:text-blue-600 transition-colors" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto h-full">
          <div className={`transition-all duration-300 h-full px-3 pb-6 pt-16 sm:px-4 ${!sidebarOpen ? "md:pl-20 md:pr-6 md:pt-6" : "md:p-8"}`}>
            <ErrorBoundary resetKey={location.pathname}>
              <ExigeModuloDaRota>
                {/* Trocar de obra recarrega a tela com os dados da nova obra. */}
                {/* Cada tela entra com o mesmo movimento curto. */}
                <div key={`${idObra ?? "sem-obra"}:${location.pathname}`} className="h-full animate-entrada">
                  <Outlet context={{ sidebarOpen }} />
                </div>
              </ExigeModuloDaRota>
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}