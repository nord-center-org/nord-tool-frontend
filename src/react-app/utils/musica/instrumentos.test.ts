import assert from "node:assert/strict";
import { test } from "node:test";

import { INSTRUMENTOS, digitar, eventosParaTocar, formaDoAcorde, instrumento, naFaixa, posicoes, vozesNoTeclado } from "./instrumentos.ts";

const BAIXO = instrumento("baixo4");

test("posições no braço e faixa", () => {
  assert.deepEqual(posicoes(33, BAIXO.cordas, 20), [{ corda: 0, casa: 5 }, { corda: 1, casa: 0 }]);
  assert.equal(naFaixa(24, [28, 63]), 36);
  assert.equal(naFaixa(70, [28, 63]), 58);
  assert.equal(INSTRUMENTOS.length, 4);
});

test("digitação do baixo anda pouco com a mão", () => {
  const pos = digitar([36, 36, 43, 45, 41], BAIXO.cordas);
  assert.deepEqual(pos[0], { corda: 1, casa: 3 }, "C2 na corda A, casa 3");
  for (let i = 1; i < pos.length; i++) assert.ok(Math.abs(pos[i].casa - pos[i - 1].casa) <= 5 || pos[i].casa === 0);
});

test("formas de acorde no violão", () => {
  assert.deepEqual(formaDoAcorde("C"), [-1, 3, 2, 0, 1, 0]);
  assert.deepEqual(formaDoAcorde("Am"), [-1, 0, 2, 2, 1, 0]);
  assert.deepEqual(formaDoAcorde("Em"), [0, 2, 2, 0, 0, 0]);
  assert.deepEqual(formaDoAcorde("F"), [1, 3, 3, 2, 1, 1]);
  assert.deepEqual(formaDoAcorde("Bm"), [-1, 2, 4, 4, 3, 2]);
  assert.equal(formaDoAcorde("Casa"), null);
  assert.deepEqual(vozesNoTeclado("C/E"), [52, 60, 64, 67]);
});

test("o que cai na tela segue o instrumento e o tom", () => {
  const notas = [{ inicio: 0, fim: 0.5, midi: 36, forca: 1 }, { inicio: 0.5, fim: 1, midi: 43, forca: 1 }];
  const acordes = [{ inicio: 0, fim: 2, acorde: "C" }, { inicio: 2, fim: 3, acorde: "N" }];
  const baixo = eventosParaTocar(BAIXO, notas, acordes, 2);
  assert.equal(baixo.length, 2);
  assert.equal(BAIXO.cordas[baixo[0].corda!] + baixo[0].casa!, 38, "C2 + 2 semitons = D2");
  const violao = eventosParaTocar(instrumento("violao"), notas, acordes, 0);
  assert.equal(violao.length, 5, "C aberto: 5 cordas");
  const teclado = eventosParaTocar(instrumento("teclado"), notas, acordes, 0);
  assert.deepEqual(teclado.map(e => e.midi), [48, 60, 64, 67]);
});
