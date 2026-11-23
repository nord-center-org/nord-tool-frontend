import { test } from "node:test";
import assert from "node:assert/strict";
import { BPM, JANELAS, TRILHAS, VALOR, gerarPartitura, novaPartidaRitmo, passoRitmo, pontosRitmo, type EstadoRitmo } from "./ritmo.ts";
import type { Entrada } from "./bombas.ts";

const P: Entrada = { direcao: null, a: false, b: false };
const ate = (e: EstadoRitmo, passo: number, ent: (e: EstadoRitmo) => Entrada[] = () => [P]) => { while (e.passo < passo - 1 && !e.terminado) passoRitmo(e, ent(e)); };
const tocar = (e: EstadoRitmo, l: number, extra: Partial<Entrada> = {}) => passoRitmo(e, [{ direcao: TRILHAS[l], a: false, b: false, ...extra }]);

test("partitura: mesma semente, mesma música; mais notas no andamento rápido; trilha repetida com folga", () => {
  const a = gerarPartitura(7, BPM.medio), b = gerarPartitura(7, BPM.medio);
  assert.deepEqual(a, b);
  assert.ok(gerarPartitura(7, BPM.rapido).length > gerarPartitura(7, BPM.lento).length);
  assert.ok(a.some(n => n.d > 0), "tem nota longa");
  for (let i = 1; i < a.length; i++) {
    assert.ok(a[i].t > a[i - 1].t);
    if (a[i].l === a[i - 1].l) assert.ok(a[i].t - (a[i - 1].t + a[i - 1].d) >= 3600 / BPM.medio / 2 - 1);
  }
});

test("janelas de acerto: perfeito, ótimo, bom e erro quebra o combo", () => {
  const e = novaPartidaRitmo({ modo: "solo", andamento: "medio", semente: 3, jogadores: [{ bot: null }] });
  const m = e.musicos[0];
  const toques = [0, JANELAS[0] + 1, JANELAS[1] + 1];
  e.notas.slice(0, 3).forEach((n, k) => {
    if (n.d) return;
    ate(e, n.t - toques[k]);
    tocar(e, n.l);
    passoRitmo(e, [P]);
  });
  const graus = m.res.slice(0, 3).filter((_, i) => !e.notas[i].d);
  assert.ok(graus.every(r => r >= 1 && r <= 3), `${graus}`);
  assert.equal(m.res[0], 1);
  assert.ok(m.combo >= 2);
  const antes = m.pontos;
  assert.ok(antes >= VALOR[0]);
  // Toque sem nota: erro.
  passoRitmo(e, [{ direcao: TRILHAS[(e.notas[3].l + 1) % 4], a: false, b: false }]);
  assert.equal(m.combo, 0);
});

test("nota que passa sem toque conta erro e o público cai; zerado, é vaiado", () => {
  const e = novaPartidaRitmo({ modo: "duelo", andamento: "rapido", semente: 4, jogadores: [{ bot: null }, { bot: "dificil" }] });
  const m = e.musicos[0];
  ate(e, e.notas[0].t + JANELAS[2] + 2);
  assert.equal(m.res[0], 4);
  assert.ok(m.vida < 0.6);
  for (let i = 0; i < 3000 && !m.fora; i++) passoRitmo(e, [P, P]);
  assert.ok(m.fora, "vaiado");
  assert.ok(!e.musicos[1].fora);
});

test("nota longa: segurar soma pontos; Show dobra; ataque no Duelo vai para o líder", () => {
  const e = novaPartidaRitmo({ modo: "duelo", andamento: "medio", semente: 9, jogadores: [{ bot: null }, { bot: "dificil" }] });
  const m = e.musicos[0], outro = e.musicos[1];
  const i = e.notas.findIndex(n => n.d > 0);
  const n = e.notas[i];
  for (const k of e.notas.keys()) if (k < i) m.res[k] = 1;
  m.proxima = i;
  ate(e, n.t, () => [P, P]);
  passoRitmo(e, [{ direcao: TRILHAS[n.l], a: false, b: false }, P]);
  assert.equal(m.segurando, i);
  const p0 = m.pontos;
  for (let k = 0; k < n.d - 2; k++) passoRitmo(e, [{ direcao: TRILHAS[n.l], a: false, b: false }, P]);
  assert.ok(m.pontos - p0 >= (n.d - 3) * 2);
  // Show.
  m.energia = 0.5;
  passoRitmo(e, [{ direcao: null, a: false, b: true }, P]);
  assert.ok(m.show);
  // Ataque.
  m.ataque = 1; outro.pontos = 99999; outro.efeito = null;
  passoRitmo(e, [{ direcao: null, a: true, b: false }, P]);
  assert.ok(outro.efeito !== null);
  assert.equal(m.ataque, 0);
});

test("espelho troca as trilhas", () => {
  const e = novaPartidaRitmo({ modo: "duelo", andamento: "lento", semente: 11, jogadores: [{ bot: null }, { bot: "dificil" }] });
  const m = e.musicos[0];
  m.efeito = "espelho"; m.efeitoAte = 1e9;
  const n = e.notas.find(x => !x.d)!;
  ate(e, n.t, () => [P, P]);
  passoRitmo(e, [{ direcao: TRILHAS[3 - n.l], a: false, b: false }, P]);
  assert.equal(m.res[e.notas.indexOf(n)], 1);
});

test("bots tocam a música inteira nos três modos, de 1 a 8", () => {
  for (const [modo, n] of [["solo", 1], ["duelo", 2], ["duelo", 8], ["banda", 4], ["banda", 8]] as const) {
    const e = novaPartidaRitmo({ modo, andamento: "medio", semente: 50 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    while (!e.terminado) passoRitmo(e, []);
    assert.equal(e.passo, e.fimMusica, `${modo} ${n}`);
    assert.notEqual(e.vencedor, null, `${modo} ${n}`);
    assert.equal(pontosRitmo(e).length, n);
    assert.ok(e.musicos.every(m => m.acertos > e.notas.length * 0.85));
  }
});
