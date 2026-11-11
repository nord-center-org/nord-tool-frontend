import assert from "node:assert/strict";
import { test } from "node:test";

import type { Pixels } from "./editorImagem.ts";
import {
  apagarNaMascara, caixaDa, combinar, contar, desenhoDaSelecao, inverter, mascaraDoRetangulo, preencherNaMascara, recortarMascara, restaurarFora,
  suavizar, varinhaMagica,
} from "./varinhaMagica.ts";

/** 6 × 4: fundo branco, um quadrado vermelho 2 × 2 em (1,1) e um pixel quase branco solto em (5,3). */
const cena = (): Pixels => {
  const w = 6, h = 4, data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) data.set([255, 255, 255, 255], p * 4);
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) data.set([220, 20, 20, 255], (y * w + x) * 4);
  // Uma coluna vermelha isola o canto de baixo à direita do resto do fundo.
  for (let y = 0; y < h; y++) data.set([220, 20, 20, 255], (y * w + 4) * 4);
  data.set([250, 250, 250, 255], (3 * w + 5) * 4);
  return { data, width: w, height: h };
};

test("varinha pega a área contínua da cor clicada", () => {
  const p = cena();
  const fundo = varinhaMagica(p, 0, 0, 10);
  // 24 pixels - 4 do quadrado - 4 da coluna - 4 da coluna isolada à direita = 12.
  assert.equal(contar(fundo), 12);
  assert.equal(fundo[1 * 6 + 1], 0);
  assert.equal(fundo[0], 255);
  const quadrado = varinhaMagica(p, 1, 1, 10);
  assert.equal(contar(quadrado), 4);
  assert.deepEqual(caixaDa(quadrado, 6, 4), { x: 1, y: 1, w: 2, h: 2 });
});

test("varinha global pega a cor em toda a imagem e a tolerância decide o parecido", () => {
  const p = cena();
  assert.equal(contar(varinhaMagica(p, 0, 0, 10, true)), 16);
  assert.equal(contar(varinhaMagica(p, 0, 0, 0, true)), 15, "tolerância 0 deixa de fora o quase branco");
  assert.equal(contar(varinhaMagica(p, 1, 1, 10, true)), 8, "o vermelho do quadrado e da coluna");
  assert.equal(contar(varinhaMagica(p, 0, 0, 100)), 24, "tolerância 100 pega a imagem toda");
  assert.equal(contar(varinhaMagica(p, -1, 0)), 0);
});

test("transparente com qualquer cor guardada conta como igual", () => {
  const data = new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 0, 10, 10, 10, 255]);
  assert.equal(contar(varinhaMagica({ data, width: 3, height: 1 }, 0, 0, 0)), 2);
});

test("somar, tirar, cruzar e inverter", () => {
  const a = mascaraDoRetangulo({ x: 0, y: 0, w: 2, h: 1 }, 3, 1);
  const b = mascaraDoRetangulo({ x: 1, y: 0, w: 2, h: 1 }, 3, 1);
  assert.deepEqual([...combinar(a, b, "somar")], [255, 255, 255]);
  assert.deepEqual([...combinar(a, b, "tirar")], [255, 0, 0]);
  assert.deepEqual([...combinar(a, b, "cruzar")], [0, 255, 0]);
  assert.deepEqual([...combinar(a, b, "nova")], [...b]);
  assert.deepEqual([...combinar(null, b, "somar")], [...b]);
  assert.deepEqual([...combinar(null, b, "tirar")], [0, 0, 0]);
  assert.deepEqual([...inverter(a)], [0, 0, 255]);
  assert.equal(caixaDa(new Uint8Array(4), 2, 2), null);
});

test("apagar o fundo deixa só o objeto e a borda suave faz meio-termo", () => {
  const p = cena();
  apagarNaMascara(p, varinhaMagica(p, 0, 0, 10));
  assert.equal(p.data[3], 0, "fundo transparente");
  assert.equal(p.data[(1 * 6 + 1) * 4 + 3], 255, "o quadrado continua");
  const suave = suavizar(mascaraDoRetangulo({ x: 0, y: 0, w: 2, h: 1 }, 4, 1), 4, 1, 1);
  assert.ok(suave[1] > 0 && suave[1] < 255 && suave[2] > 0 && suave[2] < 255, `borda gradual: ${[...suave]}`);
  assert.equal(suave[3], 0);
  const m = new Uint8Array([255]);
  assert.equal(suavizar(m, 1, 1, 0), m);
});

test("preencher na seleção, restaurar fora e recortar a máscara", () => {
  const p: Pixels = { data: new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 255, 255]), width: 2, height: 1 };
  preencherNaMascara(p, new Uint8Array([255, 128]), [255, 0, 0, 255]);
  assert.deepEqual([...p.data.slice(0, 4)], [255, 0, 0, 255]);
  assert.ok(p.data[4] > 100 && p.data[6] > 100 && p.data[7] === 255, `mistura na borda: ${[...p.data.slice(4)]}`);
  const antes: Pixels = { data: new Uint8ClampedArray([1, 1, 1, 1, 2, 2, 2, 2]), width: 2, height: 1 };
  const depois: Pixels = { data: new Uint8ClampedArray([9, 9, 9, 9, 9, 9, 9, 9]), width: 2, height: 1 };
  restaurarFora(depois, antes, new Uint8Array([255, 0]));
  assert.deepEqual([...depois.data], [9, 9, 9, 9, 2, 2, 2, 2]);
  const grande = mascaraDoRetangulo({ x: 1, y: 1, w: 1, h: 1 }, 3, 3);
  assert.deepEqual([...recortarMascara(grande, 3, { x: 1, y: 0, w: 2, h: 2 })], [0, 0, 255, 0]);
});

test("desenho da seleção: véu por dentro e borda marcada", () => {
  const m = mascaraDoRetangulo({ x: 0, y: 0, w: 3, h: 3 }, 4, 3);
  const d = desenhoDaSelecao(m, 4, 3);
  assert.equal(d[(1 * 4 + 1) * 4 + 3], 56, "meio com véu");
  assert.equal(d[0 * 4 + 3], 255, "canto é borda");
  assert.equal(d[(1 * 4 + 3) * 4 + 3], 0, "fora não tem nada");
});
