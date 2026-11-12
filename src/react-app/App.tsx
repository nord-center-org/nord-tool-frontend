import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import Layout from "@/react-app/components/Layout";
import HomePage from "@/react-app/pages/Home";
import ApartamentosPage from "@/react-app/pages/Apartamentos";
import DashboardPage from "@/react-app/pages/Dashboard";
import DeliveriesPage from "@/react-app/pages/Deliveries";
import SettingsPage from "@/react-app/pages/Settings";
import CronogramaPage from "@/react-app/pages/Cronograma_semanal";
import ControleChavesPage from "@/react-app/pages/Controle_de_chaves";
import DaviJobPage from "@/react-app/pages/DaviJob";
import CasamentoPage from "@/react-app/pages/Casamento";
import CaixinhaPage from "@/react-app/pages/Caixinha";
import MedicoesPage from "@/react-app/pages/Medicoes";
import { ObraProvider } from "@/react-app/hooks/useObra";
import CadastroPage from "@/react-app/pages/Cadastro";
import EsqueciSenhaPage from "@/react-app/pages/EsqueciSenha";
import RedefinirSenhaPage from "@/react-app/pages/RedefinirSenha";
import FinanceiroPage from "@/react-app/pages/Financeiro";
import ConcretagemInProgress from "@/react-app/components/Placeholder";
import RelatorioFotograficoPage from "@/react-app/pages/RelatorioFotografico";
import MapeamentosPage from "@/react-app/pages/Mapeamentos";
import TreinosPage from "@/react-app/pages/Treinos";
import LugiaPage from "@/react-app/pages/Lugia";
import LoginPage from "@/react-app/pages/Login";
import AlterarSenhaPage from "@/react-app/pages/AlterarSenha";
import AlterarEmailPage from "@/react-app/pages/AlterarEmail";
import MeusDadosPage from "@/react-app/pages/MeusDados";
import MeuAvatarPage from "@/react-app/pages/MeuAvatar";
import RotaProtegida from "@/react-app/components/RotaProtegida";
import AuthProvider from "@/react-app/components/AuthProvider";
import TemaProvider from "@/react-app/components/tema/TemaProvider";

/** Escadinha 3D carrega three.js: fica num pedaço separado, baixado só quando a tela abre. */
const Escadinha = lazy(() => import("@/react-app/pages/Escadinha"));
const Sac = lazy(() => import("@/react-app/pages/Sac"));
const Placas = lazy(() => import("@/react-app/pages/Placas"));
const BlocoNotas = lazy(() => import("@/react-app/pages/BlocoNotas"));
const Cubicagem = lazy(() => import("@/react-app/pages/Cubicagem"));
const Repertorio = lazy(() => import("@/react-app/pages/Repertorio"));

function CarregandoTela() {
  return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Carregando" /></div>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <TemaProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
          <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
          <Route path="/" element={<RotaProtegida><ObraProvider><Layout /></ObraProvider></RotaProtegida>}>
            <Route index element={<HomePage />} />
            <Route path="entregas" element={<DeliveriesPage />} />
            <Route path="apartamentos" element={<ApartamentosPage />} />
            <Route path="database" element={<Navigate to="/apartamentos" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="conta/senha" element={<AlterarSenhaPage />} />
            <Route path="conta/email" element={<AlterarEmailPage />} />
            <Route path="conta/dados" element={<MeusDadosPage />} />
            <Route path="conta/avatar" element={<MeuAvatarPage />} />
            <Route path="lugia" element={<LugiaPage />} />
            <Route path="sac" element={<Suspense fallback={<CarregandoTela />}><Sac /></Suspense>} />
  
            {/* Mapeamentos */}
            <Route path="mapeamentos/conferencias" element={<MapeamentosPage />} />
            <Route path="mapeamentos/pendencias" element={<ConcretagemInProgress />} />
            <Route path="mapeamentos/relatorio-fotografico" element={<RelatorioFotograficoPage />} />
            <Route path="mapeamentos/placas" element={<Suspense fallback={<CarregandoTela />}><Placas /></Suspense>} />
            <Route path="mapeamentos/cubicagem" element={<Suspense fallback={<CarregandoTela />}><Cubicagem /></Suspense>} />
            <Route path="mapeamentos/bloco-notas" element={<Suspense fallback={<CarregandoTela />}><BlocoNotas /></Suspense>} />
  
            {/* Organizacional */}
            <Route path="organizacional/rte" element={<ConcretagemInProgress />} />
            <Route path="organizacional/diario-obras" element={<ConcretagemInProgress />} />
            <Route path="organizacional/escadinha" element={<Suspense fallback={<CarregandoTela />}><Escadinha /></Suspense>} />
            <Route path="organizacional/fluxograma" element={<ConcretagemInProgress />} />
            <Route path="organizacional/controle-chaves" element={<ControleChavesPage />} />
            <Route path="treinamentos" element={<ConcretagemInProgress />} />
            <Route path="organizacional/fvs" element={<ConcretagemInProgress />} />
            <Route path="organizacional/projetos" element={<ConcretagemInProgress />} />
            <Route path="organizacional/cronograma" element={<CronogramaPage />} />
  
            {/* Gestão Individual */}
            <Route path="gestao/financeiro" element={<FinanceiroPage />} />
            <Route path="gestao/treinos" element={<TreinosPage />} />
            <Route path="gestao/repertorio" element={<Suspense fallback={<CarregandoTela />}><Repertorio /></Suspense>} />
            <Route path="gestao/academico" element={<ConcretagemInProgress />} />
            <Route path="gestao/casamento" element={<CasamentoPage />} />
            <Route path="gestao/caixinha" element={<CaixinhaPage />} />
            <Route path="organizacional/medicoes" element={<MedicoesPage />} />
            <Route path="gestao/davi-job" element={<DaviJobPage />} />
          </Route>
          {/* URL inexistente: volta ao início (que leva ao login quando não há sessão) em vez de tela em branco */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </TemaProvider>
      </Router>
    </AuthProvider>
  );
}