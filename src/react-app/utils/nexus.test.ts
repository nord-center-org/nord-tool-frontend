import assert from "node:assert/strict";
import { test } from "node:test";

import { ESPIADA_MAX_MS, ESPIADA_MIN_MS, FALAS_ESPIADA, falaDaEspiada, intervaloEspiada, ladoDaEspiada, nomeDoPortaVoz, oQueSegura } from "./nexus.ts";

test("a próxima espiada fica entre o mínimo e o máximo, mesmo com sorteio fora do intervalo", () => {
  assert.equal(intervaloEspiada(() => 0), ESPIADA_MIN_MS);
  assert.equal(intervaloEspiada(() => 1), ESPIADA_MAX_MS);
  assert.equal(intervaloEspiada(() => 2), ESPIADA_MAX_MS);
  assert.equal(intervaloEspiada(() => -1), ESPIADA_MIN_MS);
  const meio = intervaloEspiada(() => 0.5);
  assert.ok(meio > ESPIADA_MIN_MS && meio < ESPIADA_MAX_MS);
});

test("espia mais da lateral que de baixo, e sempre fala uma das falas", () => {
  assert.equal(ladoDaEspiada(() => 0.1), "lado");
  assert.equal(ladoDaEspiada(() => 0.9), "baixo");
  assert.equal(falaDaEspiada(() => 0), FALAS_ESPIADA[0]);
  assert.equal(falaDaEspiada(() => 0.9999), FALAS_ESPIADA.at(-1));
  assert.equal(falaDaEspiada(() => 1), FALAS_ESPIADA.at(-1));
});

test("o porta-voz alterna cafezinho e rádio de hora em hora", () => {
  assert.equal(oQueSegura(8), "cafe");
  assert.equal(oQueSegura(9), "radio");
  assert.equal(oQueSegura(0), "cafe");
  assert.equal(oQueSegura(23), "radio");
  assert.equal(oQueSegura(-1), "radio");
});

test("nome do porta-voz: só o primeiro, curto, e um padrão", () => {
  assert.equal(nomeDoPortaVoz("  Ana Maria "), "Ana");
  assert.equal(nomeDoPortaVoz(""), "Novidades");
  assert.equal(nomeDoPortaVoz(null), "Novidades");
  assert.equal(nomeDoPortaVoz("A".repeat(30)).length, 20);
});
