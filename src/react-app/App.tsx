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
import ConcretagemInProgress from "@/react-app/components/Placeholder";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="entregas" element={<DeliveriesPage />} />
          <Route path="apartamentos" element={<ApartamentosPage />} />
          <Route path="database" element={<Navigate to="/apartamentos" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />

          {/* Mapeamentos */}
          <Route path="mapeamentos/conferencias" element={<ConcretagemInProgress />} />
          <Route path="mapeamentos/pendencias" element={<ConcretagemInProgress />} />
          <Route path="mapeamentos/relatorio-fotografico" element={<ConcretagemInProgress />} />

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
          <Route path="gestao/financeiro" element={<ConcretagemInProgress />} />
          <Route path="gestao/treinos" element={<ConcretagemInProgress />} />
          <Route path="gestao/repertorio" element={<ConcretagemInProgress />} />
          <Route path="gestao/academico" element={<ConcretagemInProgress />} />
          <Route path="gestao/casamento" element={<CasamentoPage />} />
          <Route path="gestao/davi-job" element={<DaviJobPage />} />
        </Route>
      </Routes>
    </Router>
  );
}