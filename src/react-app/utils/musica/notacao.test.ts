import assert from "node:assert/strict";
import { test } from "node:test";

import { acordeExibido, acordeNaNotacao, emSolfejo, gravarNotacao, lerNotacao, nomeDaNotaExibida, tomExibido } from "./notacao.ts";

const SUST = { acidente: "sustenido", nomes: "letras" } as const;
const BEM = { acidente: "bemol", nomes: "letras" } as const;
const PT = { acidente: "sustenido", nomes: "solfejo" } as const;

test("v15: sustenido é o padrão, bemol é opção", () => {
  assert.equal(nomeDaNotaExibida(61), "C#");
  assert.equal(nomeDaNotaExibida(70, BEM), "Bb");
  assert.equal(acordeNaNotacao("Bbm7/Ab", SUST), "A#m7/G#");
  assert.equal(acordeNaNotacao("C#7M", BEM), "Db7M");
  assert.equal(acordeExibido("[Refrão]", SUST), "[Refrão]", "texto que não é acorde fica");
});

test("v15: Dó, Ré, Mi no lugar das letras", () => {
  assert.equal(emSolfejo("C#m7/G#"), "Dó#m7/Sol#");
  assert.equal(acordeExibido("Ebm", PT), "Ré#m");
  assert.equal(acordeExibido("Bb", { acidente: "bemol", nomes: "solfejo" }), "Sib");
  assert.equal(nomeDaNotaExibida(64, PT), "Mi");
  assert.equal(acordeExibido("Am7(9)", PT), "Lám7(9)");
});

test("v15: o tom na notação escolhida", () => {
  assert.deepEqual(tomExibido({ tonica: 10, menor: false }), { cifra: "A#", extenso: "Lá# maior" });
  assert.deepEqual(tomExibido({ tonica: 10, menor: false }, BEM), { cifra: "Bb", extenso: "Sib maior" });
  assert.deepEqual(tomExibido({ tonica: 4, menor: true }, PT), { cifra: "Mim", extenso: "Mi menor" });
});

test("v15: preferência guardada no aparelho", () => {
  const m = new Map<string, string>();
  const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  assert.deepEqual(lerNotacao(st), { acidente: "sustenido", nomes: "letras" });
  gravarNotacao(st, { acidente: "bemol", nomes: "solfejo" });
  assert.deepEqual(lerNotacao(st), { acidente: "bemol", nomes: "solfejo" });
  m.set("@NordTool:notacao", "{lixo");
  assert.deepEqual(lerNotacao(st), { acidente: "sustenido", nomes: "letras" });
});
