import assert from "node:assert/strict";
import { test } from "node:test";

import { classeDaNota, nomeDaNota, distanciaEntreTons, lerAcorde, lerTom, nomeDoTom, nomeMidi, notasDoAcorde, transporAcorde } from "./teoria.ts";

test("notas e nomes", () => {
  assert.equal(classeDaNota("F#"), 6);
  assert.equal(classeDaNota("Bb"), 10);
  assert.equal(classeDaNota("Cb"), 11);
  assert.equal(classeDaNota("H"), null);
  assert.equal(nomeMidi(40), "E2");
  assert.equal(nomeMidi(61, true), "Db4");
  assert.equal(nomeDaNota(36), "C");
  assert.equal(nomeDaNota(42, "solfejo"), "Fá#");
  assert.equal(nomeDaNota(-3, "solfejo"), "Lá");
});

test("lê acordes de cifra e recusa palavras", () => {
  assert.deepEqual(lerAcorde("Am7")?.intervalos, [0, 3, 7, 10]);
  assert.deepEqual(lerAcorde("F#m7(b5)")?.intervalos, [0, 3, 6, 10]);
  assert.equal(lerAcorde("C/E")?.baixo, 4);
  assert.deepEqual(lerAcorde("Bb7M")?.intervalos, [0, 4, 7, 11]);
  assert.deepEqual(lerAcorde("D7/4")?.intervalos, [0, 5, 7, 10], "D7/4 é sus4 com sétima, não baixo invertido");
  assert.deepEqual(lerAcorde("G4")?.intervalos, [0, 5, 7]);
  assert.deepEqual(lerAcorde("E7(9)")?.intervalos, [0, 2, 4, 7, 10]);
  assert.deepEqual(lerAcorde("Bdim7")?.intervalos, [0, 3, 6, 9]);
  assert.equal(lerAcorde("Am")?.menor, true);
  for (const palavra of ["Casa", "Ele", "Do", "Eu", "A gente", "Bem"]) assert.equal(lerAcorde(palavra), null, palavra);
  assert.deepEqual(notasDoAcorde(lerAcorde("D/F#")!).sort((a, b) => a - b), [2, 6, 9]);
});

test("transpõe acordes e tons", () => {
  assert.equal(transporAcorde("F#m7/C#", 2), "G#m7/D#");
  assert.equal(transporAcorde("Bb7M", 2), "C7M");
  assert.equal(transporAcorde("Eb", 1), "E");
  assert.equal(transporAcorde("D7/4", -2), "C7/4");
  assert.equal(transporAcorde("Ele", 3), "Ele");
  assert.deepEqual(lerTom("Em"), { tonica: 4, menor: true });
  assert.equal(lerTom("Am7"), null);
  assert.deepEqual(nomeDoTom({ tonica: 10, menor: false }), { cifra: "Bb", extenso: "Si♭ maior" });
  assert.deepEqual(nomeDoTom({ tonica: 4, menor: true }), { cifra: "Em", extenso: "Mi menor" });
  assert.equal(distanciaEntreTons(0, 11), -1);
  assert.equal(distanciaEntreTons(0, 6), 6);
});
