import assert from "node:assert/strict";
import { test } from "node:test";

import { CHAVE_PREFERENCIAS, gravarPreferencias, lerPreferencias } from "./preferenciasRepertorio.ts";

test("preferências do Repertório no aparelho", () => {
  const mapa = new Map<string, string>();
  const storage = { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => void mapa.set(k, v) };
  assert.deepEqual(lerPreferencias(storage), { todasNotas: false });
  gravarPreferencias(storage, { todasNotas: true });
  assert.deepEqual(lerPreferencias(storage), { todasNotas: true });
  mapa.set(CHAVE_PREFERENCIAS, "{quebrado");
  assert.deepEqual(lerPreferencias(storage), { todasNotas: false });
  mapa.set(CHAVE_PREFERENCIAS, JSON.stringify({ todasNotas: "sim" }));
  assert.deepEqual(lerPreferencias(storage), { todasNotas: false });
  assert.deepEqual(lerPreferencias(undefined), { todasNotas: false });
  gravarPreferencias({ setItem: () => { throw new Error("cheio"); } }, { todasNotas: true });
});
