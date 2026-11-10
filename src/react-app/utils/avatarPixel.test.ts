import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACESSORIOS, BARBAS, BATONS, BOCAS, CABELOS, CORES_CABELO, DATAS, DETALHES, ENFEITES, FORMATOS_OLHOS, FUNCOES, FUNDOS, OLHOS, SOBRANCELHAS, TRACOS, avatarPadrao,
  type DataComemorativa,
} from "./avatar.ts";
import { CONTORNO, LADO, diferenca, emRetangulos, montarGrade, tom } from "./avatarPixel.ts";

const cheia = (g: (string | null)[][]) => g.length === LADO && g.every(l => l.length === LADO && l.every(Boolean));

test("todas as combinações montam uma grade 32×32 completa", () => {
  const base = avatarPadrao(3);
  const temas: (DataComemorativa | null)[] = [null, ...(Object.keys(DATAS) as DataComemorativa[])];
  for (const tema of temas) for (const cabelo of CABELOS) for (const funcao of Object.keys(FUNCOES) as (keyof typeof FUNCOES)[]) {
    for (const capacete of [true, false]) assert.ok(cheia(montarGrade({ ...base, cabelo, funcao, capacete }, tema)), `${tema}/${cabelo}/${funcao}`);
  }
  for (const olhos of OLHOS) for (const formatoOlhos of FORMATOS_OLHOS) for (const acessorio of ACESSORIOS) {
    assert.ok(cheia(montarGrade({ ...base, olhos, formatoOlhos, acessorio }, null)));
  }
  for (const boca of BOCAS) for (const barba of BARBAS) for (const sobrancelha of SOBRANCELHAS) for (const detalhe of DETALHES) {
    montarGrade({ ...base, boca, barba, sobrancelha, detalhe }, null);
  }
  for (const corCabelo of Object.keys(CORES_CABELO) as (keyof typeof CORES_CABELO)[]) for (const fundo of Object.keys(FUNDOS) as (keyof typeof FUNDOS)[]) {
    assert.ok(cheia(montarGrade({ ...base, corCabelo, fundo }, null)));
  }
});

test("sem fundo, o canto fica transparente", () => {
  const g = montarGrade(avatarPadrao(2), null, false, true);
  assert.equal(g[0][0], null);
  assert.notEqual(g[31][3], null, "o ombro encosta no pé");
});

test("piscada muda só a região dos olhos, em qualquer formato", () => {
  for (const formatoOlhos of FORMATOS_OLHOS) for (const acessorio of ["nenhum", "oculos"] as const) {
    const c = { ...avatarPadrao(9), formatoOlhos, acessorio };
    const d = diferenca(montarGrade(c, null), montarGrade(c, null, true));
    const pontos = d.flatMap((l, y) => l.map((cor, x) => (cor ? [x, y] : null)).filter(Boolean)) as [number, number][];
    assert.ok(pontos.length > 0, formatoOlhos);
    assert.ok(pontos.every(([x, y]) => y >= 13 && y <= 16 && x >= 9 && x <= 22), `${formatoOlhos}/${acessorio}`);
  }
});

test("contorno colorido: o contorno da cabeça puxa o tom da pele, não o preto chapado", () => {
  const c = { ...avatarPadrao(4), capacete: false, cabelo: "careca" as const, pele: "p1" as const };
  const g = montarGrade(c, null);
  assert.notEqual(g[10][6], CONTORNO);
  assert.notEqual(g[10][6], g[10][7]);
});

test("retângulos cobrem a grade e tons clareiam/escurecem", () => {
  const g = montarGrade(avatarPadrao(1), null);
  const area = emRetangulos(g).reduce((s, r) => s + r.w, 0);
  assert.equal(area, LADO * LADO);
  assert.equal(tom("#808080", -0.5), "#404040");
  assert.equal(tom("#000000", 1), "#ffffff");
});

const mudou = (a: (string | null)[][], b: (string | null)[][]) => diferenca(a, b).flat().filter(v => v !== null).length;

test("v2: traços femininos, batom e enfeites montam a grade e mudam o desenho", () => {
  const base = avatarPadrao(3);
  for (const tracos of TRACOS) for (const batom of Object.keys(BATONS) as (keyof typeof BATONS)[]) for (const enfeite of ENFEITES) {
    for (const capacete of [true, false]) for (const olhos of OLHOS) for (const boca of BOCAS) {
      assert.ok(cheia(montarGrade({ ...base, tracos, batom, enfeite, capacete, olhos, boca }, null)), `${tracos}/${batom}/${enfeite}/${olhos}/${boca}`);
    }
  }
  const sem = { ...base, capacete: false };
  const masc = montarGrade(sem, null), fem = montarGrade({ ...sem, tracos: "feminino" }, null);
  assert.ok(mudou(masc, fem) > 4, "feminino tem cílios, bochechas e decote");
  assert.ok(mudou(montarGrade(sem, null), montarGrade({ ...sem, batom: "vermelho" }, null)) > 0, "batom muda a boca");
  for (const enfeite of ENFEITES.filter(e => e !== "nenhum")) assert.ok(mudou(masc, montarGrade({ ...sem, enfeite }, null)) > 0, enfeite);
  // Laço, tiara e flor ficam escondidos debaixo do capacete; argola e pérola continuam.
  const comCapacete = { ...base, capacete: true };
  assert.equal(mudou(montarGrade(comCapacete, null), montarGrade({ ...comCapacete, enfeite: "laco" }, null)), 0);
  assert.ok(mudou(montarGrade(comCapacete, null), montarGrade({ ...comCapacete, enfeite: "argola" }, null)) > 0);
  for (const cabelo of ["longoLiso", "cachosLongos", "mariaChiquinha"] as const) assert.ok(mudou(masc, montarGrade({ ...sem, cabelo }, null)) > 0, cabelo);
});
