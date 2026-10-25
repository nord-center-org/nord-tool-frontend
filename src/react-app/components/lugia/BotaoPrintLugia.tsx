import { Crop } from "lucide-react";
import { useLocation } from "react-router";

import { useAuth } from "@/react-app/hooks/useAuth";
import { useCapturaLugia } from "@/react-app/hooks/useCapturaLugia";
import { podeAcessar } from "@/react-app/utils/sessao";

/** Botão no topo de qualquer tela: marca uma área e manda o print para o chat da Lugia. */
export default function BotaoPrintLugia({ className = "" }: { className?: string }) {
  const { usuario } = useAuth();
  const { estado, iniciar } = useCapturaLugia();
  const location = useLocation();
  if (!podeAcessar(usuario?.permissoes, "LUGIA") || location.pathname === "/lugia" || estado !== "inativo") return null;
  return (
    <button type="button" onClick={() => iniciar("agora")} data-sem-print
      aria-label="Print para a Lugia" title="Marcar uma área desta tela e mandar para a Lugia"
      className={`group flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/60 text-slate-600 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-blue-600 active:scale-95 ${className}`}>
      <Crop className="h-5 w-5" />
    </button>
  );
}
