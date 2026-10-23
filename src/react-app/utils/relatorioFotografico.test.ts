import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LAYOUTS, celulas, combinaBusca, fotosDoLayout, layoutPorCodigo, legendaImpressa, nomeArquivoPdf, paginarFotos, progresso, type ItemRelatorio,
} from "./relatorioFotografico.ts";

const foto = (id: number, idItem: number, nrOrdem: number, txLegenda: string | null = null) => ({ id, idItem, nrOrdem, txLegenda });
const itens: ItemRelatorio[] = [
  { id: 2, nrOrdem: 2, nmItem: "Fachada sul", txOrientacao: null, txResposta: null, fotos: [foto(12, 2, 1)] },
  { id: 1, nrOrdem: 1, nmItem: "Fachada norte", txOrientacao: null, txResposta: null, fotos: [foto(11, 1, 2, "detalhe"), foto(10, 1, 1, "geral")] },
  { id: 3, nrOrdem: 3, nmItem: "Cobertura", txOrientacao: null, txResposta: "Sem patologias", fotos: [] },
];

test("catálogo de layouts: códigos únicos, células dentro da página e sem sobreposição", () => {
  assert.equal(new Set(LAYOUTS.map(l => l.codigo)).size, LAYOUTS.length);
  for (const l of LAYOUTS) {
    for (const c of l.celulas) assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1 + 1e-9 && c.y + c.h <= 1 + 1e-9, l.codigo);
    const area = l.celulas.reduce((s, c) => s + c.w * c.h, 0);
    assert.ok(Math.abs(area - 1) < 1e-9, `${l.codigo} cobre a página`);
  }
  assert.equal(fotosDoLayout("R3L"), 3);
  assert.equal(fotosDoLayout("P6"), 6);
  assert.equal(layoutPorCodigo("xyz").codigo, "R2");
  assert.equal(layoutPorCodigo("P2").orientacao, "paisagem");
});

test("células absolutas cobrem a área sem sair dela, de cima para baixo", () => {
  const area = { x: 40, y: 40, w: 500, h: 700 };
  const cs = celulas(layoutPorCodigo("R4"), area, 10);
  assert.equal(cs.length, 4);
  assert.equal(cs[0].w, 245);
  assert.ok(cs[0].y > cs[2].y, "primeira linha fica em cima");
  assert.ok(cs[1].x > cs[0].x, "segunda coluna à direita");
  for (const l of LAYOUTS) for (const c of celulas(l, area, 10)) {
    assert.ok(c.x >= area.x - 1e-9 && c.x + c.w <= area.x + area.w + 1e-9);
    assert.ok(c.y >= area.y - 1e-9 && c.y + c.h <= area.y + area.h + 1e-9);
  }
  assert.equal(celulas(layoutPorCodigo("R3L"), area)[0].texto, "direita");
});

test("fotos seguem a ordem dos itens e das fotos e cada item começa numa página nova", () => {
  const paginas = paginarFotos(itens, 2);
  assert.equal(paginas.length, 2);
  assert.deepEqual(paginas[0].map(p => p.foto.id), [10, 11]);
  assert.deepEqual(paginas[1].map(p => [p.foto.id, p.numero]), [[12, 3]]);
  const seis = paginarFotos(itens, 6);
  assert.equal(seis.length, 2, "mesmo cabendo tudo numa página, o item 2 vai para outra");
  assert.deepEqual(seis.map(pg => pg.map(p => p.item.id)), [[1, 1], [2]]);
  const tres = paginarFotos([{ ...itens[1], fotos: [1, 2, 3, 4].map(i => ({ id: i, idItem: 1, nrOrdem: i, txLegenda: null })) }], 3);
  assert.deepEqual(tres.map(pg => pg.length), [3, 1], "item com mais fotos que a página continua na seguinte");
  assert.deepEqual(paginarFotos([], 4), []);
});

test("legenda impressa numera e junta item e legenda", () => {
  const [p, q] = paginarFotos(itens, 6);
  assert.equal(legendaImpressa(p[0]), "1. Fachada norte — geral");
  assert.equal(legendaImpressa(q[0]), "3. Fachada sul", "a numeração continua na página do item seguinte");
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
