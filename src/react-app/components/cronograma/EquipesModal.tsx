import { useEffect, useMemo, useState } from "react";
import { GitBranch, Plus, Search, Trash2, Users, X } from "lucide-react";

import { CronogramaSemanalService, type CronogramaEquipe } from "../../services/CronogramaSemanalService";
import { filtrarPessoas, alternarPessoa, type PessoaCompartilhavel } from "../../utils/compartilhamento";

interface EquipesModalProps {
  meuId: number;
  meuNome: string;
  nomeObra?: string | null;
  onFechar: () => void;
  onSalvo: () => void;
}

interface Rascunho { id?: number; nmEquipe: string; idLider: number | null; idsMembros: number[] }

const novo = (): Rascunho => ({ nmEquipe: "", idLider: null, idsMembros: [] });

/**
 * Equipes do cronograma da obra escolhida. Quem está na mesma equipe vê as demandas uns dos outros e pode movê-las
 * na esteira. "Puxar da hierarquia" marca o líder e todos abaixo dele.
 */
export default function EquipesModal({ meuId, meuNome, nomeObra, onFechar, onSalvo }: EquipesModalProps) {
  const [equipes, setEquipes] = useState<CronogramaEquipe[] | null>(null);
  const [pessoas, setPessoas] = useState<PessoaCompartilhavel[]>([]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    try {
      const [e, p] = await Promise.all([CronogramaSemanalService.equipesDaObra(), CronogramaSemanalService.pessoas()]);
      setEquipes(e);
      // A lista de pessoas não traz quem está logado: entra aqui para poder fazer parte da equipe.
      setPessoas([{ id: meuId, nmNome: `${meuNome} (você)`, nmCargo: null, inEquipe: false }, ...p]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível carregar as equipes");
      setEquipes([]);
    }
  };
  useEffect(() => { void carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nome = (id: number | null | undefined) => pessoas.find(p => p.id === id)?.nmNome ?? (id ? `#${id}` : "—");
  const visiveis = useMemo(() => filtrarPessoas(pessoas, busca), [pessoas, busca]);

  const puxarHierarquia = async () => {
    if (!rascunho?.idLider) { setErro("Escolha o líder primeiro."); return; }
    setErro(null);
    try {
      const ids = await CronogramaSemanalService.pelaHierarquia(rascunho.idLider);
      setRascunho(r => r && { ...r, idsMembros: [...new Set([...r.idsMembros, ...ids])] });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível ler a hierarquia");
    }
  };

  const salvar = async () => {
    if (!rascunho) return;
    setOcupado(true); setErro(null);
    try {
      await CronogramaSemanalService.salvarEquipe({ nmEquipe: rascunho.nmEquipe, idLider: rascunho.idLider, idsMembros: rascunho.idsMembros }, rascunho.id);
      setRascunho(null);
      await carregar();
      onSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a equipe");
    } finally {
      setOcupado(false);
    }
  };

  const excluir = async (e: CronogramaEquipe) => {
    if (!window.confirm(`Excluir a equipe "${e.nmEquipe}"? As demandas continuam; só deixam de ser vistas pela equipe.`)) return;
    try {
      await CronogramaSemanalService.excluirEquipe(e.id);
      await carregar();
      onSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível excluir");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="equipes-titulo" onMouseDown={e => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="equipes-titulo" className="flex items-center gap-2 text-lg font-bold"><Users size={20} className="text-violet-600" /> Equipes {nomeObra ? `· ${nomeObra}` : ""}</h2>
            <p className="text-xs text-slate-500">Quem está na mesma equipe vê as demandas uns dos outros e pode movê-las na esteira.</p>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="text-slate-500 hover:text-slate-800"><X size={20} /></button>
        </header>

        {erro && <p role="alert" className="mx-5 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!rascunho ? (
            <>
              {equipes === null ? <p className="text-sm text-slate-500">Carregando…</p> : equipes.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Nenhuma equipe nesta obra ainda.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {equipes.map(e => (
                    <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setRascunho({ id: e.id, nmEquipe: e.nmEquipe, idLider: e.idLider ?? null, idsMembros: e.idsMembros })}>
                        <p className="truncate text-sm font-bold">{e.nmEquipe}</p>
                        <p className="truncate text-[11px] text-slate-500">Líder: {e.nmLider ?? "—"} · {e.idsMembros.length} pessoa(s): {e.idsMembros.map(id => nome(id).split(" ")[0]).join(", ")}</p>
                      </button>
                      <button type="button" onClick={() => void excluir(e)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label={`Excluir ${e.nmEquipe}`}><Trash2 size={16} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => setRascunho(novo())}
                className="mt-3 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
                <Plus size={16} /> Nova equipe
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">
                Nome da equipe
                <input value={rascunho.nmEquipe} onChange={e => setRascunho({ ...rascunho, nmEquipe: e.target.value.slice(0, 80) })} placeholder="Ex.: Qualidade, Torre 3"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block min-w-0 flex-1 text-xs font-semibold text-slate-500">
                  Líder
                  <select value={rascunho.idLider ?? ""} onChange={e => setRascunho({ ...rascunho, idLider: e.target.value ? Number(e.target.value) : null })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    <option value="">Sem líder</option>
                    {pessoas.map(p => <option key={p.id} value={p.id}>{p.nmNome}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => void puxarHierarquia()} disabled={!rascunho.idLider} title="Marca o líder e todos abaixo dele na hierarquia"
                  className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                  <GitBranch size={14} /> Puxar da hierarquia
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Membros ({rascunho.idsMembros.length + (rascunho.idLider && !rascunho.idsMembros.includes(rascunho.idLider) ? 1 : 0)})</p>
                <label className="relative mt-1 block">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa ou cargo" aria-label="Buscar pessoa"
                    className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm" />
                </label>
                <ul className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                  {visiveis.map(p => {
                    const lider = p.id === rascunho.idLider;
                    const sel = lider || rascunho.idsMembros.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label className={`flex items-center gap-2 px-3 py-1.5 text-sm ${lider ? "bg-violet-50" : "hover:bg-slate-50"}`}>
                          <input type="checkbox" checked={sel} disabled={lider} onChange={() => setRascunho({ ...rascunho, idsMembros: alternarPessoa(rascunho.idsMembros, p.id) })} />
                          <span className="min-w-0 flex-1 truncate">{p.nmNome}</span>
                          {lider ? <span className="text-[10px] font-bold text-violet-700">líder</span> : p.nmCargo && <span className="truncate text-[11px] text-slate-400">{p.nmCargo}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {rascunho && (
          <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button type="button" onClick={() => { setRascunho(null); setErro(null); }} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Voltar</button>
            <button type="button" onClick={() => void salvar()} disabled={ocupado || !rascunho.nmEquipe.trim()}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              {ocupado ? "Salvando…" : "Salvar equipe"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
