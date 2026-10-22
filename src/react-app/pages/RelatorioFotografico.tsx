import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, ChevronRight, LayoutTemplate, Loader2, Plus, Search } from "lucide-react";

import EditorRelatorio from "@/react-app/components/relatorio/EditorRelatorio";
import ModelosModal from "@/react-app/components/relatorio/ModelosModal";
import NovoRelatorioModal from "@/react-app/components/relatorio/NovoRelatorioModal";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { useAuth } from "@/react-app/hooks/useAuth";
import {
  relatorioFotograficoService as servico, type ModeloRelatorio, type RelatorioFotografico, type RelatorioForm,
} from "@/react-app/services/RelatorioFotograficoService";
import { ROTULO_STATUS, combinaBusca, type StatusRelatorio } from "@/react-app/utils/relatorioFotografico";
import { podeAcessar } from "@/react-app/utils/sessao";

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

/** Relatório fotográfico: lista dos relatórios da obra/fase, criação por modelo e preenchimento. */
export default function RelatorioFotograficoPage() {
  const { usuario } = useAuth();
  const podeEditar = podeAcessar(usuario?.permissoes, "RELATORIO_FOTOGRAFICO", "ESCRITA");
  const ehAdmin = podeAcessar(usuario?.permissoes, "RELATORIO_FOTOGRAFICO", "ADMIN");
  const [relatorios, setRelatorios] = useState<RelatorioFotografico[] | null>(null);
  const [modelos, setModelos] = useState<ModeloRelatorio[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [novo, setNovo] = useState(false);
  const [gerirModelos, setGerirModelos] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusRelatorio | "">("");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [lista, mods] = await Promise.all([servico.listar(), servico.modelos()]);
      setRelatorios(lista);
      setModelos(mods);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível carregar os relatórios."));
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const visiveis = useMemo(() => (relatorios ?? []).filter(r => (!status || r.cdStatus === status) && combinaBusca(r, busca)), [relatorios, status, busca]);

  const criar = async (form: RelatorioForm, idFase: number | null): Promise<string | null> => {
    try {
      const r = await servico.criar(form, idFase);
      setRelatorios(l => [r, ...(l ?? [])]);
      setNovo(false);
      setAberto(r.id);
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível criar o relatório.");
    }
  };

  const atualizarResumo = (r: RelatorioFotografico) => {
    const qtFotos = r.itens?.reduce((s, i) => s + i.fotos.length, 0) ?? r.qtFotos;
    setRelatorios(l => (l ?? []).map(x => (x.id === r.id ? { ...r, itens: undefined, qtFotos } : x)));
  };

  if (aberto !== null) {
    return (
      <div className="mx-auto max-w-5xl">
        <EditorRelatorio id={aberto} podeEditar={podeEditar} modelos={modelos} nomeUsuario={usuario?.nome ?? null} onVoltar={() => { setAberto(null); void carregar(); }}
          onAlterado={atualizarResumo} onExcluido={id => { setRelatorios(l => (l ?? []).filter(x => x.id !== id)); setAberto(null); }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina icone={Camera} titulo="Relatório fotográfico" subtitulo="Fotos organizadas por item, prontas para PDF"
        acoes={<>
          {ehAdmin && (
            <button type="button" onClick={() => setGerirModelos(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <LayoutTemplate className="h-4 w-4" /> Modelos
            </button>
          )}
          {podeEditar && (
            <button type="button" onClick={() => setNovo(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Novo relatório
            </button>
          )}
        </>} />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input aria-label="Buscar relatório" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título, local, fase…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value as StatusRelatorio | "")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="">Todos</option>
          <option value="RASCUNHO">{ROTULO_STATUS.RASCUNHO}</option>
          <option value="CONCLUIDO">{ROTULO_STATUS.CONCLUIDO}</option>
        </select>
      </div>

      {erro && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro} <button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar de novo</button>
        </div>
      )}

      {!relatorios ? (
        !erro && <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
      ) : visiveis.length === 0 ? (
        <div className="animate-surgir rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          {relatorios.length === 0 ? "Nenhum relatório ainda." : "Nenhum relatório com esse filtro."}
          {relatorios.length === 0 && podeEditar && <> <button type="button" onClick={() => setNovo(true)} className="font-bold text-blue-600">Criar o primeiro</button></>}
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Relatórios">
          {visiveis.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => setAberto(r.id)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 active:scale-[0.99]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Camera className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{r.nmTitulo}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.dtRelatorio.split("-").reverse().join("/")}{r.nmLocal ? ` · ${r.nmLocal}` : ""}{r.nmFase ? ` · ${r.nmFase}` : ""} · {r.qtFotos} foto(s)
                  </p>
                </div>
                <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${r.cdStatus === "CONCLUIDO" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{ROTULO_STATUS[r.cdStatus]}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-[11px] text-slate-400">As fotos são reduzidas no aparelho (até 1280 px) antes de enviar, para economizar dados e espaço.</p>

      {novo && <NovoRelatorioModal modelos={modelos} onCriar={criar} onFechar={() => setNovo(false)} />}
      {gerirModelos && (
        <ModelosModal modelos={modelos} onFechar={() => setGerirModelos(false)}
          onSalvo={m => setModelos(l => (l.some(x => x.id === m.id) ? l.map(x => (x.id === m.id ? m : x)) : [...l, m]))} />
      )}
    </div>
  );
}
