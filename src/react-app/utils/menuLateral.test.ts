import assert from "node:assert/strict";
import { test } from "node:test";

import { alternarGrupo, chaveGrupos, grupoDaRota, iniciais, lerGruposAbertos, rotaFavorita, salvarGruposAbertos } from "./menuLateral.ts";

const memoria = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

test("guarda os grupos abertos por usuário", () => {
  const s = memoria();
  salvarGruposAbertos(s, 1, ["Entrega"]);
  salvarGruposAbertos(s, 2, ["Organizacional"]);
  assert.deepEqual(lerGruposAbertos(s, 1), ["Entrega"]);
  assert.deepEqual(lerGruposAbertos(s, 2), ["Organizacional"]);
  assert.deepEqual(lerGruposAbertos(s, 3), []);
});

test("valor estragado ou sem armazenamento vira lista vazia", () => {
  const s = memoria();
  s.setItem(chaveGrupos(1), "{nada");
  assert.deepEqual(lerGruposAbertos(s, 1), []);
  s.setItem(chaveGrupos(1), JSON.stringify({ a: 1 }));
  assert.deepEqual(lerGruposAbertos(s, 1), []);
  assert.deepEqual(lerGruposAbertos(undefined, 1), []);
  assert.doesNotThrow(() => salvarGruposAbertos({ setItem: () => { throw new Error("cheio"); } }, 1, []));
});

test("alternar abre e fecha", () => {
  assert.deepEqual(alternarGrupo([], "A"), ["A"]);
  assert.deepEqual(alternarGrupo(["A", "B"], "A"), ["B"]);
});

test("grupo da rota atual", () => {
  const grupos = [
    { title: "Visão Geral", items: [{ path: "/" }] },
    { title: "Entrega", items: [{ path: "/entregas" }, { path: "/apartamentos" }] },
    { title: "Organizacional", items: [{ path: "/organizacional/medicoes" }] },
  ];
  assert.equal(grupoDaRota(grupos, "/"), "Visão Geral");
  assert.equal(grupoDaRota(grupos, "/apartamentos"), "Entrega");
  assert.equal(grupoDaRota(grupos, "/organizacional/medicoes/12"), "Organizacional");
  assert.equal(grupoDaRota(grupos, "/configuracoes"), null);
  assert.equal(grupoDaRota(grupos, "/entregasx"), null);
});

test("iniciais do nome", () => {
  assert.equal(iniciais("Nick Gomes da Silva"), "NG");
  assert.equal(iniciais("  ana "), "A");
  assert.equal(iniciais(""), "?");
});

test("correção: tela favorita não abre o grupo dela", () => {
  assert.equal(rotaFavorita(["/sac", "/mapeamentos/cubicagem"], "/mapeamentos/cubicagem"), true);
  assert.equal(rotaFavorita(["/mapeamentos/cubicagem"], "/mapeamentos/cubicagem/12"), true, "subtela também");
  assert.equal(rotaFavorita(["/mapeamentos/cubicagem"], "/mapeamentos/cubicagem-velha"), false);
  assert.equal(rotaFavorita(["/"], "/sac"), false, "o início só casa com ele mesmo");
  assert.equal(rotaFavorita([], "/sac"), false);
});
