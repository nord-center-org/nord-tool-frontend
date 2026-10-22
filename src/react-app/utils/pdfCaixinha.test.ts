import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";

import { validarPdfComprovante } from "./caixinha.ts";
import { fotosParaPdf, pdfUnicoCaixinha } from "./pdfCaixinha.ts";

const JPEG = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkKKKK8U/TD//Z", "base64"));

test("fotos viram PDF válido para o comprovante (uma página por foto)", async () => {
  const bytes = await fotosParaPdf([{ bytes: JPEG, tipo: "image/jpeg" }, { bytes: JPEG, tipo: "image/jpeg" }], "Recibo");
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2);
  assert.equal(validarPdfComprovante({ name: "recibo.pdf", size: bytes.length }, bytes.slice(0, 8), bytes.slice(-1024)), null);
  await assert.rejects(() => fotosParaPdf([], "x"));
});

test("PDF único: capa + páginas dos comprovantes; inválido vira aviso", async () => {
  const comp = await fotosParaPdf([{ bytes: JPEG, tipo: "image/jpeg" }, { bytes: JPEG, tipo: "image/jpeg" }], "c");
  const r = await pdfUnicoCaixinha(
    { titulo: "Caixinha — Nick", periodo: "01/10/2026 a 31/10/2026", total: "R$ 35,50", pago: "R$ 10,00", aPagar: "R$ 25,50" },
    [
      { numero: 1, data: "21/10/2026", responsavel: "João", insumo: "Parafusos 🔩", valor: "R$ 25,50", situacao: "A pagar", comprovantes: [comp] },
      { numero: 2, data: "20/10/2026", responsavel: "Ana", insumo: "Fita", valor: "R$ 10,00", situacao: "Pago", comprovantes: [new Uint8Array([1, 2, 3])] },
      { numero: 3, data: "19/10/2026", responsavel: "Ana", insumo: "Sem PDF", valor: "R$ 0,00", situacao: "Pago", comprovantes: [] },
    ]);
  assert.equal(r.falhas, 1);
  assert.equal((await PDFDocument.load(r.bytes)).getPageCount(), 1 + 2 + 1);
});

test("muitos lançamentos quebram a capa em várias páginas", async () => {
  const lista = Array.from({ length: 120 }, (_, i) => ({ numero: i + 1, data: "01/10/2026", responsavel: "X", insumo: "Item", valor: "R$ 1,00", situacao: "Pago", comprovantes: [] }));
  const r = await pdfUnicoCaixinha({ titulo: "C", periodo: "p", total: "1", pago: "1", aPagar: "0" }, lista);
  assert.ok((await PDFDocument.load(r.bytes)).getPageCount() >= 3);
});
