import assert from "node:assert/strict";
import { test } from "node:test";

import { celulas, combinaBusca, grade, legendaImpressa, nomeArquivoPdf, paginarFotos, progresso, type ItemRelatorio } from "./relatorioFotografico.ts";

const foto = (id: number, idItem: number, nrOrdem: number, txLegenda: string | null = null) => ({ id, idItem, nrOrdem, txLegenda });
const itens: ItemRelatorio[] = [
  { id: 2, nrOrdem: 2, nmItem: "Fachada sul", txOrientacao: null, txResposta: null, fotos: [foto(12, 2, 1)] },
  { id: 1, nrOrdem: 1, nmItem: "Fachada norte", txOrientacao: null, txResposta: null, fotos: [foto(11, 1, 2, "detalhe"), foto(10, 1, 1, "geral")] },
  { id: 3, nrOrdem: 3, nmItem: "Cobertura", txOrientacao: null, txResposta: "Sem patologias", fotos: [] },
];

test("grade por layout", () => {
  assert.deepEqual(grade(1), { colunas: 1, linhas: 1 });
  assert.deepEqual(grade(2), { colunas: 1, linhas: 2 });
  assert.deepEqual(grade(4), { colunas: 2, linhas: 2 });
  assert.deepEqual(grade(6), { colunas: 2, linhas: 3 });
});

test("células cobrem a área sem sair dela, da esquerda para a direita e de cima para baixo", () => {
  const area = { x: 40, y: 40, w: 500, h: 700 };
  const cs = celulas(4, area, 10);
  assert.equal(cs.length, 4);
  assert.equal(cs[0].w, 245);
  assert.ok(cs[0].y > cs[2].y, "primeira linha fica em cima");
  assert.ok(cs[1].x > cs[0].x, "segunda coluna à direita");
  for (const c of cs) {
    assert.ok(c.x >= area.x && c.x + c.w <= area.x + area.w + 1e-9);
    assert.ok(c.y >= area.y - 1e-9 && c.y + c.h <= area.y + area.h + 1e-9);
  }
});

test("fotos seguem a ordem dos itens e das fotos e quebram em páginas", () => {
  const paginas = paginarFotos(itens, 2);
  assert.equal(paginas.length, 2);
  assert.deepEqual(paginas[0].map(p => p.foto.id), [10, 11]);
  assert.deepEqual(paginas[1].map(p => [p.foto.id, p.numero]), [[12, 3]]);
  assert.deepEqual(paginarFotos([], 4), []);
});

test("legenda impressa numera e junta item e legenda", () => {
  const [p] = paginarFotos(itens, 6);
  assert.equal(legendaImpressa(p[0]), "1. Fachada norte — geral");
  assert.equal(legendaImpressa(p[2]), "3. Fachada sul");
});

test("progresso conta itens com foto ou observação", () => {
  assert.deepEqual(progresso(itens), { respondidos: 3, total: 3 });
  assert.deepEqual(progresso([{ ...itens[2], txResposta: "  " }]), { respondidos: 0, total: 1 });
});

test("nome do PDF sem acentos nem símbolos", () => {
  assert.equal(nomeArquivoPdf("Fachada — Bloco Á/2", "2026-10-21"), "Relatorio-Fachada-Bloco-A-2-2026-10-21.pdf");
  assert.equal(nomeArquivoPdf("???", "2026-10-21"), "Relatorio-fotografico-2026-10-21.pdf");
});

test("busca por título, local, fase ou autor, sem acento", () => {
  const r = { nmTitulo: "Vistoria fachada", nmLocal: "Bloco A", nmModelo: null, nmFase: "Nord 1", nmAutor: "José" };
  assert.ok(combinaBusca(r, "fachada jose"));
  assert.ok(combinaBusca(r, "nord bloco"));
  assert.ok(!combinaBusca(r, "cobertura"));
  assert.ok(combinaBusca(r, "  "));
});
