import assert from "node:assert/strict";
import { test } from "node:test";

import { alterado, completar, filtrarUsuarios, nivelDe, nomeModulo, personalizados, qtModulosLiberados } from "./acessos.ts";

test("nivelDe e completar: ausente ou inválido vira NENHUM", () => {
  assert.equal(nivelDe({ MEDICOES: "ESCRITA" }, "MEDICOES"), "ESCRITA");
  assert.equal(nivelDe({ MEDICOES: "XPTO" }, "MEDICOES"), "NENHUM");
  assert.equal(nivelDe(undefined, "MEDICOES"), "NENHUM");
  assert.deepEqual(completar(["A", "B"], { A: "LEITURA" }), { A: "LEITURA", B: "NENHUM" });
});

test("alterado compara perfil, situação e níveis", () => {
  const base = { cdPerfil: "USER", inAtivo: true, acessos: { A: "NENHUM" as const, B: "LEITURA" as const } };
  assert.equal(alterado(base, { ...base, acessos: { ...base.acessos } }), false);
  assert.equal(alterado(base, { ...base, inAtivo: false }), true);
  assert.equal(alterado(base, { ...base, cdPerfil: "ADMIN" }), true);
  assert.equal(alterado(base, { ...base, acessos: { A: "NENHUM", B: "ESCRITA" } }), true);
});

test("personalizados aponta o que foge do perfil", () => {
  assert.deepEqual(personalizados({ A: "ADMIN", B: "NENHUM", C: "LEITURA" }, { A: "ADMIN", B: "ESCRITA" }), ["B", "C"]);
});

test("qtModulosLiberados, nomeModulo e busca", () => {
  assert.equal(qtModulosLiberados({ A: "LEITURA", B: "NENHUM", C: "ADMIN" }), 2);
  assert.equal(nomeModulo("MEDICOES"), "Medições");
  assert.equal(nomeModulo("NOVO"), "NOVO");
  const lista = [{ nmNome: "João Silva", nmEmail: "joao@obra.com" }, { nmNome: "Ana", nmEmail: "ana@obra.com" }];
  assert.equal(filtrarUsuarios(lista, "joao").length, 1);
  assert.equal(filtrarUsuarios(lista, "OBRA.com").length, 2);
  assert.equal(filtrarUsuarios(lista, "").length, 2);
});
