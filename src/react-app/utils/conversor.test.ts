import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";

import {
  contarPaginas, extrairPaginas, imagensParaPdf, juntarPdfs, lerIntervalos, marcaDagua, nomeResultado, numerarPaginas, organizarPdf, tamanhoLegivel,
} from "./conversor.ts";

async function pdf(paginas: number, largura = 200): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) d.addPage([largura + i, 300]);
  return d.save();
}
const larguras = async (b: Uint8Array) => (await PDFDocument.load(b)).getPages().map(p => p.getWidth());

// PNG 1x1 vermelho.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64"));

test("intervalos de páginas", () => {
  assert.deepEqual(lerIntervalos("1-3, 5, 8-", 10), { paginas: [1, 2, 3, 5, 8, 9, 10] });
  assert.deepEqual(lerIntervalos("", 3), { paginas: [1, 2, 3] });
  assert.deepEqual(lerIntervalos("todas", 2), { paginas: [1, 2] });
  assert.deepEqual(lerIntervalos("3-1 2", 3), { paginas: [3, 2, 1] });
  assert.ok("erro" in lerIntervalos("1-20", 10));
  assert.ok("erro" in lerIntervalos("abc", 10));
  assert.ok("erro" in lerIntervalos("0", 10));
});

test("juntar, extrair e organizar", async () => {
  const a = await pdf(2, 100), b = await pdf(3, 300);
  const junto = await juntarPdfs([a, b]);
  assert.deepEqual(await larguras(junto), [100, 101, 300, 301, 302]);
  assert.equal(await contarPaginas(junto), 5);
  assert.deepEqual(await larguras(await extrairPaginas(junto, [5, 1])), [302, 100]);
  const org = await PDFDocument.load(await organizarPdf(junto, [{ pagina: 3, giro: 90 }, { pagina: 1, giro: -90 }]));
  assert.equal(org.getPageCount(), 2);
  assert.deepEqual(org.getPages().map(p => p.getRotation().angle), [90, 270]);
  assert.equal(org.getPage(0).getWidth(), 300);
});

test("numerar e marca d'água não mudam as páginas", async () => {
  const base = await pdf(3);
  const n = await numerarPaginas(base, { posicao: "rodape-centro", inicio: 1, formato: "n-de-t" });
  assert.equal(await contarPaginas(n), 3);
  assert.ok(n.length > base.length);
  const m = await marcaDagua(base, "CÓPIA — controlada");
  assert.equal(await contarPaginas(m), 3);
  assert.ok(m.length > base.length);
});

test("imagens viram páginas A4 ou do tamanho da imagem", async () => {
  const a4 = await PDFDocument.load(await imagensParaPdf([{ bytes: PNG, tipo: "png", largura: 800, altura: 400 }, { bytes: PNG, tipo: "png", largura: 400, altura: 800 }], "a4"));
  assert.deepEqual(a4.getPages().map(p => Math.round(p.getWidth())), [842, 595]);
  const orig = await PDFDocument.load(await imagensParaPdf([{ bytes: PNG, tipo: "png", largura: 400, altura: 200 }], "original"));
  assert.deepEqual([orig.getPage(0).getWidth(), orig.getPage(0).getHeight()], [300, 150]);
});

test("tamanho e nome do resultado", () => {
  assert.equal(tamanhoLegivel(1536), "2 KB");
  assert.equal(tamanhoLegivel(1.5 * 1024 * 1024), "1,5 MB");
  assert.equal(nomeResultado("Relatório de obra.pdf", "comprimido", "pdf"), "Relatorio-de-obra-comprimido.pdf");
  assert.equal(nomeResultado("###", "", "zip"), "arquivo.zip");
});
