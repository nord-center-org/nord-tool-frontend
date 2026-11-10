import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FileUp, Loader2, NotebookPen, Pencil, Plus, Search, Trash2 } from "lucide-react";

import EditorCaderno from "@/react-app/components/bloco/EditorCaderno";
import { ACEITA_ARQUIVOS, importarArquivo } from "@/react-app/components/bloco/arquivosBloco";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { blocoNotasService as servico, type Caderno } from "@/react-app/services/BlocoNotasService";
import { CORES_CAPA, ROTULO_FUNDO, tituloDoPdf, type Fundo } from "@/react-app/utils/blocoNotas";

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
type Papel = Exclude<Fundo, "PDF">;

/** Formulário de caderno: novo (com o papel da primeira página) ou renomear/trocar a cor. */
function CadernoModal({ caderno, onSalvar, onFechar }: {
  caderno: Caderno | null;
  onSalvar: (titulo: string, cor: string, papel: Papel) => Promise<string | null>;
  onFechar: () => void;
}) {
  const [titulo, setTitulo] = useState(caderno?.nmTitulo ?? "");
  const [cor, setCor] = useState(caderno?.cdCor ?? CORES_CAPA[0]);
  const [papel, setPapel] = useState<Papel>("PAUTADO");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return setErro("Dê um nome ao caderno.");
    setSalvando(true);
    const m = await onSalvar(titulo.trim(), cor, papel);
    setSalvando(false);
    if (m) setErro(m);
  };

  return (
    <ModalBase titulo={caderno ? "Editar caderno" : "Novo caderno"} onFechar={onFechar}>
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Nome">
          <input autoFocus value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Anotações da obra" className={classeInput} />
        </Campo>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cor da capa</span>
          <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da capa">
            {CORES_CAPA.map(c => (
              <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={c} onClick={() => setCor(c)}
                className={`h-8 w-8 rounded-lg ${cor === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`} style={{ background: c }} />
            ))}
          </div>
        </div>
        {!caderno && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Papel</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Papel">
              {(Object.keys(ROTULO_FUNDO) as Papel[]).map(p => (
                <button key={p} type="button" role="radio" aria-checked={papel === p} onClick={() => setPapel(p)}
                  className={`rounded-xl border-2 px-2 py-2 text-xs font-bold ${papel === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {ROTULO_FUNDO[p]}
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="submit" disabled={salvando} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />} {caderno ? "Salvar" : "Criar caderno"}
        </button>
      </form>
    </ModalBase>
  );
}

/** Bloco de notas: os cadernos da pessoa, para escrever à mão, marcar PDFs e exportar em PDF. */
export default function BlocoNotasPage() {
  const [cadernos, setCadernos] = useState<Caderno[] | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [modal, setModal] = useState<"novo" | Caderno | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState<string | null>(null);
  const arquivoPdf = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try { setCadernos(await servico.cadernos()); } catch (e) { setErro(mensagem(e, "Não foi possível carregar os cadernos.")); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (cadernos ?? []).filter(c => !t || c.nmTitulo.toLowerCase().includes(t));
  }, [cadernos, busca]);

  const salvar = async (titulo: string, cor: string, papel: Papel): Promise<string | null> => {
    try {
      if (modal && modal !== "novo") {
        const c = await servico.alterar(modal.id, titulo, cor, modal.nrVersao);
        setCadernos(l => (l ?? []).map(x => (x.id === c.id ? { ...x, ...c } : x)));
      } else {
        const c = await servico.criar(titulo, cor, papel);
        setCadernos(l => [c, ...(l ?? [])]);
        setAberto(c.id);
      }
      setModal(null);
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível salvar o caderno.");
    }
  };

  const excluir = async (c: Caderno) => {
    if (!window.confirm(`Excluir o caderno “${c.nmTitulo}” com todas as páginas? Não dá para desfazer.`)) return;
    try {
      await servico.excluir(c.id);
      setCadernos(l => (l ?? []).filter(x => x.id !== c.id));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível excluir o caderno."));
    }
  };

  /** O arquivo (PDF, imagem, Word, planilha, texto) vira um caderno novo; a página em branco do começo sai. */
  const importar = async (arquivo: File) => {
    setImportando(`Lendo ${arquivo.name}…`);
    setErro(null);
    let criado: Caderno | null = null;
    try {
      criado = await servico.criar(tituloDoPdf(arquivo.name), CORES_CAPA[6], "BRANCO");
      const branca = criado.paginas?.[0]?.id;
      await importarArquivo(criado.id, arquivo, undefined, (feitas, total) => setImportando(`Importando página ${feitas} de ${total}…`));
      if (branca) await servico.excluirPagina(branca);
      await carregar();
      setAberto(criado.id);
    } catch (e) {
      if (criado) await servico.excluir(criado.id).catch(() => undefined);
      setErro(mensagem(e, "Não foi possível abrir o arquivo."));
    } finally {
      setImportando(null);
    }
  };

  if (aberto !== null) {
    return (
      <div>
        <EditorCaderno id={aberto} onVoltar={() => { setAberto(null); void carregar(); }}
          onAlterado={c => setCadernos(l => (l ?? []).map(x => (x.id === c.id ? { ...x, ...c, paginas: undefined } : x)))} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina icone={NotebookPen} titulo="Bloco de notas" subtitulo="Escreva à mão, marque PDFs e exporte em PDF"
        acoes={<>
          <button type="button" onClick={() => arquivoPdf.current?.click()} disabled={importando !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Abrir arquivo
          </button>
          <button type="button" onClick={() => setModal("novo")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Novo caderno
          </button>
        </>} />

      <div className="relative mb-4 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input aria-label="Buscar caderno" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar caderno"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>

      {importando && <p role="status" className="mb-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{importando}</p>}
      {erro && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro} <button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar de novo</button>
        </div>
      )}

      {!cadernos ? (
        !erro && <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
      ) : visiveis.length === 0 ? (
        <div className="animate-surgir rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          {cadernos.length === 0 ? <>Nenhum caderno ainda. <button type="button" onClick={() => setModal("novo")} className="font-bold text-blue-600">Criar o primeiro</button> ou abra um arquivo (PDF, imagem, Word, planilha) para anotar.</> : "Nenhum caderno com esse nome."}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Cadernos">
          {visiveis.map(c => (
            <li key={c.id} className="group relative">
              <button type="button" onClick={() => setAberto(c.id)} className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="relative flex aspect-[3/4] w-full items-end p-3" style={{ background: c.cdCor }}>
                  <span className="absolute inset-y-0 left-3 w-1.5 bg-black/15" aria-hidden="true" />
                  <NotebookPen className="absolute right-3 top-3 h-6 w-6 text-white/70" aria-hidden="true" />
                  <span className="line-clamp-3 pl-4 text-base font-bold leading-tight text-white drop-shadow">{c.nmTitulo}</span>
                </span>
                <span className="px-3 py-2 text-[11px] text-slate-500">{c.qtPaginas} página(s) · {quando(c.dhAlteracao)}</span>
              </button>
              <div className="absolute right-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button type="button" onClick={() => setModal(c)} aria-label={`Editar ${c.nmTitulo}`} title="Renomear ou trocar a cor" className="rounded-lg bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => void excluir(c)} aria-label={`Excluir ${c.nmTitulo}`} title="Excluir" className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow hover:bg-white"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-[11px] text-slate-400">Seus cadernos são só seus. Tudo é salvo sozinho enquanto você escreve.</p>

      {modal && <CadernoModal caderno={modal === "novo" ? null : modal} onSalvar={salvar} onFechar={() => setModal(null)} />}
      <input ref={arquivoPdf} type="file" accept={ACEITA_ARQUIVOS} className="hidden" onChange={e => { const a = e.target.files?.[0]; e.target.value = ""; if (a) void importar(a); }} />
    </div>
  );
}
