import assert from "node:assert/strict";
import { test } from "node:test";

import { BARBAS, BOCAS, CABELOS, CORES_CABELO, DATAS, FUNCOES, OLHOS, avatarPadrao, type DataComemorativa } from "./avatar.ts";
import { LADO, diferenca, emRetangulos, montarGrade, tom } from "./avatarPixel.ts";

test("todas as combinações montam uma grade 32×32 completa", () => {
  const base = avatarPadrao(3);
  const temas: (DataComemorativa | null)[] = [null, ...(Object.keys(DATAS) as DataComemorativa[])];
  for (const tema of temas) for (const cabelo of CABELOS) for (const funcao of Object.keys(FUNCOES) as (keyof typeof FUNCOES)[]) {
    for (const capacete of [true, false]) {
      const g = montarGrade({ ...base, cabelo, funcao, capacete }, tema);
      assert.equal(g.length, LADO);
      assert.ok(g.every(l => l.length === LADO && l.every(Boolean)), `${tema}/${cabelo}/${funcao}`);
    }
  }
  for (const olhos of OLHOS) for (const boca of BOCAS) for (const barba of BARBAS) for (const corCabelo of Object.keys(CORES_CABELO) as (keyof typeof CORES_CABELO)[]) {
    montarGrade({ ...base, olhos, boca, barba, corCabelo }, null);
  }
});

test("piscada muda só a região dos olhos", () => {
  const c = { ...avatarPadrao(9), olhos: "oculos" as const };
  const d = diferenca(montarGrade(c, null), montarGrade(c, null, true));
  const pontos = d.flatMap((l, y) => l.map((cor, x) => (cor ? [x, y] : null)).filter(Boolean)) as [number, number][];
  assert.ok(pontos.length > 0);
  assert.ok(pontos.every(([x, y]) => y >= 13 && y <= 16 && x >= 9 && x <= 22));
});

test("retângulos cobrem a grade e tons clareiam/escurecem", () => {
  const g = montarGrade(avatarPadrao(1), null);
  const area = emRetangulos(g).reduce((s, r) => s + r.w, 0);
  assert.equal(area, LADO * LADO);
  assert.equal(tom("#808080", -0.5), "#404040");
  assert.equal(tom("#000000", 1), "#ffffff");
});
