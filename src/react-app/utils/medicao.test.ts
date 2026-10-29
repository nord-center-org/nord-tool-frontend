import assert from "node:assert/strict";
import { test } from "node:test";

import { areaMedida, comprimentoTotal, fmtM, fmtM2, imantar } from "./medicao.ts";

test("medição: comprimento, área, ímã e formato", () => {
  assert.equal(comprimentoTotal([[0, 0], [3, 4], [3, 10]]), 11);
  assert.deepEqual(areaMedida([[0, 0], [4, 0], [4, 2.5], [0, 2.5]]), { area: 10, perimetro: 13 });
  assert.equal(areaMedida([[0, 0], [1, 1]]), null);
  assert.deepEqual(imantar([4.1, 0.05], [[0, 0], [4, 0]], 0.3), [4, 0]);
  assert.deepEqual(imantar([2, 2], [[0, 0], [4, 0]], 0.3), [2, 2]);
  assert.equal(fmtM(12.345), "12,35 m");
  assert.equal(fmtM2(48.2), "48,20 m²");
});
