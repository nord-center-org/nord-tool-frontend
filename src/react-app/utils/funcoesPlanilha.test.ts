import assert from "node:assert/strict";
import { test } from "node:test";

import { FUNCOES, NOVAS, PARAMETROS, listaEmPortugues, type ItemLista } from "./funcoesPlanilha.ts";

const item = (n: string, nomes: string[] = ["number"]): ItemLista => ({
  n, t: 0, d: "English description", a: "English", m: [1, 1], p: nomes.map(name => ({ name, detail: "Some english detail.", example: "A1", require: "m", repeat: "n", type: "rangeall" })),
});

test("nomes em português sem repetir e com a descrição", () => {
  const nomes = Object.values(FUNCOES).map(([pt]) => pt);
  assert.equal(new Set(nomes).size, nomes.length, "dois nomes em português iguais");
  assert.ok(nomes.length >= 200, `${nomes.length} funções`);
  for (const [motor, [pt, desc]] of Object.entries(FUNCOES)) {
    assert.ok(desc.endsWith("."), `${motor}: descrição`);
    assert.equal(pt, pt.toUpperCase(), `${motor}: nome em maiúsculas`);
  }
  assert.equal(FUNCOES.VLOOKUP[0], "PROCV");
  assert.equal(PARAMETROS.range, "intervalo");
});

test("lista do editor em português: traduz, esconde as exóticas e põe as novas", () => {
  const lista = listaEmPortugues([item("SUM"), item("RANK_EQ", ["value", "data"]), item("AGE_BY_IDCARD"), item("BIN2DEC"), item("ADDRESS"), item("SUM")]);
  const nomes = lista.map(f => f.n);
  assert.ok(nomes.includes("SOMA") && nomes.includes("ORDEM.EQ"));
  assert.ok(!nomes.includes("AGE_BY_IDCARD") && !nomes.includes("BIN2DEC"));
  assert.equal(nomes.filter(n => n === "SOMA").length, 1);
  for (const nova of ["PROCX", "UNIRTEXTO", "MÁXIMOSES", "MÍNIMOSES", "ENDEREÇO"]) assert.ok(nomes.includes(nova), nova);
  assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  const ordem = lista.find(f => f.n === "ORDEM.EQ") as ItemLista;
  assert.equal(ordem.d, FUNCOES["RANK.EQ"][1]);
  assert.deepEqual(ordem.p.map(p => p.name), ["valor", "dados"]);
  assert.equal(ordem.p[0].detail, "", "a explicação em inglês sai");
  const endereco = lista.find(f => f.n === "ENDEREÇO") as ItemLista;
  assert.equal(endereco, lista.find(f => f.n === "ENDEREÇO"));
  assert.equal(endereco.p[0].detail, NOVAS.find(n => n.n === "ADDRESS")?.p[0].detail, "a nova substitui a do editor e mantém a ajuda");
});
