import assert from "node:assert/strict";
import { test } from "node:test";

import { lerCifra } from "./cifra.ts";
import { campoHarmonico, lerEscrita, linhasDaLetra, marcarAcorde, montarCifra, noTempo } from "./escritaCifra.ts";

test("v10: campo harmônico do tom", () => {
  assert.deepEqual(campoHarmonico({ tonica: 0, menor: false }), ["C", "Dm", "Em", "F", "G", "Am", "Bdim", "G7"]);
  assert.deepEqual(campoHarmonico({ tonica: 9, menor: true }), ["Am", "Bdim", "C", "Dm", "Em", "F", "G", "E7"]);
  assert.deepEqual(campoHarmonico({ tonica: 8, menor: false }).slice(0, 3), ["Ab", "Bbm", "Cm"], "Lá bemol escreve com bemol");
});

test("v10: marcar acordes e encaixar no tempo", () => {
  let a = marcarAcorde([], 2, "G");
  a = marcarAcorde(a, 1, "C");
  a = marcarAcorde(a, 2.02, "D");
  assert.deepEqual(a, [{ tempo: 1, acorde: "C" }, { tempo: 2.02, acorde: "D" }], "o mesmo instante troca o acorde");
  assert.equal(noTempo(1.93, [1, 1.5, 2, 2.5]), 2);
  assert.equal(noTempo(1.7, [1, 2], 0.2), 1.7, "longe de toda batida, fica");
  assert.deepEqual(linhasDaLetra("a\n\n  \nb  \n"), ["a", "b"]);
});

test("v10: só acordes viram linhas de quatro com o tempo de cada", () => {
  const r = montarCifra({ letra: "", inicios: [], acordes: ["C", "G", "Am", "F", "C", "G"].map((acorde, i) => ({ tempo: i * 2, acorde })) }, 20);
  const c = lerCifra(r.texto);
  assert.equal(c.blocos[0].tipo, "secao");
  const comAcordes = c.blocos.filter(b => b.tipo === "acordes");
  assert.deepEqual(comAcordes.map(b => b.acordes.map(a => a.nome)), [["C", "G", "Am", "F"], ["C", "G"]]);
  assert.deepEqual(r.tempos, [null, 0, 8]);
});

test("v10: acordes em cima da sílaba certa da letra, com intro e estrofes", () => {
  const letra = "Primeira linha da musica\nSegunda linha\n\nTerceira ainda nao marcada";
  const r = montarCifra({
    letra,
    inicios: [10, 14, null],
    acordes: [{ tempo: 2, acorde: "G" }, { tempo: 10, acorde: "C" }, { tempo: 12, acorde: "Am" }, { tempo: 14, acorde: "F" }],
  }, 30);
  const c = lerCifra(r.texto);
  const letras = c.blocos.filter(b => b.tipo === "letra");
  assert.equal(letras.length, 3);
  assert.deepEqual(letras[0].acordes.map(a => [a.nome, a.col]), [["C", 0], ["Am", 12]], "Am na metade da linha (12 s de 10–14; a linha tem 24 letras)");
  assert.deepEqual(letras[1].acordes.map(a => a.nome), ["F"]);
  assert.deepEqual(letras[2].acordes, [], "linha não marcada entra só com a letra");
  assert.equal(c.blocos.length, r.tempos.length);
  const idx = (b: typeof letras[0]) => c.blocos.indexOf(b);
  assert.equal(r.tempos[idx(letras[0])], 10);
  assert.equal(r.tempos[idx(letras[1])], 14);
  assert.equal(r.tempos[idx(letras[2])], null);
  assert.match(r.texto, /^\[Intro\]\nG/);
  assert.ok(r.texto.includes("Segunda linha\n\n"), "a estrofe continua separada");
});

test("v10: acordes que encostariam ficam separados", () => {
  const r = montarCifra({ letra: "Oi", inicios: [0], acordes: [{ tempo: 0, acorde: "C#m7" }, { tempo: 0.1, acorde: "F#" }] }, 4);
  const linha = r.texto.split("\n")[0];
  assert.equal(linha, "C#m7 F#");
});

test("v10: leitura tolerante da escrita guardada", () => {
  assert.deepEqual(lerEscrita(null), { letra: "", inicios: [], acordes: [] });
  const e = lerEscrita({ letra: 5, inicios: [1, "x", -2], acordes: [{ tempo: 3, acorde: "G" }, { tempo: 1, acorde: "C" }, { tempo: "a", acorde: "D" }, { tempo: 2, acorde: "X".repeat(20) }] });
  assert.equal(e.letra, "");
  assert.deepEqual(e.inicios, [1, null, null]);
  assert.deepEqual(e.acordes.map(a => a.acorde), ["C", "G"]);
});
