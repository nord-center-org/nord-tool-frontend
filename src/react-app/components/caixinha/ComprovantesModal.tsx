import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, ExternalLink, FileText, Loader2, Trash2, Upload, XCircle } from "lucide-react";

import type { CaixinhaComprovante, CaixinhaLancamento } from "@/shared/types";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { caixinhaService } from "@/react-app/services/CaixinhaService";
import { abrirArquivoAutenticado } from "@/react-app/utils/abrirArquivoAutenticado";
import { validarPdfComprovante } from "@/react-app/utils/caixinha";

interface ComprovantesModalProps {
  lancamento: CaixinhaLancamento;
  /** Chamado após anexar/excluir, para atualizar a contagem na tabela. */
  onAlterado: () => void;
  onFechar: () => void;
}

interface ItemFila {
  chave: string;
  nome: string;
  estado: "enviando" | "ok" | "erro";
  mensagem?: string;
}

const formatarTamanho = (bytes: number) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const mensagemDe = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

/** Lê o começo e o fim do arquivo (1024 bytes de cauda) para validar o PDF sem carregá-lo inteiro. */
async function validarArquivo(arquivo: File): Promise<string | null> {
  const inicio = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
  const fim = new Uint8Array(await arquivo.slice(Math.max(0, arquivo.size - 1024)).arrayBuffer());
  return validarPdfComprovante(arquivo, inicio, fim);
}

export default function ComprovantesModal({ lancamento, onAlterado, onFechar }: ComprovantesModalProps) {
  const [itens, setItens] = useState<CaixinhaComprovante[] | null>(null);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [visualizando, setVisualizando] = useState<{ id: number; url: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const idLancamento = lancamento.idLancamento;

  const carregar = useCallback(async () => {
    try {
      setItens(await caixinhaService.listarComprovantes(idLancamento));
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível carregar os comprovantes."));
      setItens([]);
    }
  }, [idLancamento]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Libera o object URL do PDF em visualização.
  useEffect(() => () => { if (visualizando) URL.revokeObjectURL(visualizando.url); }, [visualizando]);

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;
    setErro(null);
    for (const arquivo of Array.from(arquivos)) {
      const chave = crypto.randomUUID();
      setFila(f => [...f, { chave, nome: arquivo.name, estado: "enviando" }]);
      const atualizar = (parcial: Partial<ItemFila>) => setFila(f => f.map(x => (x.chave === chave ? { ...x, ...parcial } : x)));
      try {
        const problema = await validarArquivo(arquivo);
        if (problema) { atualizar({ estado: "erro", mensagem: problema }); continue; }
        // Uma chave por arquivo: se o envio for repetido, o servidor devolve o mesmo comprovante.
        await caixinhaService.anexarComprovante(idLancamento, arquivo, chave);
        atualizar({ estado: "ok" });
        await carregar();
        onAlterado();
      } catch (e) {
        atualizar({ estado: "erro", mensagem: mensagemDe(e, "Falha no envio.") });
      }
    }
    if (entrada.current) entrada.current.value = "";
  };

  const visualizar = async (c: CaixinhaComprovante) => {
    setErro(null);
    try {
      const blob = await caixinhaService.baixarComprovante(c.idComprovante);
      setVisualizando({ id: c.idComprovante, url: URL.createObjectURL(blob) });
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível abrir o comprovante."));
    }
  };

  const baixar = async (c: CaixinhaComprovante) => {
    try {
      const blob = await caixinhaService.baixarComprovante(c.idComprovante);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = c.nmArquivo;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível baixar o comprovante."));
    }
  };

  const excluir = async (c: CaixinhaComprovante) => {
    if (!window.confirm(`Excluir o comprovante "${c.nmArquivo}"?`)) return;
    try {
      await caixinhaService.excluirComprovante(c.idComprovante);
      if (visualizando?.id === c.idComprovante) setVisualizando(null);
      await carregar();
      onAlterado();
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível excluir o comprovante."));
    }
  };

  return (
    <ModalBase titulo={`Comprovantes · ${lancamento.txInsumo}`} onFechar={onFechar} largura="max-w-3xl">
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div>
          <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => void enviar(e.target.files)} />
          <button type="button" onClick={() => entrada.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            <Upload className="h-4 w-4" /> Anexar PDFs
          </button>
          <span className="ml-3 text-xs text-slate-400">Até 5 MB cada. Você pode escolher vários.</span>
        </div>

        {fila.length > 0 && (
          <ul aria-label="Fila de envio" className="space-y-1 text-sm">
            {fila.map(f => (
              <li key={f.chave} className="flex items-center gap-2">
                {f.estado === "enviando" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                {f.estado === "ok" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {f.estado === "erro" && <XCircle className="h-4 w-4 text-red-600" />}
                <span className="truncate text-slate-600">{f.nome}</span>
                {f.mensagem && <span className="text-xs text-red-600">{f.mensagem}</span>}
              </li>
            ))}
          </ul>
        )}

        {itens === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-label="Carregando" /></div>
        ) : itens.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">Nenhum comprovante anexado.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {itens.map(c => (
              <li key={c.idComprovante} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <button type="button" onClick={() => void visualizar(c)} className="flex min-w-0 items-center gap-2 text-left text-sm text-blue-700 hover:underline">
                  <FileText className="h-4 w-4 shrink-0" /><span className="truncate">{c.nmArquivo}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatarTamanho(c.nrTamanhoBytes)}</span>
                </button>
                <div className="flex gap-1">
                  <button type="button" onClick={() => void abrirArquivoAutenticado(() => caixinhaService.baixarComprovante(c.idComprovante)).catch(e => setErro(mensagemDe(e, "Não foi possível abrir.")))} aria-label={`Abrir ${c.nmArquivo} em nova aba`} title="Abrir em nova aba" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><ExternalLink className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void baixar(c)} aria-label={`Baixar ${c.nmArquivo}`} title="Baixar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Download className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void excluir(c)} aria-label={`Excluir ${c.nmArquivo}`} title="Excluir" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {visualizando && (
          <iframe title="Visualização do comprovante" src={visualizando.url} className="h-[60vh] w-full rounded-xl border border-slate-200" />
        )}

        <p className="text-[11px] text-amber-600">Armazenamento provisório: os arquivos ficam no banco de dados.</p>
      </div>
    </ModalBase>
  );
}
