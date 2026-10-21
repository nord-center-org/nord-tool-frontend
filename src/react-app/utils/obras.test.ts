import assert from "node:assert/strict";
import { test } from "node:test";

import { alternarId, codigoValido, mesmosIds, ordenarFases, siglaValida, sugerirCodigo } from "./obras.ts";

test("sugerirCodigo tira acentos e espaços", () => {
  assert.equal(sugerirCodigo("Nord Energia São Paulo", 2026), "NORDENERGIAS2026");
  assert.equal(sugerirCodigo("  ", 2026), "");
});

test("validações de código e sigla", () => {
  assert.equal(codigoValido("NORD2026"), true);
  assert.equal(codigoValido("abc"), false);
  assert.equal(codigoValido("com espaço"), false);
  assert.equal(siglaValida(""), true);
  assert.equal(siglaValida("N1"), true);
  assert.equal(siglaValida("N-1"), false);
});

test("ordenarFases, alternarId e mesmosIds", () => {
  const f = ordenarFases([{ nrOrdem: 2, nmFase: "B" }, { nrOrdem: 1, nmFase: "Z" }, { nrOrdem: 1, nmFase: "A" }]);
  assert.deepEqual(f.map(x => x.nmFase), ["A", "Z", "B"]);
  assert.deepEqual(alternarId([1, 2], 2), [1]);
  assert.deepEqual(alternarId([1], 3), [1, 3]);
  assert.equal(mesmosIds([1, 2], [2, 1]), true);
  assert.equal(mesmosIds([1], [1, 2]), false);
});
