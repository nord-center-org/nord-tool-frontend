import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, ClipboardList, Loader2, Plus, Ruler, Search } from "lucide-react";

import EditorMapeamento from "@/react-app/components/mapeamentos/EditorMapeamento";
import NovoMapeamentoModal from "@/react-app/components/mapeamentos/NovoMapeamentoModal";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { useAuth } from "@/react-app/hooks/useAuth";
import { mapeamentoService as servico, type Mapeamento, type MapeamentoForm } from "@/react-app/services/MapeamentoService";
import type { TipoMapeamento } from "@/react-app/utils/mapeamentos";
import { combinaBusca } from "@/react-app/utils/relatorioFotografico";
import { podeAcessar } from "@/react-app/utils/sessao";

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

/** Mapeamentos: contagens de campo e levantamentos de quantitativos da obra/fase. */
export default function MapeamentosPage() {
  const { usuario } = useAuth();
  const podeEditar = podeAcessar(usuario?.permissoes, "MAPEAMENTOS", "ESCRITA");
  const [lista, setLista] = useState<Mapeamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<TipoMapeamento | "">("");

  const carregar = useCallback(async () => {
    setErro(null);
    try { setLista(await servico.listar()); } catch (e) { setErro(mensagem(e, "Não foi possível carregar os mapeamentos.")); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const visiveis = useMemo(() => (lista ?? []).filter(m => (!tipo || m.cdTipo === tipo) && combinaBusca(m, busca)), [lista, tipo, busca]);

  const criar = async (form: MapeamentoForm, idFase: number | null) => {
    try {
      const m = await servico.criar(form, idFase);
      setLista(l => [m, ...(l ?? [])]);
      setNovo(false);
      setAberto(m.id);
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível criar o mapeamento.");
    }
  };

  if (aberto !== null) {
    return (
      <div className="mx-auto max-w-6xl">
        <EditorMapeamento id={aberto} podeEditar={podeEditar} onVoltar={() => { setAberto(null); void carregar(); }}
          onAlterado={m => setLista(l => (l ?? []).map(x => (x.id === m.id ? { ...m, linhas: undefined, qtLinhas: m.linhas?.length ?? m.qtLinhas } : x)))}
          onExcluido={id => { setLista(l => (l ?? []).filter(x => x.id !== id)); setAberto(null); }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina icone={Ruler} titulo="Mapeamentos" subtitulo="Contagens de campo e quantitativos (projeto × medido × solicitado)"
        acoes={podeEditar && (
          <button type="button" onClick={() => setNovo(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Novo mapeamento
          </button>
        )} />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input aria-label="Buscar mapeamento" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título, local, fase…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <select aria-label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as TipoMapeamento | "")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="">Todos os tipos</option>
          <option value="CONTAGEM">Contagens</option>
          <option value="QUANTITATIVO">Quantitativos</option>
        </select>
      </div>

      {erro && <div role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro} <button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar de novo</button></div>}

      {!lista ? (!erro && <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>)
        : visiveis.length === 0 ? (
          <div className="animate-surgir rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            {lista.length === 0 ? "Nenhum mapeamento ainda." : "Nenhum mapeamento com esse filtro."}
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Mapeamentos">
            {visiveis.map(m => {
              const Icone = m.cdTipo === "CONTAGEM" ? ClipboardList : Ruler;
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => setAberto(m.id)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-200 active:scale-[0.99]">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icone className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-800">{m.nmTitulo}</p>
                      <p className="truncate text-xs text-slate-500">
                        {m.cdTipo === "CONTAGEM" ? "Contagem" : "Quantitativo"} · {m.dtMapeamento.split("-").reverse().join("/")}{m.nmLocal ? ` · ${m.nmLocal}` : ""}{m.nmFase ? ` · ${m.nmFase}` : ""} · {m.qtLinhas} linha(s)
                      </p>
                    </div>
                    <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${m.cdStatus === "CONCLUIDO" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{m.cdStatus === "CONCLUIDO" ? "Concluído" : "Em preenchimento"}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

      {novo && <NovoMapeamentoModal onCriar={criar} onFechar={() => setNovo(false)} />}
    </div>
  );
}
