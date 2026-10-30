/** Demanda montada pela Lugia no chat do cronograma: vira o item do formulário e um resumo de quando acontece. */
import type { CronogramaSemanalItem, RascunhoDemanda } from "../services/CronogramaSemanalService";

const CURTO: Record<number, string> = { 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex", 7: "sáb" };

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Item do formulário (datas como nos campos da tela) e os dias da atividade fixa (um item por dia ao salvar). */
export function itemDoRascunho(r: RascunhoDemanda): { item: CronogramaSemanalItem; dias: number[] } {
  const dias = r.flFixo ? [...new Set(r.diasSemana)].sort((a, b) => a - b) : [];
  return {
    item: {
      nmCronogramaSemanal: r.nmCronogramaSemanal,
      txObservacao: r.txObservacao ?? "",
      nmCategoria: r.nmCategoria,
      nmStatusCronograma: r.nmStatusCronograma,
      nmTag: r.nmTag ?? "",
      dtPrazo: r.dtPrazo ?? null,
      flFixo: dias.length > 0,
      idDiaSemana: dias[0] ?? null,
      nmHorario: dias.length ? r.nmHorario ?? "" : undefined,
      dtAgendamento: dias.length ? null : r.dtAgendamento ?? null,
    },
    dias,
  };
}

/** "Toda seg, qua às 09:00", "Dias úteis", "05/11 às 14:30", "Prazo 06/11"… (vazio quando não tem data). */
export function quandoDoRascunho(r: RascunhoDemanda): string {
  const partes: string[] = [];
  const { dias } = itemDoRascunho(r);
  if (dias.length) {
    const nomes = dias.join(",") === "1,2,3,4,5" ? "Dias úteis" : dias.join(",") === "1,2,3,4,5,7" ? "Seg a sáb" : `Toda ${dias.map(d => CURTO[d]).join(", ")}`;
    partes.push(r.nmHorario ? `${nomes} às ${r.nmHorario}` : nomes);
  } else if (r.dtAgendamento) {
    partes.push(`${dataBr(r.dtAgendamento)} às ${r.dtAgendamento.slice(11, 16)}`);
  }
  if (r.dtPrazo) partes.push(`Prazo ${dataBr(r.dtPrazo)}`);
  return partes.join(" · ");
}
