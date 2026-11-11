import assert from "node:assert/strict";
import { test } from "node:test";

import { diasNoPeriodo, emOrdem, posicaoNoPeriodo, rotuloDoPeriodo } from "./periodoAgenda.ts";

test("onde o dia cai no período", () => {
  assert.equal(posicaoNoPeriodo("2026-11-10", "2026-11-14", "2026-11-10"), "inicio");
  assert.equal(posicaoNoPeriodo("2026-11-10", "2026-11-14", "2026-11-12"), "meio");
  assert.equal(posicaoNoPeriodo("2026-11-10", "2026-11-14", "2026-11-14"), "fim");
  assert.equal(posicaoNoPeriodo("2026-11-10", "2026-11-14", "2026-11-15"), null);
  assert.equal(posicaoNoPeriodo("2026-11-10", "2026-11-14", "2026-11-09"), null);
  assert.equal(posicaoNoPeriodo("2026-11-10", null, "2026-11-10"), "unico");
  assert.equal(posicaoNoPeriodo("2026-11-10", "2026-11-10", "2026-11-10"), "unico");
  assert.equal(posicaoNoPeriodo("2026-11-10", "2026-11-08", "2026-11-09"), null, "fim antes do início vale como um dia só");
  assert.equal(posicaoNoPeriodo(null, "2026-11-14", "2026-11-12"), null);
  assert.equal(posicaoNoPeriodo("2026-12-30", "2027-01-02", "2027-01-01"), "meio", "virando o ano");
});

test("dias tocados em ordem e tamanho do período", () => {
  assert.deepEqual(emOrdem("2026-11-14", "2026-11-10"), ["2026-11-10", "2026-11-14"]);
  assert.deepEqual(emOrdem("2026-11-10", "2026-11-14"), ["2026-11-10", "2026-11-14"]);
  assert.equal(diasNoPeriodo("2026-11-10", "2026-11-14"), 5);
  assert.equal(diasNoPeriodo("2026-11-10", null), 1);
  assert.equal(diasNoPeriodo("2026-10-30", "2026-11-02"), 4, "virando o mês");
  assert.equal(diasNoPeriodo("2026-11-10", "2026-11-09"), 1);
});

test("rótulo de cada dia", () => {
  assert.equal(rotuloDoPeriodo("unico", "2026-11-10", null, "08:00"), "◷ 08:00");
  assert.equal(rotuloDoPeriodo("inicio", "2026-11-10", "2026-11-14", "08:00"), "◷ 08:00 → 14/11");
  assert.equal(rotuloDoPeriodo("meio", "2026-11-10", "2026-11-14", "08:00"), "↔ até 14/11");
  assert.equal(rotuloDoPeriodo("fim", "2026-11-10", "2026-11-14", "08:00"), "⇥ termina (5 dias)");
});
