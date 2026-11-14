import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_PRINTS, MAX_TITULO, classeStatus, encaixar, nomePdfChamados, paraFontePdf, quebrarTexto, ordenarChamados, pendentes, posicaoBotaoSac, primeiroNome, problemaDoRascunho, saudacaoSac, rotuloStatus,
} from "./sac.ts";

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


test("botão do SAC: saudação pela hora e com o primeiro nome", () => {
  assert.equal(saudacaoSac("Ana Maria Souza", 9), "Bom dia, Ana!");
  assert.equal(saudacaoSac("Ana", 14), "Boa tarde, Ana!");
  assert.equal(saudacaoSac("Ana", 20), "Boa noite, Ana!");
  assert.equal(saudacaoSac("Ana", 3), "Boa noite, Ana!");
  assert.equal(saudacaoSac(null, 12), "Boa tarde!");
  assert.equal(saudacaoSac("   ", 5), "Bom dia!");
  assert.equal(primeiroNome("  Bruno   Lima "), "Bruno");
});

test("botão do SAC: some no próprio SAC e sobe no Início para não cobrir o mascote", () => {
  assert.equal(posicaoBotaoSac("/sac"), "escondido");
  assert.equal(posicaoBotaoSac("/sac/12"), "escondido");
  assert.equal(posicaoBotaoSac("/"), "acima-do-mascote");
  assert.equal(posicaoBotaoSac("/mapeamentos/bloco-notas"), "canto");
  assert.equal(posicaoBotaoSac("/sacolas"), "canto");
});

test("v4: texto escrevível pela fonte do PDF", () => {
  assert.equal(paraFontePdf("Ação “ok” — 50% 😀\tfim"), "Ação “ok” — 50% ?  fim");
  assert.equal(paraFontePdf("linha1\r\nlinha2"), "linha1\nlinha2");
});

test("v4: quebra o texto em linhas que cabem", () => {
  const medir = (t: string) => t.length;
  assert.deepEqual(quebrarTexto("um dois tres quatro", 9, medir), ["um dois", "tres", "quatro"]);
  assert.deepEqual(quebrarTexto("a\n\nb", 9, medir), ["a", "", "b"]);
  assert.deepEqual(quebrarTexto("abcdefghijkl", 5, medir), ["abcde", "fghij", "kl"], "palavra grande é partida");
  assert.deepEqual(quebrarTexto("", 5, medir), [""]);
});

test("v4: encaixa o print sem distorcer nem aumentar", () => {
  assert.deepEqual(encaixar(1000, 500, 400, 400), { l: 400, a: 200 });
  assert.deepEqual(encaixar(300, 900, 400, 300), { l: 100, a: 300 });
  assert.deepEqual(encaixar(100, 50, 400, 400), { l: 100, a: 50 });
  assert.deepEqual(encaixar(0, 50, 400, 400), { l: 0, a: 0 });
  assert.equal(nomePdfChamados("2026-11-13"), "chamados-sac-2026-11-13.pdf");
});
