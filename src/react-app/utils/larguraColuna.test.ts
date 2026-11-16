import assert from "node:assert/strict";
import { test } from "node:test";

import { ALTURA_PADRAO, FOLGA, MAXIMA, MINIMA, alturaIdeal, colunaDaBorda, larguraIdeal } from "./larguraColuna.ts";

const medir = (t: { texto: string; negrito?: boolean }) => t.texto.length * (t.negrito ? 8 : 7);

test("largura ideal pelo texto mais largo", () => {
  assert.equal(larguraIdeal([{ texto: "Cimento" }, { texto: "Areia" }], medir), 7 * 7 + FOLGA);
  assert.equal(larguraIdeal([{ texto: "Total", negrito: true }], medir), 5 * 8 + FOLGA);
  assert.equal(larguraIdeal([{ texto: "linha curta\numa linha bem maior" }], medir), 19 * 7 + FOLGA);
  assert.equal(larguraIdeal([{ texto: "" }], medir), null);
  assert.equal(larguraIdeal([{ texto: "a" }], medir), MINIMA);
  assert.equal(larguraIdeal([{ texto: "x".repeat(500) }], medir), MAXIMA);
});

test("coluna pela borda do cabeçalho", () => {
  const larg = [73, 100, 50];
  assert.equal(colunaDaBorda(larg, 74), 0);
  assert.equal(colunaDaBorda(larg, 175), 1);
  assert.equal(colunaDaBorda(larg, 228), 2);
  assert.equal(colunaDaBorda(larg, 120), -1, "longe de qualquer borda");
});

test("correção: altura ideal da linha nos dois cliques", () => {
  assert.equal(alturaIdeal([]), ALTURA_PADRAO, "linha vazia volta ao padrão");
  assert.equal(alturaIdeal([{ texto: "a", tamanho: 10 }]), ALTURA_PADRAO, "letra normal cabe na altura padrão");
  assert.ok(alturaIdeal([{ texto: "a\nb\nc", tamanho: 10 }]) > 50, "três linhas de texto");
  assert.ok(alturaIdeal([{ texto: "grande", tamanho: 24 }]) > 40, "letra grande");
  assert.equal(alturaIdeal([{ texto: "x\n".repeat(200), tamanho: 10 }]), 400, "no máximo 400");
});
