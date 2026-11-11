import assert from "node:assert/strict";
import { test } from "node:test";

import { ADDRESS, AVERAGEIF, AVERAGEIFS, COUNTIF, COUNTIFS, EXTRAS, MAXIFS, MINIFS, SUMIF, SUMIFS, TEXTJOIN, XLOOKUP, atende } from "./funcoesExtras.ts";

const col = (...v: unknown[]) => v.map(x => [x]) as (string | number | null)[][];
const erro = (f: () => unknown, codigo: string) => assert.throws(f, (e: Error) => e.message === codigo);

test("critérios como no Sheets", () => {
  assert.ok(atende(15, ">10"));
  assert.ok(!atende(5, ">10"));
  assert.ok(atende(10, ">=10"));
  assert.ok(atende(3, "<=3,5"), "vírgula decimal no critério");
  assert.ok(atende("Obra A", "obra a"), "sem diferenciar maiúsculas");
  assert.ok(atende("Concreto", "conc*"));
  assert.ok(atende("Laje", "L?je"));
  assert.ok(atende("a*b", "a~*b"));
  assert.ok(!atende("axb", "a~*b"));
  assert.ok(atende("Bloco", "<>Laje"));
  assert.ok(atende("", ""));
  assert.ok(atende(null, "="));
  assert.ok(atende(7, 7));
  assert.ok(atende("7", 7));
  assert.ok(!atende(null, ">0"), "vazio não passa em comparação numérica");
  assert.ok(atende("b", ">a"));
  assert.ok(!atende(null, ">a"));
  assert.ok(atende("Ação", "acao"), "sem diferenciar acentos");
});

test("UNIRTEXTO", () => {
  assert.equal(TEXTJOIN([", ", true, col("a", "", "b"), "c"]), "a, b, c");
  assert.equal(TEXTJOIN(["-", false, col("a", "", "b")]), "a--b");
  assert.equal(TEXTJOIN(["/", "FALSO", col(1, true)]), "1/VERDADEIRO");
  erro(() => TEXTJOIN([",", true]), "N/A");
});

test("MÁXIMOSES e MÍNIMOSES", () => {
  const valores = col(10, 20, 30, "x", 5);
  const obras = col("A", "B", "A", "A", "B");
  assert.equal(MAXIFS([valores, obras, "A"]), 30);
  assert.equal(MINIFS([valores, obras, "B"]), 5);
  assert.equal(MAXIFS([valores, obras, "A", valores, "<25"]), 10);
  assert.equal(MAXIFS([valores, obras, "Z"]), 0, "nada atende: 0, como no Sheets");
  assert.equal(MINIFS([valores, obras, "Z"]), 0);
  erro(() => MAXIFS([valores, col("A"), "A"]), "VALUE");
  erro(() => MAXIFS([valores, obras]), "N/A");
  erro(() => MINIFS([valores, obras, "A", obras]), "N/A");
});

test("PROCX", () => {
  const codigos = col("C1", "C2", "C3");
  const nomes = col("Cimento", "Areia", "Brita");
  assert.equal(XLOOKUP(["c2", codigos, nomes]), "Areia");
  assert.equal(XLOOKUP(["X", codigos, nomes, "não achei"]), "não achei");
  erro(() => XLOOKUP(["X", codigos, nomes]), "N/A");
  const faixas = col(0, 100, 500);
  const taxas = col(0.1, 0.2, 0.3);
  assert.equal(XLOOKUP([250, faixas, taxas, "", -1]), 0.2, "exato ou o próximo menor");
  assert.equal(XLOOKUP([250, faixas, taxas, "", 1]), 0.3, "exato ou o próximo maior");
  erro(() => XLOOKUP([900, faixas, taxas, "", 1]), "N/A");
  assert.equal(XLOOKUP(["Are*", nomes, codigos, "", 2]), "C2", "curinga");
  assert.equal(XLOOKUP(["A", col("A", "B", "A"), col(1, 2, 3), "", 0, -1]), 3, "do fim para o começo");
  assert.equal(XLOOKUP(["C2", codigos, [["Cimento", 10], ["Areia", 20], ["Brita", 30]]]), "Areia", "uma célula só");
  assert.equal(XLOOKUP(["B", [["A", "B", "C"]], [[1, 2, 3]]]), 2, "na horizontal");
  assert.equal(XLOOKUP(["X", codigos, nomes, col("a", "b")]), "a");
  erro(() => XLOOKUP(["C3", codigos, col("a")]), "VALUE");
  erro(() => XLOOKUP(["B", [["A", "B"]], [[1]]]), "VALUE");
  erro(() => XLOOKUP(["A", codigos]), "N/A");
});

test("CONT.SE, SOMASE e MÉDIASE sem diferenciar maiúsculas nem acentos", () => {
  const obras = col("Obra A", "obra a", "Obra B", "Óbra a", null);
  const valores = col(10, 20, 30, "x", 5);
  assert.equal(COUNTIF([obras, "obra a"]), 3);
  assert.equal(COUNTIF([valores, ">10"]), 2);
  assert.equal(COUNTIF([obras, ""]), 1, "vazias");
  assert.equal(COUNTIFS([obras, "obra a", valores, ">15"]), 1);
  assert.equal(SUMIF([obras, "obra a", valores]), 30, "texto no intervalo da soma é ignorado");
  assert.equal(SUMIF([valores, ">=20"]), 50);
  assert.equal(SUMIFS([valores, obras, "obra*", valores, "<30"]), 30);
  assert.equal(AVERAGEIF([obras, "obra a", valores]), 15);
  assert.equal(AVERAGEIF([valores, ">0"]), 16.25);
  assert.equal(AVERAGEIFS([valores, obras, "Obra B"]), 30);
  erro(() => AVERAGEIF([obras, "Z", valores]), "DIV/0");
  erro(() => AVERAGEIFS([valores, obras, "Z"]), "DIV/0");
  erro(() => COUNTIF([obras]), "N/A");
  erro(() => SUMIF([obras]), "N/A");
  erro(() => AVERAGEIF([obras, "a", valores, 1]), "N/A");
  erro(() => COUNTIFS([obras, "a", col(1), "1"]), "VALUE");
  erro(() => SUMIFS([valores]), "N/A");
});

test("ENDEREÇO", () => {
  assert.equal(ADDRESS([1, 2]), "$B$1");
  assert.equal(ADDRESS([3, 28, 4]), "AB3");
  assert.equal(ADDRESS([3, 1, 2]), "A$3");
  assert.equal(ADDRESS([3, 1, 3]), "$A3");
  assert.equal(ADDRESS([1, 1, 4, true, "Página 1"]), "'Página 1'!A1");
  assert.equal(ADDRESS([1, 1, 4, true, "Orc"]), "Orc!A1");
  erro(() => ADDRESS([0, 1]), "VALUE");
  erro(() => ADDRESS([1, 1, 5]), "VALUE");
  assert.deepEqual(Object.keys(EXTRAS).sort(), ["ADDRESS", "AVERAGEIF", "AVERAGEIFS", "COUNTIF", "COUNTIFS", "MAXIFS", "MINIFS", "SUMIF", "SUMIFS", "TEXTJOIN", "XLOOKUP"]);
});
