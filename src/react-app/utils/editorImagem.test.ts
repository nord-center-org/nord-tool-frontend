import assert from "node:assert/strict";
import { test } from "node:test";

import { AJUSTES, Historico, aplicarAjuste, corParaHex, hexParaCor, preencher, redimensionarProporcional, retanguloDe, type Pixels } from "./editorImagem.ts";

const imagem = (w: number, h: number, cor: number[]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(cor, i);
  return { data, width: w, height: h };
};
const px = (p: Pixels | Uint8ClampedArray, i = 0) => Array.from((p instanceof Uint8ClampedArray ? p : p.data).slice(i * 4, i * 4 + 4));

test("ajustes de cor", () => {
  const cinza = imagem(2, 1, [100, 100, 100, 255]);
  assert.deepEqual(px(aplicarAjuste(cinza, "brilho", 20)), [151, 151, 151, 255]);
  assert.deepEqual(px(aplicarAjuste(cinza, "inverter", 0)), [155, 155, 155, 255]);
  const vermelho = imagem(1, 1, [200, 50, 50, 128]);
  const pb = px(aplicarAjuste(vermelho, "cinza", 0));
  assert.ok(pb[0] === pb[1] && pb[1] === pb[2] && pb[3] === 128);
  assert.deepEqual(px(aplicarAjuste(vermelho, "saturacao", -100)).slice(0, 3), [125, 125, 125]);
  const girado = px(aplicarAjuste(vermelho, "matiz", 120));
  assert.ok(girado[1] > girado[0], `matiz leva o vermelho para o verde: ${girado}`);
  const mais = px(aplicarAjuste(imagem(1, 1, [200, 60, 60, 255]), "contraste", 50));
  assert.ok(mais[0] > 200 && mais[1] < 60);
  const quente = px(aplicarAjuste(cinza, "temperatura", 50));
  assert.ok(quente[0] > 100 && quente[2] < 100);
  assert.equal(AJUSTES.find(a => a.tipo === "cinza")?.semValor, true);
});

test("desfoque espalha e nitidez realça uma borda", () => {
  const p = imagem(5, 1, [0, 0, 0, 255]);
  p.data.set([255, 255, 255, 255], 2 * 4);
  const d = aplicarAjuste(p, "desfoque", 1);
  assert.ok(d[1 * 4] > 0 && d[2 * 4] < 255);
  const n = aplicarAjuste(p, "nitidez", 100);
  assert.equal(n[2 * 4], 255);
  assert.equal(n[1 * 4], 0);
  assert.deepEqual(px(aplicarAjuste(p, "desfoque", 0)), px(p));
});

test("balde de tinta pinta só a área contínua", () => {
  // 3x3 branco com uma parede preta na coluna do meio.
  const p = imagem(3, 3, [255, 255, 255, 255]);
  for (const y of [0, 1, 2]) p.data.set([0, 0, 0, 255], (y * 3 + 1) * 4);
  assert.equal(preencher(p, 0, 0, [255, 0, 0, 255]), 3);
  assert.deepEqual(px(p, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(p, 2), [255, 255, 255, 255]);
  assert.equal(preencher(p, 0, 0, [255, 0, 0, 255]), 0);
  assert.equal(preencher(p, 9, 9, [0, 0, 0, 255]), 0);
  const quase = imagem(2, 1, [250, 250, 250, 255]);
  quase.data.set([240, 240, 240, 255], 4);
  assert.equal(preencher(quase, 0, 0, [0, 0, 255, 255], 10), 2);
});

test("cores, histórico, proporção e retângulo", () => {
  assert.deepEqual(hexParaCor("#ff8000"), [255, 128, 0, 255]);
  assert.equal(corParaHex([255, 128, 0]), "#ff8000");
  const h = new Historico<number>(2);
  h.guardar(1); h.guardar(2); h.guardar(3);
  assert.equal(h.desfazer(4), 3);
  assert.equal(h.desfazer(3), 2);
  assert.equal(h.desfazer(2), null);
  assert.equal(h.refazer(2), 3);
  h.guardar(9);
  assert.equal(h.podeRefazer, false);
  h.guardar(10); h.ajustarLimite(1);
  assert.equal(h.desfazer(11), 10);
  assert.equal(h.desfazer(10), null);
  assert.deepEqual(redimensionarProporcional(800, 600, { largura: 400 }), { largura: 400, altura: 300 });
  assert.deepEqual(redimensionarProporcional(800, 600, { altura: 300 }), { largura: 400, altura: 300 });
  assert.deepEqual(retanguloDe({ x: 50, y: 40 }, { x: -5, y: 10.5 }, 30, 100), { x: 0, y: 10, w: 30, h: 30 });
});
