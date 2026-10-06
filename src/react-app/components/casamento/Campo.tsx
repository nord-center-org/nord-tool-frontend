import type { ReactNode } from "react";

interface CampoProps {
  rotulo: string;
  children: ReactNode;
  dica?: string;
}

/** Rótulo + controle de formulário no padrão NordTool. */
export default function Campo({ rotulo, children, dica }: CampoProps) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{rotulo}</span>
      <div className="mt-1">{children}</div>
      {dica && <span className="mt-1 block text-xs text-slate-400">{dica}</span>}
    </label>
  );
}

export const classeInput =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60";
