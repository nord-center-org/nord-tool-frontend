import assert from "node:assert/strict";
import { test } from "node:test";

import { descreverAcao, idDesconhecido, linhasParaAbas, paginaComTexto, separarAcoes, textoParaHtml, validarAcao, type ItemConhecido } from "./chatCadernos.ts";

const itens: ItemConhecido[] = [{ tipo: "caderno", id: 12, titulo: "Obra Jardim" }, { tipo: "planilha", id: 3, titulo: "Orçamento" }];

test("separa o texto das ações e valida cada uma", () => {
  const r = separarAcoes('Achei na página 3.\n\n```nordtool-acoes\n[{"acao":"abrir","tipo":"Caderno","id":12,"pagina":3},{"acao":"excluir","id":1},{"acao":"abrir","tipo":"x","id":2}]\n```\n\nQuer mais?');
  assert.equal(r.texto, "Achei na página 3.\n\nQuer mais?");
  assert.deepEqual(r.acoes, [{ acao: "abrir", tipo: "caderno", id: 12, pagina: 3 }]);
  assert.equal(r.pendente, false);
});

test("bloco ainda chegando some do texto e fica pendente", () => {
  const r = separarAcoes('Vou criar.\n```nordtool-acoes\n[{"acao":"criar_');
  assert.equal(r.texto, "Vou criar.");
  assert.deepEqual(r.acoes, []);
  assert.equal(r.pendente, true);
});

test("JSON estragado só some; objeto solto e vários blocos funcionam", () => {
  assert.deepEqual(separarAcoes("a ```nordtool-acoes {oops} ``` b").acoes, []);
  const r = separarAcoes('```nordtool-acoes\n{"acao":"criar_caderno","titulo":"Novo"}\n```\n```nordtool-acoes\n[{"acao":"anotar","idCaderno":"12","texto":"oi"}]\n```');
  assert.deepEqual(r.acoes, [{ acao: "criar_caderno", titulo: "Novo" }, { acao: "anotar", id: 12, texto: "oi" }]);
  assert.equal(separarAcoes("sem ações").texto, "sem ações");
});

test("validarAcao recusa o que falta e corta o excesso", () => {
  assert.equal(validarAcao(null), null);
  assert.equal(validarAcao({ acao: "abrir", tipo: "caderno" }), null);
  assert.deepEqual(validarAcao({ acao: "abrir", tipo: "planilha", id: 3, pagina: 2 }), { acao: "abrir", tipo: "planilha", id: 3 });
  assert.deepEqual(validarAcao({ acao: "criar_caderno" }), { acao: "criar_caderno", titulo: "Caderno sem título" });
  assert.equal(validarAcao({ acao: "anotar", id: 1, texto: "  " }), null);
  assert.equal(validarAcao({ acao: "anotar", id: -1, texto: "x" }), null);
  assert.equal((validarAcao({ acao: "anotar", id: 1, texto: "x".repeat(9000) }) as { texto: string }).texto.length, 5000);
  assert.equal(validarAcao({ acao: "criar_documento", titulo: "A" }), null);
  assert.deepEqual(validarAcao({ acao: "criar_documento", html: "<p>x</p>" }), { acao: "criar_documento", titulo: "Documento sem título", html: "<p>x</p>" });
  assert.equal(validarAcao({ acao: "criar_planilha", linhas: "a" }), null);
  assert.equal(validarAcao({ acao: "criar_planilha", linhas: [] }), null);
  assert.deepEqual(validarAcao({ acao: "criar_planilha", titulo: "T", linhas: [["a", 1, true, null, { x: 1 }], "solta"] }),
    { acao: "criar_planilha", titulo: "T", linhas: [["a", 1, true, null, "[object Object]"]] });
  assert.deepEqual(validarAcao({ acao: "renomear", tipo: "documento", id: 4, titulo: " Ata " }), { acao: "renomear", tipo: "documento", id: 4, titulo: "Ata" });
  assert.equal(validarAcao({ acao: "renomear", tipo: "documento", id: 4 }), null);
});

test("no máximo 10 ações por resposta", () => {
  const lista = Array.from({ length: 15 }, (_, i) => ({ acao: "abrir", tipo: "caderno", id: i + 1 }));
  assert.equal(separarAcoes("```nordtool-acoes\n" + JSON.stringify(lista) + "\n```").acoes.length, 10);
});

test("descreve as ações com o nome do item", () => {
  assert.equal(descreverAcao({ acao: "abrir", tipo: "caderno", id: 12, pagina: 3 }, itens), "Abrir o caderno “Obra Jardim”, página 3");
  assert.equal(descreverAcao({ acao: "abrir", tipo: "documento", id: 9 }, itens), "Abrir o documento nº 9");
  assert.equal(descreverAcao({ acao: "anotar", id: 12, texto: "x" }, itens), "Anotar numa página nova do caderno “Obra Jardim”");
  assert.equal(descreverAcao({ acao: "criar_caderno", titulo: "A", texto: "b" }, itens), "Criar o caderno “A” com o texto");
  assert.equal(descreverAcao({ acao: "criar_caderno", titulo: "A" }, itens), "Criar o caderno “A”");
  assert.equal(descreverAcao({ acao: "criar_documento", titulo: "Ata", html: "x" }, itens), "Criar o documento “Ata”");
  assert.equal(descreverAcao({ acao: "criar_planilha", titulo: "T", linhas: [["a"]] }, itens), "Criar a planilha “T” (1 linha)");
  assert.equal(descreverAcao({ acao: "criar_planilha", titulo: "T", linhas: [["a"], ["b"]] }, itens), "Criar a planilha “T” (2 linhas)");
  assert.equal(descreverAcao({ acao: "renomear", tipo: "planilha", id: 3, titulo: "Novo" }, itens), "Renomear a planilha “Orçamento” para “Novo”");
});

test("aponta ids que não existem", () => {
  assert.equal(idDesconhecido({ acao: "abrir", tipo: "caderno", id: 12 }, itens), false);
  assert.equal(idDesconhecido({ acao: "abrir", tipo: "planilha", id: 12 }, itens), true);
  assert.equal(idDesconhecido({ acao: "anotar", id: 3, texto: "x" }, itens), true);
  assert.equal(idDesconhecido({ acao: "criar_caderno", titulo: "x" }, itens), false);
});

test("linhas viram abas: números, fórmulas em português, cabeçalho em negrito", () => {
  const [aba] = linhasParaAbas([["Item", "Qtd"], ["Cimento", "30,5"], ["Areia", 2], ["Total", "=SOMA(B2:B3)"], [true, null, ""]]);
  const cel = (r: number, c: number) => aba.celldata?.find(x => x.r === r && x.c === c)?.v;
  assert.equal(cel(0, 0)?.v, "Item");
  assert.equal(cel(0, 0)?.bl, 1);
  assert.equal(cel(1, 1)?.v, 30.5);
  assert.equal(cel(1, 1)?.m, "30,5");
  assert.equal(cel(2, 1)?.v, 2);
  assert.equal(cel(3, 1)?.f, "=SOMA(B2:B3)");
  assert.equal(cel(4, 0)?.m, "VERDADEIRO");
  assert.equal(cel(4, 1), undefined);
  assert.equal(aba.row, 100);
  assert.equal(aba.column, 26);
});

test("página com texto e texto em HTML", () => {
  const p = paginaComTexto("Oi", 595, "id1");
  assert.deepEqual(p.itens[0], { t: "tx", id: "id1", x: 48, y: 48, w: 499, s: 16, c: "#0f172a", txt: "Oi" });
  assert.equal(paginaComTexto("x", 100).itens[0].w, 120);
  assert.equal(textoParaHtml("a <b>\nc\n\nd"), "<p>a &lt;b&gt;<br>c</p><p>d</p>");
});
