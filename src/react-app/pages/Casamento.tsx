import { useState } from "react";
import { Heart, LayoutDashboard, Store, Users, Flag, type LucideIcon } from "lucide-react";

type AbaCasamento = "dashboard" | "fornecedores" | "convidados" | "marcos";

const ABAS: { id: AbaCasamento; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "fornecedores", label: "Fornecedores", icon: Store },
  { id: "convidados", label: "Convidados", icon: Users },
  { id: "marcos", label: "Marcos", icon: Flag },
];

function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <h3 className="text-lg font-bold text-slate-700">{titulo}</h3>
      <p className="mt-1 text-sm text-slate-400">Esta aba será liberada nas próximas etapas.</p>
    </div>
  );
}

/** Casca do módulo Casamento (Gestão Individual). O conteúdo de cada aba entra nas etapas E15–E18. */
export default function CasamentoPage() {
  const [aba, setAba] = useState<AbaCasamento>("dashboard");

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <header className="mx-auto mb-8 max-w-7xl rounded-2xl bg-slate-900 text-white shadow-xl">
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
        </div>
      </header>

      <main role="tabpanel" className="mx-auto max-w-7xl space-y-8">
        {aba === "dashboard" && <EmConstrucao titulo="Dashboard do casamento" />}
        {aba === "fornecedores" && <EmConstrucao titulo="Fornecedores" />}
        {aba === "convidados" && <EmConstrucao titulo="Convidados" />}
        {aba === "marcos" && <EmConstrucao titulo="Marcos" />}
      </main>
    </div>
  );
}
