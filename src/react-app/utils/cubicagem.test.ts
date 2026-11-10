import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acharEscala, acharPeca, areaDoPoligono, calibrar, comprimentoDaLinha, lerNumero, lerPecas, linhasDaPlanilha, metrosPorPonto, montarLinhas,
  pecaDoAchado, pecaNova, tipoDoCodigo, totais, volumeDaPeca, verticesDoCaminho, multiplicar, GradePontos, type LinhaPdf, type Peca,
} from "./cubicagem.ts";

const linha = (texto: string, pagina = 1): LinhaPdf => ({ texto, pagina, x: 10, y: 20, w: 50, h: 5 });
const peca = (dados: Partial<Peca>): Peca => ({ ...pecaNova(dados.codigo ?? "V1"), ...dados });

test("tipo pelo prefixo do código", () => {
  assert.equal(tipoDoCodigo("V12"), "VIGA");
  assert.equal(tipoDoCodigo("vb3"), "VIGA");
  assert.equal(tipoDoCodigo("P 5"), "PILAR");
  assert.equal(tipoDoCodigo("L-3"), "LAJE");
  assert.equal(tipoDoCodigo("S1"), "FUNDACAO");
  assert.equal(tipoDoCodigo("B12"), "FUNDACAO");
  assert.equal(tipoDoCodigo("X1"), "OUTRO");
});

test("volume retangular, circular, por área e direto", () => {
  assert.equal(volumeDaPeca(peca({ forma: "RET", b: 14, h: 50, comp: 6.3 })).liquido, 0.441);
  assert.equal(volumeDaPeca(peca({ forma: "RET", b: 20, h: 60, comp: 3, qtd: 4 })).bruto, 1.44);
  assert.equal(volumeDaPeca(peca({ forma: "CIRC", d: 30, comp: 3 })).liquido, 0.2121);
  assert.equal(volumeDaPeca(peca({ forma: "AREA", area: 42.5, esp: 12 })).liquido, 5.1);
  assert.equal(volumeDaPeca(peca({ forma: "VOLUME", vol: 2.75 })).liquido, 2.75);
});

test("faltando medida não calcula e diz o que falta", () => {
  const v = volumeDaPeca(peca({ forma: "RET", b: 14, h: null, comp: null }));
  assert.equal(v.liquido, null);
  assert.deepEqual(v.falta, ["altura", "comprimento"]);
});

test("descontos abatem do volume e nunca deixam negativo", () => {
  const p = peca({ forma: "RET", b: 20, h: 50, comp: 5, descontos: [{ id: "a", desc: "Dentro do P5", m3: 0.04 }, { id: "b", desc: "", m3: null }] });
  const v = volumeDaPeca(p);
  assert.equal(v.bruto, 0.5);
  assert.equal(v.descontos, 0.04);
  assert.equal(v.liquido, 0.46);
  assert.equal(volumeDaPeca({ ...p, descontos: [{ id: "c", desc: "", m3: 9 }] }).liquido, 0);
});

test("totais por tipo na ordem da obra, perda e incompletas", () => {
  const t = totais([
    peca({ codigo: "V1", tipo: "VIGA", forma: "RET", b: 14, h: 50, comp: 6.3 }),
    peca({ codigo: "P1", tipo: "PILAR", forma: "RET", b: 20, h: 60, comp: 3, qtd: 4 }),
    peca({ codigo: "V2", tipo: "VIGA", forma: "RET", b: 14, h: 50, comp: null }),
  ], 5);
  assert.deepEqual(t.porTipo.map(x => x.tipo), ["PILAR", "VIGA"]);
  assert.equal(t.porTipo[1].liquido, 0.441);
  assert.equal(t.porTipo[1].incompletas, 1);
  assert.equal(t.liquido, 1.881);
  assert.equal(t.perda, 0.0941);
  assert.equal(t.comPerda, 1.9751);
  assert.equal(t.incompletas, 1);
  assert.equal(totais([], 80).perda, 0);
});

test("leitura tolerante das peças salvas", () => {
  const p = lerPecas([{ codigo: "V12", tipo: "XYZ", b: -3, h: "50", qtd: 0, descontos: [{ m3: 0.1 }, 5], origem: { arquivo: "a.pdf", pagina: 2 } }, 7, null]);
  assert.equal(p.length, 1);
  assert.equal(p[0].tipo, "OUTRO");
  assert.equal(p[0].b, null);
  assert.equal(p[0].h, null);
  assert.equal(p[0].qtd, 1);
  assert.equal(p[0].descontos.length, 1);
  assert.deepEqual(p[0].origem, { arquivo: "a.pdf", pagina: 2 });
  assert.deepEqual(lerPecas("x"), []);
});

test("acha a seção da viga em vários jeitos de escrever", () => {
  for (const [t, b, h] of [["V12 (14x50)", 14, 50], ["V12 14/50", 14, 50], ["V-12 ( 19 x 60 )", 19, 60], ["V 12 0,14x0,50", 14, 50], ["V12=V13 (15x40)", 15, 40]] as const) {
    const [a] = acharPeca("v12", [linha(t)]);
    assert.ok(a, t);
    assert.equal(a.b, b, t);
    assert.equal(a.h, h, t);
    assert.equal(a.tipo, "VIGA");
  }
});

test("não confunde V12 com V120 nem com AV12", () => {
  assert.equal(acharPeca("V12", [linha("V120 (14x50)"), linha("AV12 20x40")]).length, 0);
});

test("pilar circular, laje com h= e achados com medida primeiro", () => {
  assert.equal(acharPeca("P7", [linha("P7 Ø40")])[0].d, 40);
  assert.equal(acharPeca("L3", [linha("L3 h=12")])[0].esp, 12);
  const r = acharPeca("P5", [linha("ver P5", 1), linha("P5 20x60", 3)]);
  assert.equal(r.length, 2);
  assert.equal(r[0].pagina, 3);
  assert.equal(r[1].b, null);
  assert.deepEqual(acharPeca("??", [linha("x")]), []);
});

test("peça montada do achado", () => {
  const ret = pecaDoAchado(acharPeca("V12", [linha("V12 (14x50)", 2)])[0], "forma.pdf");
  assert.equal(ret.forma, "RET");
  assert.equal(ret.b, 14);
  assert.deepEqual(ret.origem, { arquivo: "forma.pdf", pagina: 2 });
  assert.equal(pecaDoAchado(acharPeca("P7", [linha("P7 Ø40")])[0], "a").forma, "CIRC");
  const laje = pecaDoAchado(acharPeca("L3", [linha("L3 h=12")])[0], "a");
  assert.equal(laje.forma, "AREA");
  assert.equal(laje.esp, 12);
});

test("linhas montadas dos pedaços do PDF", () => {
  const l = montarLinhas([
    { str: "V12", x: 100, y: 500, w: 15, h: 6 },
    { str: "(14x50)", x: 117, y: 500.5, w: 30, h: 6 },
    { str: "P5", x: 300, y: 200, w: 10, h: 6 },
    { str: " ", x: 0, y: 0, w: 1, h: 6 },
  ], 4);
  assert.equal(l.length, 2);
  assert.equal(l[0].texto, "V12 (14x50)");
  assert.equal(l[0].pagina, 4);
  assert.equal(l[1].texto, "P5");
});

test("escala, medida e calibração", () => {
  assert.equal(acharEscala(["FORMA DO 3º PAV. ESC. 1:50", "Escala 1/50", "ESC 1 : 100"]), 50);
  assert.equal(acharEscala(["sem escala"]), null);
  // 1:50 → 100 pt no papel = 35,28 mm → 1,764 m reais
  assert.ok(Math.abs(100 * metrosPorPonto(50) - 1.7639) < 1e-3);
  assert.equal(comprimentoDaLinha([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }]), 11);
  assert.equal(areaDoPoligono([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }]), 50);
  assert.equal(areaDoPoligono([{ x: 0, y: 0 }, { x: 1, y: 1 }]), 0);
  assert.equal(calibrar(200, 5), 0.025);
  assert.equal(calibrar(0, 5), null);
});

test("números em pt-BR", () => {
  assert.equal(lerNumero("6,30"), 6.3);
  assert.equal(lerNumero("1.250,5"), 1250.5);
  assert.equal(lerNumero("6.3"), 6.3);
  assert.equal(lerNumero(" "), null);
  assert.ok(Number.isNaN(lerNumero("abc")));
});

test("planilha com uma linha por peça e os totais", () => {
  const l = linhasDaPlanilha([
    peca({ codigo: "V2", tipo: "VIGA", forma: "RET", b: 14, h: 50, comp: 2 }),
    peca({ codigo: "P1", tipo: "PILAR", forma: "CIRC", d: 30, comp: 3 }),
  ], 10);
  assert.equal(l[0].Peça, "P1");
  assert.equal(l[1]["Volume líquido (m³)"], 0.14);
  assert.equal(l.at(-1)?.Tipo, "Total com perda");
});

test("medida na linha de baixo do código (como o CAD costuma pôr)", () => {
  const ls: LinhaPdf[] = [
    { texto: "L3", pagina: 1, x: 100, y: 500, w: 12, h: 10 },
    { texto: "h=12", pagina: 1, x: 100, y: 485, w: 20, h: 10 },
    { texto: "V8", pagina: 1, x: 300, y: 500, w: 12, h: 10 },
    { texto: "(15x40)", pagina: 1, x: 298, y: 486, w: 30, h: 10 },
    { texto: "P2", pagina: 1, x: 600, y: 500, w: 12, h: 10 },
    { texto: "20x30", pagina: 1, x: 900, y: 488, w: 30, h: 10 },
  ];
  assert.equal(acharPeca("L3", ls)[0].esp, 12);
  assert.equal(acharPeca("V8", ls)[0].h, 40);
  assert.equal(acharPeca("P2", ls)[0].b, null);
});

test("ímã: vértices do caminho com a matriz e o mais perto na grade", () => {
  const v = verticesDoCaminho([0, 0, 0, 1, 0, 34, 2, 1, 1, 2, 2, 11, 34, 4], [1, 0, 0, 1, 395, 1190]);
  assert.deepEqual(v, [{ x: 395, y: 1190 }, { x: 395, y: 1224 }, { x: 406, y: 1224 }]);
  assert.deepEqual(multiplicar([2, 0, 0, 2, 0, 0], [1, 0, 0, 1, 10, 5]), [2, 0, 0, 2, 10, 5]);
  const g = new GradePontos(20);
  v.forEach(p => g.adicionar(p));
  g.adicionar({ x: 395, y: 1190 });
  assert.equal(g.total, 3);
  assert.deepEqual(g.maisPerto({ x: 404, y: 1221 }, 6), { x: 406, y: 1224 });
  assert.equal(g.maisPerto({ x: 500, y: 500 }, 6), null);
});
