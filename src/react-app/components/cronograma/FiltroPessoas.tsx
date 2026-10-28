import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Users } from "lucide-react";

import type { CronogramaEquipe } from "../../services/CronogramaSemanalService";
import { alternarPessoaNoFiltro, rotuloFiltro, type DonoDemanda, type FiltroPessoas as Filtro } from "../../utils/filtroPessoas";

interface FiltroPessoasProps {
  filtro: Filtro;
  onMudar: (f: Filtro) => void;
  donos: DonoDemanda[];
  equipes: CronogramaEquipe[];
}

const normalizar = (t: string) => t.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Botão "De quem": todas, só as minhas, de outras pessoas, uma equipe inteira ou pessoas escolhidas. */
export default function FiltroPessoas({ filtro, onMudar, donos, equipes }: FiltroPessoasProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return termo ? donos.filter(d => normalizar(d.nome).includes(termo)) : donos;
  }, [donos, busca]);
  const marcados = filtro.tipo === "pessoas" ? filtro.ids : [];
  const ativo = filtro.tipo !== "todos";

  const atalho = (f: Filtro, rotulo: string) => {
    const sel = filtro.tipo === f.tipo && f.tipo !== "pessoas";
    return (
      <button type="button" onClick={() => { onMudar(f); setAberto(false); }}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${sel ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
        {rotulo}
      </button>
    );
  };

  return (
    <div className="relative" ref={caixa}>
      <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto} aria-haspopup="dialog"
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-600 ${ativo ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-800"}`}>
        <Users size={16} /> <span className="max-w-[160px] truncate">{rotuloFiltro(filtro, donos)}</span> <ChevronDown size={14} />
      </button>
      {aberto && (
        <div role="dialog" aria-label="Filtrar por pessoa"
          className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl">
          <div className="flex flex-wrap gap-1.5">
            {atalho({ tipo: "todos" }, "Todas")}
            {atalho({ tipo: "meus" }, "Só as minhas")}
            {atalho({ tipo: "outros" }, "De outras pessoas")}
          </div>
          {equipes.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Equipes</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {equipes.map(e => {
                  const sel = filtro.tipo === "pessoas" && filtro.rotulo === e.nmEquipe;
                  return (
                    <button key={e.id} type="button" title={`${e.nmObra} · ${e.idsMembros.length} pessoa(s)`}
                      onClick={() => { onMudar({ tipo: "pessoas", ids: e.idsMembros, rotulo: e.nmEquipe }); setAberto(false); }}
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${sel ? "border-violet-600 bg-violet-600 text-white" : "border-violet-200 text-violet-700 hover:bg-violet-50"}`}>
                      {e.nmEquipe}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p className="mt-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Pessoas (marque uma ou várias)</p>
          {donos.length > 6 && (
            <label className="relative mt-1 block">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa" aria-label="Buscar pessoa"
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-xs" />
            </label>
          )}
          <ul className="mt-1 max-h-56 overflow-y-auto">
            {visiveis.map(d => {
              const sel = marcados.includes(d.id);
              return (
                <li key={d.id}>
                  <button type="button" onClick={() => onMudar(alternarPessoaNoFiltro(filtro.tipo === "pessoas" && filtro.rotulo ? { tipo: "pessoas", ids: filtro.ids } : filtro, d.id))}
                    aria-pressed={sel} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${sel ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300"}`}>
                      {sel && <Check size={12} />}
                    </span>
                    <span className="truncate">{d.nome}</span>
                  </button>
                </li>
              );
            })}
            {visiveis.length === 0 && <li className="px-2 py-1.5 text-xs text-slate-400">Ninguém encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
