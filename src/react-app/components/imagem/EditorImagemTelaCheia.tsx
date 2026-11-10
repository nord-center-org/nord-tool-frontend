import { Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

const EditorImagem = lazy(() => import("@/react-app/components/imagem/EditorImagem"));

/**
 * O editor de imagens por cima de qualquer tela (relatório fotográfico, placas…): abre a imagem de lá e devolve a
 * editada pelo onSalvar. Carregado só quando abre.
 */
export default function EditorImagemTelaCheia(props: {
  carregar: () => Promise<Blob>; titulo: string; formatoSalvar?: "png" | "jpg";
  onSalvar: (imagem: Blob) => Promise<string | null>; onFechar: () => void;
}) {
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Editar imagem: ${props.titulo}`} className="fixed inset-0 z-[90] overflow-hidden bg-slate-50 p-2 pt-3 sm:p-4">
      <Suspense fallback={<p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo o editor…</p>}>
        <EditorImagem {...props} telaCheia />
      </Suspense>
    </div>,
    document.body,
  );
}
