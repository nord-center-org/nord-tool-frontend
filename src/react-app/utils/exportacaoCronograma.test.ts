import assert from "node:assert/strict";
import { test } from "node:test";

import { agruparEmOrdem, dataHoraBr, nomeArquivoImagem, resumoFiltros } from "./exportacaoCronograma.ts";

test("nome do arquivo pelo modo e pela data", () => {
  const d = new Date(2026, 10, 3, 9, 5);
  assert.equal(nomeArquivoImagem("lista", d), "cronograma-lista-2026-11-03.png");
  assert.equal(nomeArquivoImagem("semana", d), "cronograma-semana-2026-11-03.png");
  assert.equal(nomeArquivoImagem("mes", d), "cronograma-mes-2026-11.png");
  assert.equal(dataHoraBr(d), "03/11/2026 às 09:05");
});

test("resumo mostra só os filtros ativos e encurta listas longas", () => {
  assert.deepEqual(resumoFiltros({ busca: "  " , categoria: "Todas" }), []);
  assert.deepEqual(resumoFiltros({
    busca: " laudo ", categoria: "Engenharia", categorias: ["Pessoal", "Atlética"], pessoas: "Só as minhas",
    colunas: [{ rotulo: "Fila", valores: ["A", "B", "C", "D", "E"] }, { rotulo: "Frente", valores: [] }],
  }), ["Busca: “laudo”", "Categoria: Engenharia", "Categorias: Pessoal, Atlética", "Pessoas: Só as minhas", "Fila: A, B, C +2"]);
});

test("agrupa mantendo a ordem de aparição", () => {
  const g = agruparEmOrdem([{ s: "b", n: 1 }, { s: "a", n: 2 }, { s: "b", n: 3 }], x => x.s);
  assert.deepEqual(g.map(x => [x.chave, x.itens.map(i => i.n)]), [["b", [1, 3]], ["a", [2]]]);
});
