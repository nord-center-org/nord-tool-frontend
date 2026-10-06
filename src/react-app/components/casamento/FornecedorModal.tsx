import { useEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";

import type { CasamentoAnexo, CasamentoFornecedor, StatusFornecedor } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { casamentoService, type FornecedorForm } from "@/react-app/services/CasamentoService";
import { abrirArquivoAutenticado } from "@/react-app/utils/abrirArquivoAutenticado";
import { ROTULO_STATUS_FORNECEDOR } from "@/react-app/utils/casamento";

interface FornecedorModalProps {
  /** Ausente = novo fornecedor. */
  fornecedor?: CasamentoFornecedor;
  onSalvar: (form: FornecedorForm) => void;
  onAnexosAlterados: () => void;
  onFechar: () => void;
}

const formatarTamanho = (bytes: number) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Cadastro/edição de fornecedor; anexos só existem depois que o fornecedor foi salvo. */
export default function FornecedorModal({ fornecedor, onSalvar, onAnexosAlterados, onFechar }: FornecedorModalProps) {
  const [form, setForm] = useState({
    nmFornecedor: fornecedor?.nmFornecedor ?? "",
    nmCategoria: fornecedor?.nmCategoria ?? "",
    txContato: fornecedor?.txContato ?? "",
    nmStatus: (fornecedor?.nmStatus ?? "PESQUISANDO") as StatusFornecedor,
    vlValor: fornecedor ? String(fornecedor.vlValor) : "",
    txObservacao: fornecedor?.txObservacao ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [anexos, setAnexos] = useState<CasamentoAnexo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const idFornecedor = fornecedor?.idFornecedor;

  useEffect(() => {
    if (idFornecedor === undefined) return;
    let ativo = true;
    casamentoService.listarAnexos(idFornecedor)
      .then(lista => { if (ativo) setAnexos(lista); })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Falha ao listar anexos."); });
    return () => { ativo = false; };
  }, [idFornecedor]);

  const alterar = (campo: keyof typeof form, valor: string) => setForm(f => ({ ...f, [campo]: valor }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!form.nmFornecedor.trim()) return setErro("Informe o nome do fornecedor.");
    if (!form.nmCategoria.trim()) return setErro("Informe a categoria.");
    const valor = form.vlValor.trim() === "" ? 0 : Number(form.vlValor.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) return setErro("Valor inválido.");
    onSalvar({
      nmFornecedor: form.nmFornecedor.trim(),
      nmCategoria: form.nmCategoria.trim(),
      txContato: form.txContato.trim(),
      nmStatus: form.nmStatus,
      vlValor: valor,
      txObservacao: form.txObservacao.trim(),
    });
    onFechar();
  };

  const anexar = async (arquivo: File | undefined) => {
    if (!arquivo || idFornecedor === undefined) return;
    setEnviando(true);
    setErro(null);
    try {
      const novo = await casamentoService.anexar(idFornecedor, arquivo);
      if (novo) setAnexos(a => [...a, novo]);
      onAnexosAlterados();
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível anexar o arquivo.");
    } finally {
      setEnviando(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  };

  const abrir = async (anexo: CasamentoAnexo) => {
    try { await abrirArquivoAutenticado(() => casamentoService.baixarAnexo(anexo.idAnexo)); }
    catch (e) { setErro(e instanceof Error && e.message ? e.message : "Não foi possível abrir o anexo."); }
  };

  const excluir = async (anexo: CasamentoAnexo) => {
    if (!window.confirm(`Excluir o anexo "${anexo.nmArquivo}"?`)) return;
    try {
      await casamentoService.excluirAnexo(anexo.idAnexo);
      setAnexos(a => a.filter(x => x.idAnexo !== anexo.idAnexo));
      onAnexosAlterados();
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível excluir o anexo.");
    }
  };

  return (
    <ModalBase titulo={fornecedor ? "Editar fornecedor" : "Novo fornecedor"} onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Fornecedor">
          <input autoFocus maxLength={200} value={form.nmFornecedor} onChange={e => alterar("nmFornecedor", e.target.value)} className={classeInput} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Categoria">
            <input maxLength={100} value={form.nmCategoria} onChange={e => alterar("nmCategoria", e.target.value)} placeholder="Buffet, Foto…" className={classeInput} />
          </Campo>
          <Campo rotulo="Status">
            <select value={form.nmStatus} onChange={e => alterar("nmStatus", e.target.value)} className={classeInput}>
              {(Object.keys(ROTULO_STATUS_FORNECEDOR) as StatusFornecedor[]).map(s => <option key={s} value={s}>{ROTULO_STATUS_FORNECEDOR[s]}</option>)}
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Valor (R$)">
            <input inputMode="decimal" value={form.vlValor} onChange={e => alterar("vlValor", e.target.value)} placeholder="0,00" className={classeInput} />
          </Campo>
          <Campo rotulo="Contato">
            <input maxLength={200} value={form.txContato} onChange={e => alterar("txContato", e.target.value)} className={classeInput} />
          </Campo>
        </div>
        <Campo rotulo="Observações">
          <textarea rows={2} maxLength={2000} value={form.txObservacao} onChange={e => alterar("txObservacao", e.target.value)} className={classeInput} />
        </Campo>

        <section aria-label="Anexos" className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400"><Paperclip className="h-3.5 w-3.5" /> Anexos</h3>
            {idFornecedor !== undefined && (
              <>
                <input ref={inputArquivo} type="file" hidden onChange={e => void anexar(e.target.files?.[0])} />
                <button type="button" disabled={enviando} onClick={() => inputArquivo.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Anexar
                </button>
              </>
            )}
          </div>
          {idFornecedor === undefined ? (
            <p className="text-xs text-slate-400">Salve o fornecedor para poder anexar contratos e orçamentos.</p>
          ) : anexos.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum anexo.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {anexos.map(a => (
                <li key={a.idAnexo} className="flex items-center justify-between gap-2 py-1.5">
                  <button type="button" onClick={() => void abrir(a)} className="flex min-w-0 items-center gap-2 text-left text-sm text-blue-700 hover:underline">
                    <FileText className="h-4 w-4 shrink-0" /><span className="truncate">{a.nmArquivo}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatarTamanho(a.nrTamanhoBytes)}</span>
                  </button>
                  <button type="button" onClick={() => void excluir(a)} aria-label={`Excluir ${a.nmArquivo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-amber-600">Armazenamento provisório: os arquivos ficam no banco de dados.</p>
        </section>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Salvar</button>
        </div>
      </form>
    </ModalBase>
  );
}
