import assert from "node:assert/strict";
import { test } from "node:test";

import { itemDoRascunho, quandoDoRascunho } from "./rascunhoDemanda.ts";
import type { RascunhoDemanda } from "../services/CronogramaSemanalService";

const base: RascunhoDemanda = {
  nmCronogramaSemanal: "Reunião de obra", nmCategoria: "Engenharia", nmStatusCronograma: "pendentes", flFixo: false, diasSemana: [],
};

test("fixa: um dia por item, sem agendamento, com horário", () => {
  const { item, dias } = itemDoRascunho({ ...base, flFixo: true, diasSemana: [3, 1, 3], nmHorario: "09:00", dtAgendamento: "2026-11-02T09:00" });
  assert.deepEqual(dias, [1, 3]);
  assert.equal(item.flFixo, true);
  assert.equal(item.idDiaSemana, 1);
  assert.equal(item.nmHorario, "09:00");
  assert.equal(item.dtAgendamento, null);
});

test("fixa sem dia vira demanda comum; campos vazios viram texto vazio", () => {
  const { item, dias } = itemDoRascunho({ ...base, flFixo: true, diasSemana: [], dtAgendamento: "2026-11-05T14:30", txObservacao: null });
  assert.deepEqual(dias, []);
  assert.equal(item.flFixo, false);
  assert.equal(item.dtAgendamento, "2026-11-05T14:30");
  assert.equal(item.txObservacao, "");
  assert.equal(item.nmTag, "");
});

test("resumo de quando acontece", () => {
  assert.equal(quandoDoRascunho({ ...base, flFixo: true, diasSemana: [1, 3], nmHorario: "09:00" }), "Toda seg, qua às 09:00");
  assert.equal(quandoDoRascunho({ ...base, flFixo: true, diasSemana: [5, 4, 3, 2, 1] }), "Dias úteis");
  assert.equal(quandoDoRascunho({ ...base, dtAgendamento: "2026-11-05T14:30", dtPrazo: "2026-11-06" }), "05/11 às 14:30 · Prazo 06/11");
  assert.equal(quandoDoRascunho(base), "");
});
