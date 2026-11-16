import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Camera, CheckCircle2, Download, ImagePlus, LifeBuoy, Loader2, Pencil, Send, Trash2, X } from "lucide-react";

import EditorFoto from "@/react-app/components/relatorio/EditorFoto";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { useAuth } from "@/react-app/hooks/useAuth";
import { useCapturaLugia } from "@/react-app/hooks/useCapturaLugia";
import { useNovidadesSac } from "@/react-app/hooks/useNovidadesSac";
import { sacService, type Chamado } from "@/react-app/services/SacService";
import {
  MAX_DESCRICAO, MAX_PRINTS, MAX_TITULO, STATUS_CHAMADO, classeStatus, nomePdfChamados, separarConcluidos,
  pendentes, problemaDoRascunho, rotuloStatus, type StatusChamado,
} from "@/react-app/utils/sac";
import { podeAcessar } from "@/react-app/utils/sessao";

import { rascunhoSac as rascunho, type PrintLocal } from "@/react-app/components/sac/rascunhoSac";
import { base64ParaBlob, caber } from "@/react-app/components/sac/imagensSac";

const chave = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;


/** v4: baixa os chamados escolhidos num PDF (texto à esquerda, prints ao lado). */
async function exportarChamados(lista: Chamado[]): Promise<void> {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
  const { gerarPdfChamados } = await import("@/react-app/components/sac/pdfChamados");
  const bytes = await gerarPdfChamados(lista, local);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomePdfChamados(local.slice(0, 10));
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Miniatura de um print já enviado (busca com o token; clique amplia). */
function ImagemChamado({ id, onAbrir }: { id: number; onAbrir: (id: number) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    let u: string | null = null;
    sacService.imagem(id).then(b => { if (!vivo) return; u = URL.createObjectURL(b); setUrl(u); }).catch(() => undefined);
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return (
    <button type="button" onClick={() => onAbrir(id)} className="h-20 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-blue-400" aria-label="Ver o print">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Loader2 className="m-auto h-4 w-4 animate-spin text-slate-400" />}
    </button>
  );
}

function CartaoChamado({ c, admin, onAtualizar, onExcluir, onAbrirImagem, selecionado, onSelecionar, novo, destaque }: {
  c: Chamado; admin: boolean; onAtualizar: (c: Chamado) => void; onExcluir: (c: Chamado) => void; onAbrirImagem: (id: number) => void;
  selecionado: boolean; onSelecionar: (sim: boolean) => void; novo: boolean; destaque: boolean;
}) {
  const [status, setStatus] = useState<StatusChamado>(c.cdStatus);
  const [resposta, setResposta] = useState(c.txResposta ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudou = status !== c.cdStatus || resposta.trim() !== (c.txResposta ?? "");
  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try { onAtualizar(await sacService.responder(c.id, status, resposta.trim() || null)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSalvando(false); }
  };
  return (
    <article id={`chamado-${c.id}`} className={`rounded-2xl border bg-white p-4 shadow-sm ${destaque ? "border-blue-400 ring-2 ring-blue-200" : selecionado ? "border-blue-300" : "border-slate-200"}`}>
      <header className="flex flex-wrap items-start gap-2">
        <input type="checkbox" checked={selecionado} onChange={e => onSelecionar(e.target.checked)} aria-label={`Selecionar o chamado #${c.id} para exportar`}
          className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900">{c.nmTitulo}</h3>
          <p className="text-xs text-slate-500">
            #{c.id} · {dataHora(c.dhCriacao)}{admin ? ` · ${c.nmUsuario}` : ""}{c.txTela ? ` · tela ${c.txTela}` : ""}
          </p>
        </div>
        {novo && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">Novidade</span>}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${classeStatus(c.cdStatus)}`}>{rotuloStatus(c.cdStatus)}</span>
      </header>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{c.txDescricao}</p>
      {c.imagens.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">{c.imagens.map(id => <ImagemChamado key={id} id={id} onAbrir={onAbrirImagem} />)}</div>
      )}
      {!admin && c.txResposta && (
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Resposta{c.nmUsuarioResposta ? ` de ${c.nmUsuarioResposta}` : ""}</p>
          <p className="whitespace-pre-wrap">{c.txResposta}</p>
        </div>
      )}
      {admin && (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-slate-600" htmlFor={`st-${c.id}`}>Status</label>
            <select id={`st-${c.id}`} value={status} onChange={e => setStatus(e.target.value as StatusChamado)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">
              {STATUS_CHAMADO.map(s => <option key={s.status} value={s.status}>{s.rotulo}</option>)}
            </select>
            {c.nmUsuarioResposta && <span className="text-xs text-slate-500">última resposta: {c.nmUsuarioResposta}</span>}
          </div>
          <label className="block text-xs font-bold text-slate-600" htmlFor={`rp-${c.id}`}>Resposta para quem abriu</label>
          <textarea id={`rp-${c.id}`} value={resposta} maxLength={MAX_DESCRICAO} rows={2} onChange={e => setResposta(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Ex.: feito na versão de hoje" />
          {erro && <p role="alert" className="text-xs font-semibold text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onExcluir(c)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">Excluir</button>
            <button type="button" onClick={salvar} disabled={!mudou || salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar resposta
            </button>
          </div>
        </div>
      )}
      {!admin && c.cdStatus === "ABERTO" && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => onExcluir(c)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
    </article>
  );
}

/**
 * SAC do NordTool: a pessoa escreve o que precisa mudar no sistema, tira prints de qualquer tela (a mesma ferramenta
 * de captura da Lugia), marca com seta, círculo e rabisco (o editor do relatório fotográfico) e envia para os
 * administradores, que respondem e mudam o status.
 */
export default function Sac() {
  const { usuario } = useAuth();
  const captura = useCapturaLugia();
  const { prints: fila, consumirPrints } = captura;
  const admin = podeAcessar(usuario?.permissoes, "SAC", "ADMIN");
  const novidades = useNovidadesSac();
  const [busca] = useSearchParams();
  const doAviso = Number(busca.get("chamado")) || null;
  const [aba, setAba] = useState<"novo" | "meus" | "todos" | "concluidos">(doAviso ? "meus" : "novo");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [exportando, setExportando] = useState(false);
  /** Chamados que tinham novidade quando a pessoa abriu a lista (o selo fica até sair da tela). */
  const [novosVistos, setNovosVistos] = useState<Set<number>>(new Set());
  const [titulo, setTitulo] = useState(rascunho.titulo);
  const [descricao, setDescricao] = useState(rascunho.descricao);
  const [prints, setPrints] = useState<PrintLocal[]>(rascunho.prints);
  const [editando, setEditando] = useState<PrintLocal | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [meus, setMeus] = useState<Chamado[] | null>(null);
  const [todos, setTodos] = useState<Chamado[] | null>(null);
  const [ampliada, setAmpliada] = useState<number | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => { rascunho.titulo = titulo; rascunho.descricao = descricao; rascunho.prints = prints; }, [titulo, descricao, prints]);

  // Prints tirados em outras telas voltam para cá.
  useEffect(() => {
    const novos = consumirPrints("/sac");
    if (!novos.length) return;
    setAba("novo");
    setPrints(atuais => {
      const cabem = Math.max(0, MAX_PRINTS - atuais.length);
      if (novos.length > cabem) setErro(`No máximo ${MAX_PRINTS} imagens por chamado.`);
      return [...atuais, ...novos.slice(0, cabem).map(p => {
        const blob = base64ParaBlob(p.base64, p.mime);
        return { chave: chave(), nome: p.nome, blob, url: URL.createObjectURL(blob), tela: p.tela };
      })];
    });
  }, [fila, consumirPrints]);

  const carregar = useCallback(async () => {
    try {
      setMeus(await sacService.listar(false));
      if (admin) setTodos(await sacService.listar(true));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os chamados.");
    }
  }, [admin]);
  useEffect(() => { void carregar(); }, [carregar]);

  const adicionarArquivos = (lista: FileList | null) => {
    if (!lista) return;
    const imagens = [...lista].filter(f => /^image\/(png|jpe?g)$/.test(f.type));
    if (imagens.length < lista.length) setErro("Use imagens PNG ou JPEG.");
    setPrints(atuais => [...atuais, ...imagens.slice(0, Math.max(0, MAX_PRINTS - atuais.length)).map(f => ({ chave: chave(), nome: f.name, blob: f as Blob, url: URL.createObjectURL(f), tela: null }))]);
  };

  const remover = (p: PrintLocal) => { URL.revokeObjectURL(p.url); setPrints(l => l.filter(x => x.chave !== p.chave)); };

  const problema = problemaDoRascunho({ titulo, descricao }, prints.length);

  const enviar = async () => {
    if (problema) { setErro(problema); return; }
    setEnviando(true);
    setErro(null);
    try {
      const imagens = await Promise.all(prints.map(async (p, i) => {
        const blob = await caber(p.blob);
        return { blob, nome: `print-${i + 1}.${blob.type === "image/png" ? "png" : "jpg"}` };
      }));
      const novo = await sacService.abrir({ nmTitulo: titulo.trim(), txDescricao: descricao.trim(), txTela: prints.find(p => p.tela)?.tela ?? null }, imagens);
      prints.forEach(p => URL.revokeObjectURL(p.url));
      setTitulo("");
      setDescricao("");
      setPrints([]);
      setMeus(l => [novo, ...(l ?? [])]);
      if (admin) setTodos(l => [novo, ...(l ?? [])]);
      setAviso(`Chamado #${novo.id} enviado para os administradores.`);
      setAba("meus");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o chamado.");
    } finally {
      setEnviando(false);
    }
  };

  const atualizar = (c: Chamado) => {
    setTodos(l => l?.map(x => (x.id === c.id ? c : x)) ?? null);
    setMeus(l => l?.map(x => (x.id === c.id ? c : x)) ?? null);
  };
  const excluir = async (c: Chamado) => {
    if (!window.confirm(`Excluir o chamado #${c.id} (“${c.nmTitulo}”)?`)) return;
    try {
      await sacService.excluir(c.id);
      setTodos(l => l?.filter(x => x.id !== c.id) ?? null);
      setMeus(l => l?.filter(x => x.id !== c.id) ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  };

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Abriu "Meus chamados": as novidades foram vistas (o selo "Novidade" continua até sair da tela).
  const { marcarVistos } = novidades;
  useEffect(() => {
    if ((aba !== "meus" && aba !== "concluidos") || !meus) return;
    const ids = meus.filter(c => c.inNovidade).map(c => c.id);
    if (!ids.length) return;
    setNovosVistos(atual => new Set([...atual, ...ids]));
    setMeus(l => l?.map(c => (ids.includes(c.id) ? { ...c, inNovidade: false } : c)) ?? null);
    void marcarVistos(ids);
  }, [aba, meus, marcarVistos]);

  // v5: o aviso de um chamado já concluído (resolvido ou recusado) abre "Concluídos", onde ele está
  const avisoTratado = useRef(false);
  useEffect(() => {
    if (!doAviso || !meus || avisoTratado.current) return;
    avisoTratado.current = true;
    const c = meus.find(x => x.id === doAviso);
    if (c && (c.cdStatus === "RESOLVIDO" || c.cdStatus === "RECUSADO")) setAba("concluidos");
  }, [doAviso, meus]);

  // Veio pelo aviso: rola até o chamado.
  useEffect(() => {
    if (!doAviso || (aba !== "meus" && aba !== "concluidos") || !meus) return;
    const t = window.setTimeout(() => document.getElementById(`chamado-${doAviso}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 200);
    return () => window.clearTimeout(t);
  }, [doAviso, aba, meus]);

  useEffect(() => { setSelecionados(new Set()); }, [aba]);

  const exportar = async () => {
    const escolhidos = lista.filter(c => selecionados.has(c.id));
    if (!escolhidos.length) return;
    setExportando(true);
    setErro(null);
    try {
      await exportarChamados(escolhidos);
      setAviso(`${escolhidos.length} chamado(s) exportado(s): o ZIP tem o chamados.md e a pasta imagens.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      setExportando(false);
    }
  };

  // v5: resolvidos e recusados saem da esteira e ficam em "Concluídos" (os de todos, para quem administra)
  const meusSeparados = useMemo(() => separarConcluidos(meus ?? []), [meus]);
  const todosSeparados = useMemo(() => separarConcluidos(todos ?? []), [todos]);
  const listaConcluidos = admin ? todosSeparados.concluidos : meusSeparados.concluidos;
  const lista = aba === "todos" ? todosSeparados.esteira : aba === "concluidos" ? listaConcluidos : meusSeparados.esteira;
  const carregada = aba === "todos" || (aba === "concluidos" && admin) ? todos : meus;
  const aba_ = (id: typeof aba, rotulo: string, n?: number) => (
    <button type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold ${aba === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
      {rotulo}{n ? <span className={`rounded-full px-1.5 text-xs ${aba === id ? "bg-white/20" : "bg-blue-100 text-blue-700"}`}>{n}</span> : null}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <CabecalhoPagina icone={LifeBuoy} titulo="SAC" subtitulo="Peça mudanças no sistema para os administradores, com prints marcados" />

      <div role="tablist" aria-label="SAC" className="mb-4 flex w-fit flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {aba_("novo", "Novo chamado")}
        {aba_("meus", "Meus chamados", meus ? pendentes(meus) : undefined)}
        {admin && aba_("todos", "Todos os chamados", todos ? pendentes(todos) : undefined)}
        {aba_("concluidos", "Concluídos")}
      </div>

      {aviso && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          {erro}
          <button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
        </p>
      )}

      {aba === "novo" ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Novo chamado">
          <div>
            <label htmlFor="sac-titulo" className="text-sm font-bold text-slate-700">O que você precisa?</label>
            <input id="sac-titulo" value={titulo} maxLength={MAX_TITULO} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex.: Filtro por obra no Cronograma" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="sac-descricao" className="text-sm font-bold text-slate-700">Explique o que deve mudar</label>
            <textarea id="sac-descricao" value={descricao} maxLength={MAX_DESCRICAO} rows={5} onChange={e => setDescricao(e.target.value)}
              placeholder="Onde fica, o que acontece hoje e como deveria ficar." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div>
            <p className="text-sm font-bold text-slate-700">Prints <span className="font-normal text-slate-500">({prints.length}/{MAX_PRINTS}) · toque em um print para marcar com seta, círculo ou rabisco</span></p>
            <div className="mt-2 flex flex-wrap gap-3">
              {prints.map((p, i) => (
                <div key={p.chave} className="group relative">
                  <button type="button" onClick={() => setEditando(p)} aria-label={`Marcar o print ${i + 1}`}
                    className="block h-28 w-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-blue-400">
                    <img src={p.url} alt={`Print ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                  <span className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    <Pencil className="h-3 w-3" /> Marcar
                  </span>
                  <button type="button" onClick={() => remover(p)} aria-label={`Tirar o print ${i + 1}`}
                    className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {prints.length < MAX_PRINTS && (
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => captura.iniciar("escolher", "/sac")}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
                    <Camera className="h-4 w-4" /> Tirar print de uma tela
                  </button>
                  <button type="button" onClick={() => arquivo.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                    <ImagePlus className="h-4 w-4" /> Anexar imagem
                  </button>
                  <input ref={arquivo} type="file" accept="image/png,image/jpeg" multiple className="hidden"
                    onChange={e => { adicionarArquivos(e.target.files); e.target.value = ""; }} />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">“Tirar print de uma tela” deixa você ir até a tela, marcar a área e voltar para cá com o print; o que você escreveu fica guardado.</p>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={enviar} disabled={enviando || !!problema}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar para os ADMs
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-3" aria-label={aba === "todos" ? "Todos os chamados" : aba === "concluidos" ? "Chamados concluídos" : "Meus chamados"}>
          {carregada === null ? (
            <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
          ) : lista.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {aba === "todos" ? "Nenhum chamado na esteira." : aba === "concluidos" ? "Nenhum chamado concluído ainda." : meus?.length ? "Nenhum chamado seu na esteira: os resolvidos e recusados estão em Concluídos." : "Você ainda não abriu nenhum chamado."}
              {aba === "meus" && <button type="button" onClick={() => setAba("novo")} className="ml-1 font-bold text-blue-600 hover:underline">Abrir um chamado</button>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={selecionados.size === lista.length}
                    onChange={e => setSelecionados(e.target.checked ? new Set(lista.map(c => c.id)) : new Set())} />
                  Selecionar todos
                </label>
                <span className="text-xs text-slate-500">{selecionados.size} selecionado(s)</span>
                <button type="button" onClick={exportar} disabled={!selecionados.size || exportando}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40">
                  {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar PDF com prints
                </button>
              </div>
              {lista.map(c => (
                <CartaoChamado key={`${c.id}-${c.dhAtualizacao}`} c={c} admin={aba === "todos" || (aba === "concluidos" && admin)} onAtualizar={atualizar} onExcluir={excluir} onAbrirImagem={setAmpliada}
                  selecionado={selecionados.has(c.id)} novo={aba !== "todos" && novosVistos.has(c.id)} destaque={aba !== "todos" && c.id === doAviso}
                  onSelecionar={sim => setSelecionados(atual => { const n = new Set(atual); if (sim) n.add(c.id); else n.delete(c.id); return n; })} />
              ))}
            </>
          )}
        </section>
      )}

      {editando && (
        <EditorFoto key={editando.chave} titulo="Marque o print" editavel carregar={() => Promise.resolve(editando.blob)}
          onSalvar={async blob => {
            setPrints(l => l.map(x => {
              if (x.chave !== editando.chave) return x;
              URL.revokeObjectURL(x.url);
              return { ...x, blob, url: URL.createObjectURL(blob) };
            }));
            setEditando(null);
            return null;
          }}
          onFechar={() => setEditando(null)} />
      )}
      {ampliada !== null && (
        <EditorFoto key={`img-${ampliada}`} titulo="Print do chamado" editavel={false} carregar={() => sacService.imagem(ampliada)}
          onSalvar={async () => null} onFechar={() => setAmpliada(null)} />
      )}
    </div>
  );
}
