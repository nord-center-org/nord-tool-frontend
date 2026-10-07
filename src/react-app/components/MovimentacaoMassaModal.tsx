import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { ApartamentoVistoriaDto, StatusVistoriaDto } from "@/shared/types";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { classeInput } from "@/react-app/components/casamento/Campo";
import { apartamentoVistoriaService } from "@/react-app/services/ApartamentoVistoriaService";
import { listarStatusVistoria } from "@/react-app/services/EndpointsDominioService";
import {
  agendasIncompletas, dataParaIso, ehStatusAgendado, executarEmLotes, formDaMovimentacao, type AgendaIndividual,
} from "@/react-app/utils/movimentacaoMassa";

interface MovimentacaoMassaModalProps {
  apartamentos: ApartamentoVistoriaDto[];
  /** Chamado ao fechar: recebe os ids que foram alterados (para recarregar a lista e limpar a seleção). */
  onConcluir: (idsAlterados: number[]) => void;
}

type Fase = "editando" | "enviando" | "resultado";

const horarioValido = (h?: string) => (h && /^([01]\d|2[0-3]):[0-5]\d/.test(h) ? h.slice(0, 5) : "");

/** Muda o status de vários apartamentos de uma vez; ao agendar, cada um recebe sua própria data e horário. */
export default function MovimentacaoMassaModal({ apartamentos, onConcluir }: MovimentacaoMassaModalProps) {
  const [statusList, setStatusList] = useState<StatusVistoriaDto[] | null>(null);
  const [idStatus, setIdStatus] = useState<number | "">("");
  const [agendas, setAgendas] = useState<Record<number, AgendaIndividual>>(() =>
    Object.fromEntries(apartamentos.map(a => [a.idApartamentoVistoria, {
      data: dataParaIso(a.dtApartamentoVigente), horario: horarioValido(a.nmHorarioVistoria),
    }])));
  const [dataTodos, setDataTodos] = useState("");
  const [horarioTodos, setHorarioTodos] = useState("");
  const [fase, setFase] = useState<Fase>("editando");
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [falhas, setFalhas] = useState<{ apt: ApartamentoVistoriaDto; erro: string }[]>([]);
  const [alterados, setAlterados] = useState<number[]>([]);
  const [alvos, setAlvos] = useState<ApartamentoVistoriaDto[]>(apartamentos);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { void listarStatusVistoria().then(setStatusList); }, []);

  const status = statusList?.find(s => s.idStatusVistoria === idStatus);
  const agendando = ehStatusAgendado(status?.nmStatusVistoria);
  const pendentes = useMemo(
    () => (agendando ? agendasIncompletas(alvos.map(a => a.idApartamentoVistoria), agendas) : []),
    [agendando, alvos, agendas],
  );

  const alterarAgenda = (id: number, parcial: Partial<AgendaIndividual>) =>
    setAgendas(a => ({ ...a, [id]: { ...(a[id] ?? { data: "", horario: "" }), ...parcial } }));

  const aplicarATodos = () => setAgendas(a => {
    const novo = { ...a };
    for (const apt of alvos) {
      novo[apt.idApartamentoVistoria] = {
        data: dataTodos || novo[apt.idApartamentoVistoria]?.data || "",
        horario: horarioTodos || novo[apt.idApartamentoVistoria]?.horario || "",
      };
    }
    return novo;
  });

  const executar = async (lista: ApartamentoVistoriaDto[]) => {
    if (idStatus === "") return;
    setFase("enviando");
    setErro(null);
    setProgresso({ feitos: 0, total: lista.length });
    const resultados = await executarEmLotes(
      lista,
      apt => apartamentoVistoriaService.editar(
        formDaMovimentacao(apt, idStatus, agendando ? agendas[apt.idApartamentoVistoria] : undefined),
      ),
      3,
      (feitos, total) => setProgresso({ feitos, total }),
    );
    setAlterados(a => [...a, ...resultados.filter(r => !r.erro).map(r => r.item.idApartamentoVistoria)]);
    const ruins = resultados.filter(r => r.erro).map(r => ({ apt: r.item, erro: r.erro as string }));
    setFalhas(ruins);
    setAlvos(ruins.map(r => r.apt));
    setFase("resultado");
  };

  const confirmar = () => {
    if (idStatus === "") return setErro("Escolha o novo status.");
    if (pendentes.length > 0) return setErro(`Informe data e horário de todos os apartamentos (faltam ${pendentes.length}).`);
    void executar(alvos);
  };

  const fechar = () => { if (fase !== "enviando") onConcluir(alterados); };

  return (
    <ModalBase titulo={`Mover ${apartamentos.length} apartamento(s) de status`} onFechar={fechar} largura="max-w-3xl">
      {fase === "editando" && (
        <div className="space-y-4">
          {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Novo status
            <select value={idStatus} onChange={e => { setIdStatus(e.target.value === "" ? "" : Number(e.target.value)); setErro(null); }} className={`${classeInput} mt-1`}>
              <option value="">{statusList === null ? "Carregando…" : "Selecione…"}</option>
              {statusList?.map(s => <option key={s.idStatusVistoria} value={s.idStatusVistoria}>{s.nmStatusVistoria}</option>)}
            </select>
          </label>

          {agendando ? (
            <section aria-label="Agenda individual" className="space-y-3">
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mesma data para todos
                  <input type="date" value={dataTodos} onChange={e => setDataTodos(e.target.value)} className={`${classeInput} mt-1`} />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mesmo horário para todos
                  <input type="time" value={horarioTodos} onChange={e => setHorarioTodos(e.target.value)} className={`${classeInput} mt-1`} />
                </label>
                <button type="button" onClick={aplicarATodos} disabled={!dataTodos && !horarioTodos} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Aplicar a todos</button>
                <p className="w-full text-xs text-slate-400">Depois ajuste cada apartamento individualmente abaixo.</p>
              </div>
              <ul className="max-h-[45vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {alvos.map(apt => {
                  const id = apt.idApartamentoVistoria;
                  const faltando = pendentes.includes(id);
                  return (
                    <li key={id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${faltando ? "bg-amber-50/60" : ""}`}>
                      <span className="w-32 shrink-0 text-sm font-bold text-slate-700">{apt.nmApartamentoVistoria}</span>
                      <input type="date" aria-label={`Data de ${apt.nmApartamentoVistoria}`} value={agendas[id]?.data ?? ""} onChange={e => alterarAgenda(id, { data: e.target.value })} className={`${classeInput} w-auto`} />
                      <input type="time" aria-label={`Horário de ${apt.nmApartamentoVistoria}`} value={agendas[id]?.horario ?? ""} onChange={e => alterarAgenda(id, { horario: e.target.value })} className={`${classeInput} w-auto`} />
                      {faltando && <span className="text-xs font-medium text-amber-600">falta data/horário</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section aria-label="Apartamentos selecionados" className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-xs text-slate-400">A data e o horário de cada apartamento permanecem como estão.</p>
              <ul className="flex max-h-[30vh] flex-wrap gap-1.5 overflow-y-auto">
                {alvos.map(a => <li key={a.idApartamentoVistoria} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{a.nmApartamentoVistoria}</li>)}
              </ul>
            </section>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={fechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
            <button type="button" onClick={confirmar} disabled={idStatus === ""} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              Mover {alvos.length} apartamento(s)
            </button>
          </div>
        </div>
      )}

      {fase === "enviando" && (
        <div className="flex flex-col items-center gap-3 py-10" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm font-semibold text-slate-600">Salvando {progresso.feitos} de {progresso.total}…</p>
        </div>
      )}

      {fase === "resultado" && (
        <div className="space-y-4" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CheckCircle2 className="h-5 w-5 text-green-600" /> {alterados.length} apartamento(s) atualizado(s)
          </p>
          {falhas.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700"><XCircle className="h-4 w-4" /> {falhas.length} não foi(ram) salvo(s)</p>
              <ul className="max-h-[30vh] space-y-1 overflow-y-auto text-xs text-red-700">
                {falhas.map(f => <li key={f.apt.idApartamentoVistoria}><strong>{f.apt.nmApartamentoVistoria}:</strong> {f.erro}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {falhas.length > 0 && (
              <button type="button" onClick={() => void executar(alvos)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Tentar de novo os que falharam</button>
            )}
            <button type="button" onClick={fechar} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Fechar</button>
          </div>
        </div>
      )}
    </ModalBase>
  );
}
