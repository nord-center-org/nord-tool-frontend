import assert from "node:assert/strict";
import { test } from "node:test";

import { lerCifra } from "./cifra.ts";
import { baixoDosAcordes, segmentosDaCifra } from "./seguirCifra.ts";

test("v11: os acordes da cifra no tempo, pela coluna em cima da letra", () => {
  const c = lerCifra("C       G\nLevanta a parede\nAm\nAssenta o tijolo");
  const tempos = c.blocos.map((_, i) => (i === 0 ? 10 : i === 1 ? 14 : null));
  const s = segmentosDaCifra(c, tempos, 30);
  assert.deepEqual(s.map(x => x.acorde), ["C", "G", "Am"]);
  assert.equal(s[0].inicio, 10);
  assert.equal(s[1].inicio, 12, "G na metade da linha (col 8 de 16)");
  assert.equal(s[1].fim, 14);
  assert.equal(s[2].fim, 30);
});

test("v11: linhas sem tempo ficam de fora e a transposição leva ao tom do áudio", () => {
  const c = lerCifra("D\nUm\nE\nDois");
  const s = segmentosDaCifra(c, [0, null], 8, -2);
  assert.deepEqual(s.map(x => [x.acorde, x.inicio, x.fim]), [["C", 0, 8]]);
});

test("v11: o baixo toca a fundamental ou o baixo invertido", () => {
  const n = baixoDosAcordes([{ inicio: 0, fim: 1, acorde: "C" }, { inicio: 1, fim: 2, acorde: "C/E" }, { inicio: 2, fim: 3, acorde: "Bbm7" }]);
  assert.deepEqual(n.map(x => x.midi), [36, 28, 34]);
});
