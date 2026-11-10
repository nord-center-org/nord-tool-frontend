import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONFIG_EXEMPLO, MAX_IMAGENS, MIN_LADO, VALORES_EXEMPLO, girar, imagemNova, layoutPlaca, lerConfig, lerImagens, lerValores, linhasDoTexto, moverComGuias,
  mudarOrdem, nomeArquivoPlaca, redimensionar, tamanhoDoTexto, type ImagemPlaca,
} from "./placas.ts";

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
  assert.deepEqual(lerValores({ cabecalho: "NEXT", linhas: ["a", 3, "b"] }), { cabecalho: "NEXT", linhas: ["a", "b"], rodape: "", imagens: [] });
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

// ---------------------------------------------------------------- v2: imagens soltas

const base: ImagemPlaca = { id: "a", img: 3, x: 100, y: 100, w: 200, h: 100, rot: 0, camada: "frente" };
const folha = { largura: 1123, altura: 794 };

test("imagens: leitura tolerante, limite e compatível com modelos antigos", () => {
  assert.deepEqual(lerConfig({}).imagens, []);
  assert.deepEqual(lerValores({ linhas: ["a"] }).imagens, []);
  const lidas = lerImagens([{ img: 3, x: 1, y: 2, w: 3, h: 50, rot: 999, camada: "atras" }, { img: 0 }, { img: "x" }, null]);
  assert.equal(lidas.length, 1);
  assert.equal(lidas[0].w, MIN_LADO);
  assert.equal(lidas[0].rot, 360);
  assert.equal(lidas[0].camada, "atras");
  assert.equal(lerImagens(Array.from({ length: 30 }, () => ({ img: 1 }))).length, MAX_IMAGENS);
  assert.equal(lerValores({ imagens: [{ img: 7 }] }).imagens[0].camada, "frente");
});

test("imagem nova entra no meio, com a proporção da foto", () => {
  const i = imagemNova(5, 800, 400, folha);
  assert.equal(i.w, 449);
  assert.equal(i.h, 225);
  assert.equal(i.x, Math.round((1123 - 449.2) / 2));
  const alta = imagemNova(5, 100, 1000, folha);
  assert.ok(alta.h <= 794 * 0.6 + 1 && Math.abs(alta.w / alta.h - 0.1) < 0.01);
});

test("redimensionar: canto mantém a proporção e o canto oposto fica parado", () => {
  const r = redimensionar(base, "se", 100, 0);
  assert.deepEqual([r.x, r.y, r.w, r.h], [100, 100, 300, 150]);
  const nw = redimensionar(base, "nw", -100, -10);
  assert.deepEqual([nw.x + nw.w, nw.y + nw.h], [300, 200], "canto de baixo à direita parado");
  assert.equal(nw.w / nw.h, 2);
  const livre = redimensionar(base, "se", 100, 0, true);
  assert.deepEqual([livre.w, livre.h], [300, 100]);
  const lado = redimensionar(base, "e", 50, 80);
  assert.deepEqual([lado.w, lado.h], [250, 100], "lado estica numa direção só");
  const minimo = redimensionar(base, "w", 500, 0);
  assert.equal(minimo.w, MIN_LADO);
});

test("redimensionar imagem girada estica no eixo dela", () => {
  const girada = { ...base, rot: 90 };
  // Girada 90°, o lado "e" da imagem aponta para baixo na folha.
  const r = redimensionar(girada, "e", 0, 40);
  assert.equal(r.w, 240);
  assert.equal(r.h, 100);
});

test("girar encaixa nos ângulos retos", () => {
  const cx = base.x + base.w / 2, cy = base.y + base.h / 2;
  assert.equal(girar(base, cx, cy - 100).rot, 0);
  assert.equal(girar(base, cx + 100, cy + 3).rot, 90);
  assert.equal(girar(base, cx + 100, cy - 100).rot, 45);
  assert.equal(girar(base, cx - 100, cy).rot, -90);
});

test("mover encaixa no centro e nas bordas da folha", () => {
  const meio = moverComGuias(base, 1123 / 2 - 100 + 4, 300, folha);
  assert.equal(meio.x, 1123 / 2 - 100);
  assert.deepEqual(meio.guias, [{ tipo: "v", pos: 1123 / 2 }]);
  const borda = moverComGuias(base, 3, 794 - 100 - 2, folha);
  assert.deepEqual([borda.x, borda.y], [0, 694]);
  assert.equal(borda.guias.length, 2);
  assert.deepEqual(moverComGuias(base, 250, 250, folha).guias, []);
});

test("ordem das imagens na pilha", () => {
  const l = ["a", "b", "c"].map(id => ({ ...base, id }));
  assert.deepEqual(mudarOrdem(l, "a", "frente").map(i => i.id), ["b", "c", "a"]);
  assert.deepEqual(mudarOrdem(l, "c", "tras").map(i => i.id), ["c", "a", "b"]);
  assert.deepEqual(mudarOrdem(l, "a", "subir").map(i => i.id), ["b", "a", "c"]);
  assert.deepEqual(mudarOrdem(l, "a", "descer").map(i => i.id), ["a", "b", "c"]);
  assert.equal(mudarOrdem(l, "x", "frente"), l);
});
