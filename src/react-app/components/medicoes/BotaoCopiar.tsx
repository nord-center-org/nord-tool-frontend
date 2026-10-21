import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copia o texto para a área de transferência (com plano B para navegadores sem a API moderna). */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(area);
    }
  }
}

interface BotaoCopiarProps {
  texto: string;
  rotulo: string;
}

export default function BotaoCopiar({ texto, rotulo }: BotaoCopiarProps) {
  const [estado, setEstado] = useState<"ocioso" | "copiado" | "falhou">("ocioso");
  const temporizador = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const aoClicar = async () => {
    setEstado((await copiar(texto)) ? "copiado" : "falhou");
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setEstado("ocioso"), 1800);
  };

  return (
    <button
      type="button"
      onClick={() => void aoClicar()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
    >
      {estado === "copiado" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {estado === "copiado" ? "Copiado!" : estado === "falhou" ? "Não foi possível copiar" : rotulo}
    </button>
  );
}
