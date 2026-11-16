import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";

import {
  abasEmPortugues, abasParaSalvar, abasParaXlsx, dataPtBr, formulaParaIngles, formulaParaPortugues, lerPlanilha, normalizarFormula, numeroNaTela, numeroPtBr, planilhaVazia,
  prepararAbas, precisaNormalizar, quantidadeSelecionada, temFormulaEmPortugues, textoNaTela, xlsxParaAbas, type AbaFs,
} from "./planilha.ts";

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
      { r: 2, c: 1, v: { v: 30.5, m: "30.5", f: "=SOMA(B2:B2)" } },
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
  assert.equal(cel(2, 1)?.f, "=SOMA(B2:B2)", "o Excel volta com o nome em português");
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

test("v5: a célula fica em português; o motor recebe inglês", () => {
  assert.equal(normalizarFormula("=SOMA(A1;B1*1,5)"), "=SOMA(A1,B1*1.5)");
  assert.equal(normalizarFormula("=sum(A1:A3)"), "=SOMA(A1:A3)", "nome em inglês vira português");
  assert.equal(normalizarFormula("=media(A1:A3)"), "=MÉDIA(A1:A3)", "sem acento também vale");
  assert.equal(normalizarFormula('=SE(A1>10;"sim; claro";"não")'), '=SE(A1>10,"sim; claro","não")');
  assert.equal(normalizarFormula("=PROCX(A2;B:B;C:C)"), "=PROCX(A2,B:B,C:C)");
  assert.equal(normalizarFormula("=CONT.SES(A:A;\">5\";B:B;\"obra\")"), '=CONT.SES(A:A,">5",B:B,"obra")');
  assert.equal(normalizarFormula("=ORDEM.EQ(A1;A:A)"), "=ORDEM.EQ(A1,A:A)");
  assert.equal(formulaParaIngles("=MÉDIA(A1:A3)+ÍNDICE(B:B;2)"), "=AVERAGE(A1:A3)+INDEX(B:B,2)");
  assert.equal(formulaParaIngles("=ORDEM.EQ(A1,A:A)"), "=RANK.EQ(A1,A:A)");
  assert.equal(formulaParaIngles("=UNIRTEXTO(\", \";VERDADEIRO;A1:A3)"), '=TEXTJOIN(", ",TRUE(),A1:A3)');
  assert.equal(formulaParaIngles("=SE(A1;TRUE;falso())"), "=IF(A1,TRUE(),FALSE())", "o motor só entende TRUE() e FALSE()");
  assert.equal(formulaParaPortugues("=IF(ISBLANK(A1),\"IF(\",VLOOKUP(A1,B:C,2,FALSE))"), '=SE(ÉCÉL.VAZIA(A1),"IF(",PROCV(A1,B:C,2,FALSO))');
  assert.equal(formulaParaPortugues("=BIN2DEC(A1)"), "=BIN2DEC(A1)", "sem nome em português, fica igual");
  assert.equal(normalizarFormula("=SE(A1;VERDADEIRO;falso)"), "=SE(A1,VERDADEIRO,FALSO)");
  assert.equal(formulaParaIngles("=SE(VERDADEIRO1;'FALSO'!A1;FALSO)"), "=IF(VERDADEIRO1,'FALSO'!A1,FALSE())", "célula e página com esse nome ficam");
  assert.equal(formulaParaPortugues("=AND(TRUE(),FALSE)"), "=E(VERDADEIRO,FALSO)");
  assert.ok(precisaNormalizar("=SUM(A1)"));
  assert.ok(precisaNormalizar("=SOMA(A1;A2)"));
  assert.ok(!precisaNormalizar("=SOMA(A1,A2)"));
  assert.ok(!precisaNormalizar("texto"));
});

test("v5: abrir prepara id e a lista das células com fórmula (para recalcular)", () => {
  const [a, b2] = prepararAbas([
    { name: "A", celldata: [{ r: 0, c: 0, v: { v: 1 } }, { r: 2, c: 1, v: { f: "=SUM(A1:A2)", v: 1 } }] },
    { name: "B", id: "p1", celldata: [{ r: 0, c: 0, v: { f: "texto" } }] },
  ]);
  assert.equal(a.id, "p1");
  assert.deepEqual(a.calcChain, [{ r: 2, c: 1, id: "p1" }]);
  assert.equal(a.celldata?.[1].v?.f, "=SOMA(A1:A2)");
  assert.equal(b2.id, "p2", "id repetido ganha outro");
  assert.deepEqual(b2.calcChain, []);
  assert.equal(prepararAbas([{ name: "C", id: "abc" }])[0].id, "abc");
});

test("v5: planilhas antigas (em inglês) abrem em português", () => {
  const [aba] = abasEmPortugues([{ name: "P", celldata: [{ r: 0, c: 0, v: { f: "=SUM(A2:A3)", v: 3 } }, { r: 1, c: 0, v: { v: 1 } }, { r: 2, c: 0, v: null }] }]);
  assert.equal(aba.celldata?.[0].v?.f, "=SOMA(A2:A3)");
  assert.equal(aba.celldata?.[1].v?.v, 1);
  assert.equal(abasEmPortugues([{ name: "Q" }])[0].celldata?.length, 0);
});

test("v5: números na tela no jeito brasileiro", () => {
  assert.equal(numeroNaTela("1,234.5"), "1.234,5");
  assert.equal(numeroNaTela("R$1,200.09"), "R$1.200,09");
  assert.equal(numeroNaTela("R$ 1,200.09"), "R$ 1.200,09");
  assert.equal(numeroNaTela("12.5%"), "12,5%");
  assert.equal(numeroNaTela("-0.75"), "-0,75");
  assert.equal(numeroNaTela("(1,200.00)"), "(1.200,00)");
  assert.equal(numeroNaTela("30"), "30");
  assert.equal(numeroNaTela("2026-11-11"), "2026-11-11");
  assert.equal(numeroNaTela("13:30"), "13:30");
  assert.equal(numeroNaTela("v1.2.3"), "v1.2.3");
  assert.equal(numeroNaTela("Cimento 2.5"), "Cimento 2.5");
  assert.equal(numeroNaTela("1,2,3"), "1,2,3", "lista não é número");
  assert.equal(numeroNaTela("1234.56"), "1234,56");
  assert.equal(textoNaTela("TRUE"), "VERDADEIRO");
  assert.equal(textoNaTela("FALSE"), "FALSO");
  assert.equal(textoNaTela("#NAME?"), "#NOME?");
  assert.equal(textoNaTela("#N/A"), "#N/D");
  assert.equal(textoNaTela("#DIV/0!"), "#DIV/0!");
  assert.equal(textoNaTela("2.5"), "2,5");
  assert.equal(textoNaTela("Obra"), "Obra");
});

test("v5: data digitada como dd/mm/aaaa", () => {
  assert.deepEqual(dataPtBr("11/12/2026"), { iso: "2026-12-11", formato: "dd/MM/yyyy" });
  assert.deepEqual(dataPtBr("5/3/26"), { iso: "2026-03-05", formato: "dd/MM/yyyy" });
  assert.deepEqual(dataPtBr("11/12/2026 14:30"), { iso: "2026-12-11 14:30", formato: "dd/MM/yyyy hh:mm" });
  assert.deepEqual(dataPtBr("11/12/2026 08:05:09"), { iso: "2026-12-11 08:05:09", formato: "dd/MM/yyyy hh:mm:ss" });
  assert.equal(dataPtBr("31/02/2026"), null);
  assert.equal(dataPtBr("11/13/2026"), null);
  assert.equal(dataPtBr("11/12/2026 25:00"), null);
  assert.equal(dataPtBr("1/2"), null);
  assert.equal(dataPtBr(44000), null);
});

test("correção: planilha nova com 1000 linhas e inserir N linhas pela seleção", () => {
  assert.equal(planilhaVazia()[0].row, 1000);
  assert.equal(planilhaVazia()[0].column, 26);
  assert.equal(quantidadeSelecionada([2, 6]), 5);
  assert.equal(quantidadeSelecionada([4, 4]), 1);
  assert.equal(quantidadeSelecionada(undefined), 1);
  assert.equal(quantidadeSelecionada([0, 99999]), 1000, "no máximo 1000 de uma vez");
});
