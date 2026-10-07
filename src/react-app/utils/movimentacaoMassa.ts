/** Regras puras da movimentação em massa de apartamentos (sem React, testáveis em node). */

export interface ApartamentoBasico {
  idApartamentoVistoria: number;
  nmApartamentoVistoria: string;
  idDiaSemana?: number;
  dtApartamentoVigente?: string;
  nmHorarioVistoria?: string;
  idStatusVistoria?: number;
  inMarcarRevistoria?: boolean;
  txObservacaoRevistoria?: string;
  dtRevistoriaVigente?: string;
}

export interface FormApartamento {
  idApartamentoVistoria?: number;
  nmApartamentoVistoria: string;
  idDiaSemana: number;
  dtApartamentoVigente?: string;
  nmHorarioVistoria?: string;
  idStatusVistoria: number;
  inMarcarRevistoria?: boolean;
  txObservacaoRevistoria?: string;
  dtRevistoriaVigente?: string;
}

/** Aceita dd/MM/yyyy, yyyy-MM-dd e yyyy-MM-ddTHH:mm...; devolve yyyy-MM-dd ("" se vazio). */
export function dataParaIso(valor?: string | null): string {
  if (!valor) return "";
  const texto = String(valor).split("T")[0].trim();
  if (texto.includes("/")) {
    const [d, m, a] = texto.split("/");
    return a && m && d ? `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
  }
  return texto;
}

/** Dia da semana no padrão do banco: 1 = segunda … 7 = domingo. */
export function idDiaSemanaDaData(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(a, m - 1, d).getDay();
  return dia === 0 ? 7 : dia;
}

export function ehStatusAgendado(nome?: string | null): boolean {
  return (nome ?? "").toLocaleLowerCase("pt-BR").includes("agendado");
}

/** O formulário completo que o PUT espera, a partir do apartamento atual. */
export function formDoApartamento(apt: ApartamentoBasico): FormApartamento {
  return {
    idApartamentoVistoria: apt.idApartamentoVistoria,
    nmApartamentoVistoria: apt.nmApartamentoVistoria ?? "",
    idDiaSemana: Number(apt.idDiaSemana) || 0,
    dtApartamentoVigente: dataParaIso(apt.dtApartamentoVigente),
    nmHorarioVistoria: apt.nmHorarioVistoria ?? "",
    idStatusVistoria: Number(apt.idStatusVistoria) || 0,
    inMarcarRevistoria: apt.inMarcarRevistoria ?? false,
    txObservacaoRevistoria: apt.txObservacaoRevistoria ?? "",
    dtRevistoriaVigente: apt.dtRevistoriaVigente ?? "",
  };
}

export interface AgendaIndividual {
  /** yyyy-MM-dd */
  data: string;
  /** HH:mm */
  horario: string;
}

/**
 * Formulário final de um apartamento na movimentação: troca só o status; se o novo status for "Agendado",
 * grava a data e o horário informados para ESTE apartamento (e recalcula o dia da semana).
 */
export function formDaMovimentacao(
  apt: ApartamentoBasico,
  idStatusNovo: number,
  agenda?: AgendaIndividual,
): FormApartamento {
  const form = { ...formDoApartamento(apt), idStatusVistoria: idStatusNovo };
  if (agenda) {
    form.dtApartamentoVigente = agenda.data;
    form.nmHorarioVistoria = agenda.horario;
    form.idDiaSemana = idDiaSemanaDaData(agenda.data);
  }
  return form;
}

/** Ids dos apartamentos sem data ou sem horário válidos (todos precisam de ambos ao agendar). */
export function agendasIncompletas(ids: number[], agendas: Record<number, AgendaIndividual | undefined>): number[] {
  return ids.filter(id => {
    const a = agendas[id];
    return !a || !/^\d{4}-\d{2}-\d{2}$/.test(a.data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.horario);
  });
}

export interface ResultadoItem<T> {
  item: T;
  erro: string | null;
}

/**
 * Executa `enviar` para cada item com no máximo `concorrencia` chamadas ao mesmo tempo.
 * Uma falha não interrompe as demais; o resultado mantém a ordem original.
 */
export async function executarEmLotes<T>(
  itens: T[],
  enviar: (item: T) => Promise<unknown>,
  concorrencia = 3,
  aoProgredir?: (concluidos: number, total: number) => void,
): Promise<ResultadoItem<T>[]> {
  const resultados: ResultadoItem<T>[] = new Array(itens.length);
  let proximo = 0;
  let concluidos = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const indice = proximo++;
      try {
        await enviar(itens[indice]);
        resultados[indice] = { item: itens[indice], erro: null };
      } catch (e) {
        resultados[indice] = { item: itens[indice], erro: e instanceof Error && e.message ? e.message : "Falha ao salvar." };
      }
      concluidos += 1;
      aoProgredir?.(concluidos, itens.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concorrencia, itens.length)) }, trabalhador));
  return resultados;
}
