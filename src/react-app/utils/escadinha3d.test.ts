import assert from "node:assert/strict";
import { test } from "node:test";

import type { Apartamento, Ponto } from "./escadinha.ts";
import { areaMolhada, arestas, divisoriaDoApto, fachadaDoLado, medidas, paredesDoLado, portaDoApto, sacadaDoApto } from "./escadinha3d.ts";

const contorno: Ponto[] = [[0, 0], [20, 0], [20, 10], [0, 10]];
const ap = (id: string, x0: number, lado: "A" | "B"): Apartamento => ({ id, nome: id, lado, contorno: [[x0, 0], [x0 + 5, 0], [x0 + 5, 4], [x0, 4]] });
const aptos = [ap("a1", 0, "A"), ap("a2", 5, "A"), ap("b1", 10, "B")];

test("paredes do lado sem repetir a parede compartilhada", () => {
  const p = paredesDoLado(aptos, "A");
  assert.equal(p.length, 7, "dois retângulos colados: 8 arestas menos a do meio repetida");
  assert.equal(paredesDoLado(aptos, "B").length, 4);
});

test("fachada: só as arestas da metade que caem no contorno", () => {
  const metadeA: Ponto[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const f = fachadaDoLado(contorno, metadeA);
  assert.equal(f.length, 3, "a linha x=10 é a divisão dos lados, não é fachada");
});

test("drywall, área molhada, sacada e porta pelo núcleo", () => {
  const a = aptos[0];
  const d = divisoriaDoApto(a);
  assert.deepEqual(d, { a: [2.75, 0], b: [2.75, 4] });
  const nucleoC: Ponto = [10, 5];
  const m = areaMolhada(a, nucleoC);
  assert.ok(m.every(([x, y]) => x >= 3 && y >= 2), "canto de cima à direita, perto do núcleo");
  const s = sacadaDoApto(a, nucleoC);
  assert.ok(s.every(([x]) => x <= 1.21), "faixa do lado de fora (esquerda)");
  const porta = portaDoApto(a, nucleoC);
  assert.deepEqual(porta.p, [5, 2]);
  assert.equal(arestas([[0, 0], [0, 0], [1, 0]]).length, 2);
  assert.deepEqual(medidas(contorno), { area: 200, perimetro: 60 });
});
