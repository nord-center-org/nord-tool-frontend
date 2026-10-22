import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";

import { ApiError } from "@/react-app/services/apiClient";
import { relatorioFotograficoService as servico, type ModeloRelatorio } from "@/react-app/services/RelatorioFotograficoService";
import { LAYOUTS, type FotosPorPagina } from "@/react-app/utils/relatorioFotografico";

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
                <span className="block text-[11px] font-normal text-slate-400">{m.itens.length} item(ns) · {m.nrFotosPagina}/página</span>
              </button>
            ))}
          </aside>
          <section className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {salvo && <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Modelo salvo.</p>}
            {selecao !== null && <EditorModelo key={modelo?.id ?? "novo"} modelo={modelo} onEditar={() => setSalvo(false)} onSalvo={m => { onSalvo(m); setSelecao(m.id); setSalvo(true); }} />}
          </section>
        </div>
      </div>
    </div>
  );
}

function EditorModelo({ modelo, onSalvo, onEditar }: { modelo: ModeloRelatorio | null; onSalvo: (m: ModeloRelatorio) => void; onEditar: () => void }) {
  const [nome, setNome] = useState(modelo?.nmModelo ?? "");
  const [descricao, setDescricao] = useState(modelo?.txDescricao ?? "");
  const [layout, setLayout] = useState<FotosPorPagina>(modelo?.nrFotosPagina ?? 2);
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
      nmModelo: nome.trim(), txDescricao: descricao.trim() || null, nrFotosPagina: layout, inAtivo: ativo, nrVersao: modelo?.nrVersao,
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
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fotos por página</span>
          <div className="mt-1 flex gap-2" role="radiogroup" aria-label="Fotos por página do modelo">
            {LAYOUTS.map(n => (
              <button key={n} type="button" role="radio" aria-checked={layout === n} onClick={() => setLayout(n)}
                className={`h-9 w-12 rounded-xl border text-sm font-bold ${layout === n ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>{n}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativo (aparece ao criar relatório)
        </label>
      </div>

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
