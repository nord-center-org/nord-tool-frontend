import { useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";

import { ApiError } from "@/react-app/services/apiClient";
import ImagemAutenticada from "@/react-app/components/ImagemAutenticada";
import SeletorLayout from "@/react-app/components/relatorio/SeletorLayout";
import { useBlobUrl } from "@/react-app/hooks/useBlobUrl";
import {
  relatorioFotograficoService as servico, type FonteRelatorio, type ModeloRelatorio, type TipoImagemModelo,
} from "@/react-app/services/RelatorioFotograficoService";
import { prepararFoto } from "@/react-app/utils/imagem";
import { layoutPorCodigo } from "@/react-app/utils/relatorioFotografico";

const FONTES: { id: FonteRelatorio; nome: string; css: string }[] = [
  { id: "HELVETICA", nome: "Moderna", css: "Helvetica, Arial, sans-serif" },
  { id: "TIMES", nome: "Clássica", css: "'Times New Roman', Times, serif" },
  { id: "COURIER", nome: "Máquina de escrever", css: "'Courier New', Courier, monospace" },
];

const classeInput = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20";
const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

interface ItemEdicao { chave: number; nmItem: string; txOrientacao: string }

interface Props {
  modelos: ModeloRelatorio[];
  onSalvo: (m: ModeloRelatorio) => void;
  onFechar: () => void;
}

/** Modelos de relatório (ADMIN do módulo): nome, layout e itens pedidos. */
export default function ModelosModal({ modelos, onSalvo, onFechar }: Props) {
  const [selecao, setSelecao] = useState<number | "novo" | null>(modelos[0]?.id ?? "novo");
  // O aviso fica aqui: ao salvar um modelo novo o editor é recriado (key muda de "novo" para o id).
  const [salvo, setSalvo] = useState(false);
  const modelo = typeof selecao === "number" ? modelos.find(m => m.id === selecao) ?? null : null;
  const selecionar = (s: number | "novo") => { setSelecao(s); setSalvo(false); };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Modelos de relatório" className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-xl sm:h-[85vh] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Modelos de relatório</h2>
            <p className="text-xs text-slate-500">Itens que cada relatório pede e quantas fotos por página.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-100 p-3 md:w-64 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r" aria-label="Modelos">
            <button type="button" onClick={() => selecionar("novo")} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Novo modelo</button>
            {modelos.map(m => (
              <button key={m.id} type="button" onClick={() => selecionar(m.id)} aria-current={selecao === m.id}
                className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm ${selecao === m.id ? "bg-blue-50 font-bold text-blue-700 ring-1 ring-blue-200" : "text-slate-700 hover:bg-slate-50"} ${m.inAtivo ? "" : "line-through opacity-60"}`}>
                {m.nmModelo}
                <span className="block text-[11px] font-normal text-slate-400">{m.itens.length} item(ns) · {layoutPorCodigo(m.cdLayout).nome}</span>
              </button>
            ))}
          </aside>
          <section className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {salvo && <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Modelo salvo.</p>}
            {selecao !== null && (
              <EditorModelo key={modelo?.id ?? "novo"} modelo={modelo} onEditar={() => setSalvo(false)}
                onSalvo={m => { onSalvo(m); setSelecao(m.id); setSalvo(true); }} onImagem={onSalvo} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

interface EditorModeloProps {
  modelo: ModeloRelatorio | null;
  onSalvo: (m: ModeloRelatorio) => void;
  /** Fundo/ícone enviados ou removidos: atualiza o modelo sem recriar o editor. */
  onImagem: (m: ModeloRelatorio) => void;
  onEditar: () => void;
}

function EditorModelo({ modelo, onSalvo, onImagem, onEditar }: EditorModeloProps) {
  const [nome, setNome] = useState(modelo?.nmModelo ?? "");
  const [descricao, setDescricao] = useState(modelo?.txDescricao ?? "");
  const [layout, setLayout] = useState(modelo?.cdLayout ?? "R2");
  const [fonte, setFonte] = useState<FonteRelatorio>(modelo?.cdFonte ?? "HELVETICA");
  const [cabecalho, setCabecalho] = useState(modelo?.inCabecalho ?? true);
  const [opacidade, setOpacidade] = useState(modelo?.nrOpacidadeFundo ?? 12);
  const [imagens, setImagens] = useState({ fundo: modelo?.inFundo ?? false, icone: modelo?.inIcone ?? false, versao: 0 });
  const [enviandoImagem, setEnviandoImagem] = useState<TipoImagemModelo | null>(null);
  const [ativo, setAtivo] = useState(modelo?.inAtivo ?? true);
  const [itens, setItens] = useState<ItemEdicao[]>(() => (modelo?.itens ?? []).map((i, n) => ({ chave: n, nmItem: i.nmItem, txOrientacao: i.txOrientacao ?? "" })));
  const [proxima, setProxima] = useState(itens.length);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const mover = (i: number, d: number) => setItens(l => {
    const alvo = i + d;
    if (alvo < 0 || alvo >= l.length) return l;
    const c = [...l];
    [c[i], c[alvo]] = [c[alvo], c[i]];
    return c;
  });

  const salvar = async () => {
    if (!nome.trim()) return setErro("Informe o nome do modelo.");
    if (itens.some(i => !i.nmItem.trim())) return setErro("Todo item precisa de um nome.");
    setSalvando(true);
    setErro(null);
    onEditar();
    const form = {
      nmModelo: nome.trim(), txDescricao: descricao.trim() || null, cdLayout: layout, cdFonte: fonte, inCabecalho: cabecalho,
      nrOpacidadeFundo: opacidade, inAtivo: ativo, nrVersao: modelo?.nrVersao,
      itens: itens.map(i => ({ nmItem: i.nmItem.trim(), txOrientacao: i.txOrientacao.trim() || null })),
    };
    try {
      onSalvo(modelo ? await servico.alterarModelo(modelo.id, form) : await servico.criarModelo(form));
    } catch (e) {
      setErro(e instanceof ApiError && e.status === 409 ? "Outra pessoa alterou este modelo. Feche e abra de novo." : mensagem(e, "Não foi possível salvar o modelo."));
    } finally {
      setSalvando(false);
    }
  };

  const trocarImagem = async (tipo: TipoImagemModelo, arquivo: File | null) => {
    if (!modelo) return;
    setEnviandoImagem(tipo);
    setErro(null);
    try {
      let novo: ModeloRelatorio | undefined;
      if (arquivo) {
        // PNG pequeno vai como está (mantém a transparência do logo); o resto é reduzido como as fotos.
        const direto = arquivo.type === "image/png" && arquivo.size <= 1_500_000;
        const preparado = direto ? { imagem: arquivo as Blob, nome: arquivo.name } : await prepararFoto(arquivo);
        novo = await servico.enviarImagemModelo(modelo.id, tipo, preparado.imagem, preparado.nome);
      } else {
        novo = await servico.removerImagemModelo(modelo.id, tipo);
      }
      if (novo) {
        onImagem(novo);
        setImagens(v => ({ fundo: novo!.inFundo, icone: novo!.inIcone, versao: v.versao + 1 }));
      }
    } catch (e) {
      setErro(mensagem(e, "Não foi possível salvar a imagem."));
    } finally {
      setEnviandoImagem(null);
    }
  };

  const campoImagem = (tipo: TipoImagemModelo, titulo: string, dica: string) => {
    const tem = imagens[tipo];
    return (
      <div className="rounded-2xl border border-slate-200 p-3">
        <p className="text-sm font-bold text-slate-700">{titulo}</p>
        <p className="text-xs text-slate-500">{dica}</p>
        {modelo ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
              {tem ? <ImagemAutenticada chave={`modelo:${modelo.id}:${tipo}:${imagens.versao}`} carregar={() => servico.imagemModelo(modelo.id, tipo)} alt={titulo} className="max-h-full max-w-full object-contain" />
                : <ImagePlus className="h-5 w-5 text-slate-300" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                {enviandoImagem === tipo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {tem ? "Trocar" : "Escolher imagem"}
                <input type="file" accept="image/png,image/jpeg" className="sr-only" disabled={enviandoImagem !== null}
                  onChange={e => { void trocarImagem(tipo, e.target.files?.[0] ?? null); e.target.value = ""; }} />
              </label>
              {tem && (
                <button type="button" onClick={() => void trocarImagem(tipo, null)} disabled={enviandoImagem !== null}
                  className="rounded-xl px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">Remover</button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Salve o modelo para adicionar a imagem.</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome do modelo</span>
        <input value={nome} maxLength={120} onChange={e => setNome(e.target.value)} placeholder="Ex.: Vistoria de fachada" className={`mt-1 ${classeInput}`} />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Descrição</span>
        <input value={descricao} maxLength={500} onChange={e => setDescricao(e.target.value)} className={`mt-1 ${classeInput}`} />
      </label>
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Modelo da página</span>
        <SeletorLayout valor={layout} onMudar={setLayout} rotulo="Modelo da página do modelo" />
      </div>

      <section className="space-y-3 rounded-2xl bg-slate-50/70 p-3" aria-label="Aparência do PDF">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Aparência do PDF</h3>
        <div className="grid gap-4 lg:grid-cols-[1fr_11rem]">
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fonte</span>
              <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Fonte">
                {FONTES.map(f => (
                  <button key={f.id} type="button" role="radio" aria-checked={fonte === f.id} onClick={() => setFonte(f.id)}
                    className={`rounded-xl border bg-white px-2 py-2 text-left ${fonte === f.id ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-200"}`}>
                    <span className="block text-lg leading-tight text-slate-800" style={{ fontFamily: f.css }}>Aa Relatório</span>
                    <span className="text-[11px] font-semibold text-slate-500">{f.nome}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={cabecalho} onChange={e => setCabecalho(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
              <span><b>Cabeçalho padrão</b> em todas as páginas<span className="block text-xs text-slate-500">Título, data, local, fase e responsável no alto de cada página.</span></span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {campoImagem("icone", "Ícone", "Fica no canto superior direito de todas as páginas (ex.: logo).")}
              {campoImagem("fundo", "Fundo (marca d'água)", "Aparece clarinho atrás de todas as páginas.")}
            </div>
            {imagens.fundo && (
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Intensidade da marca d'água: {opacidade}%</span>
                <input type="range" min={3} max={60} value={opacidade} onChange={e => setOpacidade(Number(e.target.value))} className="mt-1 w-full accent-blue-600" />
              </label>
            )}
          </div>
          <PreviaPagina modelo={modelo} layout={layout} fonte={FONTES.find(f => f.id === fonte)!.css} cabecalho={cabecalho}
            opacidade={opacidade} imagens={imagens} titulo={nome || "Título do relatório"} />
        </div>
      </section>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativo (aparece ao criar relatório)
      </label>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Itens</h3>
        <ol className="space-y-2" aria-label="Itens do modelo">
          {itens.map((item, i) => (
            <li key={item.chave} className="flex items-start gap-2 rounded-xl border border-slate-200 p-2">
              <span className="mt-2 w-5 text-center text-xs font-black text-slate-400">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <input aria-label={`Item ${i + 1}`} value={item.nmItem} maxLength={150} onChange={e => setItens(l => l.map(x => (x.chave === item.chave ? { ...x, nmItem: e.target.value } : x)))} className={classeInput} />
                <input aria-label={`Orientação do item ${i + 1}`} value={item.txOrientacao} maxLength={500} placeholder="Orientação para quem fotografa (opcional)"
                  onChange={e => setItens(l => l.map(x => (x.chave === item.chave ? { ...x, txOrientacao: e.target.value } : x)))} className={`${classeInput} text-xs`} />
              </div>
              <div className="flex flex-col">
                <button type="button" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Descer" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label="Remover" onClick={() => setItens(l => l.filter(x => x.chave !== item.chave))} className="rounded-lg p-1 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => { setItens(l => [...l, { chave: proxima, nmItem: "", txOrientacao: "" }]); setProxima(p => p + 1); }}
          className="mt-2 inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"><Plus className="h-4 w-4" /> Adicionar item</button>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => void salvar()} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar modelo
        </button>
      </div>
    </div>
  );
}

interface PreviaProps {
  modelo: ModeloRelatorio | null;
  layout: string;
  fonte: string;
  cabecalho: boolean;
  opacidade: number;
  imagens: { fundo: boolean; icone: boolean; versao: number };
  titulo: string;
}

/** Prévia da página do PDF: cabeçalho, ícone, marca d'água e o layout das fotos. */
function PreviaPagina({ modelo, layout, fonte, cabecalho, opacidade, imagens, titulo }: PreviaProps) {
  const l = layoutPorCodigo(layout);
  const id = modelo?.id ?? 0;
  const fundo = useBlobUrl(modelo && imagens.fundo ? `modelo:${id}:fundo:${imagens.versao}` : null, () => servico.imagemModelo(id, "fundo"));
  const icone = useBlobUrl(modelo && imagens.icone ? `modelo:${id}:icone:${imagens.versao}` : null, () => servico.imagemModelo(id, "icone"));
  const paisagem = l.orientacao === "paisagem";
  return (
    <figure className="mx-auto w-full max-w-[11rem]" aria-label="Prévia da página">
      <div className={`relative overflow-hidden rounded-md border border-slate-300 bg-white shadow-md ${paisagem ? "aspect-[1.414/1]" : "aspect-[1/1.414]"}`} style={{ fontFamily: fonte }}>
        {fundo.url && <img src={fundo.url} alt="" className="absolute inset-[6%] h-[88%] w-[88%] object-contain" style={{ opacity: opacidade / 100 }} />}
        <div className="absolute inset-x-[6%] top-[4%] flex h-[11%] items-start justify-between gap-1">
          {cabecalho ? (
            <div className="min-w-0">
              <p className="truncate text-[7px] font-bold leading-tight text-slate-800">{titulo}</p>
              <p className="truncate text-[5px] text-slate-500">22/10/2026 · Bloco A · Fase 1</p>
            </div>
          ) : <span />}
          {icone.url && <img src={icone.url} alt="" className="h-full max-w-[30%] object-contain" />}
        </div>
        {cabecalho && <div className="absolute inset-x-[6%] top-[15%] h-px bg-slate-200"><div className="h-[2px] w-[18%] bg-blue-600" /></div>}
        <div className={`absolute inset-x-[6%] bottom-[8%] ${cabecalho || icone.url ? "top-[18%]" : "top-[5%]"}`}>
          {l.celulas.map((c, i) => (
            <div key={i} className="absolute flex gap-[3%] p-[2%]" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, flexDirection: c.texto === "direita" ? "row" : "column" }}>
              <div className={`rounded-[2px] bg-gradient-to-b from-sky-100 to-emerald-200 ${c.texto === "direita" ? "h-full w-[58%]" : "w-full flex-1"}`} />
              <div className={`space-y-[2px] ${c.texto === "direita" ? "flex-1 pt-[2px]" : ""}`}>
                <div className="h-[2px] w-[80%] rounded bg-slate-300" />
                <div className="h-[2px] w-[55%] rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
        <p className="absolute inset-x-[6%] bottom-[2.5%] truncate border-t border-slate-200 pt-[1px] text-[4.5px] text-slate-400">Feito no NordTool por …</p>
      </div>
      <figcaption className="mt-1 text-center text-[11px] text-slate-400">Prévia</figcaption>
    </figure>
  );
}
