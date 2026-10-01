import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { FerramentaService, type Ferramenta } from "../services/FerramentaService";

interface CadastroFerramentasProps {
  itens: Ferramenta[];
  carregando: boolean;
  erro: string | null;
  onRecarregar: () => void;
}

const vazio = (): Ferramenta => ({ nmFerramenta: "", nmCategoria: "", cdPatrimonio: "", flAtivo: true });

export default function CadastroFerramentas({ itens, carregando, erro, onRecarregar }: CadastroFerramentasProps) {
  const [draft, setDraft] = useState<Ferramenta>(vazio());
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [draftEdicao, setDraftEdicao] = useState<Ferramenta>(vazio());
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const criar = async () => {
    if (!draft.nmFerramenta.trim()) return;
    setSalvandoNovo(true);
    setErroForm(null);
    try {
      await FerramentaService.criar({
        nmFerramenta: draft.nmFerramenta.trim(),
        nmCategoria: draft.nmCategoria?.trim() || undefined,
        cdPatrimonio: draft.cdPatrimonio?.trim() || undefined,
        flAtivo: true,
      });
      setDraft(vazio());
      onRecarregar();
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : "Falha ao criar ferramenta.");
    } finally {
      setSalvandoNovo(false);
    }
  };

  const iniciarEdicao = (item: Ferramenta) => {
    setEditandoId(item.id ?? null);
    setDraftEdicao({ ...item });
    setErroForm(null);
  };

  const salvarEdicao = async () => {
    if (editandoId === null || !draftEdicao.nmFerramenta.trim()) return;
    setSalvandoEdicao(true);
    setErroForm(null);
    try {
      await FerramentaService.alterar(editandoId, {
        nmFerramenta: draftEdicao.nmFerramenta.trim(),
        nmCategoria: draftEdicao.nmCategoria?.trim() || undefined,
        cdPatrimonio: draftEdicao.cdPatrimonio?.trim() || undefined,
        flAtivo: draftEdicao.flAtivo ?? true,
      });
      setEditandoId(null);
      onRecarregar();
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : "Falha ao alterar ferramenta.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const excluir = async (item: Ferramenta) => {
    if (!item.id) return;
    if (!window.confirm(`Excluir "${item.nmFerramenta}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(item.id);
    setErroForm(null);
    try {
      await FerramentaService.excluir(item.id);
      onRecarregar();
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : "Falha ao excluir ferramenta.");
    } finally {
      setExcluindoId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-700">Ferramentas</h4>
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {erro && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{erro}</span>
          <button onClick={onRecarregar} className="shrink-0 font-semibold hover:text-red-900">Tentar novamente</button>
        </div>
      )}

      {erroForm && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erroForm}</div>
      )}

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[2fr_1.5fr_1.5fr_auto]">
        <input
          value={draft.nmFerramenta}
          onChange={(e) => setDraft({ ...draft, nmFerramenta: e.target.value })}
          placeholder="Nome da ferramenta"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <input
          value={draft.nmCategoria ?? ""}
          onChange={(e) => setDraft({ ...draft, nmCategoria: e.target.value })}
          placeholder="Categoria (opcional)"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <input
          value={draft.cdPatrimonio ?? ""}
          onChange={(e) => setDraft({ ...draft, cdPatrimonio: e.target.value })}
          placeholder="Patrimônio (opcional)"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          onClick={() => void criar()}
          disabled={salvandoNovo || !draft.nmFerramenta.trim()}
          className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {salvandoNovo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
        </button>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {itens.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            {editandoId === item.id ? (
              <>
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                  <input autoFocus value={draftEdicao.nmFerramenta} onChange={(e) => setDraftEdicao({ ...draftEdicao, nmFerramenta: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/30" />
                  <input value={draftEdicao.nmCategoria ?? ""} onChange={(e) => setDraftEdicao({ ...draftEdicao, nmCategoria: e.target.value })} placeholder="Categoria" className="rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/30" />
                  <input value={draftEdicao.cdPatrimonio ?? ""} onChange={(e) => setDraftEdicao({ ...draftEdicao, cdPatrimonio: e.target.value })} placeholder="Patrimônio" className="rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => void salvarEdicao()} disabled={salvandoEdicao} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                    {salvandoEdicao ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={() => setEditandoId(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-slate-700">{item.nmFerramenta}</span>
                  {item.nmCategoria && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{item.nmCategoria}</span>}
                  {item.cdPatrimonio && <span className="text-xs text-slate-400">#{item.cdPatrimonio}</span>}
                  {item.flAtivo === false && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500">Inativa</span>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => iniciarEdicao(item)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void excluir(item)} disabled={excluindoId === item.id} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                    {excluindoId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!carregando && !itens.length && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma ferramenta cadastrada.</p>
        )}
      </div>
    </div>
  );
}
