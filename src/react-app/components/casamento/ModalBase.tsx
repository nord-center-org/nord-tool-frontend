import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalBaseProps {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  /** Classe de largura máxima (padrão: max-w-md). */
  largura?: string;
}

/** Janela modal do módulo Casamento: fecha com Esc, clique fora ou no X. */
export default function ModalBase({ titulo, onFechar, children, largura = "max-w-md" }: ModalBaseProps) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`w-full ${largura} max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
