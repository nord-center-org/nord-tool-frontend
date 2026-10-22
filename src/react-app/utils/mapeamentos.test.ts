import assert from "node:assert/strict";
import { test } from "node:test";

import { comparar, formatarNumero, lerColagem, lerNumero, linhasPlanilha, totaisPorGrupo, type LinhaMapeamento } from "./mapeamentos.ts";

const linha = (p: Partial<LinhaMapeamento>): LinhaMapeamento => ({ nmGrupo: null, nmItem: "x", nmUnidade: "un", qtProjeto: null, qtMedida: null, qtSolicitada: null, txObservacao: null, ...p });

test("comparação dentro da tolerância não alerta", () => {
  const c = comparar({ qtProjeto: 100, qtMedida: 104, qtSolicitada: 104 }, 5);
  assert.deepEqual(c.alertas, []);
  assert.equal(c.difMedido, 4);
  assert.equal(c.pctMedido, 104);
  assert.equal(c.difSolicitado, 0);
});

test("alertas: medido e solicitado acima do projeto, solicitado acima do medido", () => {
  assert.deepEqual(comparar({ qtProjeto: 100, qtMedida: 106, qtSolicitada: 104 }, 5).alertas, ["MEDIDO_ACIMA_PROJETO"]);
  assert.deepEqual(comparar({ qtProjeto: 100, qtMedida: 90, qtSolicitada: 95 }, 5).alertas, ["SOLICITADO_ACIMA_MEDIDO"]);
  assert.deepEqual(comparar({ qtProjeto: 100, qtMedida: 110, qtSolicitada: 120 }, 5).alertas, ["MEDIDO_ACIMA_PROJETO", "SOLICITADO_ACIMA_MEDIDO", "SOLICITADO_ACIMA_PROJETO"]);
  assert.deepEqual(comparar({ qtProjeto: null, qtMedida: 3, qtSolicitada: null }, 5).alertas, ["SEM_PROJETO"]);
  assert.deepEqual(comparar({ qtProjeto: null, qtMedida: null, qtSolicitada: null }, 5).alertas, []);
  assert.equal(comparar({ qtProjeto: 0, qtMedida: 2, qtSolicitada: null }, 5).pctMedido, null);
});

test("tolerância zero alerta qualquer excesso; arredondamento sem lixo de ponto flutuante", () => {
  assert.deepEqual(comparar({ qtProjeto: 0.3, qtMedida: 0.1 + 0.2, qtSolicitada: null }, 0).alertas, []);
  assert.equal(comparar({ qtProjeto: 1.1, qtMedida: 1.3, qtSolicitada: null }, 0).difMedido, 0.2);
});

test("totais por grupo e unidade", () => {
  const t = totaisPorGrupo([
    linha({ nmGrupo: "Alvenaria", nmUnidade: "m²", qtProjeto: 10, qtMedida: 9.5 }),
    linha({ nmGrupo: "Alvenaria", nmUnidade: "m²", qtProjeto: 5, qtMedida: 5 }),
    linha({ nmGrupo: "Alvenaria", nmUnidade: "m³", qtProjeto: 2 }),
    linha({ nmGrupo: " ", nmUnidade: "un", qtMedida: 4 }),
  ]);
  assert.deepEqual(t.map(x => [x.grupo, x.unidade, x.linhas, x.projeto, x.medida]), [
    ["Alvenaria", "m²", 2, 15, 14.5], ["Alvenaria", "m³", 1, 2, 0], ["Sem grupo", "un", 1, 0, 4],
  ]);
});

test("leitura de números em pt-BR", () => {
  assert.equal(lerNumero("1.250,5"), 1250.5);
  assert.equal(lerNumero("12,75"), 12.75);
  assert.equal(lerNumero("12.75"), 12.75);
  assert.equal(lerNumero("1.250"), 1250);
  assert.equal(lerNumero(" 3 "), 3);
  assert.equal(lerNumero(""), null);
  assert.ok(Number.isNaN(lerNumero("abc") as number));
  assert.ok(Number.isNaN(lerNumero("-2") as number));
  assert.equal(formatarNumero(1250.5), "1.250,5");
  assert.equal(formatarNumero(null), "");
});

test("colar do Excel: cabeçalho ignorado, erros por linha", () => {
  const texto = "Grupo\tItem\tUnidade\tProjeto\tMedido\tSolicitado\nAlvenaria\tBloco 14\tm²\t1.250,5\t1262\t1300\n\tGraute\tm³\t12\n\t\tun\t1\nX\tY\tun\tdois\n";
  const r = lerColagem(texto);
  assert.equal(r.linhas.length, 2);
  assert.deepEqual(r.linhas[0], { nmGrupo: "Alvenaria", nmItem: "Bloco 14", nmUnidade: "m²", qtProjeto: 1250.5, qtMedida: 1262, qtSolicitada: 1300, txObservacao: null });
  assert.equal(r.linhas[1].nmGrupo, null);
  assert.equal(r.linhas[1].qtMedida, null);
  assert.deepEqual(r.erros, ["Linha 4: sem item.", "Linha 5: quantidade inválida."]);
});

test("planilha exportada por tipo", () => {
  const ls = [linha({ nmItem: "Bloco", qtProjeto: 100, qtMedida: 90, qtSolicitada: 95 })];
  const q = linhasPlanilha("QUANTITATIVO", ls, 5)[0];
  assert.equal(q.Alertas, "Solicitado acima do medido");
  assert.equal(q["Medido − Projeto"], -10);
  const c = linhasPlanilha("CONTAGEM", [linha({ nmItem: "Pedreiro", qtMedida: 4 })], 5)[0];
  assert.deepEqual(Object.keys(c), ["Grupo", "Item", "Unidade", "Contado", "Observação"]);
});
