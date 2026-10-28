import assert from "node:assert/strict";
import { test } from "node:test";

import { CENAS, DIR, ESQ, duracaoAtor, duracaoCena, estadoNoTempo, sortearCena, type Ator } from "./desfile.ts";

const ator: Ator = { tipo: "betoneira", x: 0, dir: 1, velocidade: 10, atraso: 1, passos: [{ ate: 100 }, { parar: 2, fala: "Oi", marca: "m" }, { ate: 50 }] };

test("estado do ator ao longo do tempo: espera, anda, para e volta", () => {
  assert.deepEqual(estadoNoTempo(ator, 0.5), { x: 0, andando: false, acao: null, fala: null, marca: null });
  assert.equal(estadoNoTempo(ator, 6).x, 50);
  assert.equal(estadoNoTempo(ator, 6).andando, true);
  const parado = estadoNoTempo(ator, 11.5);
  assert.equal(parado.x, 100);
  assert.equal(parado.fala, "Oi");
  assert.equal(parado.andando, false);
  assert.equal(estadoNoTempo(ator, 15.5).x, 75);
  assert.equal(estadoNoTempo(ator, 15.5).marca, "m");
  assert.equal(estadoNoTempo(ator, 99).x, 50);
  assert.equal(duracaoAtor(ator), 1 + 10 + 2 + 5);
});

test("toda cena começa e termina fora da tela e dura um tempo razoável", () => {
  const ids = new Set<string>();
  for (const cena of CENAS) {
    assert.ok(!ids.has(cena.id), `id repetido ${cena.id}`);
    ids.add(cena.id);
    const d = duracaoCena(cena);
    assert.ok(d > 8 && d < 50, `${cena.id}: ${d}s`);
    for (const a of cena.atores) {
      if (a.tipo === "monte") continue;
      assert.ok(a.x <= ESQ - 0 || a.x >= DIR, `${cena.id}/${a.tipo} começa na tela`);
      const fim = estadoNoTempo(a, duracaoAtor(a) + 1).x;
      assert.ok(fim <= ESQ || fim >= DIR, `${cena.id}/${a.tipo} termina na tela`);
    }
  }
});

test("sorteio não repete as cenas recentes enquanto houver outra", () => {
  const recentes = CENAS.slice(0, CENAS.length - 1).map(c => c.id);
  assert.equal(sortearCena(recentes, () => 0.99).id, CENAS[CENAS.length - 1].id);
  assert.ok(CENAS.some(c => c.id === sortearCena(CENAS.map(x => x.id), () => 0.3).id));
});
