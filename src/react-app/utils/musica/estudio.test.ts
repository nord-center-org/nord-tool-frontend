import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LIMITES, alternarNota, duplicarCompassos, duracaoEmSegundos, faixasAudiveis, juntarGravacao, lerProjeto, mudarCompassos, notaDaTecla, notasNoIntervalo,
  novaFaixa, novoProjeto, pecaDaTecla, quantizar, teclaDaNota, type NotaEstudio, type Projeto,
} from "./estudio.ts";

const nota = (inicio: number, midi = 60, dur = 1): NotaEstudio => ({ inicio, dur, midi, vel: 0.8 });

test("v6: projeto e faixas novas", () => {
  const p = novoProjeto("Teste", "2026-11-13T00:00:00Z");
  assert.equal(p.bpm, 100);
  assert.equal(p.compassos, 4);
  assert.equal(duracaoEmSegundos(p), 16 * 0.6);
  const a = novaFaixa("baixo");
  assert.equal(a.nome, "Baixo");
  assert.equal(novaFaixa("baixo", [a]).nome, "Baixo 2");
  assert.equal(novaFaixa("bateria").nome, "Bateria");
});

test("v6: clique na grade põe e tira a nota", () => {
  let n = alternarNota([], 60, 2, 1, 16);
  assert.deepEqual(n, [{ inicio: 2, dur: 1, midi: 60, vel: 0.85 }]);
  n = alternarNota(n, 60, 2.5, 1, 16);
  assert.equal(n.length, 0, "clicar dentro da nota a tira");
  n = alternarNota([], 60, 15.5, 2, 16);
  assert.equal(n[0].dur, 0.5, "cortada no fim");
  assert.deepEqual(alternarNota([], 60, 16, 1, 16), [], "fora da música não entra");
  n = alternarNota(alternarNota([], 62, 0, 1, 16), 60, 0, 1, 16);
  assert.deepEqual(n.map(x => x.midi), [60, 62], "ordenadas");
});

test("v6: gravação quantizada sem duplicar", () => {
  assert.equal(quantizar(1.13), 1.25);
  assert.equal(quantizar(1.13, 0), 1.13);
  const r = juntarGravacao([nota(0)], [nota(0.04), nota(1.1, 62, 0.3), nota(20)], 16);
  assert.deepEqual(r.map(x => [x.inicio, x.midi, x.dur]), [[0, 60, 1], [1, 62, 0.25]]);
  const livre = juntarGravacao([], [nota(1.13, 60, 0.31)], 16, 0);
  assert.equal(livre[0].inicio, 1.13);
});

test("v6: mudo e solo", () => {
  const a = { ...novaFaixa("baixo"), id: "a" }, b = { ...novaFaixa("teclado"), id: "b" }, c = { ...novaFaixa("bateria"), id: "c", mudo: true };
  assert.deepEqual(faixasAudiveis([a, b, c]).map(f => f.id), ["a", "b"]);
  assert.deepEqual(faixasAudiveis([a, { ...b, solo: true }, c]).map(f => f.id), ["b"]);
});

test("v6: notas no intervalo, com repetição", () => {
  const p: Projeto = { ...novoProjeto(), compassos: 1, faixas: [{ ...novaFaixa("baixo"), notas: [nota(0), nota(2)] }] };
  assert.deepEqual(notasNoIntervalo(p, 0, 1).map(x => x.tempo), [0]);
  assert.deepEqual(notasNoIntervalo(p, 1, 3).map(x => x.tempo), [2]);
  assert.deepEqual(notasNoIntervalo(p, 3, 6).map(x => x.tempo), [], "sem repetição, depois do fim não toca");
  assert.deepEqual(notasNoIntervalo(p, 3, 6.5, true).map(x => x.tempo), [4, 6], "com repetição volta ao começo");
});

test("v6: compassos e repetir trecho", () => {
  const p: Projeto = { ...novoProjeto(), compassos: 2, faixas: [{ ...novaFaixa("baixo"), id: "x", notas: [nota(0), nota(6, 60, 3)] }] };
  const menor = mudarCompassos(p, 1);
  assert.equal(menor.compassos, 1);
  assert.deepEqual(menor.faixas[0].notas.map(n => n.inicio), [0]);
  const corte = mudarCompassos({ ...p, faixas: [{ ...p.faixas[0], notas: [nota(3, 60, 3)] }] }, 1);
  assert.equal(corte.faixas[0].notas[0].dur, 1);
  assert.equal(mudarCompassos(p, 999).compassos, LIMITES.compassosMax);
  const dup = duplicarCompassos(p, 0, 1);
  assert.equal(dup.compassos, 2);
  assert.deepEqual(dup.faixas[0].notas.map(n => n.inicio), [0, 4, 6]);
  assert.deepEqual(duplicarCompassos(p, 0, 2).compassos, 4);
});

test("v6: teclado do computador toca notas e bateria", () => {
  assert.equal(notaDaTecla("a", 4), 60);
  assert.equal(notaDaTecla("W", 4), 61);
  assert.equal(notaDaTecla("k", 4), 72);
  assert.equal(notaDaTecla("z", 4), null);
  assert.equal(teclaDaNota(62, 4), "S");
  assert.equal(teclaDaNota(40, 4), null);
  assert.equal(pecaDaTecla("a"), 36);
  assert.equal(pecaDaTecla("S"), 38);
  assert.equal(pecaDaTecla("q"), null);
});

test("v6: leitura segura do projeto guardado", () => {
  assert.equal(lerProjeto(null), null);
  assert.equal(lerProjeto({ titulo: "sem id" }), null);
  const p = lerProjeto({
    id: "p1", titulo: "", bpm: 9999, compassos: 2,
    faixas: [
      { id: "f", timbre: "baixo", notas: [{ inicio: 1, dur: 1, midi: 40 }, { inicio: 50, dur: 1, midi: 40 }, { inicio: 7, dur: 5, midi: 40, vel: 9 }, "x"] },
      { id: "g", timbre: "tuba", notas: [] },
    ],
  });
  assert.ok(p);
  assert.equal(p.titulo, "Música nova");
  assert.equal(p.bpm, LIMITES.bpmMax);
  assert.equal(p.faixas.length, 1);
  assert.deepEqual(p.faixas[0].notas.map(n => [n.inicio, n.dur, n.vel]), [[1, 1, 0.85], [7, 1, 1]]);
});

test("v8: a faixa guarda a variação do timbre", () => {
  const p = lerProjeto({ id: "p", faixas: [{ id: "f", timbre: "baixo", variante: "slap", notas: [] }, { id: "g", timbre: "baixo", variante: "<script>", notas: [] }] });
  assert.equal(p?.faixas[0].variante, "slap");
  assert.equal(p?.faixas[1].variante, undefined);
});
