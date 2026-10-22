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
import LoginPage from "@/react-app/pages/Login";
import AlterarSenhaPage from "@/react-app/pages/AlterarSenha";
import RotaProtegida from "@/react-app/components/RotaProtegida";
import AuthProvider from "@/react-app/components/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <Router>
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
  
            {/* Mapeamentos */}
            <Route path="mapeamentos/conferencias" element={<MapeamentosPage />} />
            <Route path="mapeamentos/pendencias" element={<ConcretagemInProgress />} />
            <Route path="mapeamentos/relatorio-fotografico" element={<RelatorioFotograficoPage />} />
  
            {/* Organizacional */}
            <Route path="organizacional/rte" element={<ConcretagemInProgress />} />
            <Route path="organizacional/diario-obras" element={<ConcretagemInProgress />} />
            <Route path="organizacional/escadinha" element={<ConcretagemInProgress />} />
            <Route path="organizacional/fluxograma" element={<ConcretagemInProgress />} />
            <Route path="organizacional/controle-chaves" element={<ControleChavesPage />} />
            <Route path="treinamentos" element={<ConcretagemInProgress />} />
            <Route path="organizacional/fvs" element={<ConcretagemInProgress />} />
            <Route path="organizacional/projetos" element={<ConcretagemInProgress />} />
            <Route path="organizacional/cronograma" element={<CronogramaPage />} />
  
            {/* Gestão Individual */}
            <Route path="gestao/financeiro" element={<FinanceiroPage />} />
            <Route path="gestao/treinos" element={<TreinosPage />} />
            <Route path="gestao/repertorio" element={<ConcretagemInProgress />} />
            <Route path="gestao/academico" element={<ConcretagemInProgress />} />
            <Route path="gestao/casamento" element={<CasamentoPage />} />
            <Route path="gestao/caixinha" element={<CaixinhaPage />} />
            <Route path="organizacional/medicoes" element={<MedicoesPage />} />
            <Route path="gestao/davi-job" element={<DaviJobPage />} />
          </Route>
          {/* URL inexistente: volta ao início (que leva ao login quando não há sessão) em vez de tela em branco */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}