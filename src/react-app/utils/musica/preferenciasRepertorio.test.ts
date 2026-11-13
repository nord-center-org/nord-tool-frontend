import assert from "node:assert/strict";
import { test } from "node:test";

import { CHAVE_PREFERENCIAS, gravarPreferencias, lerPreferencias } from "./preferenciasRepertorio.ts";

test("preferências do Repertório no aparelho", () => {
  const mapa = new Map<string, string>();
  const storage = { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => void mapa.set(k, v) };
  assert.deepEqual(lerPreferencias(storage), { todasNotas: false, vista: "queda", sintetizador: false, volumeSintetizador: 0.7 });
  gravarPreferencias(storage, { todasNotas: true, vista: "queda", sintetizador: false, volumeSintetizador: 0.7 });
  assert.deepEqual(lerPreferencias(storage), { todasNotas: true, vista: "queda", sintetizador: false, volumeSintetizador: 0.7 });
  mapa.set(CHAVE_PREFERENCIAS, "{quebrado");
  assert.deepEqual(lerPreferencias(storage), { todasNotas: false, vista: "queda", sintetizador: false, volumeSintetizador: 0.7 });
  mapa.set(CHAVE_PREFERENCIAS, JSON.stringify({ todasNotas: "sim" }));
  assert.deepEqual(lerPreferencias(storage), { todasNotas: false, vista: "queda", sintetizador: false, volumeSintetizador: 0.7 });
  assert.deepEqual(lerPreferencias(undefined), { todasNotas: false, vista: "queda", sintetizador: false, volumeSintetizador: 0.7 });
  gravarPreferencias(storage, { todasNotas: false, vista: "mapa", sintetizador: false, volumeSintetizador: 0.7 });
  assert.deepEqual(lerPreferencias(storage), { todasNotas: false, vista: "mapa", sintetizador: false, volumeSintetizador: 0.7 });
  mapa.set(CHAVE_PREFERENCIAS, JSON.stringify({ vista: "lado" }));
  assert.equal(lerPreferencias(storage).vista, "queda");
  mapa.set(CHAVE_PREFERENCIAS, JSON.stringify({ sintetizador: true, volumeSintetizador: 9 }));
  assert.deepEqual(lerPreferencias(storage), { todasNotas: false, vista: "queda", sintetizador: true, volumeSintetizador: 1.5 });
  mapa.set(CHAVE_PREFERENCIAS, JSON.stringify({ volumeSintetizador: "alto" }));
  assert.equal(lerPreferencias(storage).volumeSintetizador, 0.7);
  gravarPreferencias({ setItem: () => { throw new Error("cheio"); } }, { todasNotas: true, vista: "queda", sintetizador: false, volumeSintetizador: 0.7 });
});
