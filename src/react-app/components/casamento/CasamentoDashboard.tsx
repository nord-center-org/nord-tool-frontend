import { useCallback, useEffect, useState } from "react";
import { CalendarHeart, Check, Loader2, Pencil, Store, Users, Wallet } from "lucide-react";

import type { CasamentoConfig, CasamentoDashboard as Dados } from "@/shared/types";
import EditarCasalModal from "@/react-app/components/casamento/EditarCasalModal";
import { useContagemRegressiva } from "@/react-app/hooks/useContagemRegressiva";
import type { Sincronizacao } from "@/react-app/hooks/useSincronizacao";
import { casamentoService } from "@/react-app/services/CasamentoService";
import { dataExtensa, doisDigitos, estaAtrasado, formatarMoeda, percentual } from "@/react-app/utils/casamento";

interface CasamentoDashboardProps {
  sync: Sincronizacao;
}

function Unidade({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="min-w-[4.5rem] rounded-xl bg-white/10 px-3 py-2 text-center">
      <div className="text-2xl font-black tabular-nums md:text-3xl">{valor}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">{rotulo}</div>
    </div>
  );
}

/** Aba Dashboard: casal, contagem regressiva, progresso, totais e próximos marcos. */
export default function CasamentoDashboard({ sync }: CasamentoDashboardProps) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      setDados(await casamentoService.dashboard());
      setErroCarga(null);
    } catch (e) {
      setErroCarga(e instanceof Error && e.message ? e.message : "Não foi possível carregar o dashboard.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const contagem = useContagemRegressiva(dados?.configuracao.dataCasamento);

  const salvarCasal = (casal: string, dataCasamento: string) => {
    const antes = dados;
    const nova: CasamentoConfig = { casal, dataCasamento };
    void sync.executar({
      aplicar: () => setDados(d => (d ? { ...d, configuracao: nova } : d)),
      desfazer: () => setDados(antes),
      enviar: () => casamentoService.salvarConfiguracao(casal, dataCasamento),
    });
  };

  const concluirMarco = async (idMarco: number) => {
    const antes = dados;
    const resultado = await sync.executar({
      aplicar: () => setDados(d => {
        if (!d) return d;
        const concluidos = d.qtMarcosConcluidos + 1;
        return {
          ...d,
          qtMarcosConcluidos: concluidos,
          pcMarcosConcluidos: percentual(concluidos, d.qtMarcos),
          proximosMarcos: d.proximosMarcos.filter(m => m.idMarco !== idMarco),
        };
      }),
      desfazer: () => setDados(antes),
      enviar: () => casamentoService.concluirMarco(idMarco, true),
    });
    // Recarrega para o 6º marco entrar na lista dos próximos 5.
    if (resultado.ok) void carregar(true);
  };

  if (carregando) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>;
  }

  if (erroCarga || !dados) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-lg font-bold text-slate-800">Não foi possível carregar o dashboard</h3>
        <p className="mt-1 text-sm text-slate-500">{erroCarga}</p>
        <button type="button" onClick={() => void carregar()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tentar novamente</button>
      </div>
    );
  }

  const { configuracao } = dados;
  const configurado = Boolean(configuracao.casal && configuracao.dataCasamento);
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`;

  return (
    <div className="space-y-6">
      {/* Casal + contagem regressiva */}
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg" aria-label="Contagem regressiva">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Contagem regressiva</p>
            <h2 className="mt-1 text-2xl font-black md:text-3xl">{configuracao.casal || "Defina o casal"}</h2>
            {configuracao.dataCasamento && <p className="mt-1 text-sm text-blue-100">{dataExtensa(configuracao.dataCasamento)}</p>}
          </div>
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label="Editar casal e data"
            title="Editar casal e data"
            className="rounded-xl bg-white/15 p-2 transition-colors hover:bg-white/25"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {!configurado || !contagem ? (
          <button type="button" onClick={() => setEditando(true)} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
            Configurar casal e data
          </button>
        ) : contagem.passou ? (
          <p className="mt-5 text-lg font-bold">A data do casamento chegou. Parabéns!</p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-3" role="timer" aria-label="Tempo restante">
            <Unidade valor={String(contagem.dias)} rotulo="dias" />
            <Unidade valor={doisDigitos(contagem.horas)} rotulo="horas" />
            <Unidade valor={doisDigitos(contagem.minutos)} rotulo="min" />
            <Unidade valor={doisDigitos(contagem.segundos)} rotulo="seg" />
          </div>
        )}
      </section>

      {/* Progresso geral */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Progresso geral">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-bold uppercase text-slate-400">Progresso geral</h3>
          <span className="text-2xl font-black text-slate-800">{dados.pcMarcosConcluidos}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={dados.pcMarcosConcluidos}
          aria-label="Marcos concluídos"
          className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all" style={{ width: `${dados.pcMarcosConcluidos}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-400">{dados.qtMarcosConcluidos} de {dados.qtMarcos} marcos concluídos</p>
      </section>

      {/* Totais */}
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><Store className="h-4 w-4" /> Fornecedores</div>
          <p className="text-3xl font-black text-slate-800">{dados.qtFornecedoresContratados}<span className="text-lg font-bold text-slate-400"> / {dados.qtFornecedores}</span></p>
          <p className="mt-1 text-sm text-slate-500">contratados de {dados.qtFornecedores} cadastrados</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><Users className="h-4 w-4" /> Convidados</div>
          <p className="text-3xl font-black text-slate-800">{dados.qtConvidadosConfirmados}<span className="text-lg font-bold text-slate-400"> / {dados.qtConvidados}</span></p>
          <p className="mt-1 text-sm text-slate-500">confirmados na lista · <strong className="text-slate-700">{dados.qtPessoasConfirmadas}</strong> pessoas com acompanhantes</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><Wallet className="h-4 w-4" /> Valor contratado</div>
          <p className="text-3xl font-black text-slate-800">{formatarMoeda(dados.vlContratado)}</p>
          <p className="mt-1 text-sm text-slate-500">soma dos fornecedores contratados</p>
        </article>
      </div>

      {/* Próximos marcos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Próximos marcos">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><CalendarHeart className="h-4 w-4" /> Próximos marcos</h3>
        {dados.proximosMarcos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            {dados.qtMarcos === 0 ? "Nenhum marco cadastrado. Cadastre na aba Marcos." : "Todos os marcos foram concluídos."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dados.proximosMarcos.map(marco => {
              const atrasado = estaAtrasado(marco.dtPrazo, marco.inConcluido, hojeIso);
              return (
                <li key={marco.idMarco} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{marco.nmTitulo}</p>
                    <p className={`text-xs ${atrasado ? "font-bold text-red-600" : "text-slate-400"}`}>
                      {marco.dtPrazo ? `Prazo: ${marco.dtPrazo}` : "Sem prazo"}{atrasado ? " · atrasado" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={sync.estado === "salvando"}
                    onClick={() => void concluirMarco(marco.idMarco)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Concluir
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editando && (
        <EditarCasalModal atual={configuracao} onSalvar={salvarCasal} onFechar={() => setEditando(false)} />
      )}
    </div>
  );
}
