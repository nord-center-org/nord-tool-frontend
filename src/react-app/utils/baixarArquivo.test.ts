import assert from "node:assert/strict";
import { test } from "node:test";

import { nomeDeArquivo } from "./baixarArquivo.ts";

test("nome de arquivo sem acento nem símbolo", () => {
  assert.equal(nomeDeArquivo("Orçamento · Torre A (3º pav.)", "planilha"), "Orcamento-Torre-A-3-pav");
  assert.equal(nomeDeArquivo("  ", "documento"), "documento");
  assert.equal(nomeDeArquivo("x".repeat(80), "a").length, 60);
});
