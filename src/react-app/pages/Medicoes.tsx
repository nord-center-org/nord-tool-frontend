import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronRight, Loader2, Pencil, Plus, Ruler, Trash2, X } from "lucide-react";

import type { Medicao, MedicaoStatus } from "@/shared/types";
import BotaoCopiar from "@/react-app/components/medicoes/BotaoCopiar";
import MedicaoModal from "@/react-app/components/medicoes/MedicaoModal";
import { useSincronizacao } from "@/react-app/hooks/useSincronizacao";
import { ApiError } from "@/react-app/services/apiClient";
import { medicaoService, type MedicaoForm } from "@/react-app/services/MedicaoService";
import { formatarMoeda } from "@/react-app/utils/casamento";
import {
  STATUS_PENDENTE, classeStatus, dataIsoParaBr, filtrarMedicoes, observacaoSienge, resumirMedicoes, tituloBoletim,
} from "@/react-app/utils/medicoes";

const classeControle = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20";

export default function MedicoesPage() {
  const sync = useSincronizacao();
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [status, setStatus] = useState<MedicaoStatus[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [modal, setModal] = useState<{ medicao?: Medicao } | null>(null);
  const [abertos, setAbertos] = useState<number[]>([]);
  // Linhas com salvamento em andamento ficam travadas: a próxima troca usaria uma versão velha (409).
  const [ocupados, setOcupados] = useState<number[]>([]);

  const recarregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const lista = await medicaoService.listar();
      setMedicoes(lista.medicoes);
      setStatus(lista.status);
      setErroCarga(null);
    } catch (e) {
      setErroCarga(e instanceof Error && e.message ? e.message : "Não foi possível carregar as medições.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const nomeDoStatus = useMemo(() => new Map(status.map(s => [s.cdStatus, s.nmStatus])), [status]);
  const resumo = useMemo(() => resumirMedicoes(medicoes), [medicoes]);
  const visiveis = useMemo(() => filtrarMedicoes(medicoes, busca, filtroStatus), [medicoes, busca, filtroStatus]);
  const filtrosAtivos = busca.trim() !== "" || filtroStatus !== "";

  const alternar = (id: number) => setAbertos(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]));
  const ocupar = (id: number, ocupado: boolean) => setOcupados(l => (ocupado ? [...l, id] : l.filter(x => x !== id)));

  /** Troca de status na própria linha: otimista, com rollback e tratamento do 409. */
  const trocarStatus = (m: Medicao, cdStatus: string) => {
    if (cdStatus === m.cdStatus || ocupados.includes(m.id)) return;
    ocupar(m.id, true);
    let conflito = false;
    const substituir = (novo: Medicao) => setMedicoes(lista => lista.map(x => (x.id === m.id ? novo : x)));
    void sync.executar({
      aplicar: () => substituir({ ...m, cdStatus, nmStatus: nomeDoStatus.get(cdStatus) ?? cdStatus }),
      desfazer: () => substituir(m),
      enviar: async () => {
        try {
          return await medicaoService.alterarStatus(m.id, cdStatus, m.nrVersao);
        } catch (e) {
          conflito = e instanceof ApiError && e.status === 409;
          throw e;
        }
      },
    }).then(r => {
      ocupar(m.id, false);
      if (r.ok) substituir(r.valor);
      else if (conflito) { setAviso("A medição foi alterada por outra pessoa."); void recarregar(true); }
    });
  };

  /** Devolve a mensagem de erro para o modal (ou null se salvou). Em 409 fecha o modal, avisa e recarrega. */
  const salvar = async (form: MedicaoForm, atual?: Medicao, idFase?: number | null): Promise<string | null> => {
    try {
      if (atual) await medicaoService.alterar(atual.id, form);
      else await medicaoService.criar(form, idFase);
      setModal(null);
      await recarregar(true);
      return null;
    } catch (e) {
      const mensagem = e instanceof Error && e.message ? e.message : "Não foi possível salvar a medição.";
      if (e instanceof ApiError && e.status === 409) {
        setModal(null);
        setAviso(mensagem);
        await recarregar(true);
        return null;
      }
      return mensagem;
    }
  };

  const excluir = (m: Medicao) => {
    if (!window.confirm(`Excluir "${tituloBoletim(m)}" (${formatarMoeda(m.vlMedicao)})?`)) return;
    ocupar(m.id, true);
    const antes = medicoes;
    let conflito = false;
    void sync.executar({
      aplicar: () => setMedicoes(lista => lista.filter(x => x.id !== m.id)),
      desfazer: () => setMedicoes(antes),
      enviar: async () => {
        try {
          await medicaoService.excluir(m.id, m.nrVersao);
        } catch (e) {
          conflito = e instanceof ApiError && e.status === 409;
          throw e;
        }
      },
    }).then(r => {
      ocupar(m.id, false);
      if (!r.ok && conflito) { setAviso("A medição foi alterada por outra pessoa."); void recarregar(true); }
    });
  };

  // Ativos + o status atual da medição (mesmo que já esteja inativo).
  const opcoesDe = (m: Medicao) => status.filter(s => s.inAtivo || s.cdStatus === m.cdStatus);

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <header className="mx-auto mb-4 max-w-5xl rounded-2xl bg-slate-900 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Ruler className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-blue-400">Medições</h1>
              <p className="text-sm text-slate-400">Boletins de medição dos contratos</p>
            </div>
          </div>
          <div className="flex items-center gap-5" aria-label="Resumo">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Pendentes</p>
              <p className="text-lg font-black tabular-nums">
                {resumo.porStatus[STATUS_PENDENTE]?.quantidade ?? 0}
                <span className="ml-2 text-sm font-semibold text-slate-300">{formatarMoeda(resumo.porStatus[STATUS_PENDENTE]?.valor ?? 0)}</span>
              </p>
            </div>
            <button type="button" onClick={() => setModal({})} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700"><Plus className="h-4 w-4" /> Nova medição</button>
          </div>
        </div>
      </header>

      <div className="mx-auto mb-3 flex max-w-5xl justify-end px-1" role="status" aria-live="polite">
        {sync.estado === "salvando" && <span className="flex items-center gap-2 text-xs font-medium text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" /> Salvando…</span>}
        {sync.estado === "ocioso" && <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400"><Check className="h-3.5 w-3.5" /> Tudo salvo</span>}
        {sync.estado === "erro" && (
          <span role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {sync.erro}
            <button type="button" onClick={sync.limparErro} aria-label="Dispensar erro" className="rounded p-0.5 hover:bg-red-100"><X className="h-3.5 w-3.5" /></button>
          </span>
        )}
      </div>

      <main className="mx-auto max-w-5xl space-y-4">
        {aviso && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>{aviso} A lista foi atualizada.</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Dispensar aviso" className="rounded p-0.5 hover:bg-amber-100"><X className="h-4 w-4" /></button>
          </div>
        )}

        <section aria-label="Filtros" className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
            {[{ cdStatus: "", nmStatus: "Todas" }, ...status.filter(s => s.inAtivo || resumo.porStatus[s.cdStatus])].map(s => {
              const ativo = filtroStatus === s.cdStatus;
              const qt = s.cdStatus ? resumo.porStatus[s.cdStatus]?.quantidade ?? 0 : resumo.total;
              return (
                <button
                  key={s.cdStatus || "todas"}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltroStatus(s.cdStatus)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${ativo ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  {s.nmStatus} <span className={ativo ? "text-blue-100" : "text-slate-400"}>{qt}</span>
                </button>
              );
            })}
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar medição"
            placeholder="Buscar por contrato, empresa, memorial…"
            className={`${classeControle} min-w-[14rem] flex-1`}
          />
          {filtrosAtivos && <button type="button" onClick={() => { setBusca(""); setFiltroStatus(""); }} className="text-xs font-bold text-blue-600 hover:underline">Limpar</button>}
        </section>

        {carregando ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" /></div>
        ) : erroCarga ? (
          <div role="alert" className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-bold text-slate-800">Não foi possível carregar as medições</h3>
            <p className="mt-1 text-sm text-slate-500">{erroCarga}</p>
            <button type="button" onClick={() => void recarregar()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tentar novamente</button>
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Medições">
            {visiveis.length === 0 && (
              <li className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
                {medicoes.length === 0 ? "Nenhuma medição cadastrada." : "Nenhuma medição com os filtros atuais."}
              </li>
            )}
            {visiveis.map(m => {
              const aberto = abertos.includes(m.id);
              const ocupado = ocupados.includes(m.id);
              return (
                <li key={m.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => alternar(m.id)}
                      aria-expanded={aberto}
                      aria-label={`${aberto ? "Recolher" : "Ver"} detalhes: ${tituloBoletim(m)}`}
                      className="flex min-w-0 flex-1 basis-72 items-start gap-2 text-left"
                    >
                      <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${aberto ? "rotate-90" : ""}`} />
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-800">{tituloBoletim(m)}</span>
                        <span className="block text-xs text-slate-400">{dataIsoParaBr(m.dtMedicao)}</span>
                      </span>
                    </button>
                    <p className="whitespace-nowrap font-black tabular-nums text-slate-800">{formatarMoeda(m.vlMedicao)}</p>
                    <select
                      value={m.cdStatus}
                      disabled={ocupado}
                      onChange={e => trocarStatus(m, e.target.value)}
                      aria-label={`Status: ${tituloBoletim(m)}`}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold outline-none disabled:opacity-60 ${classeStatus(m.cdStatus)}`}
                    >
                      {opcoesDe(m).map(s => <option key={s.cdStatus} value={s.cdStatus}>{s.nmStatus}</option>)}
                    </select>
                    <div className="flex items-center">
                      <button type="button" disabled={ocupado} onClick={() => setModal({ medicao: m })} aria-label={`Editar ${tituloBoletim(m)}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"><Pencil className="h-4 w-4" /></button>
                      <button type="button" disabled={ocupado} onClick={() => excluir(m)} aria-label={`Excluir ${tituloBoletim(m)}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  {aberto && (
                    <div className="space-y-3 border-t border-slate-100 px-4 py-3 pl-10 text-sm text-slate-600">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observação (Sienge)</p>
                        <p className="mt-1">{observacaoSienge(m)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <BotaoCopiar texto={tituloBoletim(m)} rotulo="Copiar boletim" />
                        <BotaoCopiar texto={observacaoSienge(m)} rotulo="Copiar observação" />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {modal && (
        <MedicaoModal
          key={modal.medicao?.id ?? "nova"}
          medicao={modal.medicao}
          medicoes={medicoes}
          status={status}
          onSalvar={(form, idFase) => salvar(form, modal.medicao, idFase)}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
