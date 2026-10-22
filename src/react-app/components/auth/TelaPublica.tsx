import type { ReactNode } from "react";

/** Moldura das telas públicas (login, criar conta, esqueci a senha). */
export default function TelaPublica({ subtitulo, children }: { subtitulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4 sm:p-6 font-sans">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-slate-800">Nord</span>
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Tool</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">{subtitulo}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export const classeCampoPublico = "mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
export const classeRotuloPublico = "text-xs font-bold text-slate-500 uppercase tracking-wider";
export const classeBotaoPublico = "w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-bold py-3 text-sm shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
