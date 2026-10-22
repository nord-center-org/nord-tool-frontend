import type { ComponentType, ReactNode } from "react";

interface CabecalhoPaginaProps {
  icone: ComponentType<{ className?: string }>;
  titulo: string;
  subtitulo?: string;
  /** Botões à direita (no celular descem para baixo do título). */
  acoes?: ReactNode;
}

/** Cabeçalho padrão das telas: ícone, título, subtítulo e ações (ver docs/PADRAO_VISUAL.md). */
export default function CabecalhoPagina({ icone: Icone, titulo, subtitulo, acoes }: CabecalhoPaginaProps) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
      <div className="flex min-w-0 items-center gap-4">
        <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5">
          <Icone className="h-6 w-6 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">{titulo}</h2>
          {subtitulo && <p className="mt-1 text-sm font-medium text-slate-500">{subtitulo}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </header>
  );
}
