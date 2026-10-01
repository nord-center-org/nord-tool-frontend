import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

export interface ItemCadastroSimples {
  id: number;
  nome: string;
}

interface CadastroSimplesProps {
  titulo: string;
  rotuloCampo: string;
  itens: ItemCadastroSimples[];
  carregando: boolean;
  erro: string | null;
  onRecarregar: () => void;
  onCriar: (nome: string) => Promise<void>;
  onAlterar: (id: number, nome: string) => Promise<void>;
  onExcluir: (id: number) => Promise<void>;
}

export default function CadastroSimples({
  titulo, rotuloCampo, itens, carregando, erro, onRecarregar, onCriar, onAlterar, onExcluir,
}: CadastroSimplesProps) {
  const [novoNome, setNovoNome] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const criar = async () => {
    if (!novoNome.trim()) return;
    setSalvandoNovo(true);
    setErroForm(null);
    try {
      await onCriar(novoNome.trim());
      setNovoNome("");
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : `Falha ao criar ${rotuloCampo.toLowerCase()}.`);
    } finally {
      setSalvandoNovo(false);
    }
  };

  const iniciarEdicao = (item: ItemCadastroSimples) => {
    setEditandoId(item.id);
    setNomeEdicao(item.nome);
    setErroForm(null);
  };

  const salvarEdicao = async () => {
    if (editandoId === null || !nomeEdicao.trim()) return;
    setSalvandoEdicao(true);
    setErroForm(null);
    try {
      await onAlterar(editandoId, nomeEdicao.trim());
      setEditandoId(null);
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : `Falha ao alterar ${rotuloCampo.toLowerCase()}.`);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const excluir = async (item: ItemCadastroSimples) => {
    if (!window.confirm(`Excluir "${item.nome}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(item.id);
    setErroForm(null);
    try {
      await onExcluir(item.id);
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : `Falha ao excluir ${rotuloCampo.toLowerCase()}.`);
    } finally {
      setExcluindoId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-700">{titulo}</h4>
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

      <div className="flex items-center gap-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void criar(); }}
          placeholder={`Novo nome de ${rotuloCampo.toLowerCase()}...`}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          onClick={() => void criar()}
          disabled={salvandoNovo || !novoNome.trim()}
          className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {salvandoNovo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
        </button>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {itens.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            {editandoId === item.id ? (
              <>
                <input
                  autoFocus
                  value={nomeEdicao}
                  onChange={(e) => setNomeEdicao(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void salvarEdicao(); if (e.key === "Escape") setEditandoId(null); }}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => void salvarEdicao()} disabled={salvandoEdicao} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                    {salvandoEdicao ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={() => setEditandoId(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm text-slate-700">{item.nome}</span>
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
          <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhum registro cadastrado.</p>
        )}
      </div>
    </div>
  );
}
