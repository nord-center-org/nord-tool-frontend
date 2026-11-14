import assert from "node:assert/strict";
import { test } from "node:test";

import { dividirEmDuas, itensDaCifra, nomeDaImagem, planoDaImagem } from "./imagemCifra.ts";

test("v12: as linhas da cifra para a imagem", () => {
  const itens = itensDaCifra("Tom: G\n\n[Intro] G  D\n\n\nG      D\nLevanta a parede\n\n");
  assert.deepEqual(itens.map(i => i.tipo), ["secao", "espaco", "acordes", "letra"]);
  assert.equal(itens[0].texto, "Intro");
  assert.equal(itens[0].resto, "G  D");
  assert.equal(itens[2].texto, "G      D", "a linha de acordes fica como está (colunas)");
});

test("v12: cifra curta numa coluna; a fonte encolhe para a linha comprida caber", () => {
  const p = planoDaImagem("C\nOi");
  assert.equal(p.colunas.length, 1);
  assert.equal(p.largura, 1080);
  assert.equal(p.fonte, 30);
  assert.ok(p.altura >= 720);
  const longa = planoDaImagem("x".repeat(120));
  assert.ok(longa.fonte < 30 && longa.fonte >= 15);
  assert.ok(120 * longa.fonte * 0.6 <= longa.larguraColuna || longa.fonte === 15);
});

test("v12: cifra comprida em duas colunas, divididas entre estrofes", () => {
  const estrofe = "G       D\nLevanta a parede devagar\nEm      C\nAssenta o tijolo no prumo\n";
  const texto = Array.from({ length: 16 }, () => estrofe).join("\n");
  const p = planoDaImagem(texto);
  assert.equal(p.colunas.length, 2);
  assert.equal(p.largura, 1920);
  assert.ok(p.altura <= 1920 + 200);
  for (const c of p.colunas) {
    assert.notEqual(c[0].tipo, "espaco");
    assert.notEqual(c[c.length - 1].tipo, "espaco");
  }
  assert.ok(Math.abs(p.colunas[0].length - p.colunas[1].length) <= 5, "colunas equilibradas");
  const [a, b] = dividirEmDuas(itensDaCifra("a\nb\nc\nd"));
  assert.deepEqual([a.length, b.length], [2, 2], "sem estrofes, divide no meio");
});

test("v12: nome do arquivo da imagem", () => {
  assert.equal(nomeDaImagem("Canção da Obra!"), "cifra-cancao-da-obra.png");
  assert.equal(nomeDaImagem("  "), "cifra-musica.png");
});
