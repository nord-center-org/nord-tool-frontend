import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";

import { gerarPdfRelatorio } from "./pdfRelatorioFotografico.ts";
import type { ItemRelatorio } from "./relatorioFotografico.ts";

const JPEG = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkKKKK8U/TD//Z", "base64"));

const itens: ItemRelatorio[] = [
  { id: 1, nrOrdem: 1, nmItem: "Fachada norte", txOrientacao: null, txResposta: "Trinca na platibanda 🚧", fotos: [
    { id: 10, idItem: 1, nrOrdem: 1, txLegenda: "geral" }, { id: 11, idItem: 1, nrOrdem: 2, txLegenda: null },
  ] },
  { id: 2, nrOrdem: 2, nmItem: "Cobertura", txOrientacao: null, txResposta: null, fotos: [{ id: 12, idItem: 2, nrOrdem: 1, txLegenda: "calha" }] },
];
const cabecalho = { titulo: "Vistoria de fachada — Bloco A", local: "Bloco A", data: "21/10/2026", fase: "Nord 1", autor: "José", modelo: null };

test("capa + páginas de fotos conforme o layout", async () => {
  const pedidas: number[] = [];
  const bytes = await gerarPdfRelatorio(cabecalho, itens, "R2", async id => { pedidas.push(id); return JPEG; });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1 + 2, "capa + 3 fotos em páginas de 2");
  assert.deepEqual(pedidas, [10, 11, 12]);
});

test("6 por página cabe tudo numa página e relatório sem foto só tem a capa", async () => {
  const seis = await PDFDocument.load(await gerarPdfRelatorio(cabecalho, itens, "R6", async () => JPEG));
  assert.equal(seis.getPageCount(), 2);
  const vazio = await PDFDocument.load(await gerarPdfRelatorio(cabecalho, [{ ...itens[1], fotos: [] }], "R4", async () => JPEG));
  assert.equal(vazio.getPageCount(), 1);
});

test("muitos itens quebram a capa em mais páginas", async () => {
  const muitos: ItemRelatorio[] = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, nrOrdem: i + 1, nmItem: `Item ${i + 1}`, txOrientacao: null, txResposta: "Observação longa ".repeat(8), fotos: [] }));
  const doc = await PDFDocument.load(await gerarPdfRelatorio(cabecalho, muitos, "R4", async () => JPEG));
  assert.ok(doc.getPageCount() >= 3);
});

test("layout paisagem com texto ao lado, fundo, ícone e fontes", async () => {
  for (const fonte of ["HELVETICA", "TIMES", "COURIER"] as const) {
    const bytes = await gerarPdfRelatorio(cabecalho, itens, "P1L", async () => JPEG,
      { fonte, cabecalho: true, fundo: JPEG, opacidadeFundo: 15, icone: JPEG, feitoPor: "Ana Souza" });
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1 + 3, "capa + 1 foto por página");
    const [w, h] = [doc.getPage(1).getWidth(), doc.getPage(1).getHeight()];
    assert.ok(w > h, "páginas de fotos em paisagem");
    assert.ok(doc.getPage(0).getHeight() > doc.getPage(0).getWidth(), "capa em retrato");
  }
});

test("sem cabeçalho também gera e layout com 3 por página agrupa", async () => {
  const doc = await PDFDocument.load(await gerarPdfRelatorio(cabecalho, itens, "R3L", async () => JPEG, { cabecalho: false }));
  assert.equal(doc.getPageCount(), 2);
});
