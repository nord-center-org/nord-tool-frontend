import assert from "node:assert/strict";
import { test } from "node:test";

import { acordesDaLinha, blocosComTempo, cifraDosAcordes, lerCifra, linhaDeAcordes, transporAcordes } from "./cifra.ts";

const TEXTO = `Tom: G
Capotraste na 2ª casa

[Intro] G  D  Em  C

[Primeira Parte]
G              D
  Quando a gente canta
Em        C
  a obra fica pronta
Sem acorde aqui

E|-----3---|
B|---0-----|

[Refrão]
C   D   G   (2x)`;

test("lê a cifra no formato do Cifra Club", () => {
  const c = lerCifra(TEXTO);
  assert.deepEqual(c.tom, { tonica: 7, menor: false });
  assert.equal(c.capotraste, 2);
  const tipos = c.blocos.map(b => b.tipo);
  assert.deepEqual(tipos, ["info", "secao", "secao", "letra", "letra", "letra", "tab", "tab", "secao", "acordes"]);
  assert.deepEqual(c.blocos[1].acordes.map(a => a.nome), ["G", "D", "Em", "C"]);
  assert.equal(c.blocos[3].texto, "  Quando a gente canta");
  assert.deepEqual(c.blocos[3].acordes, [{ col: 0, nome: "G" }, { col: 15, nome: "D" }]);
  assert.deepEqual(c.blocos[5].acordes, [], "letra sem acorde em cima");
  assert.equal(c.blocos[6].espacoAntes, true);
  assert.deepEqual(c.blocos[9].acordes.map(a => a.nome), ["C", "D", "G"]);
  assert.deepEqual(blocosComTempo(c), [1, 3, 4, 5, 9]);
});

test("linhas de acordes, enfeites e transposição sem desalinhar", () => {
  assert.deepEqual(acordesDaLinha("| Am | F | (2x)")?.map(a => a.nome), ["Am", "F"]);
  assert.equal(acordesDaLinha("Eu sei que vou"), null);
  const t = transporAcordes([{ col: 0, nome: "E" }, { col: 2, nome: "B" }], 1);
  assert.deepEqual(t, [{ col: 0, nome: "F" }, { col: 2, nome: "C" }]);
  const empurra = transporAcordes([{ col: 0, nome: "A" }, { col: 2, nome: "E" }], 1);
  assert.deepEqual(empurra, [{ col: 0, nome: "A#" }, { col: 3, nome: "F" }], "o nome cresceu: o próximo anda uma coluna");
  assert.equal(linhaDeAcordes([{ col: 0, nome: "G" }, { col: 6, nome: "D" }]), "G     D");
});

test("cifra gerada pelos acordes do áudio, quatro compassos por linha", () => {
  const segs = [{ inicio: 0, fim: 2, acorde: "C" }, { inicio: 2, fim: 4, acorde: "G" }, { inicio: 4, fim: 6, acorde: "Am" }, { inicio: 6, fim: 8, acorde: "F" }, { inicio: 8, fim: 10, acorde: "N" }];
  const txt = cifraDosAcordes(segs, 2);
  const c = lerCifra(txt);
  assert.deepEqual(c.blocos[1].acordes.map(a => a.nome), ["C", "G", "Am", "F"]);
  assert.equal(c.blocos.length, 3, "seção + 2 linhas");
  assert.deepEqual(c.blocos[2].acordes.map(a => a.nome), ["F"], "compasso sem acorde repete o anterior");
  assert.equal(lerCifra(cifraDosAcordes([{ inicio: 0, fim: 4, acorde: "N" }, { inicio: 4, fim: 6, acorde: "D" }], 2)).blocos[1].acordes.length, 1, "silêncio do começo é pulado");
});
