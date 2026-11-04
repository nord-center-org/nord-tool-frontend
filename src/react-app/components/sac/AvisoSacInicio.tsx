import { useNavigate } from "react-router";
import { LifeBuoy } from "lucide-react";

import AvatarDoAdm from "./AvatarDoAdm";
import { useNovidadesSac } from "@/react-app/hooks/useNovidadesSac";
import { rotuloStatus } from "@/react-app/utils/sac";

/**
 * No Início, o administrador que respondeu fica no canteiro avisando ("respondi seu chamado") até a pessoa abrir
 * o chamado. Com mais de uma novidade, mostra a mais recente e quantas faltam.
 */
export default function AvisoSacInicio() {
  const { chamados } = useNovidadesSac();
  const navigate = useNavigate();
  const c = chamados[0];
  if (!c) return null;
  const primeiro = (c.nmUsuarioResposta ?? "O administrador").split(" ")[0];
  return (
    <div className="absolute bottom-3 right-3 z-20 flex max-w-[92%] items-end gap-2 sm:bottom-5 sm:right-5 animate-surgir" data-sem-print>
      <button type="button" onClick={() => navigate(`/sac?chamado=${c.id}`)}
        className="relative mb-4 max-w-[10.5rem] rounded-2xl rounded-br-sm bg-white/95 px-2.5 py-2 text-left sm:mb-6 sm:max-w-xs sm:px-3.5 sm:py-2.5 shadow-lg ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-blue-300 sm:max-w-xs">
        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600"><LifeBuoy className="h-3 w-3" /> SAC</p>
        <p className="text-xs font-bold leading-snug text-slate-800 sm:text-sm">{primeiro} respondeu seu chamado!</p>
        <p className="truncate text-xs text-slate-500">“{c.nmTitulo}” · {rotuloStatus(c.cdStatus)}</p>
        <p className="mt-1 text-xs font-bold text-blue-600">Ver chamado{chamados.length > 1 ? ` · +${chamados.length - 1}` : ""} →</p>
      </button>
      <div className="shrink-0 drop-shadow-lg"><AvatarDoAdm c={c} tamanho={76} animado className="h-12 w-12 sm:h-[76px] sm:w-[76px]" /></div>
    </div>
  );
}
