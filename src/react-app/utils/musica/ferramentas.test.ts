import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CORDAS_DO_BRACO, FERRAMENTAS_PADRAO, VARIANTES, lerFerramentas, naEscala, notaNoBraco, notasDaEscala, notasDaTecla, temBraco, variante,
} from "./ferramentas.ts";

test("v8: cada instrumento tem timbres e a variação padrão é a primeira", () => {
  for (const t of ["baixo", "teclado", "violao", "lead", "bateria"] as const) assert.ok(VARIANTES[t].length >= 2, t);
  assert.equal(variante("baixo", "slap"), "slap");
  assert.equal(variante("baixo", "orgao"), "dedo", "variação de outro instrumento vale a padrão");
  assert.equal(variante("teclado", undefined), "eletrico");
});

test("v8: escalas", () => {
  assert.deepEqual([...notasDaEscala(0, "maior")].sort((a, b) => a - b), [0, 2, 4, 5, 7, 9, 11]);
  assert.deepEqual([...notasDaEscala(9, "penta-menor")].sort((a, b) => a - b), [0, 2, 4, 7, 9], "Lá pentatônica menor = Dó pentatônica maior");
  assert.deepEqual([...notasDaEscala(7, "nao-existe")].sort((a, b) => a - b), [0, 2, 4, 6, 7, 9, 11], "escala desconhecida vira maior");
  const c = notasDaEscala(0, "maior");
  assert.equal(naEscala(61, c), false);
  assert.equal(naEscala(62, c), true);
  assert.equal(naEscala(61, null), true);
});

test("v8: acorde com uma tecla", () => {
  assert.deepEqual(notasDaTecla(60, null), [60]);
  assert.deepEqual(notasDaTecla(60, "maior"), [60, 64, 67]);
  assert.deepEqual(notasDaTecla(57, "m7"), [57, 60, 64, 67]);
  assert.deepEqual(notasDaTecla(40, "5"), [40, 47, 52]);
  assert.deepEqual(notasDaTecla(60, "xyz"), [60]);
  const c = notasDaEscala(0, "maior");
  assert.deepEqual(notasDaTecla(62, "escala", c), [62, 65, 69], "no campo de Dó, Ré dá Ré menor");
  assert.deepEqual(notasDaTecla(67, "escala", c), [67, 71, 74], "Sol dá Sol maior");
  assert.deepEqual(notasDaTecla(61, "escala", c), [61], "fora da escala, só a nota");
  assert.deepEqual(notasDaTecla(60, "escala", null), [60], "sem escala, só a nota");
});

test("v8: braço do baixo e do violão", () => {
  assert.equal(temBraco("baixo"), true);
  assert.equal(temBraco("teclado"), false);
  const baixo = CORDAS_DO_BRACO.baixo!.cordas;
  assert.equal(notaNoBraco(baixo, 1, 0), 28, "Mi solto");
  assert.equal(notaNoBraco(baixo, 1, 3), 31, "Sol na casa 3 do Mi");
  assert.equal(notaNoBraco(baixo, 0, 5, 2), 30);
});

test("v8: preferências guardadas, com leitura tolerante", () => {
  assert.deepEqual(lerFerramentas(null), FERRAMENTAS_PADRAO);
  const p = lerFerramentas({
    sustentar: true, transpor: 40, escala: { tonica: 14, id: "blues" }, acorde: "m7", forca: 5, layout: "braco", oitavas: 9,
    variantes: { baixo: "slap", teclado: "nada", tuba: "x" },
  });
  assert.equal(p.sustentar, true);
  assert.equal(p.transpor, 12);
  assert.deepEqual(p.escala, { tonica: 11, id: "blues" });
  assert.equal(p.acorde, "m7");
  assert.equal(p.forca, 1);
  assert.equal(p.layout, "braco");
  assert.equal(p.oitavas, 3);
  assert.deepEqual(p.variantes, { baixo: "slap" });
  assert.equal(lerFerramentas({ escala: { id: "x" }, acorde: "13" }).escala, null);
  assert.equal(lerFerramentas({ acorde: "escala" }).acorde, "escala");
});
