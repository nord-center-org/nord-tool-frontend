import assert from "node:assert/strict";
import { test } from "node:test";

import { ajustarFormula, blocoDoMovimento, girarBloco, mapaDoMovimento } from "./moverPlanilha.ts";

test("bloco e nova posição; nada a fazer na borda", () => {
  assert.deepEqual(blocoDoMovimento({ eixo: "coluna", inicio: 2, fim: 3, direcao: "antes" }, 10), { de: 1, ate: 3, novoInicio: 1, novoFim: 2 });
  assert.deepEqual(blocoDoMovimento({ eixo: "linha", inicio: 0, fim: 0, direcao: "depois" }, 10), { de: 0, ate: 1, novoInicio: 1, novoFim: 1 });
  assert.equal(blocoDoMovimento({ eixo: "linha", inicio: 0, fim: 1, direcao: "antes" }, 10), null);
  assert.equal(blocoDoMovimento({ eixo: "coluna", inicio: 8, fim: 9, direcao: "depois" }, 10), null);
});

test("girar colunas e linhas", () => {
  // colunas B e C (1..2) vão para a esquerda: A vai para depois delas
  const m = { eixo: "coluna" as const, inicio: 1, fim: 2, direcao: "antes" as const };
  assert.deepEqual([0, 1, 2, 3].map(mapaDoMovimento(m)), [2, 0, 1, 3]);
  assert.deepEqual(girarBloco([["a", "b", "c"], ["1", "2", "3"]], m, 0), [["b", "c", "a"], ["2", "3", "1"]]);
  const l = { eixo: "linha" as const, inicio: 0, fim: 0, direcao: "depois" as const };
  assert.deepEqual(girarBloco([["x"], ["y"]], l, 0), [["y"], ["x"]]);
});

test("as fórmulas continuam apontando para as mesmas células", () => {
  const troca = { eixo: "coluna" as const, inicio: 1, fim: 1, direcao: "antes" as const }; // B ↔ A
  assert.equal(ajustarFormula("=A1+B1*2", troca), "=B1+A1*2");
  assert.equal(ajustarFormula("=SUM(A1:C3)", troca), "=SUM(A1:C3)", "o intervalo cobre as mesmas colunas");
  assert.equal(ajustarFormula("=SUM(A1:A3)", troca), "=SUM(B1:B3)");
  assert.equal(ajustarFormula("=SUM(B2:D2)", { eixo: "coluna", inicio: 4, fim: 4, direcao: "antes" }), "=SUM(B2:E2)", "D sai do meio e E entra");
  assert.equal(ajustarFormula('=CONCAT("A1",B$2)', troca), '=CONCAT("A1",A$2)', "texto entre aspas não muda");
  assert.equal(ajustarFormula("=Plan2!A1+$A$1", troca), "=Plan2!A1+$B$1", "outra página não muda");
  assert.equal(ajustarFormula("=LOG10(A1)", troca), "=LOG10(B1)", "nome de função com número não é referência");
  const linha = { eixo: "linha" as const, inicio: 2, fim: 2, direcao: "antes" as const }; // linha 3 ↔ linha 2
  assert.equal(ajustarFormula("=A2-A3+A10", linha), "=A3-A2+A10");
  assert.equal(ajustarFormula("=AA12", { eixo: "coluna", inicio: 26, fim: 26, direcao: "depois" }), "=AB12");
});
