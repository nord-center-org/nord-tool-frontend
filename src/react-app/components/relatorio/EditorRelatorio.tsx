import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Camera, CheckCircle2, FileDown, ImagePlus, Loader2, Lock, Plus, RotateCcw, Save, Trash2, X,
} from "lucide-react";

import ImagemAutenticada from "@/react-app/components/ImagemAutenticada";
import { ApiError } from "@/react-app/services/apiClient";
import { relatorioFotograficoService as servico, type RelatorioFotografico } from "@/react-app/services/RelatorioFotograficoService";
import { prepararFoto } from "@/react-app/utils/imagem";
import { gerarPdfRelatorio } from "@/react-app/utils/pdfRelatorioFotografico";
import {
  LAYOUTS, ROTULO_STATUS, nomeArquivoPdf, progresso, type FotoRelatorio, type FotosPorPagina, type ItemRelatorio,
} from "@/react-app/utils/relatorioFotografico";

const classeInput = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500";
const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Item na tela: `chave` estável mesmo para itens ainda não salvos (sem id). */
interface ItemLocal { chave: string; id?: number; nmItem: string; txOrientacao: string | null; txResposta: string; fotos: FotoRelatorio[] }

const paraLocal = (itens: ItemRelatorio[] = []): ItemLocal[] =>
  [...itens].sort((a, b) => a.nrOrdem - b.nrOrdem).map(i => ({ chave: `i${i.id}`, id: i.id, nmItem: i.nmItem, txOrientacao: i.txOrientacao, txResposta: i.txResposta ?? "", fotos: i.fotos }));

interface Props {
  id: number;
  podeEditar: boolean;
  onVoltar: () => void;
  onAlterado: (r: RelatorioFotografico) => void;
  onExcluido: (id: number) => void;
}

/** Preenchimento do relatório: cabeçalho, itens (observação + fotos), concluir, PDF e exclusão. */
export default function EditorRelatorio({ id, podeEditar, onVoltar, onAlterado, onExcluido }: Props) {
  const [rel, setRel] = useState<RelatorioFotografico | null>(null);
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [data, setData] = useState("");
  const [layout, setLayout] = useState<FotosPorPagina>(2);
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Record<string, number>>({});
  const novos = useRef(0);

  const aplicar = useCallback((r: RelatorioFotografico) => {
    setRel(r);
    setTitulo(r.nmTitulo);
    setLocal(r.nmLocal ?? "");
    setData(r.dtRelatorio);
    setLayout(r.nrFotosPagina);
    setItens(paraLocal(r.itens));
    setSujo(false);
  }, []);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      aplicar(await servico.detalhar(id));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível abrir o relatório."));
    }
  }, [aplicar, id]);

  useEffect(() => { void carregar(); }, [carregar]);

  if (!rel) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-10 text-sm text-slate-500">
        {erro ? <><p role="alert" className="text-red-700">{erro}</p><button type="button" onClick={onVoltar} className="font-semibold text-blue-600">Voltar</button></>
          : <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" />}
      </div>
    );
  }

  const concluido = rel.cdStatus === "CONCLUIDO";
  const editavel = podeEditar && !concluido;
  const { respondidos, total } = progresso(itens.map((i, n) => ({ id: i.id ?? -n, nrOrdem: n, nmItem: i.nmItem, txOrientacao: i.txOrientacao, txResposta: i.txResposta, fotos: i.fotos })));
  const mexer = (f: () => void) => { f(); setSujo(true); };
  const alterarItem = (chave: string, mudanca: Partial<ItemLocal>) => mexer(() => setItens(l => l.map(i => (i.chave === chave ? { ...i, ...mudanca } : i))));
  const mover = (indice: number, delta: number) => mexer(() => setItens(l => {
    const alvo = indice + delta;
    if (alvo < 0 || alvo >= l.length) return l;
    const copia = [...l];
    [copia[indice], copia[alvo]] = [copia[alvo], copia[indice]];
    return copia;
  }));

  const tratar409 = async (e: unknown) => {
    if (e instanceof ApiError && e.status === 409) {
      setAviso("Outra pessoa alterou este relatório. Recarreguei a versão atual; refaça sua alteração.");
      await carregar();
      return true;
    }
    return false;
  };

  const salvar = async (): Promise<boolean> => {
    if (!titulo.trim()) { setErro("Informe o título."); return false; }
    if (itens.some(i => !i.nmItem.trim())) { setErro("Todo item precisa de um nome."); return false; }
    setOcupado("salvar");
    setErro(null);
    setAviso(null);
    try {
      const r = await servico.alterar(id, {
        nmTitulo: titulo.trim(), nmLocal: local.trim() || null, dtRelatorio: data, nrFotosPagina: layout, nrVersao: rel.nrVersao,
        itens: itens.map(i => ({ id: i.id, nmItem: i.nmItem.trim(), txOrientacao: i.txOrientacao, txResposta: i.txResposta.trim() || null })),
      });
      aplicar(r);
      onAlterado(r);
      setAviso("Relatório salvo.");
      return true;
    } catch (e) {
      if (!(await tratar409(e))) setErro(mensagem(e, "Não foi possível salvar."));
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const trocarStatus = async () => {
    if (sujo && !(await salvar())) return;
    setOcupado("status");
    setErro(null);
    try {
      const atual = await servico.detalhar(id);
      const r = await servico.alterarStatus(id, concluido ? "RASCUNHO" : "CONCLUIDO", atual.nrVersao);
      aplicar(r);
      onAlterado(r);
      setAviso(concluido ? "Relatório reaberto para edição." : "Relatório concluído.");
    } catch (e) {
      if (!(await tratar409(e))) setErro(mensagem(e, "Não foi possível alterar o status."));
    } finally {
      setOcupado(null);
    }
  };

  const excluir = async () => {
    if (!window.confirm(`Excluir o relatório "${rel.nmTitulo}" com todas as fotos? Esta ação não pode ser desfeita.`)) return;
    setOcupado("excluir");
    try {
      await servico.excluir(id, rel.nrVersao);
      onExcluido(id);
    } catch (e) {
      if (!(await tratar409(e))) setErro(mensagem(e, "Não foi possível excluir."));
      setOcupado(null);
    }
  };

  const enviarFotos = async (item: ItemLocal, arquivos: FileList | null) => {
    if (!item.id || !arquivos?.length) return;
    const lista = Array.from(arquivos);
    setErro(null);
    setEnviando(m => ({ ...m, [item.chave]: (m[item.chave] ?? 0) + lista.length }));
    const falhas: string[] = [];
    for (const arquivo of lista) {
      try {
        const foto = await prepararFoto(arquivo);
        const salva = await servico.adicionarFoto(item.id, foto.imagem, foto.nome, null);
        setItens(l => l.map(i => (i.chave === item.chave ? { ...i, fotos: [...i.fotos, salva] } : i)));
      } catch (e) {
        falhas.push(`${arquivo.name}: ${mensagem(e, "falhou")}`);
      } finally {
        setEnviando(m => ({ ...m, [item.chave]: Math.max(0, (m[item.chave] ?? 1) - 1) }));
      }
    }
    if (falhas.length) setErro(`Algumas fotos não foram enviadas. ${falhas.join(" · ")}`);
  };

  const salvarLegenda = async (item: ItemLocal, foto: FotoRelatorio, texto: string) => {
    const nova = texto.trim() || null;
    if (nova === (foto.txLegenda ?? null)) return;
    try {
      const salva = await servico.alterarFoto(foto.id, nova);
      setItens(l => l.map(i => (i.chave === item.chave ? { ...i, fotos: i.fotos.map(f => (f.id === foto.id ? salva : f)) } : i)));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível salvar a legenda."));
    }
  };

  const excluirFoto = async (item: ItemLocal, foto: FotoRelatorio) => {
    if (!window.confirm("Excluir esta foto?")) return;
    try {
      await servico.excluirFoto(foto.id);
      setItens(l => l.map(i => (i.chave === item.chave ? { ...i, fotos: i.fotos.filter(f => f.id !== foto.id) } : i)));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível excluir a foto."));
    }
  };

  const removerItem = (item: ItemLocal) => {
    if (item.fotos.length && !window.confirm(`Remover "${item.nmItem}"? As ${item.fotos.length} foto(s) dele serão excluídas ao salvar.`)) return;
    mexer(() => setItens(l => l.filter(i => i.chave !== item.chave)));
  };

  const gerarPdf = async () => {
    setOcupado("pdf");
    setErro(null);
    try {
      const bytes = await gerarPdfRelatorio(
        { titulo: titulo.trim() || rel.nmTitulo, local: local.trim() || null, data: dataBr(data), fase: rel.nmFase, autor: rel.nmAutor, modelo: rel.nmModelo },
        itens.map((i, n) => ({ id: i.id ?? -(n + 1), nrOrdem: n + 1, nmItem: i.nmItem, txOrientacao: i.txOrientacao, txResposta: i.txResposta, fotos: i.fotos })),
        layout,
        async idFoto => new Uint8Array(await (await servico.imagem(idFoto)).arrayBuffer()),
      );
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivoPdf(titulo || rel.nmTitulo, data);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível gerar o PDF."));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => { if (!sujo || window.confirm("Sair sem salvar as alterações?")) onVoltar(); }}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Relatórios
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void gerarPdf()} disabled={ocupado !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {ocupado === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
          </button>
          {podeEditar && (
            <button type="button" onClick={() => void trocarStatus()} disabled={ocupado !== null}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-60 ${concluido ? "border border-slate-200 bg-white text-slate-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
              {concluido ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {concluido ? "Reabrir" : "Concluir"}
            </button>
          )}
          {editavel && (
            <button type="button" onClick={() => void salvar()} disabled={!sujo || ocupado !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {ocupado === "salvar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </button>
          )}
        </div>
      </div>

      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>}
      {concluido && (
        <p className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600"><Lock className="h-4 w-4" /> Concluído: reabra para editar.</p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Dados do relatório">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className={`rounded-full px-2.5 py-1 ${concluido ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{ROTULO_STATUS[rel.cdStatus]}</span>
          {rel.nmFase && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{rel.nmFase}</span>}
          {rel.nmModelo && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{rel.nmModelo}</span>}
          <span className="text-slate-400">{respondidos} de {total} itens respondidos</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Título</span>
            <input value={titulo} disabled={!editavel} maxLength={150} onChange={e => mexer(() => setTitulo(e.target.value))} className={`mt-1 ${classeInput}`} />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Local</span>
            <input value={local} disabled={!editavel} maxLength={150} onChange={e => mexer(() => setLocal(e.target.value))} className={`mt-1 ${classeInput}`} />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data</span>
            <input type="date" value={data} disabled={!editavel} onChange={e => mexer(() => setData(e.target.value))} className={`mt-1 ${classeInput}`} />
          </label>
        </div>
        <div className="mt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fotos por página no PDF</span>
          <div className="mt-1 flex gap-2" role="radiogroup" aria-label="Fotos por página">
            {LAYOUTS.map(n => (
              <button key={n} type="button" role="radio" aria-checked={layout === n} disabled={!editavel} onClick={() => mexer(() => setLayout(n))}
                className={`h-9 w-12 rounded-xl border text-sm font-bold ${layout === n ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"} disabled:opacity-60`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ol className="space-y-3" aria-label="Itens do relatório">
        {itens.map((item, indice) => (
          <li key={item.chave} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-2">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">{indice + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <input aria-label={`Nome do item ${indice + 1}`} value={item.nmItem} disabled={!editavel} maxLength={150}
                  onChange={e => alterarItem(item.chave, { nmItem: e.target.value })} className={`${classeInput} font-semibold`} />
                {item.txOrientacao && <p className="text-xs text-slate-500">{item.txOrientacao}</p>}
                <textarea aria-label={`Observação do item ${indice + 1}`} value={item.txResposta} disabled={!editavel} maxLength={2000} rows={2}
                  placeholder={editavel ? "Observação (opcional)" : "Sem observação"} onChange={e => alterarItem(item.chave, { txResposta: e.target.value })} className={classeInput} />
              </div>
              {editavel && (
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" aria-label="Subir item" onClick={() => mover(indice, -1)} disabled={indice === 0} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="Descer item" onClick={() => mover(indice, 1)} disabled={indice === itens.length - 1} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label="Remover item" onClick={() => removerItem(item)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {item.fotos.map(foto => (
                <figure key={foto.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <div className="relative">
                    <ImagemAutenticada chave={`relfoto:${foto.id}`} carregar={() => servico.imagem(foto.id)} alt={foto.txLegenda ?? item.nmItem} className="aspect-[4/3] w-full object-cover" />
                    {editavel && (
                      <button type="button" aria-label="Excluir foto" onClick={() => void excluirFoto(item, foto)}
                        className="absolute right-1 top-1 rounded-lg bg-white/90 p-1 text-red-500 shadow-sm hover:bg-white"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                  <figcaption className="p-1.5">
                    <input aria-label="Legenda da foto" defaultValue={foto.txLegenda ?? ""} disabled={!editavel} maxLength={300} placeholder={editavel ? "Legenda" : ""}
                      onBlur={e => void salvarLegenda(item, foto, e.target.value)} className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xs text-slate-600 outline-none focus:border-slate-200 focus:bg-white" />
                  </figcaption>
                </figure>
              ))}
              {editavel && (item.id ? (
                <div className="flex aspect-[4/3] flex-col items-stretch justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-2">
                  <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 py-2 text-xs font-bold text-white hover:bg-blue-700">
                    <Camera className="h-4 w-4" /> Câmera
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { void enviarFotos(item, e.target.files); e.target.value = ""; }} />
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                    <ImagePlus className="h-4 w-4" /> Galeria
                    <input type="file" accept="image/jpeg,image/png" multiple className="sr-only" onChange={e => { void enviarFotos(item, e.target.files); e.target.value = ""; }} />
                  </label>
                  {(enviando[item.chave] ?? 0) > 0 && (
                    <p role="status" className="flex items-center justify-center gap-1 text-[11px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Enviando {enviando[item.chave]}…</p>
                  )}
                </div>
              ) : (
                <p className="col-span-2 flex items-center rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">Salve o relatório para adicionar fotos neste item.</p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {editavel && (
        <button type="button" onClick={() => mexer(() => setItens(l => [...l, { chave: `n${++novos.current}`, nmItem: "Novo item", txOrientacao: null, txResposta: "", fotos: [] }]))}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-white">
          <Plus className="h-4 w-4" /> Adicionar item
        </button>
      )}

      {podeEditar && (
        <div className="flex justify-end pt-2">
          <button type="button" onClick={() => void excluir()} disabled={ocupado !== null}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
            <Trash2 className="h-4 w-4" /> Excluir relatório
          </button>
        </div>
      )}
    </div>
  );
}
