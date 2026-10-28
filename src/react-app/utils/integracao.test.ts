import assert from "node:assert/strict";
import { test } from "node:test";

import { instrucaoAssistente, linkRelatorio, quandoUsado } from "./integracao.ts";

test("linkRelatorio monta a URL absoluta, mesmo com API_BASE relativo", () => {
  assert.equal(linkRelatorio("https://api.x/api/v1/nord-tool/", "ntk_abc"), "https://api.x/api/v1/nord-tool/publico/cronograma/ntk_abc");
  assert.equal(linkRelatorio("/api/v1/nord-tool", "ntk_abc", "http://localhost:5173"), "http://localhost:5173/api/v1/nord-tool/publico/cronograma/ntk_abc");
});

test("instrucaoAssistente leva o link e o horário", () => {
  const t = instrucaoAssistente("https://l/x", "6h30");
  assert.match(t, /Todo dia às 6h30/);
  assert.match(t, /https:\/\/l\/x/);
  assert.match(t, /atrasadas/);
});

test("quandoUsado mostra a data do último uso", () => {
  assert.equal(quandoUsado(null), "nunca usado");
  assert.equal(quandoUsado("2026-10-28T07:47:03.937817"), "último uso 28/10 07:47");
  assert.equal(quandoUsado("lixo"), "nunca usado");
});
