import { useState } from "react";
import { AlertCircle, Check, Download, Heart, LayoutDashboard, Loader2, Store, Users, Flag, X, type LucideIcon } from "lucide-react";
import * as XLSX from "xlsx";

import MarcosTab from "@/react-app/components/casamento/MarcosTab";
import ConvidadosTab from "@/react-app/components/casamento/ConvidadosTab";
import FornecedoresTab from "@/react-app/components/casamento/FornecedoresTab";
import CasamentoDashboard from "@/react-app/components/casamento/CasamentoDashboard";
import { useSincronizacao } from "@/react-app/hooks/useSincronizacao";
import { casamentoService } from "@/react-app/services/CasamentoService";
import { abasExportacao } from "@/react-app/utils/exportarCasamento";

type AbaCasamento = "dashboard" | "fornecedores" | "convidados" | "marcos";

const ABAS: { id: AbaCasamento; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "fornecedores", label: "Fornecedores", icon: Store },
  { id: "convidados", label: "Convidados", icon: Users },
  { id: "marcos", label: "Marcos", icon: Flag },
];

/** Módulo Casamento (Gestão Individual). */
export default function CasamentoPage() {
  const [aba, setAba] = useState<AbaCasamento>("dashboard");
  const sync = useSincronizacao();
  const [exportando, setExportando] = useState(false);
  const [erroExportacao, setErroExportacao] = useState<string | null>(null);

  /** Backup em planilha: baixa fornecedores, convidados, marcos e configuração e gera um .xlsx. */
  const exportarTudo = async () => {
    setExportando(true);
    setErroExportacao(null);
    try {
      const [configuracao, fornecedores, convidados, marcos] = await Promise.all([
        casamentoService.buscarConfiguracao(),
        casamentoService.listarFornecedores(),
        casamentoService.listarConvidados(),
        casamentoService.listarMarcos(),
      ]);
      const livro = XLSX.utils.book_new();
      for (const aba of abasExportacao({ configuracao: configuracao ?? { casal: null, dataCasamento: null }, fornecedores, convidados, marcos })) {
        XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(aba.linhas), aba.nome);
      }
      XLSX.writeFile(livro, "NordTool_Casamento.xlsx");
    } catch (e) {
      setErroExportacao(e instanceof Error && e.message ? e.message : "Não foi possível exportar.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <header className="mx-auto mb-4 max-w-7xl rounded-2xl bg-slate-900 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-blue-400">
            <Heart className="h-6 w-6" /> Casamento
          </h1>
          <nav role="tablist" aria-label="Seções do casamento" className="flex flex-wrap gap-2">
            {ABAS.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={aba === item.id}
                onClick={() => setAba(item.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  aba === item.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <item.icon size={16} /> {item.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void exportarTudo()}
            disabled={exportando}
            title="Baixa uma planilha com fornecedores, convidados e marcos"
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar tudo
          </button>
        </div>
      </header>

      {erroExportacao && (
        <p role="alert" className="mx-auto mb-4 max-w-7xl rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{erroExportacao}</p>
      )}

      <div className="mx-auto mb-4 flex max-w-7xl justify-end px-1" role="status" aria-live="polite">
        {sync.estado === "salvando" && (
          <span className="flex items-center gap-2 text-xs font-medium text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" /> Salvando…</span>
        )}
        {sync.estado === "ocioso" && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400"><Check className="h-3.5 w-3.5" /> Tudo salvo</span>
        )}
        {sync.estado === "erro" && (
          <span role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {sync.erro}
            <button type="button" onClick={sync.limparErro} aria-label="Dispensar erro" className="rounded p-0.5 hover:bg-red-100"><X className="h-3.5 w-3.5" /></button>
          </span>
        )}
      </div>

      <main role="tabpanel" className="mx-auto max-w-7xl space-y-8">
        {aba === "dashboard" && <CasamentoDashboard sync={sync} />}
        {aba === "fornecedores" && <FornecedoresTab sync={sync} />}
        {aba === "convidados" && <ConvidadosTab sync={sync} />}
        {aba === "marcos" && <MarcosTab sync={sync} />}
      </main>
    </div>
  );
}
