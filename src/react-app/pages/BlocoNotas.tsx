import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeftRight, FileText, FileUp, ImageIcon, Loader2, NotebookPen, Pencil, Search, Sheet, Trash2, type LucideIcon } from "lucide-react";

import EditorCaderno from "@/react-app/components/bloco/EditorCaderno";
import EditorDocumentoAvulso from "@/react-app/components/bloco/EditorDocumentoAvulso";
import { sanitizarHtml } from "@/react-app/components/bloco/documento";
import { ACEITA_ARQUIVOS, importarArquivo } from "@/react-app/components/bloco/arquivosBloco";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { arquivosBlocoService, blocoNotasService as servico, type ArquivoBloco, type Caderno, type TipoArquivoBloco } from "@/react-app/services/BlocoNotasService";
import { CORES_CAPA, ROTULO_FUNDO, tipoDoArquivo, tituloDoPdf, type Fundo } from "@/react-app/utils/blocoNotas";
import { itensDoBloco, type FiltroBloco, type ItemBloco } from "@/react-app/utils/centralBloco";

// A planilha (Fortune-sheet) é grande: só carrega quando uma planilha é aberta.
const EditorPlanilha = lazy(() => import("@/react-app/components/bloco/planilha/EditorPlanilha"));

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

function RenomearModal({ item, onSalvar, onFechar }: { item: ItemBloco; onSalvar: (t: string) => Promise<string | null>; onFechar: () => void }) {
  const [titulo, setTitulo] = useState(item.titulo);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  return (
    <ModalBase titulo="Renomear" onFechar={onFechar}>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault();
        if (!titulo.trim()) return setErro("Dê um nome.");
        setSalvando(true);
        const m = await onSalvar(titulo.trim());
        setSalvando(false);
        if (m) setErro(m);
      }}>
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Nome"><input autoFocus value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)} className={classeInput} /></Campo>
        <button type="submit" disabled={salvando} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </button>
      </form>
    </ModalBase>
  );
}

/** Botão grande do "Criar" da central. */
function Atalho({ icone: Icone, titulo, texto, cor, onClick, desligado, rotulo }: {
  icone: LucideIcon; titulo: string; texto: string; cor: string; onClick?: () => void; desligado?: boolean; rotulo?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={desligado} aria-label={rotulo ?? titulo}
      className="group flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:gap-3 sm:p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white sm:h-10 sm:w-10" style={{ background: cor }}><Icone className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-800">{titulo}</span>
        <span className="block text-[11px] leading-snug text-slate-500">{texto}</span>
      </span>
    </button>
  );
}

const FILTROS: { valor: FiltroBloco; rotulo: string }[] = [
  { valor: "TODOS", rotulo: "Tudo" }, { valor: "CADERNO", rotulo: "Cadernos" }, { valor: "PLANILHA", rotulo: "Planilhas" }, { valor: "DOCUMENTO", rotulo: "Documentos" },
];
const ICONE: Record<ItemBloco["tipo"], LucideIcon> = { CADERNO: NotebookPen, PLANILHA: Sheet, DOCUMENTO: FileText };
const NOME_TIPO: Record<ItemBloco["tipo"], string> = { CADERNO: "Caderno", PLANILHA: "Planilha", DOCUMENTO: "Documento" };
const CHAVE_FILTRO = "@NordTool:bloco-notas:filtro";

type Aberto = { tipo: ItemBloco["tipo"]; id: number } | null;

/**
 * Bloco de notas (v3): a central dos arquivos da pessoa. Em "Criar" ficam caderno (à mão, PDF), planilha (estilo Google
 * Sheets), documento (estilo Word), abrir arquivo e converter; embaixo, tudo o que ela tem, com filtro e busca.
 */
export default function BlocoNotasPage() {
  const [cadernos, setCadernos] = useState<Caderno[] | null>(null);
  const [arquivos, setArquivos] = useState<ArquivoBloco[] | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);
  const [modal, setModal] = useState<"novo" | Caderno | null>(null);
  const [renomeando, setRenomeando] = useState<ItemBloco | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroBloco>(() => {
    try { const f = localStorage.getItem(CHAVE_FILTRO); return FILTROS.some(x => x.valor === f) ? f as FiltroBloco : "TODOS"; } catch { return "TODOS"; }
  });
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState<string | null>(null);
  const arquivoPdf = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [c, a] = await Promise.all([servico.cadernos(), arquivosBlocoService.listar()]);
      setCadernos(c); setArquivos(a);
    } catch (e) { setErro(mensagem(e, "Não foi possível carregar o bloco de notas.")); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const escolherFiltro = (f: FiltroBloco) => { setFiltro(f); try { localStorage.setItem(CHAVE_FILTRO, f); } catch { /* sem armazenamento */ } };
  const itens = useMemo(() => itensDoBloco(cadernos ?? [], arquivos ?? [], filtro, busca), [cadernos, arquivos, filtro, busca]);
  const total = (cadernos?.length ?? 0) + (arquivos?.length ?? 0);

  const salvar = async (titulo: string, cor: string, papel: Papel): Promise<string | null> => {
    try {
      if (modal && modal !== "novo") {
        const c = await servico.alterar(modal.id, titulo, cor, modal.nrVersao);
        setCadernos(l => (l ?? []).map(x => (x.id === c.id ? { ...x, ...c } : x)));
      } else {
        const c = await servico.criar(titulo, cor, papel);
        setCadernos(l => [c, ...(l ?? [])]);
        setAberto({ tipo: "CADERNO", id: c.id });
      }
      setModal(null);
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível salvar o caderno.");
    }
  };

  const novoArquivo = async (tipo: TipoArquivoBloco, titulo?: string, conteudo?: string) => {
    setErro(null);
    try {
      const a = await arquivosBlocoService.criar(tipo, titulo ?? (tipo === "PLANILHA" ? "Planilha sem título" : "Documento sem título"), conteudo);
      setArquivos(l => [a, ...(l ?? [])]);
      setAberto({ tipo, id: a.id });
    } catch (e) {
      setErro(mensagem(e, "Não foi possível criar."));
    }
  };

  const excluir = async (item: ItemBloco) => {
    const oQue = item.tipo === "CADERNO" ? "o caderno" : item.tipo === "PLANILHA" ? "a planilha" : "o documento";
    if (!window.confirm(`Excluir ${oQue} “${item.titulo}”${item.tipo === "CADERNO" ? " com todas as páginas" : ""}? Não dá para desfazer.`)) return;
    try {
      if (item.tipo === "CADERNO") {
        await servico.excluir(item.id);
        setCadernos(l => (l ?? []).filter(x => x.id !== item.id));
      } else {
        await arquivosBlocoService.excluir(item.id);
        setArquivos(l => (l ?? []).filter(x => x.id !== item.id));
      }
    } catch (e) {
      setErro(mensagem(e, "Não foi possível excluir."));
    }
  };

  const renomear = async (titulo: string): Promise<string | null> => {
    const item = renomeando;
    if (!item) return null;
    try {
      if (item.tipo === "CADERNO") {
        const c = (cadernos ?? []).find(x => x.id === item.id);
        if (!c) return null;
        const r = await servico.alterar(c.id, titulo, c.cdCor, c.nrVersao);
        setCadernos(l => (l ?? []).map(x => (x.id === r.id ? { ...x, ...r } : x)));
      } else {
        const a = (arquivos ?? []).find(x => x.id === item.id);
        if (!a) return null;
        const r = await arquivosBlocoService.salvar(a.id, a.nrVersao, { nmTitulo: titulo });
        setArquivos(l => (l ?? []).map(x => (x.id === r.id ? { ...x, ...r } : x)));
      }
      setRenomeando(null);
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível renomear.");
    }
  };

  /**
   * "Abrir arquivo": planilha (Excel, CSV) vira planilha; Word (.docx) vira documento; PDF, imagem e texto viram um
   * caderno para anotar por cima.
   */
  const importar = async (arquivo: File) => {
    const tipo = tipoDoArquivo(arquivo.name, arquivo.type);
    setImportando(`Lendo ${arquivo.name}…`);
    setErro(null);
    let criado: Caderno | null = null;
    try {
      if (tipo === "planilha") {
        const [XLSX, { xlsxParaAbas, abasParaSalvar }] = await Promise.all([import("xlsx"), import("@/react-app/utils/planilha")]);
        const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellFormula: true, cellStyles: true, cellDates: false });
        await novoArquivo("PLANILHA", tituloDoPdf(arquivo.name), JSON.stringify(abasParaSalvar(xlsxParaAbas(wb))));
        return;
      }
      if (tipo === "word") {
        const mammoth = await import("mammoth");
        const r = await mammoth.convertToHtml({ arrayBuffer: await arquivo.arrayBuffer() });
        await novoArquivo("DOCUMENTO", tituloDoPdf(arquivo.name), sanitizarHtml(r.value, true));
        return;
      }
      criado = await servico.criar(tituloDoPdf(arquivo.name), CORES_CAPA[6], "BRANCO");
      const branca = criado.paginas?.[0]?.id;
      await importarArquivo(criado.id, arquivo, undefined, (feitas, total) => setImportando(`Importando página ${feitas} de ${total}…`));
      if (branca) await servico.excluirPagina(branca);
      await carregar();
      setAberto({ tipo: "CADERNO", id: criado.id });
    } catch (e) {
      if (criado) await servico.excluir(criado.id).catch(() => undefined);
      setErro(mensagem(e, "Não foi possível abrir o arquivo."));
    } finally {
      setImportando(null);
    }
  };

  const atualizarArquivo = useCallback((a: ArquivoBloco) => setArquivos(l => (l ?? []).map(x => (x.id === a.id ? { ...x, ...a, conteudo: undefined } : x))), []);
  const voltar = () => { setAberto(null); void carregar(); };

  if (aberto?.tipo === "CADERNO") {
    return (
      <div>
        <EditorCaderno id={aberto.id} onVoltar={voltar}
          onAlterado={c => setCadernos(l => (l ?? []).map(x => (x.id === c.id ? { ...x, ...c, paginas: undefined } : x)))} />
      </div>
    );
  }
  if (aberto?.tipo === "PLANILHA") {
    return (
      <Suspense fallback={<div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo a planilha…</div>}>
        <EditorPlanilha id={aberto.id} onVoltar={voltar} onAlterado={atualizarArquivo} />
      </Suspense>
    );
  }
  if (aberto?.tipo === "DOCUMENTO") return <EditorDocumentoAvulso id={aberto.id} onVoltar={voltar} onAlterado={atualizarArquivo} />;

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina icone={NotebookPen} titulo="Bloco de notas" subtitulo="Cadernos, planilhas e documentos num lugar só" />

      <section aria-label="Criar" className="mb-6">
        <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Criar</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          <Atalho icone={NotebookPen} titulo="Caderno" texto="Escreva à mão e anote PDFs" cor="#2563eb" rotulo="Novo caderno" onClick={() => setModal("novo")} />
          <Atalho icone={Sheet} titulo="Planilha" texto="Tabelas com fórmulas, como no Google Sheets" cor="#16a34a" rotulo="Nova planilha" onClick={() => void novoArquivo("PLANILHA")} />
          <Atalho icone={FileText} titulo="Documento" texto="Texto formatado, como no Word" cor="#1d4ed8" rotulo="Novo documento" onClick={() => void novoArquivo("DOCUMENTO")} />
          <Atalho icone={FileUp} titulo="Abrir arquivo" texto="PDF, imagem, Word, Excel, CSV ou texto" cor="#475569" rotulo="Abrir arquivo"
            desligado={importando !== null} onClick={() => arquivoPdf.current?.click()} />
          <Atalho icone={ArrowLeftRight} titulo="Converter" texto="Em breve: juntar, dividir e converter PDFs" cor="#ea580c" rotulo="Converter arquivo (em breve)" desligado />
          <Atalho icone={ImageIcon} titulo="Editar imagem" texto="Em breve: editor de imagens" cor="#9333ea" rotulo="Editar imagem (em breve)" desligado />
        </div>
      </section>

      {importando && <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800"><Loader2 className="h-4 w-4 animate-spin" />{importando}</p>}
      {erro && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro} <button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar de novo</button>
        </div>
      )}

      <section aria-label="Meus arquivos">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Meus arquivos</h2>
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Mostrar">
            {FILTROS.map(f => (
              <button key={f.valor} type="button" role="radio" aria-checked={filtro === f.valor} onClick={() => escolherFiltro(f.valor)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${filtro === f.valor ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{f.rotulo}</button>
            ))}
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input aria-label="Buscar no bloco de notas" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pelo nome"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>

        {!cadernos || !arquivos ? (
          !erro && <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
        ) : itens.length === 0 ? (
          <div className="animate-surgir rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            {total === 0 ? "Nada aqui ainda. Comece criando um caderno, uma planilha ou um documento, ou abra um arquivo." : busca.trim() ? "Nada com esse nome." : "Nada deste tipo ainda."}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Arquivos">
            {itens.map(item => {
              const Icone = ICONE[item.tipo];
              return (
                <li key={`${item.tipo}-${item.id}`} className="group relative">
                  <button type="button" onClick={() => setAberto({ tipo: item.tipo, id: item.id })} aria-label={`Abrir ${NOME_TIPO[item.tipo].toLowerCase()} ${item.titulo}`}
                    className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    {item.tipo === "CADERNO" ? (
                      <span className="relative flex aspect-[3/4] w-full items-end p-3" style={{ background: item.cor }}>
                        <span className="absolute inset-y-0 left-3 w-1.5 bg-black/15" aria-hidden="true" />
                        <Icone className="absolute right-3 top-3 h-6 w-6 text-white/70" aria-hidden="true" />
                        <span className="line-clamp-3 pl-4 text-base font-bold leading-tight text-white drop-shadow">{item.titulo}</span>
                      </span>
                    ) : (
                      <span className={`relative flex aspect-[3/4] w-full flex-col justify-end p-3 ${item.tipo === "PLANILHA" ? "bg-emerald-50" : "bg-slate-50"}`}>
                        <span aria-hidden="true" className="absolute inset-x-4 top-4 bottom-16 rounded-md border border-slate-200 bg-white"
                          style={item.tipo === "PLANILHA"
                            ? { backgroundImage: "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)", backgroundSize: "28px 14px" }
                            : { backgroundImage: "repeating-linear-gradient(transparent 0 10px, #e2e8f0 10px 11px)", backgroundPosition: "0 8px", backgroundClip: "content-box", padding: "8px 10px" }} />
                        <span className="relative flex items-center gap-1.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white" style={{ background: item.cor }}><Icone className="h-3.5 w-3.5" /></span>
                          <span className="line-clamp-2 text-sm font-bold leading-tight text-slate-800">{item.titulo}</span>
                        </span>
                      </span>
                    )}
                    <span className="px-3 py-2 text-[11px] text-slate-500">{NOME_TIPO[item.tipo]}{item.detalhe ? ` · ${item.detalhe}` : ""} · {quando(item.alteracao)}</span>
                  </button>
                  <div className="absolute right-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button type="button" onClick={() => (item.tipo === "CADERNO" ? setModal((cadernos ?? []).find(c => c.id === item.id) ?? null) : setRenomeando(item))}
                      aria-label={`Renomear ${item.titulo}`} title="Renomear" className="rounded-lg bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void excluir(item)} aria-label={`Excluir ${item.titulo}`} title="Excluir" className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow hover:bg-white"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 text-center text-[11px] text-slate-400">Tudo aqui é só seu e é salvo sozinho enquanto você trabalha. Dúvidas? Toque no “?” no alto da tela.</p>

      {modal && <CadernoModal caderno={modal === "novo" ? null : modal} onSalvar={salvar} onFechar={() => setModal(null)} />}
      {renomeando && <RenomearModal item={renomeando} onSalvar={renomear} onFechar={() => setRenomeando(null)} />}
      <input ref={arquivoPdf} type="file" accept={ACEITA_ARQUIVOS} className="hidden" aria-label="Arquivo para abrir"
        onChange={e => { const a = e.target.files?.[0]; e.target.value = ""; if (a) void importar(a); }} />
    </div>
  );
}
