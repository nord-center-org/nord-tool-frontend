import assert from "node:assert/strict";
import { test } from "node:test";

import { montarCifra } from "./escritaCifra.ts";
import { cortesDeJanela, proximoInicio, escritaDaLetra, limparTrecho, linhasDosTrechos, marcasDosAcordes, quebrarLinha } from "./letra.ts";

test("v11: corta as janelas de até 30 s no trecho mais silencioso", () => {
  const sr = 1000; // taxa baixa só para o teste
  const s = new Float32Array(70 * sr).fill(0.5);
  s.fill(0, 24 * sr, 25 * sr); // silêncio entre 24 e 25 s
  s.fill(0, 50 * sr, 51 * sr); // e entre 50 e 51 s
  const c = cortesDeJanela(s, sr);
  assert.equal(c[0], 0);
  assert.equal(c[c.length - 1], s.length);
  assert.equal(c.length, 4, "três janelas");
  assert.ok(c[1] >= 24 * sr && c[1] <= 25 * sr, `primeiro corte no silêncio (${c[1] / sr} s)`);
  assert.ok(c[2] >= 50 * sr && c[2] <= 51 * sr, `segundo corte no silêncio (${c[2] / sr} s)`);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] - c[i - 1] <= 30 * sr);
  assert.deepEqual(cortesDeJanela(new Float32Array(10 * sr), sr), [0, 10 * sr], "curto: uma janela só");
});

test("v11: limpa o que o modelo inventa", () => {
  assert.equal(limparTrecho(" ♪ Levanta a parede ♪ "), "Levanta a parede");
  assert.equal(limparTrecho("[Música]"), "");
  assert.equal(limparTrecho("(risos) Oi"), "Oi");
  assert.equal(limparTrecho("Obrigado por assistir!"), "");
  assert.equal(limparTrecho("Legendas pela comunidade Amara.org"), "");
  assert.equal(limparTrecho("..."), "");
  assert.equal(limparTrecho(" e aí e aí"), "");
  assert.equal(limparTrecho("Hum, hum."), "");
  assert.equal(limparTrecho("Oh, Senhor"), "Oh, Senhor");
  assert.equal(limparTrecho("Obrigado, Senhor, pela vida"), "Obrigado, Senhor, pela vida", "obrigado dentro de um verso fica");
});

test("v11: quebra linhas longas na pontuação ou entre palavras", () => {
  assert.deepEqual(quebrarLinha("Curta"), ["Curta"]);
  assert.deepEqual(quebrarLinha("Levanta a parede devagar, assenta o tijolo no prumo"), ["Levanta a parede devagar,", "assenta o tijolo no prumo"]);
  const l = quebrarLinha("uma frase comprida sem pontuação nenhuma que passa bastante do limite de letras");
  assert.ok(l.length >= 2 && l.every(x => x.length <= 42));
  assert.equal(l.join(" "), "uma frase comprida sem pontuação nenhuma que passa bastante do limite de letras");
});

test("v11: trechos viram linhas com o tempo de cada uma", () => {
  const linhas = linhasDosTrechos([
    { inicio: 8, fim: 10, texto: " Assenta o tijolo no prumo." },
    { inicio: 0, fim: 4, texto: " Levanta a parede devagar." },
    { inicio: 12, fim: 20, texto: " A obra termina no fim do dia, e a casa fica de pé para sempre." },
    { inicio: 21, fim: 22, texto: " Obrigado por assistir." },
  ]);
  assert.deepEqual(linhas.map(l => l.texto), ["Levanta a parede devagar", "Assenta o tijolo no prumo", "A obra termina no fim do dia,", "e a casa fica de pé para sempre"]);
  assert.deepEqual(linhas.map(l => l.inicio).slice(0, 3), [0, 8, 12]);
  assert.ok(linhas[3].inicio > 14 && linhas[3].inicio < 17, `o pedaço quebrado começa no meio do trecho (${linhas[3].inicio})`);
});

test("v11: a mesma frase travada fica no máximo duas vezes seguidas", () => {
  const linhas = linhasDosTrechos([0, 2, 4, 6].map(i => ({ inicio: i, fim: i + 2, texto: "Aleluia" })));
  assert.equal(linhas.length, 2);
});

test("v11: letra com estrofes e tempos para o Escrever cifra", () => {
  const e = escritaDaLetra([{ inicio: 2, texto: "Um" }, { inicio: 5, texto: "Dois" }, { inicio: 20, texto: "Três" }], { letra: "", inicios: [], acordes: [{ tempo: 1, acorde: "G" }] });
  assert.equal(e.letra, "Um\nDois\n\nTrês");
  assert.deepEqual(e.inicios, [2, 5, 20]);
  assert.equal(e.acordes.length, 1, "os acordes ficam");
  const c = montarCifra({ ...e, acordes: marcasDosAcordes([{ inicio: 0, fim: 2, acorde: "G" }, { inicio: 2, fim: 3, acorde: "G" }, { inicio: 3, fim: 4, acorde: "N" }, { inicio: 5, fim: 8, acorde: "C" }]) }, 30);
  assert.match(c.texto, /^\[Intro\]\nG/);
  assert.ok(c.texto.includes("C\nDois"));
});

test("v11: se o modelo parou antes do fim da janela, recomeça de onde parou", () => {
  const sr = 100;
  assert.equal(proximoInicio(0, 3000, 12, sr), 1200, "parou em 12 s de 30: recomeça em 12 s");
  assert.equal(proximoInicio(1000, 4000, 29.5, sr), 4000, "chegou ao fim");
  assert.equal(proximoInicio(1000, 4000, null, sr), 4000, "nada reconhecido");
  assert.equal(proximoInicio(1000, 4000, 0.5, sr), 4000, "não andou");
  assert.equal(proximoInicio(0, 840, 4, sr), 840, "sobram só 4,4 s: segue para o fim");
});
