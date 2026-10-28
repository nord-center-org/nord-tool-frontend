import assert from "node:assert/strict";
import { test } from "node:test";

import { alternarPessoaNoFiltro, donosDasDemandas, passaFiltroPessoas, rotuloFiltro } from "./filtroPessoas.ts";

const minha = { idDono: 1, nmDono: "Nick Silva", flProprio: true };
const daAna = { idDono: 2, nmDono: "Ana Souza", flProprio: false };
const doBruno = { idDono: 3, nmDono: "Bruno Lima", flProprio: false };
const antiga = { idDono: null, flProprio: true };

test("filtro: todas, minhas, de outras pessoas e grupo", () => {
  assert.equal(passaFiltroPessoas(daAna, { tipo: "todos" }), true);
  assert.equal(passaFiltroPessoas(minha, { tipo: "meus" }), true);
  assert.equal(passaFiltroPessoas(daAna, { tipo: "meus" }), false);
  assert.equal(passaFiltroPessoas(daAna, { tipo: "outros" }), true);
  const grupo = { tipo: "pessoas" as const, ids: [2, 3] };
  assert.equal(passaFiltroPessoas(daAna, grupo, 1), true);
  assert.equal(passaFiltroPessoas(minha, grupo, 1), false);
  assert.equal(passaFiltroPessoas(antiga, { tipo: "pessoas", ids: [1] }, 1), true, "item sem dono conta como meu");
});

test("donos: eu primeiro, depois por nome, sem repetir", () => {
  const d = donosDasDemandas([doBruno, daAna, minha, daAna, antiga], 1);
  assert.deepEqual(d, [{ id: 1, nome: "Eu" }, { id: 2, nome: "Ana Souza" }, { id: 3, nome: "Bruno Lima" }]);
  assert.deepEqual(donosDasDemandas([], 1), [{ id: 1, nome: "Eu" }]);
});

test("alternar pessoa e rótulo do botão", () => {
  const donos = donosDasDemandas([minha, daAna, doBruno], 1);
  let f = alternarPessoaNoFiltro({ tipo: "todos" }, 2);
  assert.equal(rotuloFiltro(f, donos), "Ana");
  f = alternarPessoaNoFiltro(f, 3);
  assert.equal(rotuloFiltro(f, donos), "Ana e Bruno");
  assert.equal(rotuloFiltro({ tipo: "pessoas", ids: [1, 2, 3] }, donos), "3 pessoas");
  assert.equal(rotuloFiltro({ tipo: "pessoas", ids: [2, 3], rotulo: "Equipe Qualidade" }, donos), "Equipe Qualidade");
  assert.deepEqual(alternarPessoaNoFiltro(alternarPessoaNoFiltro({ tipo: "todos" }, 2), 2), { tipo: "todos" });
  assert.equal(rotuloFiltro({ tipo: "todos" }, donos), "Todas as pessoas");
});
