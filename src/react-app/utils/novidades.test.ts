import assert from "node:assert/strict";
import { test } from "node:test";
import { dataCurta, lerUltimaVista, marcarVista, naoVistas, NOVIDADES, type Novidade } from "./novidades.ts";

const lista: Novidade[] = [
  { id: "c", data: "2026-10-27", titulo: "C", texto: "" },
  { id: "b", data: "2026-10-26", titulo: "B", texto: "" },
  { id: "a", data: "2026-10-25", titulo: "A", texto: "" },
];

test("naoVistas: tudo antes da última vista", () => {
  assert.deepEqual(naoVistas(lista, null).map(n => n.id), ["c", "b", "a"]);
  assert.deepEqual(naoVistas(lista, "b").map(n => n.id), ["c"]);
  assert.deepEqual(naoVistas(lista, "c"), []);
  // Id que não existe mais (entrada removida): trata como nada visto.
  assert.equal(naoVistas(lista, "sumiu").length, 3);
});

test("NOVIDADES: ids únicos, datas válidas e da mais nova para a mais antiga", () => {
  const ids = NOVIDADES.map(n => n.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const n of NOVIDADES) {
    assert.match(n.data, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(n.titulo.trim() && n.texto.trim(), `${n.id} sem título ou texto`);
    if (n.onde) assert.ok(n.onde.caminho.startsWith("/"), `${n.id}: caminho deve ser interno`);
  }
  const datas = NOVIDADES.map(n => n.data);
  assert.deepEqual(datas, [...datas].sort().reverse());
});

test("última vista por usuário, tolerando armazenamento indisponível", () => {
  const mapa = new Map<string, string>();
  const storage = { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => void mapa.set(k, v) };
  marcarVista(storage, 7, "b");
  assert.equal(lerUltimaVista(storage, 7), "b");
  assert.equal(lerUltimaVista(storage, 8), null);
  const quebrado = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  assert.equal(lerUltimaVista(quebrado, 7), null);
  assert.doesNotThrow(() => marcarVista(quebrado, 7, "b"));
});

test("dataCurta", () => {
  assert.equal(dataCurta("2026-10-25"), "25 out");
  assert.equal(dataCurta("2026-01-03"), "3 jan");
  assert.equal(dataCurta("lixo"), "lixo");
});
