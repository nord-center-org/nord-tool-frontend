import { useState } from "react";
import { Camera, Images, Loader2 } from "lucide-react";

import type { TermoFotoDto } from "@/shared/types";
import { termoReprovaService } from "@/react-app/services/TermoReprovaService";
import { prepararFoto } from "@/react-app/utils/imagem";
import { calcularNovaOrdem, fotosDaPagina } from "@/react-app/utils/termoRegras";
import FotoCard from "@/react-app/components/termo/FotoCard";
import ConferenciaFoto from "@/react-app/components/termo/ConferenciaFoto";
import LightboxFoto from "@/react-app/components/termo/LightboxFoto";

interface PainelFotosPaginaProps {
  idTermo: number;
  nrPaginas: number;
  fotos: TermoFotoDto[];
  pagina: number;
  /** Recarrega as fotos do termo depois de cada alteração. */
  onAlterado: () => Promise<void>;
}

const botaoPrimario =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700";
const botaoSecundario =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50";

/** Painel "Pendências resolvidas · página X": tirar/anexar foto e gerenciar as fotos da página. */
export default function PainelFotosPagina({ idTermo, nrPaginas, fotos, pagina, onAlterado }: PainelFotosPaginaProps) {
  const daPagina = fotosDaPagina(fotos, pagina);
  const [fila, setFila] = useState<File[]>([]);
  const [ampliada, setAmpliada] = useState<TermoFotoDto | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (acao: () => Promise<unknown>, falha: string) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      await onAlterado();
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : falha);
    } finally {
      setOcupado(false);
    }
  };

  const escolher = (lista: FileList | null) => {
    const arquivos = lista ? Array.from(lista) : [];
    if (arquivos.length > 0) { setErro(null); setFila(arquivos); }
  };

  const mover = (idFoto: number, direcao: "cima" | "baixo") => {
    const ordem = calcularNovaOrdem(fotos, idFoto, direcao);
    if (ordem) void executar(() => termoReprovaService.ordenarFotos(idTermo, ordem), "Não foi possível reordenar as fotos.");
  };

  const substituir = (foto: TermoFotoDto, arquivo: File) =>
    executar(async () => {
      const preparada = await prepararFoto(arquivo);
      await termoReprovaService.editarFoto(foto.idTermoFoto, { imagem: preparada.imagem, miniatura: preparada.miniatura, nome: preparada.nome });
    }, "Não foi possível substituir a imagem.");

  const excluir = (foto: TermoFotoDto) => {
    if (!window.confirm("Excluir esta foto? Esta ação não pode ser desfeita.")) return;
    void executar(() => termoReprovaService.excluirFoto(foto.idTermoFoto), "Não foi possível excluir a foto.");
  };

  return (
    <section className="flex min-h-0 flex-col gap-3" aria-label={`Fotos da página ${pagina}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Pendências resolvidas · página {pagina}</h3>
        <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
          {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" aria-label="Processando" />}
          {daPagina.length === 0 ? "sem foto" : daPagina.length === 1 ? "1 foto" : `${daPagina.length} fotos`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className={botaoPrimario}>
          <Camera className="h-4 w-4" /> Tirar foto
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={ocupado || fila.length > 0}
            onChange={e => { escolher(e.target.files); e.target.value = ""; }} />
        </label>
        <label className={botaoSecundario}>
          <Images className="h-4 w-4" /> Anexar foto
          <input type="file" accept="image/*" multiple className="hidden" disabled={ocupado || fila.length > 0}
            onChange={e => { escolher(e.target.files); e.target.value = ""; }} />
        </label>
      </div>

      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {daPagina.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Nenhuma foto vinculada a esta página.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {daPagina.map((foto, i) => (
            <FotoCard
              key={foto.idTermoFoto}
              foto={foto}
              totalPaginas={nrPaginas}
              podeSubir={i > 0}
              podeDescer={i < daPagina.length - 1}
              desabilitado={ocupado}
              onAmpliar={() => setAmpliada(foto)}
              onSalvarLegenda={legenda => void executar(() => termoReprovaService.editarFoto(foto.idTermoFoto, { legenda }), "Não foi possível salvar a legenda.")}
              onSubstituirImagem={arquivo => void substituir(foto, arquivo)}
              onMoverPagina={nova => void executar(() => termoReprovaService.editarFoto(foto.idTermoFoto, { nrPagina: nova }), "Não foi possível mover a foto.")}
              onMover={direcao => mover(foto.idTermoFoto, direcao)}
              onExcluir={() => excluir(foto)}
            />
          ))}
        </ul>
      )}

      {fila.length > 0 && (
        <ConferenciaFoto
          arquivos={fila}
          idTermo={idTermo}
          pagina={pagina}
          onFotoEnviada={() => void onAlterado()}
          onFechar={() => setFila([])}
        />
      )}
      {ampliada && <LightboxFoto foto={ampliada} onFechar={() => setAmpliada(null)} />}
    </section>
  );
}
