import assert from "node:assert/strict";
import { test } from "node:test";

import { itensDoBloco } from "./centralBloco.ts";

const cadernos = [{ id: 1, nmTitulo: "Obra Norte", cdCor: "#2563eb", dhAlteracao: "2026-11-10T10:00:00", qtPaginas: 1 }];
const arquivos = [
  { id: 2, cdTipo: "PLANILHA" as const, nmTitulo: "Orçamento", cdCor: "#16a34a", dhAlteracao: "2026-11-10T12:00:00" },
  { id: 3, cdTipo: "DOCUMENTO" as const, nmTitulo: "Ata da reunião", cdCor: "#2563eb", dhAlteracao: "2026-11-09T08:00:00" },
];

test("tudo junto, mais recente primeiro, com o detalhe do caderno", () => {
  const r = itensDoBloco(cadernos, arquivos, "TODOS", "");
  assert.deepEqual(r.map(i => `${i.tipo}:${i.id}`), ["PLANILHA:2", "CADERNO:1", "DOCUMENTO:3"]);
  assert.equal(r[1].detalhe, "1 página");
});

test("filtro por tipo e busca sem acento", () => {
  assert.deepEqual(itensDoBloco(cadernos, arquivos, "PLANILHA", "").map(i => i.id), [2]);
  assert.deepEqual(itensDoBloco(cadernos, arquivos, "TODOS", "orcamento").map(i => i.id), [2]);
  assert.deepEqual(itensDoBloco(cadernos, arquivos, "DOCUMENTO", "obra").length, 0);
});
