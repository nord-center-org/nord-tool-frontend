import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, Share2, X } from "lucide-react";

import type { TermoReprovaDto } from "@/shared/types";
import { termoReprovaService } from "@/react-app/services/TermoReprovaService";
import { nomeArquivoSeguro } from "@/react-app/utils/apartamentoNome";
import { cacheBlobs } from "@/react-app/utils/blobCache";
import { gerarPdfLadoALado, type FotoParaPdf } from "@/react-app/utils/pdfLadoALado";
import {
  estimarTamanho, excedeLimiteEmail, formatarTamanho, montarFolhas, nomeArquivoRelatorio,
} from "@/react-app/utils/pdfLadoALadoLayout";
import { reencodarFoto } from "@/react-app/utils/reencodarFoto";

interface GerarPdfDialogProps {
  codigoApartamento: string;
  termo: TermoReprovaDto;
  /** Bytes do PDF do termo já lido pela aba (evita baixar de novo). */
  pdfBytes: Uint8Array;
  onFechar: () => void;
}

type Etapa = "baixando" | "pronto" | "gerando" | "concluido" | "erro";
type Qualidade = "original" | "leve";

const CONCORRENCIA = 3;

function tipoDaImagem(blob: Blob): "image/jpeg" | "image/png" {
  return blob.type === "image/png" ? "image/png" : "image/jpeg";
}

/** Diálogo "Gerar PDF lado a lado": baixa as fotos, mostra o tamanho estimado e gera o arquivo no navegador. */
export default function GerarPdfDialog({ codigoApartamento, termo, pdfBytes, onFechar }: GerarPdfDialogProps) {
  const [etapa, setEtapa] = useState<Etapa>("baixando");
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [originais, setOriginais] = useState<FotoParaPdf[]>([]);
  const [leves, setLeves] = useState<FotoParaPdf[] | null>(null);
  const [incluirSemFoto, setIncluirSemFoto] = useState(true);
  const [qualidade, setQualidade] = useState<Qualidade>("original");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const cancelado = useRef(false);

  const total = termo.fotos.length;

  // 1) baixa as fotos (3 por vez); 2) prepara em segundo plano a versão "leve".
  useEffect(() => {
    cancelado.current = false;
    (async () => {
      const lista: FotoParaPdf[] = new Array(termo.fotos.length);
      let proximo = 0;
      let feitas = 0;
      const trabalhar = async () => {
        while (proximo < termo.fotos.length) {
          const i = proximo++;
          const foto = termo.fotos[i];
          const chave = `foto:${foto.idTermoFoto}:imagem:${foto.nrVersao}`;
          let blob = cacheBlobs.get(chave);
          if (!blob) {
            blob = await termoReprovaService.baixarImagem(foto.idTermoFoto, foto.nrVersao);
            cacheBlobs.set(chave, blob);
          }
          lista[i] = {
            id: foto.idTermoFoto,
            pagina: foto.nrPagina,
            ordem: foto.nrOrdem,
            legenda: foto.txLegenda,
            bytes: new Uint8Array(await blob.arrayBuffer()),
            tipo: tipoDaImagem(blob),
          };
          feitas++;
          if (!cancelado.current) setProgresso(feitas);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, termo.fotos.length) }, trabalhar));
      if (cancelado.current) return;
      setOriginais(lista);
      setEtapa("pronto");

      // Versão leve em segundo plano. Uma foto que não pode ser reduzida mantém os bytes originais,
      // para que um único arquivo problemático não impeça a opção.
      const reduzidas: FotoParaPdf[] = [];
      for (const f of lista) {
        try {
          const r = await reencodarFoto(f.bytes, f.tipo);
          reduzidas.push({ ...f, bytes: r.bytes, tipo: r.tipo });
        } catch {
          reduzidas.push(f);
        }
        if (cancelado.current) return;
      }
      setLeves(reduzidas);
    })().catch(e => {
      if (cancelado.current) return;
      setErro(e instanceof Error && e.message ? e.message : "Uma das fotos não pôde ser carregada. Tente novamente.");
      setEtapa("erro");
    });
    return () => { cancelado.current = true; };
  }, [termo.fotos]);

  const folhasComSemFoto = useMemo(() => montarFolhas(termo.nrPaginas, originais, true).length, [termo.nrPaginas, originais]);
  const paginasSemFoto = folhasComSemFoto - originais.length;
  const nFolhas = incluirSemFoto ? folhasComSemFoto : originais.length;

  const estimar = (fotos: FotoParaPdf[] | null) =>
    fotos ? estimarTamanho(pdfBytes.length, fotos.map(f => f.bytes.length), nFolhas) : null;
  const estimativaOriginal = estimar(originais);
  const estimativaLeve = estimar(leves);
  const estimativaEscolhida = qualidade === "leve" ? estimativaLeve : estimativaOriginal;
  const acimaDoLimite = estimativaEscolhida !== null && excedeLimiteEmail(estimativaEscolhida);

  const nomeArquivo = nomeArquivoRelatorio(nomeArquivoSeguro(codigoApartamento), termo.nrTermo);

  const baixar = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const gerar = async () => {
    setEtapa("gerando");
    setErro(null);
    try {
      const fotos = qualidade === "leve" && leves ? leves : originais;
      const bytes = await gerarPdfLadoALado(
        {
          codigoApartamento,
          nrTermo: termo.nrTermo,
          situacao: termo.nmSituacao,
          pdfBytes,
          fotos,
        },
        { incluirPaginasSemFoto: incluirSemFoto },
      );
      const file = new File([bytes as BlobPart], nomeArquivo, { type: "application/pdf" });
      setArquivo(file);
      baixar(file);
      setEtapa("concluido");
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível gerar o PDF.");
      setEtapa("erro");
    }
  };

  const podeCompartilhar = arquivo !== null && typeof navigator !== "undefined"
    && typeof navigator.canShare === "function" && navigator.canShare({ files: [arquivo] });

  const compartilhar = async () => {
    if (!arquivo) return;
    try {
      await navigator.share({ files: [arquivo], title: nomeArquivo });
    } catch (e) {
      // AbortError = o usuário fechou a folha de compartilhamento
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setErro("Não foi possível compartilhar o arquivo.");
      }
    }
  };

  const ocupado = etapa === "baixando" || etapa === "gerando";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Gerar PDF lado a lado">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Gerar PDF lado a lado</h3>
            <p className="text-xs text-slate-400">Termo {termo.nrTermo} · o arquivo é gerado no seu aparelho e não fica guardado no servidor.</p>
          </div>
          <button type="button" onClick={onFechar} disabled={etapa === "gerando"} aria-label="Fechar" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {etapa === "baixando" && (
          <div role="status" className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            Baixando fotos… {progresso} de {total}
          </div>
        )}

        {(etapa === "pronto" || etapa === "gerando" || etapa === "concluido") && (
          <fieldset disabled={ocupado} className="flex flex-col gap-3">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={incluirSemFoto} onChange={e => setIncluirSemFoto(e.target.checked)} className="mt-0.5" />
              <span>
                Incluir páginas sem foto
                <span className="block text-xs text-slate-400">
                  {paginasSemFoto === 0 ? "Todas as páginas têm foto." : `${paginasSemFoto} página(s) sem foto ${incluirSemFoto ? "entram com o aviso “Sem foto anexada”" : "serão omitidas"}.`}
                </span>
              </span>
            </label>

            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Qualidade das fotos">
              <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${qualidade === "original" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="qualidade" checked={qualidade === "original"} onChange={() => setQualidade("original")} />
                  Original <span className="text-xs text-slate-400">(recomendado)</span>
                </span>
                <span className="text-xs font-medium text-slate-500">≈ {estimativaOriginal !== null ? formatarTamanho(estimativaOriginal) : "…"}</span>
              </label>
              <label className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${leves ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${qualidade === "leve" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="qualidade" disabled={!leves} checked={qualidade === "leve"} onChange={() => setQualidade("leve")} />
                  Leve <span className="text-xs text-slate-400">(fotos menores)</span>
                </span>
                <span className="text-xs font-medium text-slate-500">≈ {estimativaLeve !== null ? formatarTamanho(estimativaLeve) : "calculando…"}</span>
              </label>
            </div>

            {acimaDoLimite && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Acima de 20 MB: o arquivo pode não caber como anexo de e-mail. {qualidade === "original" && leves ? "Considere a versão leve." : ""}
              </p>
            )}
          </fieldset>
        )}

        {etapa === "concluido" && arquivo && (
          <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
            PDF gerado: <strong>{arquivo.name}</strong> ({formatarTamanho(arquivo.size)}). O download foi iniciado.
          </p>
        )}
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {etapa === "concluido" && arquivo && (
            <>
              <button type="button" onClick={() => baixar(arquivo)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <Download className="h-4 w-4" /> Baixar de novo
              </button>
              {podeCompartilhar && (
                <button type="button" onClick={() => void compartilhar()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  <Share2 className="h-4 w-4" /> Compartilhar
                </button>
              )}
            </>
          )}
          <button type="button" onClick={onFechar} disabled={etapa === "gerando"} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50">
            {etapa === "concluido" ? "Fechar" : "Cancelar"}
          </button>
          {(etapa === "pronto" || etapa === "gerando") && (
            <button
              type="button"
              disabled={ocupado || (!incluirSemFoto && originais.length === 0)}
              onClick={() => void gerar()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {etapa === "gerando" && <Loader2 className="h-4 w-4 animate-spin" />}
              {etapa === "gerando" ? "Gerando…" : "Gerar PDF"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
