import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PREFERENCIAS_PADRAO, chavePreferenciasCronograma, lerPreferenciasCronograma, salvarPreferenciasCronograma, temFiltroAtivo,
  type PreferenciasCronograma,
} from "./preferenciasCronograma.ts";

const memoria = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

const exemplo: PreferenciasCronograma = {
  visao: "lista", busca: "laudo", categoria: "Engenharia", pessoas: { tipo: "pessoas", ids: [3, 7], rotulo: "Equipe A" },
  filtrosColuna: { status: ["Pendentes", "Executar"] }, ordenacao: { coluna: "dtPrazo", direcao: "desc" },
  calendario: "mes", categoriasRotina: ["Pessoal"],
};

test("guarda e lê os filtros por pessoa", () => {
  const s = memoria();
  salvarPreferenciasCronograma(s, 1, exemplo);
  assert.deepEqual(lerPreferenciasCronograma(s, 1), exemplo);
  assert.deepEqual(lerPreferenciasCronograma(s, 2), PREFERENCIAS_PADRAO);
});

test("valor estragado ou antigo volta ao padrão campo a campo", () => {
  const s = memoria();
  s.setItem(chavePreferenciasCronograma(1), JSON.stringify({
    visao: "tabela", busca: 42, categoria: "", pessoas: { tipo: "pessoas", ids: ["x"] },
    filtrosColuna: { status: ["A", 3], inexistente: ["B"] }, ordenacao: { coluna: "nada", direcao: "asc" }, calendario: "ano", categoriasRotina: "Pessoal",
  }));
  assert.deepEqual(lerPreferenciasCronograma(s, 1), { ...PREFERENCIAS_PADRAO, filtrosColuna: { status: ["A"] } });
  s.setItem(chavePreferenciasCronograma(1), "{quebrado");
  assert.deepEqual(lerPreferenciasCronograma(s, 1), PREFERENCIAS_PADRAO);
  assert.deepEqual(lerPreferenciasCronograma(undefined, 1), PREFERENCIAS_PADRAO);
});

test("sem armazenamento, salvar não quebra", () => {
  const quebrado = { setItem: () => { throw new Error("cheio"); } };
  assert.doesNotThrow(() => salvarPreferenciasCronograma(quebrado, 1, exemplo));
});

test("sabe quando há filtro ativo (a visão não conta)", () => {
  assert.equal(temFiltroAtivo(PREFERENCIAS_PADRAO), false);
  assert.equal(temFiltroAtivo({ ...PREFERENCIAS_PADRAO, visao: "rotina", calendario: "mes" }), false);
  assert.equal(temFiltroAtivo({ ...PREFERENCIAS_PADRAO, busca: " x " }), true);
  assert.equal(temFiltroAtivo({ ...PREFERENCIAS_PADRAO, pessoas: { tipo: "meus" } }), true);
});
