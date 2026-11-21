import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarQr, penalidade, reedSolomon, versaoPara } from "./qrcode.ts";

test("Reed-Solomon bate com o exemplo da norma (HELLO WORLD, 1-M)", () => {
  assert.deepEqual(reedSolomon([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test("escolhe a menor versão que cabe", () => {
  assert.equal(versaoPara(14), 1);
  assert.equal(versaoPara(15), 2);
  assert.equal(versaoPara(60), 4);
  assert.equal(versaoPara(213), 10);
  assert.throws(() => versaoPara(214));
});

test("o QR do link da sala tem os localizadores e o módulo escuro fixo", () => {
  const q = gerarQr("https://nordtool.example.com/gestao/games/controle?sala=AB3K");
  assert.equal(q.versao, 4);
  assert.equal(q.tamanho, 33);
  const m = q.modulos;
  for (const [x, y] of [[0, 0], [q.tamanho - 7, 0], [0, q.tamanho - 7]]) {
    assert.equal(m[y][x], true);
    assert.equal(m[y + 1][x + 1], false);
    assert.equal(m[y + 3][x + 3], true);
  }
  assert.equal(m[q.tamanho - 8][8], true);
  assert.ok(q.mascara >= 0 && q.mascara < 8);
  assert.ok(penalidade(m) > 0);
});

test("versão 7 em diante leva a informação de versão", () => {
  const q = gerarQr("x".repeat(120));
  assert.equal(q.versao, 7);
  assert.equal(q.tamanho, 45);
});
