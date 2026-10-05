import { useEffect } from "react";
import { X } from "lucide-react";

import type { TermoFotoDto } from "@/shared/types";
import ImagemAutenticada from "@/react-app/components/ImagemAutenticada";
import { termoReprovaService } from "@/react-app/services/TermoReprovaService";

interface LightboxFotoProps {
  foto: TermoFotoDto;
  onFechar: () => void;
}

/** Foto ampliada (imagem original reduzida de 1280 px), fecha com Esc, clique fora ou no X. */
export default function LightboxFoto({ foto, onFechar }: LightboxFotoProps) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      onClick={onFechar}
    >
      <button type="button" aria-label="Fechar foto ampliada" onClick={onFechar} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      <div onClick={e => e.stopPropagation()}>
        <ImagemAutenticada
          chave={`foto:${foto.idTermoFoto}:imagem:${foto.nrVersao}`}
          carregar={() => termoReprovaService.baixarImagem(foto.idTermoFoto, foto.nrVersao)}
          alt={foto.txLegenda || "Foto da correção"}
          className="max-h-[80vh] max-w-full rounded-lg bg-slate-900 object-contain"
        />
      </div>
      {foto.txLegenda && <p className="max-w-2xl text-center text-sm text-white/90">{foto.txLegenda}</p>}
    </div>
  );
}
