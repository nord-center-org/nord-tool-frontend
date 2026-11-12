import assert from "node:assert/strict";
import { test } from "node:test";

import { lerCifra } from "./cifra.ts";
import { blocoNoTempo, sincronizar } from "./sincronia.ts";

const AUDIO = [
  { inicio: 0, fim: 4, acorde: "N" },
  { inicio: 4, fim: 6, acorde: "A" }, { inicio: 6, fim: 8, acorde: "E" },
  { inicio: 8, fim: 10, acorde: "F#m" }, { inicio: 10, fim: 12, acorde: "D" },
  { inicio: 12, fim: 14, acorde: "A" }, { inicio: 14, fim: 16, acorde: "E" },
  { inicio: 16, fim: 20, acorde: "D" },
];

test("acha a hora de cada linha pelos acordes, mesmo com a cifra em outro tom", () => {
  // escrita em G (com capotraste na 2ª, soa em A)
  const cifra = lerCifra(`[Verso]
G          D
  primeira linha
Em         C
  segunda linha
Sem acorde no meio
G          D
  terceira linha`);
  const r = sincronizar(cifra, AUDIO, 20);
  assert.equal(r.deslocamento, 2);
  assert.ok(r.acerto > 0.8);
  const [l1, l2, l3, l4] = [1, 2, 3, 4].map(i => r.tempos[i] as number);
  assert.equal(l1, 4); assert.equal(l2, 8); assert.equal(l4, 12);
  assert.ok(l3 > l2 && l3 < l4, `linha sem acorde fica entre as vizinhas (${l3})`);
  assert.equal(blocoNoTempo(r.tempos, 9), 2);
  assert.equal(blocoNoTempo(r.tempos, 1), -1);
});

test("cifra só com letra: distribui pela música", () => {
  const cifra = lerCifra("um\ndois\ntrês\nquatro");
  const r = sincronizar(cifra, AUDIO, 20);
  const t = r.tempos as number[];
  assert.equal(t[0], 4, "começa quando entra o primeiro acorde");
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1]);
  assert.ok(t[3] < 20);
});
