import type { TermoFotoDto } from "@/shared/types";
import ImagemAutenticada from "@/react-app/components/ImagemAutenticada";
import { termoReprovaService } from "@/react-app/services/TermoReprovaService";
import { fotosDaPagina } from "@/react-app/utils/termoRegras";

interface PainelFotosPaginaProps {
  fotos: TermoFotoDto[];
  pagina: number;
}

/**
 * Painel "Pendências resolvidas · página X". Nesta etapa só lista as fotos já vinculadas;
 * tirar/anexar/editar/excluir entram na etapa de fotos (E10).
 */
export default function PainelFotosPagina({ fotos, pagina }: PainelFotosPaginaProps) {
  const daPagina = fotosDaPagina(fotos, pagina);

  return (
    <section className="flex min-h-0 flex-col gap-3" aria-label={`Fotos da página ${pagina}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Pendências resolvidas · página {pagina}</h3>
        <span className="text-xs font-medium text-slate-400">
          {daPagina.length === 0 ? "sem foto" : daPagina.length === 1 ? "1 foto" : `${daPagina.length} fotos`}
        </span>
      </div>

      {daPagina.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Nenhuma foto vinculada a esta página.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {daPagina.map(foto => (
            <li key={foto.idTermoFoto} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <ImagemAutenticada
                chave={`foto:${foto.idTermoFoto}:miniatura:${foto.nrVersao}`}
                carregar={() => termoReprovaService.baixarMiniatura(foto.idTermoFoto, foto.nrVersao)}
                alt={foto.txLegenda || `Correção da página ${pagina}`}
                className="block h-auto max-h-80 w-full object-contain"
              />
              {foto.txLegenda && <p className="border-t border-slate-100 px-3 py-2 text-sm text-slate-600">{foto.txLegenda}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
