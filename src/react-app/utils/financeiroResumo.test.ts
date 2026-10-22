import assert from "node:assert/strict";
import { test } from "node:test";

import { fraseDoMes, resumirMes, ultimos, type LancamentoResumo } from "./financeiroResumo.ts";

let id = 0;
const l = (cdTipo: "ENTRADA" | "SAIDA", nmCategoria: string, vlLancamento: number, inRealizado = true, dtLancamento = "10/10/2026"): LancamentoResumo =>
  ({ idLancamento: ++id, cdTipo, nmCategoria, vlLancamento, inRealizado, dtLancamento, dsLancamento: null });

test("totais, falta pagar/receber e % comprometido", () => {
  const r = resumirMes([l("ENTRADA", "Salário", 5000), l("ENTRADA", "Extra", 500, false), l("SAIDA", "Mercado", 1200.1), l("SAIDA", "Aluguel", 1800, false), l("SAIDA", "Mercado", 300.2)]);
  assert.equal(r.entrou, 5500);
  assert.equal(r.saiu, 3300.3);
  assert.equal(r.sobra, 2199.7);
  assert.equal(r.faltaPagar, 1800);
  assert.equal(r.faltaReceber, 500);
  assert.equal(r.pctComprometido, 60);
  assert.deepEqual(r.maioresGastos.map(g => [g.categoria, g.valor, g.pct]), [["Aluguel", 1800, 55], ["Mercado", 1500.3, 45]]);
});

test("mês vazio e sem entradas", () => {
  const vazio = resumirMes([]);
  assert.equal(vazio.pctComprometido, null);
  assert.equal(fraseDoMes(vazio), "Nenhum lançamento neste mês ainda.");
  const soGasto = resumirMes([l("SAIDA", "Mercado", 100)]);
  assert.equal(soGasto.pctComprometido, null);
  assert.match(fraseDoMes(soGasto), /passam das entradas em R\$\s?100,00/);
});

test("frases", () => {
  assert.equal(fraseDoMes(resumirMes([l("ENTRADA", "S", 1000), l("SAIDA", "A", 950)])), "Quase tudo o que entrou já está comprometido.");
  assert.equal(fraseDoMes(resumirMes([l("ENTRADA", "S", 1000), l("SAIDA", "A", 100)])), "As contas do mês estão no azul.");
});

test("últimos lançamentos: mais recentes primeiro", () => {
  const a = l("SAIDA", "A", 1, true, "01/10/2026"), b = l("SAIDA", "B", 1, true, "15/10/2026"), c = l("SAIDA", "C", 1, true, "15/10/2026");
  assert.deepEqual(ultimos([a, b, c], 2).map(x => x.nmCategoria), ["C", "B"]);
});
