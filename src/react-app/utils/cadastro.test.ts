import assert from "node:assert/strict";
import { test } from "node:test";

import { emailValido, forcaSenha, problemaNaSenha } from "./cadastro.ts";

test("problemaNaSenha segue a política do backend", () => {
  assert.match(problemaNaSenha("curta") ?? "", /10 caracteres/);
  assert.equal(problemaNaSenha("senha-forte-123"), null);
  assert.match(problemaNaSenha("á".repeat(40)) ?? "", /72 bytes/);
  assert.match(problemaNaSenha("senha-forte-123", "outra-coisa-1") ?? "", /não conferem/);
  assert.equal(problemaNaSenha("senha-forte-123", "senha-forte-123"), null);
});

test("emailValido e forcaSenha", () => {
  assert.equal(emailValido("joao@obra.com"), true);
  assert.equal(emailValido("joao@obra"), false);
  assert.equal(forcaSenha("abc"), 0);
  assert.equal(forcaSenha("aaaaaaaaaa"), 1);
  assert.equal(forcaSenha("aaaaaaaaa1"), 2);
  assert.equal(forcaSenha("Aaaaaaaaaaaa1!"), 3);
});
