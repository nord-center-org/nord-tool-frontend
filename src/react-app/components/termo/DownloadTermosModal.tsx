import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";

import type { ApartamentoVistoriaDto } from "@/shared/types";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { termoReprovaService } from "@/react-app/services/TermoReprovaService";
import { nomeArquivoSeguro } from "@/react-app/utils/apartamentoNome";
import { baixarArquivo } from "@/react-app/utils/baixarArquivo";
import { executarEmLotes } from "@/react-app/utils/movimentacaoMassa";
import { gerarPdfLadoALado, type FotoParaPdf } from "@/react-app/utils/pdfLadoALado";
import { formatarTamanho, nomeArquivoRelatorio } from "@/react-app/utils/pdfLadoALadoLayout";
import { nomeArquivoZip, nomeUnico, separarConcluidos } from "@/react-app/utils/termosConcluidos";
import { criarZip, type EntradaZip } from "@/react-app/utils/zip";

interface DownloadTermosModalProps {
  /** Apartamentos marcados na tabela. */
  apartamentos: ApartamentoVistoriaDto[];
  onFechar: () => void;
}

type Fase = "confirmando" | "gerando" | "resultado";

const CONCORRENCIA_APARTAMENTOS = 2;
const CONCORRENCIA_FOTOS = 3;

function tipoDaImagem(blob: Blob): "image/jpeg" | "image/png" {
  return blob.type === "image/png" ? "image/png" : "image/jpeg";
}

/** Gera o PDF "lado a lado" do último termo (concluído) de um apartamento, igual ao botão da aba do termo. */
async function gerarRelatorio(apt: ApartamentoVistoriaDto): Promise<EntradaZip> {
  const resumos = await termoReprovaService.listar(apt.idApartamentoVistoria);
  const resumo = resumos.find(t => t.nrTermo === apt.nrUltimoTermo);
  if (!resumo) throw new Error("Termo não encontrado.");
  if (resumo.nmSituacao !== "CONCLUIDO") throw new Error("O último termo não está mais concluído.");

  const termo = await termoReprovaService.buscar(resumo.idTermoReprova);
  const pdfBytes = new Uint8Array(await (await termoReprovaService.baixarPdf(termo.idTermoReprova, termo.nrVersao)).arrayBuffer());

  const fotos: FotoParaPdf[] = new Array(termo.fotos.length);
  const baixas = await executarEmLotes(
    termo.fotos.map((foto, indice) => ({ foto, indice })),
    async ({ foto, indice }) => {
      const blob = await termoReprovaService.baixarImagem(foto.idTermoFoto, foto.nrVersao);
      fotos[indice] = {
        id: foto.idTermoFoto,
        pagina: foto.nrPagina,
        ordem: foto.nrOrdem,
        legenda: foto.txLegenda,
        bytes: new Uint8Array(await blob.arrayBuffer()),
        tipo: tipoDaImagem(blob),
      };
    },
    CONCORRENCIA_FOTOS,
  );
  if (baixas.some(b => b.erro)) throw new Error("Uma das fotos não pôde ser carregada.");

  const bytes = await gerarPdfLadoALado(
    { codigoApartamento: apt.nmApartamentoVistoria, nrTermo: termo.nrTermo, situacao: termo.nmSituacao, pdfBytes, fotos },
    { incluirPaginasSemFoto: true },
  );
  return { nome: nomeArquivoRelatorio(nomeArquivoSeguro(apt.nmApartamentoVistoria), termo.nrTermo), bytes };
}

/** Baixa, em um único ZIP, o PDF lado a lado de todos os termos concluídos entre os apartamentos marcados. */
export default function DownloadTermosModal({ apartamentos, onFechar }: DownloadTermosModalProps) {
  const { concluidos, ignorados } = useMemo(() => separarConcluidos(apartamentos), [apartamentos]);
  const [fase, setFase] = useState<Fase>("confirmando");
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [falhas, setFalhas] = useState<{ apt: ApartamentoVistoriaDto; erro: string }[]>([]);
  const [zip, setZip] = useState<File | null>(null);
  const [erroZip, setErroZip] = useState<string | null>(null);
  // Relatórios já gerados, por apartamento: "tentar de novo" refaz só os que falharam.
  const prontos = useRef(new Map<number, EntradaZip>());

  const montarZip = (): File | null => {
    const usados = new Set<string>();
    const entradas = concluidos
      .map(a => prontos.current.get(a.idApartamentoVistoria))
      .filter((e): e is EntradaZip => e !== undefined)
      .map(e => ({ nome: nomeUnico(e.nome, usados), bytes: e.bytes }));
    if (entradas.length === 0) return null;
    return new File([criarZip(entradas) as BlobPart], nomeArquivoZip(), { type: "application/zip" });
  };

  const executar = async () => {
    const pendentes = concluidos.filter(a => !prontos.current.has(a.idApartamentoVistoria));
    setFase("gerando");
    setProgresso({ feitos: 0, total: pendentes.length });
    const resultados = await executarEmLotes(
      pendentes,
      async apt => { prontos.current.set(apt.idApartamentoVistoria, await gerarRelatorio(apt)); },
      CONCORRENCIA_APARTAMENTOS,
      (feitos, total) => setProgresso({ feitos, total }),
    );
    setFalhas(resultados.filter(r => r.erro).map(r => ({ apt: r.item, erro: r.erro as string })));
    try {
      const arquivo = montarZip();
      setZip(arquivo);
      setErroZip(null);
      if (arquivo) baixarArquivo(arquivo);
    } catch (e) {
      setZip(null);
      setErroZip(e instanceof Error && e.message ? e.message : "Não foi possível montar o ZIP.");
    }
    setFase("resultado");
  };

  const fechar = () => { if (fase !== "gerando") onFechar(); };
  const gerados = prontos.current.size;

  return (
    <ModalBase titulo="Baixar termos concluídos" onFechar={fechar}>
      {fase === "confirmando" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Serão baixados <strong>{concluidos.length}</strong> termo(s) concluído(s) em um único arquivo ZIP, cada um no PDF lado a lado (termo + fotos).
            O arquivo é gerado no seu aparelho e pode demorar com muitos apartamentos.
          </p>
          {ignorados.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-1 font-bold">{ignorados.length} selecionado(s) ficam de fora (sem termo ou não concluído):</p>
              <ul className="flex max-h-[20vh] flex-wrap gap-1.5 overflow-y-auto">
                {ignorados.map(a => <li key={a.idApartamentoVistoria} className="rounded-full bg-white px-2 py-0.5 font-semibold">{a.nmApartamentoVistoria}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={fechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
            <button type="button" onClick={() => void executar()} disabled={concluidos.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              <Download className="h-4 w-4" /> Baixar {concluidos.length} termo(s)
            </button>
          </div>
        </div>
      )}

      {fase === "gerando" && (
        <div className="flex flex-col items-center gap-3 py-10" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm font-semibold text-slate-600">Gerando {progresso.feitos} de {progresso.total}…</p>
          <p className="text-xs text-slate-400">Não feche esta janela até terminar.</p>
        </div>
      )}

      {fase === "resultado" && (
        <div className="space-y-4" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {gerados} termo(s) no ZIP{zip ? ` · ${formatarTamanho(zip.size)}` : ""}
          </p>
          {erroZip && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erroZip}</p>}
          {falhas.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700"><XCircle className="h-4 w-4" /> {falhas.length} não foi(ram) gerado(s)</p>
              <ul className="max-h-[30vh] space-y-1 overflow-y-auto text-xs text-red-700">
                {falhas.map(f => <li key={f.apt.idApartamentoVistoria}><strong>{f.apt.nmApartamentoVistoria}:</strong> {f.erro}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {falhas.length > 0 && (
              <button type="button" onClick={() => void executar()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Tentar de novo os que falharam</button>
            )}
            {zip && (
              <button type="button" onClick={() => baixarArquivo(zip)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Baixar o ZIP de novo</button>
            )}
            <button type="button" onClick={fechar} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Fechar</button>
          </div>
        </div>
      )}
    </ModalBase>
  );
}
