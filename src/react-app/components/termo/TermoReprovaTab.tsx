import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FilePlus2, FileText, Loader2, Trash2, Upload } from "lucide-react";

import type { ApartamentoVistoriaDto, SituacaoTermo, TermoReprovaDto, TermoReprovaResumo } from "@/shared/types";
import { termoReprovaService } from "@/react-app/services/TermoReprovaService";
import { abrirArquivoAutenticado } from "@/react-app/utils/abrirArquivoAutenticado";
import { lerPdf, type PdfLido } from "@/react-app/utils/pdfTermo";
import { criarTermoEmBranco } from "@/react-app/utils/termoEmBranco";
import {
  SITUACOES_TERMO, contarFotosPorPagina, limitarPagina, mensagemExclusaoTermo, rotuloPagina, rotuloTermo,
} from "@/react-app/utils/termoRegras";
import TermoPaginaCanvas from "@/react-app/components/termo/TermoPaginaCanvas";
import PainelFotosPagina from "@/react-app/components/termo/PainelFotosPagina";

interface TermoReprovaTabProps {
  apartamento: ApartamentoVistoriaDto;
  /** Aba visível (controla os atalhos de teclado). */
  ativa: boolean;
  onDirtyChange?: (sujo: boolean) => void;
}

const botaoSecundario =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const botaoPrimario =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

function mensagemDe(e: unknown, padrao: string): string {
  return e instanceof Error && e.message ? e.message : padrao;
}

export default function TermoReprovaTab({ apartamento, ativa, onDirtyChange }: TermoReprovaTabProps) {
  const idApartamento = apartamento.idApartamentoVistoria;

  const [termos, setTermos] = useState<TermoReprovaResumo[] | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [termo, setTermo] = useState<TermoReprovaDto | null>(null);
  const [pdf, setPdf] = useState<PdfLido | null>(null);
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);

  const [carregandoTermo, setCarregandoTermo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  const [situacao, setSituacao] = useState<SituacaoTermo>("PENDENTE");
  const [observacao, setObservacao] = useState("");
  const [arrastando, setArrastando] = useState(false);

  const raiz = useRef<HTMLDivElement>(null);

  // ---------- carga ----------

  /** Recarrega a lista e seleciona `preferido` (ou o último termo anexado). */
  const carregarLista = useCallback(async (preferido?: number | null) => {
    const lista = await termoReprovaService.listar(idApartamento);
    setTermos(lista);
    setSelecionadoId(atual => {
      if (preferido !== undefined && preferido !== null && lista.some(t => t.idTermoReprova === preferido)) return preferido;
      if (atual !== null && lista.some(t => t.idTermoReprova === atual)) return atual;
      return lista.length > 0 ? lista[lista.length - 1].idTermoReprova : null;
    });
  }, [idApartamento]);

  useEffect(() => {
    let ativo = true;
    carregarLista().catch(e => { if (ativo) { setTermos([]); setErro(mensagemDe(e, "Não foi possível carregar os termos.")); } });
    return () => { ativo = false; };
  }, [carregarLista]);

  // Metadados + PDF do termo selecionado.
  useEffect(() => {
    if (selecionadoId === null) {
      setTermo(null);
      setPdf(null);
      return;
    }
    let ativo = true;
    let lido: PdfLido | null = null;
    setCarregandoTermo(true);
    (async () => {
      const dto = await termoReprovaService.buscar(selecionadoId);
      const blob = await termoReprovaService.baixarPdf(selecionadoId, dto.nrVersao);
      lido = await lerPdf(blob);
      if (!ativo) return;
      setTermo(dto);
      setPdf(lido);
      setSituacao(dto.nmSituacao);
      setObservacao(dto.txObservacao ?? "");
      setPagina(p => limitarPagina(p, dto.nrPaginas));
      setErro(null);
    })()
      .catch(e => { if (ativo) { setPdf(null); setErro(mensagemDe(e, "Não foi possível abrir o termo.")); } })
      .finally(() => { if (ativo) setCarregandoTermo(false); });
    return () => {
      ativo = false;
      void lido?.documento.destroy();
    };
  }, [selecionadoId, recarga]);

  // ---------- estado derivado ----------

  const totalPaginas = pdf?.nrPaginas ?? termo?.nrPaginas ?? 1;
  const fotosPorPagina = contarFotosPorPagina(termo?.fotos ?? []);
  const sujo = termo !== null && (situacao !== termo.nmSituacao || observacao !== (termo.txObservacao ?? ""));

  useEffect(() => { onDirtyChange?.(sujo); }, [sujo, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Setas ← → trocam a página (fora de campos de texto).
  useEffect(() => {
    if (!ativa || !pdf) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)) return;
      if (e.key === "ArrowLeft") setPagina(p => limitarPagina(p - 1, totalPaginas));
      if (e.key === "ArrowRight") setPagina(p => limitarPagina(p + 1, totalPaginas));
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ativa, pdf, totalPaginas]);

  // ---------- ações ----------

  const executar = async (acao: () => Promise<void>, falha: string) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDe(e, falha));
    } finally {
      setOcupado(false);
    }
  };

  /** Lê o PDF no navegador para obter o nº de páginas (validando 15 MB / 40 páginas). */
  const contarPaginas = async (arquivo: File | Blob): Promise<number> => {
    const lido = await lerPdf(arquivo);
    const total = lido.nrPaginas;
    await lido.documento.destroy();
    return total;
  };

  const anexarNovo = (arquivo: File | undefined) => {
    if (!arquivo) return;
    void executar(async () => {
      const paginas = await contarPaginas(arquivo);
      const criado = await termoReprovaService.criar(idApartamento, arquivo, arquivo.name, paginas);
      setAvisos([]);
      setPagina(1);
      await carregarLista(criado.idTermoReprova);
    }, "Não foi possível anexar o termo.");
  };

  const criarEmBranco = () => {
    void executar(async () => {
      const { bytes, nome } = await criarTermoEmBranco(apartamento.nmApartamentoVistoria);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const criado = await termoReprovaService.criar(idApartamento, blob, nome, 1);
      setAvisos([]);
      setPagina(1);
      await carregarLista(criado.idTermoReprova);
    }, "Não foi possível criar o termo em branco.");
  };

  const trocarPdf = (arquivo: File | undefined) => {
    if (!arquivo || !termo) return;
    void executar(async () => {
      const paginas = await contarPaginas(arquivo);
      const atualizado = await termoReprovaService.trocarArquivo(termo.idTermoReprova, arquivo, arquivo.name, paginas);
      setAvisos(atualizado.avisos ?? []);
      await carregarLista(atualizado.idTermoReprova);
      setRecarga(n => n + 1);
    }, "Não foi possível trocar o PDF.");
  };

  const salvarAlteracoes = () => {
    if (!termo) return;
    void executar(async () => {
      const atualizado = await termoReprovaService.atualizarSituacao(termo.idTermoReprova, situacao, observacao);
      setTermo(atualizado);
      setSituacao(atualizado.nmSituacao);
      setObservacao(atualizado.txObservacao ?? "");
      await carregarLista(atualizado.idTermoReprova);
    }, "Não foi possível salvar as alterações.");
  };

  const excluirTermo = () => {
    if (!termo || !window.confirm(mensagemExclusaoTermo(termo.fotos.length))) return;
    void executar(async () => {
      await termoReprovaService.excluir(termo.idTermoReprova);
      setAvisos([]);
      setTermo(null);
      setPdf(null);
      setSelecionadoId(null);
      await carregarLista(null);
    }, "Não foi possível excluir o termo.");
  };

  const abrirPdfOriginal = () => {
    if (!termo) return;
    abrirArquivoAutenticado(() => termoReprovaService.baixarPdf(termo.idTermoReprova, termo.nrVersao))
      .catch(e => setErro(mensagemDe(e, "Não foi possível abrir o PDF.")));
  };

  const aoSoltar = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setArrastando(false);
    if (!ocupado) anexarNovo(e.dataTransfer.files?.[0]);
  };

  const campoArquivo = (aoEscolher: (arquivo: File | undefined) => void) => (
    <input
      type="file"
      accept="application/pdf,.pdf"
      className="hidden"
      disabled={ocupado}
      onChange={e => { aoEscolher(e.target.files?.[0]); e.target.value = ""; }}
    />
  );

  // ---------- render ----------

  const faixaErro = erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>;
  const faixaAvisos = avisos.length > 0 && (
    <div role="status" className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <ul>{avisos.map(a => <li key={a}>{a}</li>)}</ul>
      <button type="button" onClick={() => setAvisos([])} className="font-bold text-amber-700 hover:underline">Ok</button>
    </div>
  );

  if (termos === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando termos" />
      </div>
    );
  }

  if (termos.length === 0) {
    return (
      <div ref={raiz} className="flex h-full flex-col gap-4 overflow-y-auto p-6 md:p-10">
        {faixaErro}
        <section
          onDragOver={e => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltar}
          className={`mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${arrastando ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
        >
          <FileText className="h-10 w-10 text-slate-300" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">Termo de reprova do DAT</h3>
            <p className="mt-1 text-sm text-slate-500">
              Anexe o PDF para ver as páginas e associar as fotos das correções.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <label className={`${botaoPrimario} cursor-pointer`}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Anexar relatório de reprova (PDF)
              {campoArquivo(anexarNovo)}
            </label>
            <button type="button" className={botaoSecundario} disabled={ocupado} onClick={criarEmBranco}>
              <FilePlus2 className="h-4 w-4" /> Criar termo em branco
            </button>
          </div>
          <small className="text-xs text-slate-400">PDF de até 15 MB e 40 páginas. Você também pode arrastar o arquivo para cá.</small>
        </section>
      </div>
    );
  }

  return (
    <div ref={raiz} className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
      {/* Seletor de termo */}
      <div className="flex flex-wrap items-center gap-2">
        {termos.map(t => (
          <button
            key={t.idTermoReprova}
            type="button"
            disabled={ocupado}
            onClick={() => { setSelecionadoId(t.idTermoReprova); setPagina(1); setAvisos([]); }}
            aria-pressed={t.idTermoReprova === selecionadoId}
            className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${t.idTermoReprova === selecionadoId ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {rotuloTermo(t.nrTermo)}
          </button>
        ))}
        <label className={`${botaoSecundario} cursor-pointer`}>
          <Upload className="h-4 w-4" /> Anexar novo termo
          {campoArquivo(anexarNovo)}
        </label>
        <button type="button" className={botaoSecundario} disabled={ocupado} onClick={criarEmBranco}>
          <FilePlus2 className="h-4 w-4" /> Termo em branco
        </button>
        {ocupado && <Loader2 className="h-4 w-4 animate-spin text-blue-500" aria-label="Processando" />}
      </div>

      {faixaErro}
      {faixaAvisos}

      {carregandoTermo && !termo && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Abrindo termo" />
        </div>
      )}

      {termo && (
        <>
          {/* Cabeçalho do termo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <strong className="truncate text-sm text-slate-700" title={termo.nmArquivo}>{termo.nmArquivo}</strong>
              <button type="button" onClick={abrirPdfOriginal} className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir PDF original
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={botaoPrimario}
                disabled
                title="Disponível na etapa do PDF lado a lado"
              >
                Gerar PDF lado a lado
              </button>
              <label className={`${botaoSecundario} cursor-pointer`}>
                Trocar PDF
                {campoArquivo(trocarPdf)}
              </label>
              <button type="button" className={`${botaoSecundario} text-red-600 hover:bg-red-50`} disabled={ocupado} onClick={excluirTermo}>
                <Trash2 className="h-4 w-4" /> Excluir termo
              </button>
            </div>
          </div>

          {/* Página, situação e observações */}
          <div className="grid gap-3 md:grid-cols-[auto_auto_1fr_auto] md:items-end">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Página do termo</span>
              <div className="mt-1 flex items-center gap-1">
                <button type="button" aria-label="Página anterior" className={botaoSecundario} disabled={pagina <= 1} onClick={() => setPagina(p => limitarPagina(p - 1, totalPaginas))}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <select
                  aria-label="Página do termo"
                  value={pagina}
                  onChange={e => setPagina(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{rotuloPagina(n, totalPaginas, fotosPorPagina[n] ?? 0)}</option>
                  ))}
                </select>
                <button type="button" aria-label="Próxima página" className={botaoSecundario} disabled={pagina >= totalPaginas} onClick={() => setPagina(p => limitarPagina(p + 1, totalPaginas))}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Situação</span>
              <select
                value={situacao}
                disabled={ocupado}
                onChange={e => setSituacao(e.target.value as SituacaoTermo)}
                className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {SITUACOES_TERMO.map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observações</span>
              <textarea
                value={observacao}
                disabled={ocupado}
                rows={2}
                maxLength={4000}
                onChange={e => setObservacao(e.target.value)}
                className="mt-1 block w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <button type="button" className={botaoPrimario} disabled={ocupado || !sujo} onClick={salvarAlteracoes}>
              Salvar alterações
            </button>
          </div>

          {/* Termo (esquerda) e fotos (direita); empilhado no celular */}
          <div className="grid min-h-0 gap-4 md:grid-cols-2">
            <section aria-label={`Termo de reprova, página ${pagina}`} className="flex min-h-0 flex-col gap-3">
              <h3 className="text-sm font-bold text-slate-700">Termo de reprova · página {pagina}</h3>
              {pdf ? (
                <TermoPaginaCanvas documento={pdf.documento} pagina={pagina} />
              ) : (
                <div aria-busy="true" className="h-96 animate-pulse rounded-xl bg-slate-100" />
              )}
            </section>
            <PainelFotosPagina fotos={termo.fotos} pagina={pagina} />
          </div>
        </>
      )}
    </div>
  );
}
