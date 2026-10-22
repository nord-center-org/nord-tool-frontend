import assert from "node:assert/strict";
import { test } from "node:test";

import { criarContadorToques, criarDetectorPalavra, ehCampoDeTexto } from "./segredo.ts";

test("palavra secreta em qualquer caixa, ignorando teclas especiais", () => {
  const d = criarDetectorPalavra("davi");
  assert.deepEqual([..."xDaV"].map(d), [false, false, false, false]);
  assert.equal(d("Shift"), false);
  assert.equal(d("I"), true);
  assert.equal(d("i"), false, "zera depois de disparar");
  assert.deepEqual([..."dadavi"].map(d).pop(), true);
});

test("toques rápidos dentro da janela", () => {
  const c = criarContadorToques(5, 3000);
  assert.deepEqual([0, 500, 1000, 1500].map(c), [false, false, false, false]);
  assert.equal(c(2000), true);
  const lento = criarContadorToques(3, 1000);
  assert.deepEqual([0, 900, 2000, 2500].map(lento), [false, false, false, false]);
  assert.equal(lento(2800), true);
});

test("campos de texto não contam", () => {
  assert.ok(ehCampoDeTexto({ tagName: "input" }));
  assert.ok(ehCampoDeTexto({ tagName: "DIV", isContentEditable: true }));
  assert.ok(!ehCampoDeTexto({ tagName: "BUTTON" }));
  assert.ok(!ehCampoDeTexto(null));
});
