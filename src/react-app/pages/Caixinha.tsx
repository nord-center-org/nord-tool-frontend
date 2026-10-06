import { PiggyBank } from "lucide-react";

/** Módulo Caixinha (Gestão Individual): controle de despesas. A tela completa chega nas próximas etapas. */
export default function CaixinhaPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <header className="mx-auto mb-6 max-w-7xl rounded-2xl bg-slate-900 text-white shadow-xl">
        <div className="flex items-center gap-3 px-6 py-4">
          <PiggyBank className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-blue-400">Caixinha</h1>
            <p className="text-sm text-slate-400">Controle de despesas</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-bold text-slate-700">Em construção</h2>
          <p className="mt-1 text-sm text-slate-400">Os lançamentos e comprovantes serão liberados nas próximas etapas.</p>
        </div>
      </main>
    </div>
  );
}
