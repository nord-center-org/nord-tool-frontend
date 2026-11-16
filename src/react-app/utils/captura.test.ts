import assert from "node:assert/strict";
import { test } from "node:test";
import { nomePrint, recorteNoElemento, retanguloEntre, selecaoValida, transformacaoDeslocada } from "./captura.ts";

test("retanguloEntre aceita arrastar em qualquer direção", () => {
  assert.deepEqual(retanguloEntre(100, 80, 20, 10), { x: 20, y: 10, largura: 80, altura: 70 });
  assert.deepEqual(retanguloEntre(5, 5, 15, 25), { x: 5, y: 5, largura: 10, altura: 20 });
});

test("selecaoValida ignora clique sem arrastar", () => {
  assert.ok(!selecaoValida({ x: 0, y: 0, largura: 3, altura: 40 }));
  assert.ok(selecaoValida({ x: 0, y: 0, largura: 12, altura: 12 }));
});

test("recorte considera a rolagem do elemento e a escala", () => {
  // Elemento rolado 300 px para cima: seleção em y=100 na janela é y=400 dentro do elemento.
  const recorte = recorteNoElemento({ x: 50, y: 100, largura: 200, altura: 100 }, { x: 40, y: -300, largura: 1000, altura: 2000 }, 2);
  assert.deepEqual(recorte, { x: 20, y: 800, largura: 400, altura: 200 });
});

test("recorte corta o que sai do elemento e devolve null fora dele", () => {
  assert.deepEqual(recorteNoElemento({ x: 0, y: 0, largura: 100, altura: 100 }, { x: 50, y: 50, largura: 500, altura: 500 }, 1), {
    x: 0, y: 0, largura: 50, altura: 50,
  });
  assert.equal(recorteNoElemento({ x: 0, y: 0, largura: 40, altura: 40 }, { x: 50, y: 50, largura: 500, altura: 500 }, 1), null);
});

test("nomePrint usa a tela e a hora", () => {
  const quando = new Date(2026, 9, 25, 9, 5, 7);
  assert.equal(nomePrint("/gestao/financeiro", quando), "print-gestao-financeiro-090507.png");
  assert.equal(nomePrint("/", quando), "print-inicio-090507.png");
});

test("correção: o print guarda o quanto cada área estava rolada", () => {
  assert.equal(transformacaoDeslocada(0, 120, "none"), "translate(0px, -120px)");
  assert.equal(transformacaoDeslocada(30, 0, "matrix(1, 0, 0, 1, 5, 0)"), "translate(-30px, 0px) matrix(1, 0, 0, 1, 5, 0)");
  assert.equal(transformacaoDeslocada(0, 10, ""), "translate(0px, -10px)");
});
