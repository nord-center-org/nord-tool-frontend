import assert from "node:assert/strict";
import { test } from "node:test";

import { instrumento, type EventoQueda } from "./instrumentos.ts";
import { ANTECEDENCIA, alturaDoEvento, frequencia, passoDaAgenda } from "./sintese.ts";

const ev = (inicio: number, fim: number): EventoQueda => ({ inicio, fim, corda: 0, casa: 3, rotulo: "" });

test("v5: frequência e altura do evento", () => {
  assert.equal(frequencia(69), 440);
  assert.ok(Math.abs(frequencia(57) - 220) < 1e-9);
  assert.equal(alturaDoEvento(instrumento("baixo5"), { inicio: 0, fim: 1, corda: 1, casa: 3, rotulo: "" }), 31);
  assert.equal(alturaDoEvento(instrumento("teclado"), { inicio: 0, fim: 1, midi: 60, rotulo: "" }), 60);
});

test("v5: agenda cada nota uma vez, à frente do tempo, e respeita o andamento", () => {
  const eventos = [ev(0.1, 0.5), ev(0.3, 0.6), ev(1, 2)];
  let p = passoDaAgenda(eventos, null, 0, 1, true);
  assert.deepEqual(p.notas.map(n => n.evento.inicio), [0.1]);
  assert.equal(p.reiniciar, false);
  p = passoDaAgenda(eventos, p.agenda, 0.1, 1, true);
  assert.deepEqual(p.notas.map(n => n.evento.inicio), [0.3], "a de 0,1 não repete");
  p = passoDaAgenda(eventos, p.agenda, 0.9, 0.5, true);
  assert.equal(p.notas.length, 1);
  assert.ok(Math.abs(p.notas[0].daqui - 0.2) < 1e-9, "metade do andamento: 0,1 s da música = 0,2 s reais");
  assert.ok(Math.abs(p.notas[0].dura - 2) < 1e-9);
  assert.equal(p.agenda.ate, 0.9 + ANTECEDENCIA);
});

test("v5: pulo e pausa recomeçam sem tocar o que ficou para trás", () => {
  const eventos = [ev(0.1, 0.5), ev(5, 6), ev(5.1, 6)];
  let p = passoDaAgenda(eventos, null, 0, 1, true);
  p = passoDaAgenda(eventos, p.agenda, 5.02, 1, true);
  assert.equal(p.reiniciar, true);
  assert.deepEqual(p.notas.map(n => n.evento.inicio), [5.1], "o pulo agenda a partir de t − 0,02 (5,00): a nota de 5 s fica de fora");
  const parado = passoDaAgenda(eventos, p.agenda, 5.3, 1, false);
  assert.equal(parado.reiniciar, true);
  assert.equal(parado.notas.length, 0);
  assert.equal(passoDaAgenda(eventos, null, 0, 1, false).reiniciar, false);
  const volta = passoDaAgenda(eventos, { ate: 6, ultimo: 5.9 }, 0, 1, true);
  assert.equal(volta.reiniciar, true);
  assert.deepEqual(volta.notas.map(n => n.evento.inicio), [0.1]);
});
