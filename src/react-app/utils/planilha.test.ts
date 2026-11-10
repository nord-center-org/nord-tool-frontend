import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";

import { abasParaSalvar, abasParaXlsx, formulaParaIngles, lerPlanilha, numeroPtBr, planilhaVazia, temFormulaEmPortugues, xlsxParaAbas, type AbaFs } from "./planilha.ts";

test("fórmulas em português viram as do editor", () => {
  assert.equal(formulaParaIngles("=SOMA(A1:A3)"), "=SUM(A1:A3)");
  assert.equal(formulaParaIngles("=soma(A1:A3)/média(B1:B3)"), "=SUM(A1:A3)/AVERAGE(B1:B3)");
  assert.equal(formulaParaIngles('=SE(B2>10;"sim; claro";"não")'), '=IF(B2>10,"sim; claro","não")');
  assert.equal(formulaParaIngles("=ARRED(A1*1,5;2)"), "=ROUND(A1*1.5,2)");
  assert.equal(formulaParaIngles("=PROCV(A2;D:E;2;0)"), "=VLOOKUP(A2,D:E,2,0)");
  assert.equal(formulaParaIngles("=CONT.SE(A:A;\">5\")"), '=COUNTIF(A:A,">5")');
  assert.equal(formulaParaIngles("=SUM(A1,B1)"), "=SUM(A1,B1)");
  assert.equal(formulaParaIngles("texto; normal"), "texto; normal");
  assert.equal(formulaParaIngles('="SOMA(" & A1'), '="SOMA(" & A1');
  assert.ok(temFormulaEmPortugues("=MÁXIMO(A1:A9)"));
  assert.ok(!temFormulaEmPortugues("=MAX(A1:A9)"));
  assert.ok(!temFormulaEmPortugues(12));
});

test("planilha nova e leitura tolerante", () => {
  assert.equal(planilhaVazia()[0].name, "Página1");
  assert.equal(lerPlanilha("").length, 1);
  assert.equal(lerPlanilha("{quebrado")[0].name, "Página1");
  assert.equal(lerPlanilha("[]")[0].name, "Página1");
  const l = lerPlanilha(JSON.stringify([{ name: "Custos" }, 5, { name: "Resumo", celldata: "x" }]));
  assert.deepEqual(l.map(a => [a.name, a.order, a.celldata?.length]), [["Custos", 0, 0], ["Resumo", 1, 0]]);
});

test("para salvar: grade cheia vira só as células preenchidas", () => {
  const aba: AbaFs = { name: "A", data: [[{ v: 1, m: "1" }, null], [null, { v: "x", m: "x" }], [{}]], luckysheet_select_save: [{ row: [0, 0] }], config: { merge: {} } };
  const [s] = abasParaSalvar([aba]);
  assert.deepEqual(s.celldata, [{ r: 0, c: 0, v: { v: 1, m: "1" } }, { r: 1, c: 1, v: { v: "x", m: "x" } }]);
  assert.equal(s.data, undefined);
  assert.equal(s.luckysheet_select_save, undefined);
  assert.deepEqual(s.config, { merge: {} });
});

test("ida e volta do Excel: valores, fórmulas, mescla e largura", () => {
  const abas: AbaFs[] = [{
    name: "Orçamento", order: 0, celldata: [
      { r: 0, c: 0, v: { v: "Item", m: "Item" } }, { r: 0, c: 1, v: { v: "Valor", m: "Valor" } },
      { r: 1, c: 0, v: { v: "Cimento", m: "Cimento" } }, { r: 1, c: 1, v: { v: 30.5, m: "30.5" } },
      { r: 2, c: 1, v: { v: 30.5, m: "30.5", f: "=SUM(B2:B2)" } },
    ], config: { merge: { "3_0": { r: 3, c: 0, rs: 1, cs: 2 } }, columnlen: { 0: 160 } },
  }, { name: "Orçamento" }];
  const wb = abasParaXlsx(abas);
  assert.deepEqual(wb.SheetNames, ["Orçamento", "Orçamento (2)"]);
  const ws = wb.Sheets["Orçamento"];
  assert.equal(ws.B3.f, "SUM(B2:B2)");
  assert.equal(ws.B2.v, 30.5);
  const volta = xlsxParaAbas(XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellFormula: true, cellStyles: true }));
  const cel = (r: number, c: number) => volta[0].celldata?.find(x => x.r === r && x.c === c)?.v;
  assert.equal(cel(1, 0)?.v, "Cimento");
  assert.equal(cel(2, 1)?.f, "=SUM(B2:B2)");
  assert.deepEqual(volta[0].config?.merge?.["3_0"], { r: 3, c: 0, rs: 1, cs: 2 });
  assert.ok(Math.abs((volta[0].config?.columnlen?.[0] ?? 0) - 160) <= 15, `largura ${volta[0].config?.columnlen?.[0]}`);
  assert.equal(volta[0].status, 1);
  assert.equal(xlsxParaAbas(XLSX.utils.book_new())[0].name, "Página1");
});

test("número em português vira número; o resto fica como está", () => {
  assert.equal(numeroPtBr("30,5"), 30.5);
  assert.equal(numeroPtBr("-1.234,56"), -1234.56);
  assert.equal(numeroPtBr("1.250"), 1250);
  assert.equal(numeroPtBr(" 2,75 "), 2.75);
  for (const v of ["12", "1.5", "abc", "=SOMA(A1)", "1,2,3", "12.34.5", 7, null]) assert.equal(numeroPtBr(v), null, String(v));
});
