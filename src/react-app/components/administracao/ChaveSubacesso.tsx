import { CornerDownRight } from "lucide-react";

import { MODULOS, nomeModulo } from "@/react-app/utils/acessos";

interface ChaveSubacessoProps {
  codigo: string;
  liberado: boolean;
  onMudar: (liberado: boolean) => void;
  /** O módulo pai não chega no nível mínimo: o subacesso não vale. */
  desativado?: boolean;
  motivo?: string;
  personalizado?: boolean;
  dica?: string;
}

/** Linha de subacesso dentro de um módulo: "Pode" (herda o nível do módulo) ou "Não pode". */
export default function ChaveSubacesso({ codigo, liberado, onMudar, desativado = false, motivo, personalizado = false, dica }: ChaveSubacessoProps) {
  const nome = nomeModulo(codigo);
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${desativado ? "opacity-50" : ""}`}>
      <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-xs font-semibold text-slate-600">
          {nome}
          {personalizado && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">personalizado</span>}
        </p>
        <p className="text-[11px] text-slate-400">{desativado && motivo ? motivo : dica ?? MODULOS[codigo]?.telas}</p>
      </div>
      <div role="radiogroup" aria-label={nome} className="flex rounded-lg bg-slate-100 p-0.5">
        {[true, false].map(v => (
          <button key={String(v)} type="button" role="radio" aria-checked={liberado === v} disabled={desativado} onClick={() => onMudar(v)}
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${liberado === v ? (v ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-red-600 shadow-sm") : "text-slate-500"}`}>
            {v ? "Pode" : "Não pode"}
          </button>
        ))}
      </div>
    </li>
  );
}
