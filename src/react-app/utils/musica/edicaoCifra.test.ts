import assert from "node:assert/strict";
import { test } from "node:test";

import { linhasEditaveis, moverAcorde, porAcorde, tirarAcorde } from "./edicaoCifra.ts";

const CIFRA = "Tom: G\n\n[Intro] G  D\n\nG       D\nLevanta a parede\nAssenta o tijolo\n\nEm  C  |  (2x)\n";

test("v13: as linhas onde dá para mexer nos acordes", () => {
  const l = linhasEditaveis(CIFRA);
  assert.deepEqual(l.map(x => [x.letra, x.acordes, x.texto]), [[5, 4, "Levanta a parede"], [6, null, "Assenta o tijolo"], [null, 8, ""]]);
  assert.deepEqual(l[0].itens, [{ col: 0, nome: "G" }, { col: 8, nome: "D" }]);
});

test("v13: pôr um acorde num verso sem acordes cria a linha de cima", () => {
  const t = porAcorde(CIFRA, 1, 8, "Am");
  assert.ok(t.includes("Levanta a parede\n        Am\nAssenta o tijolo"));
  assert.equal(linhasEditaveis(t)[1].itens[0].col, 8);
  const troca = porAcorde(CIFRA, 0, 8, "D7");
  assert.ok(troca.includes("G       D7\nLevanta"), "a mesma coluna troca o acorde");
});

test("v13: tirar o último acorde do verso apaga a linha de acordes", () => {
  let t = tirarAcorde(CIFRA, 0, 0);
  assert.ok(t.includes("        D\nLevanta"));
  t = tirarAcorde(t, 0, 8);
  assert.ok(t.includes("\n\nLevanta a parede"));
  assert.equal(linhasEditaveis(t)[0].acordes, null);
});

test("v13: mover o acorde na mesma linha e para outra linha", () => {
  const mesma = moverAcorde(CIFRA, { linha: 0, col: 8 }, { linha: 0, col: 3 });
  assert.ok(mesma.includes("G  D\nLevanta"));
  const outra = moverAcorde(CIFRA, { linha: 0, col: 8 }, { linha: 1, col: 4 });
  assert.ok(outra.includes("G\nLevanta a parede\n    D\nAssenta o tijolo"), outra);
  // a origem fica sem linha de acordes e o destino é achado de novo
  const sozinho = moverAcorde(porAcorde(CIFRA, 1, 0, "C"), { linha: 1, col: 0 }, { linha: 0, col: 4 });
  assert.ok(sozinho.includes("G   C   D\nLevanta a parede\nAssenta o tijolo"), sozinho);
  assert.equal(moverAcorde(CIFRA, { linha: 0, col: 5 }, { linha: 1, col: 0 }), CIFRA, "sem acorde na origem não muda");
});

test("v13: linha só de acordes que fica vazia some", () => {
  let t = tirarAcorde(CIFRA, 2, 0);
  t = tirarAcorde(t, 2, 4);
  assert.ok(!t.includes("Em") && !t.includes("C  |"));
});
