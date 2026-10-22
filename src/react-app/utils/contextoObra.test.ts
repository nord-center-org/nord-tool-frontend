import assert from "node:assert/strict";
import { test } from "node:test";

import { FASES_LEGADAS, codigoDaFase, escolherObraInicial, fasesParaFiltro, lerObraAtual, salvarObraAtual, type ObraContexto } from "./contextoObra.ts";

const obras: ObraContexto[] = [
  { id: 1, nmObra: "Nord", fases: [
    { id: 12, idObra: 1, nmFase: "Nord 2", cdFase: "n2", nrOrdem: 2, inAtivo: true },
    { id: 11, idObra: 1, nmFase: "Nord 1", cdFase: "N1", nrOrdem: 1, inAtivo: true },
    { id: 13, idObra: 1, nmFase: "Antiga", cdFase: "AN", nrOrdem: 3, inAtivo: false },
    { id: 14, idObra: 1, nmFase: "Sem sigla", cdFase: null, nrOrdem: 4, inAtivo: true },
  ] },
  { id: 2, nmObra: "Energy", fases: [] },
];

test("fasesParaFiltro: ativas, com sigla, em ordem; sem obra configurada usa as de antes", () => {
  assert.deepEqual(fasesParaFiltro(obras, 1).map(f => `${f.sigla}:${f.nome}`), ["N1:Nord 1", "N2:Nord 2"]);
  assert.deepEqual(fasesParaFiltro(obras, 2), []);
  assert.deepEqual(fasesParaFiltro([], null), FASES_LEGADAS);
});

test("escolherObraInicial respeita a salva só se ainda houver acesso", () => {
  assert.equal(escolherObraInicial(obras, 2), 2);
  assert.equal(escolherObraInicial(obras, 9), 1);
  assert.equal(escolherObraInicial([], 9), null);
});

test("ler e salvar a obra atual", () => {
  const mapa = new Map<string, string>();
  const storage = { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => void mapa.set(k, v), removeItem: (k: string) => void mapa.delete(k) };
  salvarObraAtual(storage, 3);
  assert.equal(lerObraAtual(storage), 3);
  salvarObraAtual(storage, null);
  assert.equal(lerObraAtual(storage), null);
  mapa.set("@NordTool:obra_atual", "lixo");
  assert.equal(lerObraAtual(storage), null);
});

test("codigoDaFase pela sigla no começo do código", () => {
  assert.equal(codigoDaFase("N1-01-0101", "n1"), true);
  assert.equal(codigoDaFase("N10-01-0101", "N1"), false);
  assert.equal(codigoDaFase("EN-02-1307", "N1"), false);
});
