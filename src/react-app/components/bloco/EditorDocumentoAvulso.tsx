import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, FileDown, FileText, Loader2 } from "lucide-react";

import DocumentoCaderno, { type ExibicaoDocumento, type FonteDocumento } from "@/react-app/components/bloco/DocumentoCaderno";
import { exportarPdf } from "@/react-app/components/bloco/pdfBloco";
import { arquivosBlocoService as servico, type ArquivoBloco } from "@/react-app/services/BlocoNotasService";
import { nomeDeArquivo } from "@/react-app/utils/baixarArquivo";
import { documentoVazio } from "@/react-app/utils/blocoNotas";

const CHAVE_EXIBICAO = "@NordTool:bloco-notas:exibicao";
const botao = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const lerExibicao = (): ExibicaoDocumento => { try { return localStorage.getItem(CHAVE_EXIBICAO) === "continuo" ? "continuo" : "paginas"; } catch { return "paginas"; } };

/**
 * Documento avulso do bloco de notas (v3), no estilo do Word: o mesmo editor do documento do caderno (páginas A4 ou
 * contínuo, salva sozinho), com nome e "Baixar PDF". Nome e conteúdo dividem a mesma versão do arquivo.
 */
export default function EditorDocumentoAvulso({ id, onVoltar, onAlterado, extra }: { id: number; onVoltar: () => void; onAlterado?: (a: ArquivoBloco) => void; extra?: ReactNode }) {
  const [arquivo, setArquivo] = useState<ArquivoBloco | null>(null);
  const [titulo, setTitulo] = useState("");
  const [exibicao, setExibicao] = useState<ExibicaoDocumento>(lerExibicao);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const versao = useRef(1);
  const html = useRef("");
  const primeiro = useRef<Promise<ArquivoBloco> | null>(null);

  useEffect(() => {
    let vivo = true;
    primeiro.current = servico.abrir(id);
    primeiro.current.then(a => { if (vivo) { setArquivo(a); setTitulo(a.nmTitulo); versao.current = a.nrVersao; } })
      .catch(e => vivo && setErro(e instanceof Error ? e.message : "Não foi possível abrir o documento."));
    return () => { vivo = false; };
  }, [id]);

  const fonte = useMemo<FonteDocumento>(() => ({
    carregar: async () => {
      const a = await (primeiro.current ?? servico.abrir(id));
      primeiro.current = null;
      versao.current = a.nrVersao;
      return { html: a.conteudo ?? "", nrVersao: a.nrVersao };
    },
    // A versão é a do arquivo (o nome também a muda), não a que o editor guardou.
    salvar: async conteudo => { const r = await servico.salvar(id, versao.current, { conteudo }); versao.current = r.nrVersao; onAlterado?.(r); return { nrVersao: r.nrVersao }; },
  }), [id, onAlterado]);

  const renomear = async () => {
    const t = titulo.trim();
    if (!t || !arquivo || t === arquivo.nmTitulo) { setTitulo(arquivo?.nmTitulo ?? t); return; }
    try {
      const r = await servico.salvar(id, versao.current, { nmTitulo: t });
      versao.current = r.nrVersao;
      setArquivo({ ...arquivo, nmTitulo: t });
      onAlterado?.(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível renomear.");
      setTitulo(arquivo.nmTitulo);
    }
  };

  const baixarPdf = async () => {
    if (documentoVazio(html.current)) { setErro("O documento está vazio."); return; }
    setBaixando(true);
    try {
      const bytes = await exportarPdf([], async () => [], () => undefined, html.current);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nomeDeArquivo(titulo, "documento")}.pdf`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally {
      setBaixando(false);
    }
  };

  if (!arquivo) return erro
    ? <div className="p-4"><p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p><button type="button" className={`${botao} mt-3`} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Voltar</button></div>
    : <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo o documento…</div>;

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-2 md:h-[calc(100dvh-4rem)]">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Bloco de notas</button>
        <FileText className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
        <input value={titulo} maxLength={120} aria-label="Nome do documento" onChange={e => setTitulo(e.target.value)} onBlur={() => void renomear()}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="order-last w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-slate-800 hover:border-slate-200 focus:border-blue-500 focus:outline-none sm:order-none sm:w-auto sm:flex-1" />
        {extra}
        <button type="button" className={`${botao} ml-auto sm:ml-0`} onClick={() => void baixarPdf()} disabled={baixando}>
          {baixando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}Baixar PDF
        </button>
      </div>
      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DocumentoCaderno fonte={fonte} exibicao={exibicao} onHtml={h => { html.current = h; }}
          onExibicao={e => { setExibicao(e); try { localStorage.setItem(CHAVE_EXIBICAO, e); } catch { /* sem armazenamento */ } }} />
      </div>
    </div>
  );
}
