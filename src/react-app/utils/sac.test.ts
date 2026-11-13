import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_PRINTS, MAX_TITULO, classeStatus, nomeImagemExportada, nomeZipChamados, ordenarChamados, pendentes, posicaoBotaoSac, primeiroNome, problemaDoRascunho, saudacaoSac, rotuloStatus, textoExportacao,
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

test("exportação: um bloco por chamado com descrição, resposta e os prints do ZIP", () => {
  const c = {
    id: 12, nmTitulo: "Filtro por obra", txDescricao: "Falta filtrar por obra.", txTela: "/gestao/financeiro", cdStatus: "EM_ANDAMENTO",
    txResposta: "Vamos fazer.", nmUsuario: "Ana", nmUsuarioResposta: "Nick", dhCriacao: "2026-11-04T15:30:00", imagens: [7, 8],
  };
  const imagens = new Map([[12, [nomeImagemExportada(12, 1, "image/png"), nomeImagemExportada(12, 2, "image/jpeg")]]]);
  const texto = textoExportacao([c], imagens, "2026-11-04T16:00:00");
  assert.match(texto, /^# Chamados do SAC/);
  assert.match(texto, /1 chamado\(s\) · exportado em 04\/11\/2026 16:00/);
  assert.match(texto, /## #12 — Filtro por obra/);
  assert.match(texto, /\*\*Status:\*\* Em andamento/);
  assert.match(texto, /\*\*Aberto por:\*\* Ana em 04\/11\/2026 15:30/);
  assert.match(texto, /Falta filtrar por obra\./);
  assert.match(texto, /### Resposta \(Nick\)\n\nVamos fazer\./);
  assert.match(texto, /!\[Print 1 do chamado #12\]\(imagens\/chamado-12-1\.png\)/);
  assert.match(texto, /imagens\/chamado-12-2\.jpg/);
  assert.equal(nomeZipChamados("2026-11-04"), "chamados-sac-2026-11-04.zip");
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
