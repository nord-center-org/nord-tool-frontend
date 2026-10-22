import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Loader2, Minus, Plus } from "lucide-react";

import type { FinanceiroCategoria, FinanceiroLancamento, FinanceiroPessoa, TipoFluxo } from "@/shared/types";
import LancamentoFinanceiroModal from "@/react-app/components/financeiro/LancamentoFinanceiroModal";
import { financeiroService, type LancamentoFinanceiroForm } from "@/react-app/services/FinanceiroService";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";
import { formatarMoeda } from "@/react-app/utils/casamento";
import { competenciaDaData, deslocarMes, rotuloMes } from "@/react-app/utils/financeiro";
import { fraseDoMes, resumirMes, ultimos } from "@/react-app/utils/financeiroResumo";

interface Props {
  pessoas: FinanceiroPessoa[];
  categorias: FinanceiroCategoria[];
  idPessoa: number;
  onGerenciarCadastros: () => void;
  onVerExtrato: () => void;
}

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

/** Visão simples do mês: quanto sobra, entrou, saiu, falta pagar e onde mais se gastou, com lançamento rápido. */
export default function ResumoTab({ pessoas, categorias, idPessoa, onGerenciarCadastros, onVerExtrato }: Props) {
  const [competencia, setCompetencia] = useState(() => competenciaDaData(hojeSaoPaulo()));
  const [lancamentos, setLancamentos] = useState<FinanceiroLancamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<TipoFluxo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const lista = await financeiroService.listar({ competencia, idPessoa: idPessoa || undefined });
      setLancamentos(lista.lancamentos);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível carregar o mês."));
    }
  }, [competencia, idPessoa]);

  useEffect(() => { setLancamentos(null); void carregar(); }, [carregar]);

  const r = useMemo(() => resumirMes(lancamentos ?? []), [lancamentos]);
  const recentes = useMemo(() => ultimos(lancamentos ?? [], 5), [lancamentos]);
  const barra = r.pctComprometido == null ? 0 : Math.min(100, r.pctComprometido);

  const salvar = async (form: LancamentoFinanceiroForm): Promise<string | null> => {
    try {
      await financeiroService.criar(form);
      setNovo(null);
      setAviso("Lançamento salvo.");
      await carregar();
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível salvar o lançamento.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Mês">
          <button type="button" aria-label="Mês anterior" onClick={() => setCompetencia(c => deslocarMes(c, -1))} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-32 text-center text-sm font-bold capitalize text-slate-700">{rotuloMes(competencia)}</span>
          <button type="button" aria-label="Próximo mês" onClick={() => setCompetencia(c => deslocarMes(c, 1))} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button type="button" onClick={() => setNovo("SAIDA")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 active:scale-[0.98]">
            <Minus className="h-4 w-4" /> Gasto
          </button>
          <button type="button" onClick={() => setNovo("ENTRADA")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Entrada
          </button>
        </div>
      </div>

      {aviso && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{aviso}</p>}
      {erro && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro} <button type="button" onClick={() => void carregar()} className="ml-2 font-bold underline">Tentar de novo</button></div>}

      {lancamentos === null ? (
        !erro && <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
      ) : (
        <>
          <section aria-label="Sobra do mês" className={`rounded-3xl p-5 text-white shadow-lg sm:p-6 ${r.sobra < 0 ? "bg-gradient-to-br from-red-600 to-rose-700" : "bg-gradient-to-br from-slate-900 to-blue-900"}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Sobra do mês</p>
            <p className="mt-1 text-4xl font-black tracking-tight">{formatarMoeda(r.sobra)}</p>
            <p className="mt-1 text-sm text-white/80">{fraseDoMes(r)}</p>
            {r.pctComprometido != null && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Quanto das entradas já foi para saídas" aria-valuenow={barra} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full rounded-full ${r.pctComprometido >= 90 ? "bg-amber-300" : "bg-emerald-300"}`} style={{ width: `${barra}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-white/70">{r.pctComprometido}% do que entrou já está em saídas</p>
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1 text-[11px] font-bold uppercase text-slate-400"><ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" /> Entrou</p>
              <p className="mt-1 text-xl font-black text-emerald-700">{formatarMoeda(r.entrou)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1 text-[11px] font-bold uppercase text-slate-400"><ArrowDownCircle className="h-3.5 w-3.5 text-red-600" /> Saiu</p>
              <p className="mt-1 text-xl font-black text-red-700">{formatarMoeda(r.saiu)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase text-slate-400">Falta pagar</p>
              <p className="mt-1 text-xl font-black text-amber-700">{formatarMoeda(r.faltaPagar)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase text-slate-400">Falta receber</p>
              <p className="mt-1 text-xl font-black text-slate-700">{formatarMoeda(r.faltaReceber)}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-label="Onde mais gastou" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Onde mais gastou</h3>
              {r.maioresGastos.length === 0 ? <p className="text-sm text-slate-400">Sem gastos neste mês.</p> : (
                <ul className="space-y-2.5">
                  {r.maioresGastos.map(g => (
                    <li key={g.categoria}>
                      <div className="flex justify-between text-sm"><span className="font-semibold text-slate-700">{g.categoria}</span><span className="text-slate-600">{formatarMoeda(g.valor)} <span className="text-xs text-slate-400">({g.pct}%)</span></span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-red-400" style={{ width: `${g.pct}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-label="Últimos lançamentos" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Últimos lançamentos</h3>
                <button type="button" onClick={onVerExtrato} className="text-xs font-bold text-blue-600 hover:underline">Ver todos</button>
              </div>
              {recentes.length === 0 ? <p className="text-sm text-slate-400">Nada lançado ainda.</p> : (
                <ul className="divide-y divide-slate-100">
                  {recentes.map(l => (
                    <li key={l.idLancamento} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-700">{l.dsLancamento || l.nmCategoria}</p>
                        <p className="text-xs text-slate-400">{l.dtLancamento} · {l.nmCategoria}{l.inRealizado ? "" : " · previsto"}</p>
                      </div>
                      <span className={`shrink-0 font-bold ${l.cdTipo === "ENTRADA" ? "text-emerald-700" : "text-red-700"}`}>{l.cdTipo === "ENTRADA" ? "+" : "−"}{formatarMoeda(l.vlLancamento)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {novo && (
        <LancamentoFinanceiroModal pessoas={pessoas} categorias={categorias} idPessoaPadrao={idPessoa || (pessoas.filter(p => p.inAtivo).length === 1 ? pessoas.find(p => p.inAtivo)?.idPessoa : null)}
          tipoInicial={novo} realizadoInicial onSalvar={salvar} onGerenciarCadastros={onGerenciarCadastros} onFechar={() => setNovo(null)} />
      )}
    </div>
  );
}
