import assert from "node:assert/strict";
import { test } from "node:test";

import { diaDaSemana, diasDeTexto, diasEntre, formatarCarga, formatarSegundos, inicioDaSemana, quandoFoi, textoDeDias, treinosDoDia, treinosNaSemana } from "./treinos.ts";

test("dias da semana em texto", () => {
  assert.deepEqual(diasDeTexto("4,1, 4,9,x"), [1, 4]);
  assert.deepEqual(diasDeTexto(null), []);
  assert.equal(textoDeDias([5, 1, 5]), "1,5");
  assert.equal(textoDeDias([]), null);
});

test("dia da semana: segunda = 1, domingo = 7", () => {
  assert.equal(diaDaSemana("2026-10-19"), 1);
  assert.equal(diaDaSemana("2026-10-21"), 3);
  assert.equal(diaDaSemana("2026-10-25"), 7);
});

test("treinos de hoje só os ativos daquele dia", () => {
  const t = [{ txDias: "1,3", inAtivo: true, n: "A" }, { txDias: "3", inAtivo: false, n: "B" }, { txDias: "2", inAtivo: true, n: "C" }];
  assert.deepEqual(treinosDoDia(t, "2026-10-21").map(x => x.n), ["A"]);
});

test("quando foi o último treino", () => {
  assert.equal(diasEntre("2026-10-01", "2026-10-21"), 20);
  assert.equal(quandoFoi(null, "2026-10-21"), "Ainda não treinado");
  assert.equal(quandoFoi("2026-10-21", "2026-10-21"), "Treinado hoje");
  assert.equal(quandoFoi("2026-10-20", "2026-10-21"), "Ontem");
  assert.equal(quandoFoi("2026-10-14", "2026-10-21"), "Há 7 dias");
});

test("treinos na semana (de segunda até hoje)", () => {
  assert.equal(inicioDaSemana("2026-10-25"), "2026-10-19");
  assert.equal(inicioDaSemana("2026-10-19"), "2026-10-19");
  const s = [{ dtSessao: "2026-10-18" }, { dtSessao: "2026-10-19" }, { dtSessao: "2026-10-21" }, { dtSessao: "2026-10-22" }];
  assert.equal(treinosNaSemana(s, "2026-10-21"), 2);
});

test("formatos", () => {
  assert.equal(formatarSegundos(90), "1:30");
  assert.equal(formatarSegundos(45), "0:45");
  assert.equal(formatarSegundos(-3), "0:00");
  assert.equal(formatarCarga(42.5), "42,5 kg");
  assert.equal(formatarCarga(null), "");
});
