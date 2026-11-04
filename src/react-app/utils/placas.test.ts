import assert from "node:assert/strict";
import { test } from "node:test";

import { CONFIG_EXEMPLO, VALORES_EXEMPLO, layoutPlaca, lerConfig, lerValores, linhasDoTexto, nomeArquivoPlaca, tamanhoDoTexto } from "./placas.ts";

test("formato salvo incompleto ou estranho volta com o exemplo e limites", () => {
  const c = lerConfig({ orientacao: "retrato", fundo: { cor: "vermelho", escurecer: 5 }, quadro: { fonte: "comic", tamanho: -3 } });
  assert.equal(c.orientacao, "retrato");
  assert.equal(c.fundo.cor, CONFIG_EXEMPLO.fundo.cor);
  assert.equal(c.fundo.escurecer, 0.95);
  assert.equal(c.quadro.fonte, "calibri");
  assert.equal(c.quadro.tamanho, 0);
  assert.equal(c.rodape.titulo, "Política do Sistema de Gestão");
  assert.deepEqual(lerConfig(null), CONFIG_EXEMPLO);
});

test("textos da placa: uma linha por item, sem linhas vazias", () => {
  assert.deepEqual(linhasDoTexto(" Viga barrote \n\n Aprumadores de pilar \n"), ["Viga barrote", "Aprumadores de pilar"]);
  assert.deepEqual(lerValores({ cabecalho: "NEXT", linhas: ["a", 3, "b"] }), { cabecalho: "NEXT", linhas: ["a", "b"], rodape: "" });
});

test("layout da placa de aviso igual ao modelo da obra (A4 deitada)", () => {
  const l = layoutPlaca(CONFIG_EXEMPLO);
  assert.deepEqual(l.folha, { largura: 1123, altura: 794 });
  assert.deepEqual(l.painel, { x: 58, y: 148, w: 1015, h: 606 });
  assert.deepEqual(l.quadro, { x: 140, y: 291, w: 851, h: 265 });
  assert.deepEqual(l.rodape, { x: 90, y: 576, w: 951, h: 140 });
  assert.equal(l.cabecalho?.x, 402);
  // sem rodapé nem topo, o quadro ocupa o painel todo
  const livre = layoutPlaca({ ...CONFIG_EXEMPLO, logo: { ...CONFIG_EXEMPLO.logo, ativo: false }, cabecalho: { ...CONFIG_EXEMPLO.cabecalho, ativo: false }, rodape: { ...CONFIG_EXEMPLO.rodape, ativo: false } });
  assert.equal(livre.painel.y, 40);
  assert.ok(livre.quadro.h > 500);
  // em pé, tudo cabe na folha
  const pe = layoutPlaca({ ...CONFIG_EXEMPLO, orientacao: "retrato" });
  for (const c of [pe.painel, pe.quadro, pe.rodape!]) assert.ok(c.y + c.h <= 1123 && c.x + c.w <= 794);
});

test("letra automática: a maior que cabe; fixa quando o modelo diz", () => {
  const l = layoutPlaca(CONFIG_EXEMPLO);
  const t = tamanhoDoTexto(CONFIG_EXEMPLO, VALORES_EXEMPLO.linhas, l.quadro);
  assert.ok(t >= 38 && t <= 48, `tamanho ${t}`);
  assert.ok(tamanhoDoTexto(CONFIG_EXEMPLO, ["Curto"], l.quadro) > t);
  assert.equal(tamanhoDoTexto({ ...CONFIG_EXEMPLO, quadro: { ...CONFIG_EXEMPLO.quadro, tamanho: 30 } }, ["x"], l.quadro), 30);
});

test("nome do arquivo baixado", () => {
  assert.equal(nomeArquivoPlaca("Viga barrote sem madeira!", "pdf"), "placa-viga-barrote-sem-madeira.pdf");
  assert.equal(nomeArquivoPlaca("", "png"), "placa-placa.png");
});
