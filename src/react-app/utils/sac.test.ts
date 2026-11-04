import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_PRINTS, MAX_TITULO, classeStatus, ordenarChamados, pendentes, problemaDoRascunho, rotuloStatus } from "./sac.ts";

test("rascunho do chamado precisa de título e descrição e cabe nos limites", () => {
  assert.equal(problemaDoRascunho({ titulo: " ", descricao: "x" }, 0), "Dê um título para o chamado.");
  assert.equal(problemaDoRascunho({ titulo: "t", descricao: "  " }, 0), "Descreva o que precisa mudar.");
  assert.match(problemaDoRascunho({ titulo: "x".repeat(MAX_TITULO + 1), descricao: "d" }, 0) ?? "", /no máximo/);
  assert.match(problemaDoRascunho({ titulo: "t", descricao: "d" }, MAX_PRINTS + 1) ?? "", /imagens/);
  assert.equal(problemaDoRascunho({ titulo: "Botão novo", descricao: "Quero um botão" }, 2), null);
});

test("chamados em aberto primeiro, depois os fechados, os mais novos antes", () => {
  const lista = [
    { id: 1, cdStatus: "RESOLVIDO", dhCriacao: "2026-11-04T10:00:00" },
    { id: 2, cdStatus: "ABERTO", dhCriacao: "2026-11-01T10:00:00" },
    { id: 3, cdStatus: "EM_ANDAMENTO", dhCriacao: "2026-11-03T10:00:00" },
    { id: 4, cdStatus: "ABERTO", dhCriacao: "2026-11-02T10:00:00" },
  ];
  assert.deepEqual(ordenarChamados(lista).map(c => c.id), [4, 2, 3, 1]);
  assert.equal(pendentes(lista), 3);
});

test("rótulo e cor de cada status", () => {
  assert.equal(rotuloStatus("EM_ANDAMENTO"), "Em andamento");
  assert.match(classeStatus("RESOLVIDO"), /emerald/);
  assert.equal(rotuloStatus("OUTRO"), "OUTRO");
});
