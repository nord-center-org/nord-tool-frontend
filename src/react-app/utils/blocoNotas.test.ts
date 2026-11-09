import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acrescentarPonto, adensar, alturaTexto, apagarItens, apagarParcial, caixaDoItem, compactar, dentroDoPoligono, duplicarItens, escalarItens,
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
  assert.equal(tituloDoPdf(".pdf"), "PDF importado");
});
