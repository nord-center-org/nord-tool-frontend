import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, ImageIcon, Loader2, Palette, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { casamentoService, type CasamentoArte } from "@/react-app/services/CasamentoService";
import { CATEGORIAS_ARTE, filtrarArtes, nomeDaCategoria, problemaDaArte, tituloDoArquivo } from "@/react-app/utils/casamentoArtes";
import ModalBase from "./ModalBase";

const PreviaPdf = lazy(() => import("@/react-app/components/ui/PreviaPdf"));

const ehPdf = (a: CasamentoArte) => a.nmContentType === "application/pdf";

/** Arquivos já baixados nesta tela (miniatura e visualizador usam o mesmo). */
const cache = new Map<string, Promise<Blob>>();
function arquivoDa(a: CasamentoArte): Promise<Blob> {
  const chave = `${a.idArte}:${a.nrVersao}`;
  let p = cache.get(chave);
  if (!p) {
    p = casamentoService.baixarArte(a.idArte);
    p.catch(() => cache.delete(chave));
    cache.set(chave, p);
  }
  return p;
}

/** Primeira página do PDF como imagem pequena (para o card). */
async function miniaturaDoPdf(blob: Blob): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const pg = await doc.getPage(1);
    const base = pg.getViewport({ scale: 1 });
    const viewport = pg.getViewport({ scale: 480 / base.width });
    const c = document.createElement("canvas");
    c.width = Math.floor(viewport.width);
    c.height = Math.floor(viewport.height);
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    await pg.render({ canvasContext: ctx, canvas: c, viewport }).promise;
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    void doc.destroy();
  }
}

/** Miniatura do card: só busca o arquivo quando o card aparece na tela. */
function Miniatura({ arte }: { arte: CasamentoArte }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisivel(true); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); obs.disconnect(); } }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    let vivo = true;
    let url: string | null = null;
    arquivoDa(arte)
      .then(async blob => {
        if (ehPdf(arte)) return miniaturaDoPdf(blob);
        url = URL.createObjectURL(blob);
        return url;
      })
      .then(s => { if (vivo) setSrc(s); })
      .catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [visivel, arte]);

  return (
    <div ref={caixa} className="relative grid aspect-[4/5] place-items-center overflow-hidden bg-gradient-to-br from-rose-50 to-amber-50">
      {src ? <img src={src} alt="" className="h-full w-full object-contain" />
        : falhou ? (ehPdf(arte) ? <FileText className="h-10 w-10 text-rose-300" /> : <ImageIcon className="h-10 w-10 text-rose-300" />)
          : <Loader2 className="h-6 w-6 animate-spin text-rose-300" />}
      {ehPdf(arte) && <span className="absolute left-2 top-2 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white">PDF</span>}
    </div>
  );
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Visualizador: imagem em tela cheia ou o PDF página a página, sem baixar. */
function Visualizador({ arte, onFechar }: { arte: CasamentoArte; onFechar: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    let u: string | null = null;
    arquivoDa(arte).then(async b => {
      if (!vivo) return;
      setBlob(b);
      if (ehPdf(arte)) setBytes(new Uint8Array(await b.arrayBuffer()));
      else { u = URL.createObjectURL(b); setUrl(u); }
    }).catch(() => { if (vivo) setErro("Não deu para abrir a arte. Tente de novo."); });
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [arte]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  if (ehPdf(arte) && bytes) {
    return (
      <Suspense fallback={null}>
        <PreviaPdf bytes={bytes} titulo={arte.nmTitulo} onBaixar={() => blob && baixar(blob, arte.nmArquivo)} onFechar={onFechar} />
      </Suspense>
    );
  }
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={arte.nmTitulo}
      onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="flex items-center gap-2 p-3 text-white">
        <p className="min-w-0 flex-1 truncate font-bold">{arte.nmTitulo}</p>
        {blob && <button type="button" onClick={() => baixar(blob, arte.nmArquivo)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold hover:bg-white/20"><Download className="h-4 w-4" />Baixar</button>}
        <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-3" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
        {erro ? <p className="text-sm text-red-300">{erro}</p>
          : url ? <img src={url} alt={arte.nmTitulo} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
            : <Loader2 className="h-8 w-8 animate-spin text-white/60" />}
      </div>
    </div>
  );
}

function EditarArte({ arte, onFechar, onSalvo }: { arte: CasamentoArte; onFechar: () => void; onSalvo: () => void }) {
  const [titulo, setTitulo] = useState(arte.nmTitulo);
  const [categoria, setCategoria] = useState(arte.cdCategoria);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    try { await casamentoService.alterarArte(arte.idArte, titulo.trim(), categoria); onSalvo(); onFechar(); } catch (e) { setErro(e instanceof Error ? e.message : "Não deu para salvar."); } finally { setSalvando(false); }
  };
  return (
    <ModalBase titulo="Editar arte" onFechar={onFechar}>
      <label className="mb-3 block text-sm font-bold text-slate-700">Título
        <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={150} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" />
      </label>
      <label className="mb-3 block text-sm font-bold text-slate-700">Categoria
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal">
          {CATEGORIAS_ARTE.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      {erro && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <button type="button" disabled={salvando || !titulo.trim()} onClick={() => void salvar()} className="w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50">
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </ModalBase>
  );
}

/**
 * Casamento → Artes: guarda as artes do casamento (convite, save the date, cardápio, papelaria…) em PDF ou imagem,
 * com miniatura de cada uma, para ver em tela cheia, baixar, renomear e organizar por categoria.
 */
export default function ArtesTab() {
  const [artes, setArtes] = useState<CasamentoArte[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string>("TODAS");
  const [busca, setBusca] = useState("");
  const [categoriaEnvio, setCategoriaEnvio] = useState("CONVITE");
  const [enviando, setEnviando] = useState<{ feitos: number; total: number } | null>(null);
  const [aberta, setAberta] = useState<CasamentoArte | null>(null);
  const [editando, setEditando] = useState<CasamentoArte | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => {
    casamentoService.listarArtes().then(a => { setArtes(a); setErro(null); }).catch(e => setErro(e instanceof Error ? e.message : "Não deu para carregar as artes."));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async (arquivos: File[]) => {
    if (!arquivos.length) return;
    const problemas = arquivos.map(problemaDaArte).filter((p): p is string => !!p);
    const validos = arquivos.filter(a => !problemaDaArte(a));
    setErro(problemas.length ? problemas.join(" ") : null);
    if (!validos.length) return;
    setEnviando({ feitos: 0, total: validos.length });
    for (let i = 0; i < validos.length; i++) {
      try {
        await casamentoService.enviarArte(validos[i], tituloDoArquivo(validos[i].name), categoriaEnvio);
      } catch (e) {
        setErro(`"${validos[i].name}": ${e instanceof Error ? e.message : "não deu para enviar."}`);
      }
      setEnviando({ feitos: i + 1, total: validos.length });
    }
    setEnviando(null);
    carregar();
  };

  const excluir = async (a: CasamentoArte) => {
    if (!window.confirm(`Excluir "${a.nmTitulo}"? O arquivo sai do NordTool.`)) return;
    try { await casamentoService.excluirArte(a.idArte); carregar(); } catch (e) { setErro(e instanceof Error ? e.message : "Não deu para excluir."); }
  };

  const lista = useMemo(() => filtrarArtes(artes ?? [], categoria, busca), [artes, categoria, busca]);
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of artes ?? []) m.set(a.cdCategoria, (m.get(a.cdCategoria) ?? 0) + 1);
    return m;
  }, [artes]);

  return (
    <section className="space-y-4" aria-label="Artes do casamento">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-rose-400 to-amber-400 text-white"><Palette className="h-5 w-5" /></span>
        <div className="mr-auto">
          <h2 className="text-lg font-black text-slate-800">Artes do casamento</h2>
          <p className="text-xs text-slate-500">Convite, save the date, cardápio e papelaria em PDF ou imagem (até 15 MB cada).</p>
        </div>
        <label className="text-xs font-bold text-slate-600">Enviar como
          <select value={categoriaEnvio} onChange={e => setCategoriaEnvio(e.target.value)} aria-label="Categoria das artes enviadas"
            className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal">
            {CATEGORIAS_ARTE.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <input ref={entrada} type="file" multiple accept="application/pdf,image/jpeg,image/png" className="hidden" aria-label="Artes para enviar"
          onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void enviar(f); }} />
        <button type="button" disabled={!!enviando} onClick={() => entrada.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-60">
          {enviando ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando {enviando.feitos}/{enviando.total}</> : <><Upload className="h-4 w-4" />Enviar artes</>}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[{ id: "TODAS", nome: "Todas" }, ...CATEGORIAS_ARTE].map(c => {
          const n = c.id === "TODAS" ? artes?.length ?? 0 : contagem.get(c.id) ?? 0;
          if (c.id !== "TODAS" && n === 0) return null;
          return (
            <button key={c.id} type="button" aria-pressed={categoria === c.id} onClick={() => setCategoria(c.id)}
              className={`rounded-full px-3 py-1 text-sm font-bold ${categoria === c.id ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}>
              {c.nome} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar arte" aria-label="Buscar arte" className="w-40 text-sm outline-none" />
        </label>
      </div>

      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {artes === null && !erro ? (
        <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
      ) : artes && artes.length === 0 ? (
        <button type="button" onClick={() => entrada.current?.click()}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void enviar(Array.from(e.dataTransfer.files)); }}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-rose-200 bg-white p-10 text-center hover:bg-rose-50/40">
          <Palette className="h-10 w-10 text-rose-300" />
          <span className="font-bold text-slate-700">Guarde aqui as artes do casamento</span>
          <span className="max-w-md text-sm text-slate-500">Convite, save the date, cardápio, tags… Toque para escolher ou arraste os arquivos (PDF, JPEG ou PNG).</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void enviar(Array.from(e.dataTransfer.files)); }}>
          {lista.map(a => (
            <li key={a.idArte} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => setAberta(a)} aria-label={`Abrir ${a.nmTitulo}`} className="block w-full">
                <Miniatura arte={a} />
              </button>
              <div className="flex items-start gap-1 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800" title={a.nmTitulo}>{a.nmTitulo}</p>
                  <p className="truncate text-[11px] text-slate-500">{nomeDaCategoria(a.cdCategoria)}{a.nmCriador ? ` · ${a.nmCriador.split(" ")[0]}` : ""}</p>
                </div>
                <button type="button" onClick={() => setEditando(a)} aria-label={`Editar ${a.nmTitulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => void excluir(a)} aria-label={`Excluir ${a.nmTitulo}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
          {lista.length === 0 && <li className="col-span-full p-6 text-center text-sm text-slate-500">Nenhuma arte com esse filtro.</li>}
        </ul>
      )}

      {aberta && <Visualizador arte={aberta} onFechar={() => setAberta(null)} />}
      {editando && <EditarArte arte={editando} onFechar={() => setEditando(null)} onSalvo={carregar} />}
    </section>
  );
}
