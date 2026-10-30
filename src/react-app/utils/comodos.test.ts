import { test } from "node:test";
import assert from "node:assert/strict";

import { detectarComodos, vaosDePorta } from "./comodos.ts";
import type { ParedeReal, Ponto } from "./escadinha.ts";

const p = (a: Ponto, b: Ponto, esp = 0.14): ParedeReal => ({ a, b, esp });

/**
 * Pavimento de 20 × 10 m: corredor em cima (y 6–10) e dois apartamentos embaixo, cada um com dois cômodos ligados por
 * porta; a porta de entrada de cada apartamento dá no corredor.
 */
const contorno: Ponto[] = [[0, 0], [20, 0], [20, 10], [0, 10]];
const paredes: ParedeReal[] = [
  p([0, 0], [20, 0]), p([20, 0], [20, 10]), p([0, 10], [20, 10]), p([0, 0], [0, 10]),
  // parede do corredor com as portas de entrada (x 2–2,9 e 12–12,9)
  p([0, 6], [2, 6]), p([2.9, 6], [12, 6]), p([12.9, 6], [20, 6]),
  // parede entre os apartamentos
  p([10, 0], [10, 6]),
  // paredes internas com porta (y 2–2,9)
  p([5, 0], [5, 2]), p([5, 2.9], [5, 6]),
  p([15, 0], [15, 2]), p([15, 2.9], [15, 6]),
];

test("vãos de porta: paredes alinhadas com folga curta viram porta", () => {
  const vaos = vaosDePorta(paredes);
  const tem = (a: Ponto, b: Ponto) => vaos.some(v => Math.hypot(v.a[0] - a[0], v.a[1] - a[1]) < 0.05 && Math.hypot(v.b[0] - b[0], v.b[1] - b[1]) < 0.05);
  assert.ok(tem([2, 6], [2.9, 6]), "entrada do apto 1");
  assert.ok(tem([5, 2], [5, 2.9]), "porta interna");
});

test("cômodos e apartamentos: tira o hall e junta o que se liga por porta", () => {
  const r = detectarComodos(paredes, contorno);
  assert.equal(r.hall.length, 1);
  const hall = r.comodos.find(c => c.id === r.hall[0])!;
  assert.ok(hall.area > 60, "o corredor é o espaço com mais portas");
  assert.equal(r.apartamentos.length, 2);
  for (const a of r.apartamentos) {
    assert.equal(a.comodos.length, 2);
    assert.ok(a.area > 40 && a.area < 60, `área ${a.area}`);
  }
  assert.equal(r.apartamentos[0].nome, "Apto 01");
});

test("dois apartamentos ligados por um vão: separa pela entrada de cada um", () => {
  // abre um vão na parede entre os apartamentos (y 1–1,9): sem a regra das entradas, viraria um apartamento só
  const comVao = paredes.filter(x => !(x.a[0] === 10 && x.b[0] === 10)).concat([p([10, 0], [10, 1]), p([10, 1.9], [10, 6])]);
  const r = detectarComodos(comVao, contorno);
  assert.equal(r.apartamentos.length, 2);
});
