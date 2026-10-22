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

test("padraoDe: cargo prevalece sobre o perfil", async () => {
  const { padraoDe } = await import("./acessos.ts");
  assert.deepEqual(padraoDe({ A: "LEITURA", B: "ADMIN" }, { A: "ESCRITA", C: "NENHUM" }), { A: "ESCRITA", B: "ADMIN" });
});

test("arvoreHierarquia e abaixoDe", async () => {
  const { arvoreHierarquia, abaixoDe } = await import("./acessos.ts");
  const lista = [
    { id: 1, nmNome: "Engenheiro", idSuperior: null },
    { id: 2, nmNome: "Mestre", idSuperior: 1 },
    { id: 3, nmNome: "Encarregado", idSuperior: 2 },
    { id: 4, nmNome: "Ana", idSuperior: 1 },
    { id: 5, nmNome: "Solto", idSuperior: 99 },
  ];
  assert.deepEqual(arvoreHierarquia(lista).map(l => `${l.nivel}:${l.item.nmNome}`),
    ["0:Engenheiro", "1:Ana", "1:Mestre", "2:Encarregado", "0:Solto"]);
  assert.deepEqual([...abaixoDe(lista, 1)].sort(), [2, 3, 4]);
  assert.deepEqual([...abaixoDe(lista, 3)], []);
  const ciclo = [{ id: 1, nmNome: "A", idSuperior: 2 }, { id: 2, nmNome: "B", idSuperior: 1 }];
  assert.equal(arvoreHierarquia(ciclo).length, 2);
});
