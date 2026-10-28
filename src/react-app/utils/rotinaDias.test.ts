import assert from "node:assert/strict";
import { test } from "node:test";

import { alternarDia, planejarDias } from "./rotinaDias.ts";

test("criação: um item por dia, sem repetir, em ordem", () => {
  assert.deepEqual(planejarDias(null, [3, 1, 3, 5]), { manter: null, criar: [1, 3, 5] });
});

test("edição: o item fica no dia dele e os outros viram cópias", () => {
  assert.deepEqual(planejarDias(2, [2, 4]), { manter: 2, criar: [4] });
  assert.deepEqual(planejarDias(2, [4, 5]), { manter: 4, criar: [5] });
  assert.deepEqual(planejarDias(2, []), { manter: 2, criar: [] });
});

test("alternarDia liga e desliga", () => {
  assert.deepEqual(alternarDia([1, 2], 2), [1]);
  assert.deepEqual(alternarDia([1], 7), [1, 7]);
});
