import assert from "node:assert/strict";
import { test } from "node:test";

import { CHAVE_TEMA, PREFERENCIA_PADRAO, chaveDaTela, comGeral, comTemaDaTela, lerPreferencia, salvarPreferencia, temaDaTela } from "./tema.ts";

const memoria = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

test("cada tela segue o geral, a não ser que tenha tema próprio", () => {
  let p = comGeral(PREFERENCIA_PADRAO, "escuro");
  assert.equal(temaDaTela(p, "/gestao/caixinha", false), "escuro");
  p = comTemaDaTela(p, "/gestao/caixinha/", "claro");
  assert.equal(temaDaTela(p, "/gestao/caixinha", false), "claro");
  assert.equal(temaDaTela(p, "/entregas", false), "escuro");
  p = comTemaDaTela(p, "/gestao/caixinha", null);
  assert.equal(temaDaTela(p, "/gestao/caixinha", false), "escuro");
  assert.deepEqual(p.telas, {});
});

test("igual ao aparelho acompanha o sistema", () => {
  const p = comGeral(PREFERENCIA_PADRAO, "sistema");
  assert.equal(temaDaTela(p, "/", true), "escuro");
  assert.equal(temaDaTela(p, "/", false), "claro");
});

test("guarda e lê a preferência; valor estragado volta ao padrão", () => {
  const s = memoria();
  const p = comTemaDaTela(comGeral(PREFERENCIA_PADRAO, "sistema"), "/dashboard", "escuro");
  salvarPreferencia(s, p);
  assert.deepEqual(lerPreferencia(s), p);
  s.setItem(CHAVE_TEMA, JSON.stringify({ geral: "roxo", telas: { "/x": "azul", "/y/": "escuro", "z": "claro" } }));
  assert.deepEqual(lerPreferencia(s), { geral: "claro", telas: { "/y": "escuro" } });
  s.setItem(CHAVE_TEMA, "{quebrado");
  assert.deepEqual(lerPreferencia(s), PREFERENCIA_PADRAO);
  assert.deepEqual(lerPreferencia(undefined), PREFERENCIA_PADRAO);
});

test("chave da tela ignora barra no fim", () => {
  assert.equal(chaveDaTela("/a/b/"), "/a/b");
  assert.equal(chaveDaTela("/"), "/");
});
