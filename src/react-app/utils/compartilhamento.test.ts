import assert from "node:assert/strict";
import { test } from "node:test";

import { alternarPessoa, comEquipe, ehMeu, filtrarPessoas, passaFiltroDono, resumoNomes, type PessoaCompartilhavel } from "./compartilhamento.ts";

const pessoas: PessoaCompartilhavel[] = [
  { id: 1, nmNome: "Ana Souza", nmCargo: "Engenheira", inEquipe: false },
  { id: 2, nmNome: "Bruno Lima", nmCargo: "Encarregado", inEquipe: true },
  { id: 3, nmNome: "José Pedreiro", nmCargo: null, inEquipe: true },
];

test("busca por nome ou cargo, sem acento", () => {
  assert.deepEqual(filtrarPessoas(pessoas, "jose").map(p => p.id), [3]);
  assert.deepEqual(filtrarPessoas(pessoas, "engenh").map(p => p.id), [1]);
  assert.equal(filtrarPessoas(pessoas, "  ").length, 3);
});

test("alternar e marcar a equipe sem duplicar", () => {
  assert.deepEqual(alternarPessoa([1], 2), [1, 2]);
  assert.deepEqual(alternarPessoa([1, 2], 1), [2]);
  assert.deepEqual(comEquipe([1, 2], pessoas), [1, 2, 3]);
  assert.deepEqual(comEquipe([], [pessoas[0]]), []);
});

test("filtro meus / compartilhados comigo", () => {
  assert.ok(ehMeu({}));
  assert.ok(ehMeu({ flProprio: true }));
  assert.ok(!ehMeu({ flProprio: false }));
  assert.ok(passaFiltroDono({ flProprio: false }, "COMIGO"));
  assert.ok(!passaFiltroDono({ flProprio: false }, "MEUS"));
  assert.ok(passaFiltroDono({}, "TODOS"));
});

test("resumo dos nomes", () => {
  assert.equal(resumoNomes([1], pessoas), "Ana");
  assert.equal(resumoNomes([1, 2], pessoas), "Ana e Bruno");
  assert.equal(resumoNomes([1, 2, 3, 9], pessoas), "Ana, Bruno e mais 2");
});
