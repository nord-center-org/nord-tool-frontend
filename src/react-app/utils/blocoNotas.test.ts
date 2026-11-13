import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ZOOM_MAX, ZOOM_MIN, acrescentarPonto, correcaoDaRolagem, limitarZoom, zoomDaRoda, adensar, alturaTexto, apagarItens, apagarParcial, caixaDoItem, compactar, dentroDoPoligono, duplicarItens, escalarItens,
  formaDoArrasto, itemNoPonto, itensNoLaco, larguraNaPressao, lerConteudo, linhasDoFundo, linhasDoTexto, moverItens, nomeArquivoCaderno,
  pintarItens, pontasDaSeta, pontosDoFundo, pressao, registrar, tamanhoDaPaginaPdf, tituloDoPdf, tocaItem, type Item, type Traco,
} from "./blocoNotas.ts";

const traco = (id: string, ...xy: number[]): Traco => {
  const p: number[] = [];
  for (let k = 0; k < xy.length; k += 2) p.push(xy[k], xy[k + 1], 0.5);
  return { t: "tr", id, c: "#111827", w: 2, p };
};

test("leitura tolerante: descarta o que não reconhece e corrige valores", () => {
  const c = lerConteudo({ itens: [
    { t: "tr", id: "a", c: "vermelho", w: 999, p: [1, 2, 0.5, 3, 4] },
    { t: "fo", id: "b", f: "estrela", x1: 0 },
    { t: "tx", id: "c", txt: "Oi", s: 500 },
    { t: "im", id: "d", img: 0 },
    "lixo", null,
  ] });
  assert.equal(c.itens.length, 2);
  const t = c.itens[0] as Traco;
  assert.equal(t.c, "#111827");
  assert.equal(t.w, 60);
  assert.deepEqual(t.p, [1, 2, 0.5]);
  assert.equal((c.itens[1] as { s: number }).s, 96);
  assert.deepEqual(lerConteudo(null).itens, []);
  assert.deepEqual(lerConteudo({ itens: "x" }).itens, []);
});

test("compactar arredonda coordenadas e pressão", () => {
  const c = compactar([{ t: "tr", id: "a", c: "#111827", w: 2.345, p: [1.234, 5.678, 0.4567] }]);
  assert.deepEqual((c.itens[0] as Traco).p, [1.2, 5.7, 0.46]);
  assert.equal((c.itens[0] as Traco).w, 2.3);
});

test("pressão: mouse e dedo ficam na espessura escolhida; caneta varia", () => {
  assert.equal(pressao("mouse", 0), 0.5);
  assert.equal(pressao("touch", 1), 0.5);
  assert.equal(pressao("pen", 0.9), 0.9);
  assert.equal(pressao("pen", 0), 0.5);
  assert.equal(larguraNaPressao(4, 0.5), 4);
  assert.ok(larguraNaPressao(4, 0.05) < 2);
  assert.ok(Math.abs(larguraNaPressao(4, 1) - 5.2) < 1e-9);
});

test("caneta pula pontos colados e suaviza", () => {
  let p = acrescentarPonto([], 10, 10, 0.5);
  p = acrescentarPonto(p, 10.2, 10.1, 0.5);
  assert.equal(p.length, 3);
  p = acrescentarPonto(p, 20, 10, 0.5);
  assert.deepEqual(p.slice(3), [17.5, 10, 0.5]);
});

test("toque e caixa dos itens", () => {
  const t = traco("a", 0, 0, 100, 0);
  assert.ok(tocaItem(t, 50, 3, 2));
  assert.ok(!tocaItem(t, 50, 10, 2));
  assert.deepEqual(caixaDoItem(t), { x: -1, y: -1, w: 102, h: 2 });
  const ret = formaDoArrasto("ret", "#111827", 2, { x: 10, y: 10 }, { x: 110, y: 60 });
  assert.ok(tocaItem(ret, 10, 30, 1));
  assert.ok(!tocaItem(ret, 60, 35, 1), "dentro do retângulo vazio não é a borda");
  const elipse = formaDoArrasto("elipse", "#111827", 2, { x: 0, y: 0 }, { x: 100, y: 50 });
  assert.ok(tocaItem(elipse, 100, 25, 2));
  assert.ok(!tocaItem(elipse, 50, 25, 2));
  const itens: Item[] = [t, { t: "tx", id: "x", x: 0, y: 0, w: 200, s: 20, c: "#111827", txt: "Oi" }];
  assert.equal(itemNoPonto(itens, 10, 5)?.id, "x");
  assert.equal(itemNoPonto(itens, 500, 500), null);
});

test("borracha de traço tira o item inteiro", () => {
  const itens = [traco("a", 0, 0, 100, 0), traco("b", 0, 50, 100, 50)];
  assert.deepEqual(apagarItens(itens, 50, 0, 3).map(i => i.id), ["b"]);
  assert.equal(apagarItens(itens, 50, 25, 3), itens, "sem toque devolve a mesma lista");
});

test("borracha parcial corta o traço em dois", () => {
  const itens = [traco("a", 0, 0, 10, 0, 20, 0, 30, 0, 40, 0)];
  const r = apagarParcial(itens, 20, 0, 2) as Traco[];
  assert.equal(r.length, 2);
  assert.equal(r[0].id, "a");
  assert.equal(r[0].p[0], 0);
  assert.ok(r[0].p[r[0].p.length - 3] < 17, "primeiro pedaço acaba antes da borracha");
  assert.ok(r[1].p[0] > 23, "segundo começa depois dela");
  assert.equal(r[1].p[r[1].p.length - 3], 40);
  assert.notEqual(r[1].id, "a");
  const forma = formaDoArrasto("linha", "#111827", 2, { x: 0, y: 100 }, { x: 100, y: 100 });
  assert.equal(apagarParcial([forma], 50, 100, 2).length, 0, "formas saem inteiras");
  assert.equal(apagarParcial(itens, 500, 500, 2), itens);
});

test("borracha parcial corta traço rápido (pontos distantes) no meio", () => {
  const longo = [traco("m", 0, 0, 600, 0)];
  const r = apagarParcial(longo, 300, 0, 10) as Traco[];
  assert.equal(r.length, 2);
  const fim0 = r[0].p[r[0].p.length - 3], ini1 = r[1].p[0];
  assert.ok(fim0 < 290 && fim0 > 280, `primeiro pedaço termina antes do corte (${fim0})`);
  assert.ok(ini1 > 310 && ini1 < 320, `segundo começa depois (${ini1})`);
  assert.equal(r[1].p[r[1].p.length - 3], 600);
  const d = adensar([0, 0, 0, 10, 0, 1], 2.5);
  assert.deepEqual(d.filter((_, k) => k % 3 === 0), [0, 2.5, 5, 7.5, 10]);
  assert.deepEqual(d.filter((_, k) => k % 3 === 2), [0, 0.25, 0.5, 0.75, 1]);
});

test("laço pega o que está dentro", () => {
  const laco = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  assert.ok(dentroDoPoligono(50, 50, laco));
  assert.ok(!dentroDoPoligono(150, 50, laco));
  const itens: Item[] = [traco("dentro", 10, 10, 50, 50), traco("fora", 200, 200, 300, 300), traco("metade", 90, 50, 150, 50, 160, 50)];
  assert.deepEqual(itensNoLaco(itens, laco), ["dentro"]);
  assert.deepEqual(itensNoLaco(itens, laco.slice(0, 2)), []);
});

test("mover, redimensionar, pintar e duplicar a seleção", () => {
  const itens: Item[] = [traco("a", 0, 0, 10, 10), { t: "im", id: "i", img: 3, x: 10, y: 10, w: 100, h: 50 }];
  const ids = new Set(["a", "i"]);
  const movidos = moverItens(itens, ids, 5, -5);
  assert.deepEqual((movidos[0] as Traco).p, [5, -5, 0.5, 15, 5, 0.5]);
  assert.equal((movidos[1] as { x: number }).x, 15);
  const maiores = escalarItens(itens, ids, { x: 0, y: 0 }, 2);
  assert.deepEqual((maiores[0] as Traco).p, [0, 0, 0.5, 20, 20, 0.5]);
  assert.equal((maiores[0] as Traco).w, 4);
  assert.equal((maiores[1] as { w: number }).w, 200);
  const pintados = pintarItens(itens, ids, "#dc2626");
  assert.equal((pintados[0] as Traco).c, "#dc2626");
  assert.equal("c" in pintados[1], false, "imagem não tem cor");
  const d = duplicarItens(itens, new Set(["a"]));
  assert.equal(d.itens.length, 3);
  assert.equal(d.novos.length, 1);
  assert.deepEqual((d.itens[2] as Traco).p, [16, 16, 0.5, 26, 26, 0.5]);
});

test("formas retas com Shift e cabeça da seta", () => {
  const l = formaDoArrasto("linha", "#111827", 2, { x: 0, y: 0 }, { x: 100, y: 10 }, true);
  assert.ok(Math.abs(l.y2) < 1e-9);
  const q = formaDoArrasto("ret", "#111827", 2, { x: 0, y: 0 }, { x: 100, y: -40 }, true);
  assert.deepEqual([q.x2, q.y2], [100, -100]);
  const [a, b] = pontasDaSeta({ x1: 0, y1: 0, x2: 100, y2: 0, w: 2 });
  assert.ok(a.x < 100 && b.x < 100 && a.y * b.y < 0, "uma ponta de cada lado da linha");
});

test("texto quebra na largura da caixa", () => {
  const i = { txt: "uma frase com várias palavras\nsegunda", w: 120, s: 20 };
  assert.deepEqual(linhasDoTexto(i), ["uma frase", "com várias", "palavras", "segunda"]);
  assert.equal(alturaTexto(i), 4 * 26);
});

test("fundos do papel", () => {
  const pautado = linhasDoFundo("PAUTADO", 794, 1123);
  assert.equal(pautado.filter(l => l.forte).length, 1);
  assert.equal(pautado[0].y1, 96);
  assert.equal(linhasDoFundo("BRANCO", 794, 1123).length, 0);
  assert.equal(linhasDoFundo("QUADRICULADO", 48, 48).length, 2);
  assert.equal(pontosDoFundo("PONTILHADO", 50, 50).length, 4);
  assert.equal(pontosDoFundo("PAUTADO", 50, 50).length, 0);
});

test("histórico guarda no máximo o limite", () => {
  let h = [] as ReturnType<typeof registrar>;
  for (let k = 0; k < 5; k++) h = registrar(h, { pagina: k, antes: [], depois: [] }, 3);
  assert.deepEqual(h.map(p => p.pagina), [2, 3, 4]);
});

test("tamanho das páginas do PDF e nomes", () => {
  assert.deepEqual(tamanhoDaPaginaPdf(595.28, 841.89), { largura: 794, altura: 1123 });
  assert.deepEqual(tamanhoDaPaginaPdf(6000, 3000), { largura: 4000, altura: 2000 });
  assert.equal(nomeArquivoCaderno("Obra Norte – Vistoria"), "caderno-obra-norte-vistoria.pdf");
  assert.equal(nomeArquivoCaderno("???"), "caderno-caderno.pdf");
  assert.equal(tituloDoPdf("Projeto torre B.PDF"), "Projeto torre B");
  assert.equal(tituloDoPdf(".pdf"), "Arquivo importado");
  assert.equal(tituloDoPdf("Orçamento.xlsx"), "Orçamento");
});

// ---------------------------------------------------------------- v2

import {
  corCss, diagramarTexto, girarItens, htmlParaTrechos, juntarTrechos, lerTrechos, proximoGiro, recuoDaLinha, trechosDe, trechosParaHtml,
  type NoTexto, type Texto,
} from "./blocoNotas.ts";

const medir1 = (t: string) => t.length * 10; // 10 px por letra

test("v2: caixa de texto antiga continua igual e a nova guarda a formatação", () => {
  const antiga = lerConteudo({ itens: [{ t: "tx", id: "x", x: 0, y: 0, w: 100, s: 20, c: "#111827", txt: "Oi" }] }).itens[0] as Texto;
  assert.equal(antiga.r, undefined);
  assert.deepEqual(trechosDe(antiga), [{ t: "Oi" }]);
  const nova = lerConteudo({ itens: [{ t: "tx", id: "y", x: 0, y: 0, w: 100, s: 20, c: "#111827", txt: "velho", al: "center",
    r: [{ t: "Torre ", b: 1 }, { t: "B", b: 1 }, { t: " ok", c: "#dc2626", s: 500 }, { t: "" }, { x: 1 }] }] }).itens[0] as Texto;
  assert.deepEqual(nova.r, [{ t: "Torre B", b: 1 }, { t: " ok", c: "#dc2626", s: 96 }]);
  assert.equal(nova.txt, "Torre B ok", "o texto puro acompanha os trechos");
  assert.equal(nova.al, "center");
  assert.deepEqual(lerTrechos("x"), []);
  assert.deepEqual(juntarTrechos([{ t: "a", b: 1 }, { t: "" }, { t: "b", b: 1 }, { t: "c" }]), [{ t: "ab", b: 1 }, { t: "c" }]);
});

test("v2: diagramar quebra por palavra, respeita Enter e corta palavra longa", () => {
  const l = diagramarTexto({ txt: "", w: 100, s: 20, r: [{ t: "uma frase " }, { t: "grande", b: 1 }, { t: "\nfim" }] }, medir1);
  assert.deepEqual(l.map(x => x.pecas.map(p => p.t).join("")), ["uma frase ", "grande", "fim"]);
  assert.equal(l[0].util, 90, "sem o espaço do fim");
  const longa = diagramarTexto({ txt: "abcdefghijklmno", w: 50, s: 20 }, medir1);
  assert.deepEqual(longa.map(x => x.pecas.map(p => p.t).join("")), ["abcde", "fghij", "klmno"]);
  const tamanhos = diagramarTexto({ txt: "", w: 500, s: 20, r: [{ t: "a" }, { t: "B", s: 40 }] }, medir1);
  assert.equal(tamanhos[0].altura, 52, "a maior letra manda na altura da linha");
  assert.equal(diagramarTexto({ txt: "", w: 100, s: 20 }, medir1).length, 1, "caixa vazia tem uma linha");
});

test("v2: alinhamento da linha", () => {
  const [l] = diagramarTexto({ txt: "abc ", w: 100, s: 20 }, medir1);
  assert.equal(recuoDaLinha(l, 100, "center"), 35);
  assert.equal(recuoDaLinha(l, 100, "right"), 70);
  assert.equal(recuoDaLinha(l, 100, undefined), 0);
});

test("v2: trechos ↔ HTML do editor", () => {
  const html = trechosParaHtml([{ t: "<Oi>", b: 1 }, { t: " 2\nlinha", c: "#dc2626", s: 30 }], 2);
  assert.equal(html, '<b>&lt;Oi&gt;</b><span data-s="30" style="color:#dc2626;font-size:60px"> 2<br>linha</span>');
  const no = (nodeName: string, filhos: NoTexto[], extra: Partial<NoTexto> = {}): NoTexto => ({ nodeType: 1, nodeName, textContent: null, childNodes: filhos, ...extra });
  const txt = (t: string): NoTexto => ({ nodeType: 3, nodeName: "#text", textContent: t, childNodes: [] });
  const raiz = no("DIV", [
    no("B", [txt("Torre")]), txt(" B"),
    no("DIV", [no("SPAN", [txt("vermelho")], { style: { color: "rgb(220, 38, 38)" }, getAttribute: (n: string) => (n === "data-s" ? "30" : null) })]),
    no("DIV", [no("FONT", [txt("azul")], { getAttribute: (n: string) => (n === "color" ? "#2563EB" : null) }), no("BR", [])]),
  ]);
  assert.deepEqual(htmlParaTrechos(raiz), [
    { b: 1, t: "Torre" }, { t: " B\n" }, { c: "#dc2626", s: 30, t: "vermelho" }, { t: "\n" }, { c: "#2563eb", t: "azul" },
  ]);
  assert.equal(corCss("rgb(1, 2, 255)"), "#0102ff");
  assert.equal(corCss("azul"), undefined);
});

test("v2: girar a página gira traços e formas e move textos e imagens", () => {
  const itens = [
    { t: "tr", id: "a", c: "#111827", w: 2, p: [10, 20, 0.5] },
    { t: "fo", id: "f", f: "linha", c: "#111827", w: 2, x1: 0, y1: 0, x2: 100, y2: 0 },
    { t: "im", id: "i", img: 1, x: 0, y: 0, w: 40, h: 20 },
  ] as Parameters<typeof girarItens>[0];
  const g = girarItens(itens, 794, 1123);
  assert.deepEqual((g[0] as { p: number[] }).p, [1103, 10, 0.5]);
  assert.deepEqual([(g[1] as { x1: number }).x1, (g[1] as { y1: number }).y1, (g[1] as { x2: number }).x2, (g[1] as { y2: number }).y2], [1123, 0, 1123, 100]);
  const im = g[2] as { x: number; y: number; w: number; h: number };
  assert.deepEqual([im.x + im.w / 2, im.y + im.h / 2, im.w, im.h], [1113, 20, 40, 20], "o centro gira, a imagem continua em pé");
  const volta = girarItens(g, 1123, 794, true);
  assert.deepEqual((volta[0] as { p: number[] }).p, [10, 20, 0.5]);
  assert.equal(proximoGiro(0), 90);
  assert.equal(proximoGiro(270), 0);
  assert.equal(proximoGiro(0, true), 270);
});

import { documentoVazio, filtrarEstilo } from "./blocoNotas.ts";

test("v2: documento só aceita estilo de texto", () => {
  assert.equal(filtrarEstilo("color: red; position: fixed; background-color: #ff0; font-size: 18px"), "color: red; background-color: #ff0; font-size: 18px");
  assert.equal(filtrarEstilo("background-color: url(javascript:alert(1))"), "");
  assert.equal(filtrarEstilo("color: expression(alert(1))"), "");
  assert.equal(filtrarEstilo("text-align: center; behavior: url(x)"), "text-align: center");
  assert.equal(filtrarEstilo("lixo"), "");
  assert.ok(documentoVazio("<p><br></p>&nbsp; "));
  assert.ok(!documentoVazio("<p>Oi</p>"));
});

import { motivoArquivoNaoSuportado, planilhaParaHtml, tamanhoDaPaginaImagem, textoParaHtml, tipoDoArquivo } from "./blocoNotas.ts";

test("v2: que arquivo vira o quê", () => {
  assert.equal(tipoDoArquivo("Projeto.PDF"), "pdf");
  assert.equal(tipoDoArquivo("foto.jpeg"), "imagem");
  assert.equal(tipoDoArquivo("x", "image/png"), "imagem");
  assert.equal(tipoDoArquivo("memorial.docx"), "word");
  assert.equal(tipoDoArquivo("orcamento.xlsx"), "planilha");
  assert.equal(tipoDoArquivo("lista.csv"), "planilha");
  assert.equal(tipoDoArquivo("leia.txt"), "texto");
  assert.equal(tipoDoArquivo("apresentacao.pptx"), null);
  assert.match(motivoArquivoNaoSuportado("apresentacao.pptx"), /PDF/);
  assert.match(motivoArquivoNaoSuportado("antigo.doc"), /docx/);
  assert.match(motivoArquivoNaoSuportado("IMG_1.HEIC"), /JPEG/);
});

test("v2: página da imagem na proporção dela e texto em parágrafos", () => {
  assert.deepEqual(tamanhoDaPaginaImagem(4000, 3000), { largura: 1123, altura: 842 });
  assert.deepEqual(tamanhoDaPaginaImagem(1000, 2000), { largura: 562, altura: 1123 });
  assert.deepEqual(tamanhoDaPaginaImagem(0, 0), { largura: 794, altura: 1123 });
  assert.equal(textoParaHtml("a <b>\nb\r\n\r\nc"), "<p>a &lt;b&gt;<br>b</p><p>c</p>");
});

test("v2: planilha vira tabelas com o cabeçalho repetido", () => {
  const linhas = [["Item", "Qtd"], ...Array.from({ length: 5 }, (_, k) => [`L${k}`, k])];
  const html = planilhaParaHtml("Plan<1>", linhas, 2);
  assert.equal((html.match(/<table>/g) ?? []).length, 3);
  assert.equal((html.match(/<th>Item<\/th>/g) ?? []).length, 3);
  assert.ok(html.startsWith("<h3>Plan&lt;1&gt;</h3>"));
  assert.match(planilhaParaHtml("p", [["a"], ["b"], ["c"]], 10, 2), /mais 1 linha/);
  assert.equal(planilhaParaHtml("p", []), "");
});

test("v6: zoom vai de 10% a 1600% e a rodinha muda proporcional ao giro", () => {
  assert.equal(limitarZoom(40), ZOOM_MAX);
  assert.equal(limitarZoom(0.01), ZOOM_MIN);
  assert.equal(limitarZoom(Number.NaN), 1);
  assert.ok(zoomDaRoda(1, -100) > 1 && zoomDaRoda(1, 100) < 1, "para cima aproxima, para baixo afasta");
  assert.ok(Math.abs(zoomDaRoda(zoomDaRoda(1, -100), 100) - 1) < 1e-9, "ida e volta voltam ao mesmo zoom");
  assert.equal(zoomDaRoda(1, -100000), 2, "um evento muda no máximo 2×");
  assert.equal(zoomDaRoda(1, 3, 1), zoomDaRoda(1, 48, 0), "rodinha em linhas vira px");
  assert.equal(zoomDaRoda(15, -1000), ZOOM_MAX);
});

test("v6: o ponto embaixo do cursor fica embaixo dele depois do zoom", () => {
  // folha a 100 px da borda, ponto (200, 50) da folha; com zoom 3 ele iria para 100 + 600 = 700; cursor em 300
  assert.deepEqual(correcaoDaRolagem({ left: 100, top: 20 }, { x: 200, y: 50 }, 3, { x: 300, y: 120 }), { dx: 400, dy: 50 });
  assert.deepEqual(correcaoDaRolagem({ left: 0, top: 0 }, { x: 10, y: 10 }, 1, { x: 10, y: 10 }), { dx: 0, dy: 0 });
});
