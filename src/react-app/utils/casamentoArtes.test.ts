import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarArtes, nomeDaCategoria, problemaDaArte, tituloDoArquivo } from "./casamentoArtes.ts";

test("arquivos aceitos nas artes", () => {
  assert.equal(problemaDaArte({ name: "convite.pdf", type: "application/pdf", size: 10 }), null);
  assert.equal(problemaDaArte({ name: "convite.png", type: "", size: 10 }), null);
  assert.equal(problemaDaArte({ name: "foto.JPG", type: "", size: 10 }), null);
  assert.match(problemaDaArte({ name: "a.gif", type: "image/gif", size: 10 })!, /PDF, JPEG ou PNG/);
  assert.match(problemaDaArte({ name: "a.png", type: "image/png", size: 0 })!, /vazio/);
  assert.match(problemaDaArte({ name: "a.pdf", type: "application/pdf", size: 16 * 1024 * 1024 })!, /15 MB/);
});

test("título pelo nome do arquivo e categoria", () => {
  assert.equal(tituloDoArquivo("save-the-date_final.png"), "save the date final");
  assert.equal(tituloDoArquivo(".png"), "Arte");
  assert.equal(nomeDaCategoria("SAVE_THE_DATE"), "Save the date");
  assert.equal(nomeDaCategoria("X"), "Outras");
});

test("filtro por categoria e busca", () => {
  const artes = [{ cdCategoria: "CONVITE", nmTitulo: "Convite Padrinhos" }, { cdCategoria: "OUTRO", nmTitulo: "Menu" }];
  assert.equal(filtrarArtes(artes, "TODAS", "").length, 2);
  assert.equal(filtrarArtes(artes, "CONVITE", "").length, 1);
  assert.equal(filtrarArtes(artes, "TODAS", "padri").length, 1);
  assert.equal(filtrarArtes(artes, "OUTRO", "padri").length, 0);
});
