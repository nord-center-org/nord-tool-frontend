import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checklistProjetos, cmPorPonto, contornoDasParedes, detectarBlocos, escalaDaPrancha, familia, juntaDaPrancha, lerCarimbo,
  lerCorte, lerLegenda, montarTorreDoPacote, paredesDosBlocos, pavimentosDoCorte, quantitativo, tipoDoBloco,
  type Bloco, type Carimbo, type ParedeCm, type PranchaLida,
} from "./projetoVetorial.ts";
import { comoRetangulo, retangulosDosSegmentos, subcaminhos, type RetanguloPdf, type TextoPdf } from "./projetoPdfVetor.ts";
import { criarZip, lerZip } from "./zip.ts";
import type { ProjetoImportado } from "./escadinha.ts";

const txt = (s: string, x: number, y: number, h = 7, vertical = false): TextoPdf => ({ s, x, y, h, vertical });
/** Retângulo em cm reais convertido para pontos na escala 1:75. */
const K = cmPorPonto(75);
const ret = (x: number, y: number, w: number, h: number, cor = "#000000"): RetanguloPdf => ({ x0: x / K, y0: y / K, x1: (x + w) / K, y1: (y + h) / K, cor });

test("escala: lê 1 : 75 perto da palavra escala e ignora números soltos", () => {
  assert.equal(escalaDaPrancha([txt("Escala", 3205, 2317), txt("1 : 75", 3205, 2328)]), 75);
  assert.equal(escalaDaPrancha([txt("ESC. 1/50", 10, 10)]), 50);
  assert.equal(escalaDaPrancha([txt("1 : 75", 10, 10)]), null);
  assert.equal(escalaDaPrancha([txt("SEM ESCALA", 10, 10)]), null);
});

test("pdf: subcaminhos, retângulo de caminho único e retângulo de 4 traços encadeados", () => {
  const sub = subcaminhos([0, 0, 0, 1, 10, 0, 1, 10, 5, 1, 0, 5, 4]);
  assert.equal(sub.length, 1);
  assert.equal(sub[0].fechado, true);
  assert.deepEqual(comoRetangulo([...sub[0].pts, sub[0].pts[0]]), { x0: 0, y0: 0, x1: 10, y1: 5 });
  assert.equal(comoRetangulo([[0, 0], [10, 0], [12, 5], [0, 5]]), null);
  const seg = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2, cor: "#0082fa" });
  const r = retangulosDosSegmentos([seg(0, 0, 10, 0), seg(10, 0, 10, 4), seg(10, 4, 0, 4), seg(0, 4, 0, 0), seg(50, 50, 60, 50)]);
  assert.deepEqual(r, [{ x0: 0, y0: 0, x1: 10, y1: 4, cor: "#0082fa" }]);
});

test("blocos: acha retângulos com espessura de bloco, guarda o fundo e tira os furos", () => {
  const rets = [
    ret(0, 0, 39, 14), ret(2, 2.5, 16, 9, "#c0c0c0"), ret(21, 2.5, 16, 9, "#c0c0c0"), // bloco 39 com 2 furos
    ret(39, 0, 9, 14, "#00aa00"), // bloco 9 numa parede de 14 (mais curto que largo)
    ret(0, 100, 39, 9, "#6e6e6e"), // vedação
    ret(0, 300, 200, 80), // não é bloco
  ];
  const fundo = [{ pts: [[0, 99 / K], [60 / K, 99 / K], [60 / K, 110 / K], [0, 110 / K]] as [number, number][], cor: "#f8e15c" }];
  const blocos = detectarBlocos(rets, fundo, 75);
  assert.equal(blocos.length, 3);
  assert.equal(blocos.find(b => b.cor === "#6e6e6e")?.fundo, "#f8e15c");
  assert.equal(blocos.find(b => b.cor === "#000000")?.fundo, null);
});

test("legenda: amostra à esquerda (em outra escala) dá cor, fundo e categoria pelo título do grupo", () => {
  const amostra = (x: number, y: number, w: number, h: number, cor: string): RetanguloPdf => ({ x0: x, y0: y, x1: x + w, y1: y + h, cor });
  const textos = [
    txt("BLOCOS ESTRUTURAIS EM PLANTA", 3012, 64, 10),
    txt("BLOCO 39 (39 x 19 x 14)", 3058, 95.7),
    txt("BLOCO 34 (34 x 19 x 14)", 3058, 109.9),
    txt("BLOCOS DE VEDAÇÃO", 2836, 335, 10),
    txt("BLOCO 39 (39 x 19 x 9)", 2871, 363),
  ];
  const rets = [amostra(3023.8, 87.1, 27.6, 9.9, "#000000"), amostra(3027, 101.5, 24.1, 9.9, "#0082fa"), amostra(2837, 357, 27.6, 6.4, "#000000")];
  const fundos = [{ pts: [[2838, 358], [2864, 358], [2864, 363], [2838, 363]] as [number, number][], cor: "#ffff00" }];
  const tipos = lerLegenda(textos, rets, fundos);
  assert.deepEqual(tipos.map(t => [t.nome, t.categoria, t.cor, familia(t.fundo)]), [
    ["Bloco 39 (39×19×14)", "estrutural", "#000000", "neutra"],
    ["Bloco 34 (34×19×14)", "estrutural", "#0082fa", "neutra"],
    ["Bloco 39 (39×19×9)", "vedacao", "#000000", "forte"],
  ]);
  // Na planta a vedação vem com outro cinza e outro amarelo, mas a família e o tamanho batem.
  const vedacao: Bloco = { x: 0, y: 0, w: 9, h: 39, cor: "#6e6e6e", fundo: "#f8e15c" };
  const t = tipoDoBloco(vedacao, tipos);
  assert.equal(t.categoria, "vedacao");
  assert.equal(t.horizontal, false);
  const q = quantitativo([vedacao, { x: 50, y: 0, w: 39, h: 14, cor: "#000000", fundo: null }, { x: 90, y: 0, w: 39, h: 14, cor: "#000000", fundo: null }], tipos);
  assert.deepEqual(q.map(i => [i.nome, i.qtd]), [["Bloco 39 (39×19×14)", 2], ["Bloco 39 (39×19×9)", 1]]);
});

test("família da cor: neutra, clara e forte", () => {
  assert.equal(familia(null), "neutra");
  assert.equal(familia("#e5e5e5"), "neutra");
  assert.equal(familia("#ffffbf"), "clara");
  assert.equal(familia("#f8e15c"), "forte");
});

test("paredes: blocos alinhados viram uma parede; vão de porta quebra", () => {
  const b = (x: number): Bloco => ({ x, y: 7, w: 39, h: 14, cor: "#000000", fundo: null });
  const blocos = [b(19.5), b(59), b(98.5), b(98.5 + 39.5 + 81)];
  const paredes = paredesDosBlocos(blocos);
  assert.equal(paredes.length, 2);
  assert.deepEqual(paredes[0].a.map(Math.round), [0, 7]);
  assert.equal(Math.round(paredes[0].b[0]), 118);
  assert.equal(paredes[0].esp, 14);
});

test("contorno: torre em L fechada pelas paredes, mesmo com vão de sacada na fachada", () => {
  const h = (x0: number, x1: number, y: number): ParedeCm => ({ a: [x0, y], b: [x1, y], esp: 14 });
  const v = (x: number, y0: number, y1: number): ParedeCm => ({ a: [x, y0], b: [x, y1], esp: 14 });
  // L: 20 m × 20 m, braço de 8 m; sacada de 2,5 m aberta na fachada de baixo.
  const paredes = [h(0, 2000, 0), v(2000, 0, 800), h(800, 2000, 800), v(800, 800, 2000), h(0, 800, 2000), v(0, 0, 900), v(0, 1150, 2000)];
  const c = contornoDasParedes(paredes);
  assert.ok(c);
  assert.equal(c.length, 6);
  const xs = c.map(p => p[0]), ys = c.map(p => p[1]);
  assert.ok(Math.abs(Math.min(...xs) - 0) <= 20 && Math.abs(Math.max(...xs) - 2000) <= 20);
  assert.ok(Math.abs(Math.max(...ys) - 2000) <= 20);
});

test("corte esquemático: níveis com cota e laje, pilha com alturas reais e ids da escadinha", () => {
  const textos = [
    txt("CORTE ESQUEMÁTICO - TORRE 1", 2450, 850, 11),
    txt("801,91", 2645, 1227), txt("COBERTURA", 2600, 1239),
    txt("L26", 2606, 1275), txt("797,11", 2691, 1296), txt("BARRILETE", 2600, 1305),
    txt("L25", 2608, 1323), txt("794,45", 2691, 1335), txt("24º", 2600, 1344), txt("PAVIMENTO", 2607, 1344),
    txt("L3", 2608, 2154), txt("736,15", 2691, 2160), txt("2º", 2600, 2169), txt("PAVIMENTO", 2605, 2169),
    txt("L2", 2608, 2193), txt("733,30", 2691, 2202), txt("1º", 2597, 2208), txt("PAVIMENTO", 2602, 2208),
    txt("L1", 2608, 2240), txt("729,20", 2691, 2250), txt("TÉRREO", 2600, 2258),
    txt("L0", 2608, 2290), txt("726,20", 2691, 2300), txt("1º SUBSOLO", 2600, 2308),
  ];
  const niveis = lerCorte(textos);
  assert.deepEqual(niveis.map(n => [n.nome, n.cota, n.laje]), [
    ["1º SUBSOLO", 726.2, 0], ["TERREO", 729.2, 1], ["1º PAVIMENTO", 733.3, 2], ["2º PAVIMENTO", 736.15, 3],
    ["24º PAVIMENTO", 794.45, 25], ["BARRILETE", 797.11, 26], ["COBERTURA", 801.91, undefined],
  ]);
  const { pavimentos, lajes } = pavimentosDoCorte(niveis);
  // entre o 2º e o 24º o exemplo pula os andares: altura absurda cai no padrão de 3 m
  assert.deepEqual(pavimentos.map(p => `${p.id}:${p.altura}`), ["ss1:3", "terreo:4.1", "p1:2.85", "p2:3", "p24:2.66", "barrilete:4.8"]);
  assert.equal(lajes[3], "p2");
  assert.equal(lajes[25], "p24");
});

test("carimbo: tipo pelo código do arquivo, torres, lajes e revisão pelo título do carimbo", () => {
  const c = lerCarimbo("5875-AU02-EST-LO-304-MOD-TIA_R04.pdf", [
    txt("TORRE 1 - IMPLANTAÇÃO DE 1ª FIADA DO", 2837, 2058, 14), txt("PAVIMENTO TIPO (L3 A L5)", 2837, 2073, 14),
    txt("TORRE 1 - ELEVADOR 07", 971, 1828, 6), txt("Escala", 3205, 2317),
  ]);
  assert.deepEqual({ ...c, arquivo: undefined }, {
    arquivo: undefined, disciplina: "EST", tipo: "modulacao", torres: [1],
    titulo: "TORRE 1 - IMPLANTAÇÃO DE 1ª FIADA DO PAVIMENTO TIPO (L3 A L5)", lajes: [3, 5], revisao: "R04",
  });
  const e = lerCarimbo("5875-AU02-EST-LO-691-ELV-TIA-R01.pdf", [txt("TORRES 1 E 3 - ELEVAÇÕES DAS PAREDES ESTRUTURAIS DO PAVIMENTO TIPO (L3 A L24)", 100, 100, 14)]);
  assert.deepEqual([e.tipo, e.torres, e.lajes, e.revisao], ["elevacao", [1, 3], [3, 24], "R01"]);
});

test("o que falta: aponta lajes sem 1ª fiada e disciplinas ausentes", () => {
  const c = (tipo: Carimbo["tipo"], torres: number[], lajes: [number, number] | null): Carimbo => ({ arquivo: "x.pdf", disciplina: "EST", tipo, torres, titulo: null, lajes, revisao: null });
  const lista = checklistProjetos([c("modulacao", [2], [3, 12]), c("forma", [2], [4, 25]), c("elevacao", [1, 3], null)], 2, Array.from({ length: 23 }, (_, i) => i + 3));
  const item = (nome: string) => lista.find(i => i.item.startsWith(nome))!;
  assert.equal(item("Fôrma").ok, true);
  assert.equal(item("1ª fiada").ok, false);
  assert.match(item("1ª fiada").detalhe, /L13–L25/);
  assert.equal(item("Elevações").ok, false);
  assert.equal(item("Arquitetura").ok, false);
});

test("junta de dilatação: cota em pé = junta horizontal na altura do texto", () => {
  const j = juntaDaPrancha([txt("2 (JUNTA DE DILATAÇÃO)", 884, 1418, 6, true), txt("2 (JUNTA DE DILATAÇÃO)", 292, 1422, 6, true)], 75);
  assert.equal(j?.horizontal, true);
  assert.ok(Math.abs(j!.valor - 1420 * K) < 0.01);
  assert.equal(juntaDaPrancha([txt("JUNTA A PRUMO", 10, 10)], 75), null);
});

test("pacote: monta a torre com contorno em metros, pavimentos do corte e quantitativo por faixa", () => {
  const h = (x0: number, x1: number, y: number): ParedeCm => ({ a: [x0, y], b: [x1, y], esp: 14 });
  const v = (x: number, y0: number, y1: number): ParedeCm => ({ a: [x, y0], b: [x, y1], esp: 14 });
  const paredes = [h(0, 2000, 0), v(2000, 0, 1000), h(0, 2000, 1000), v(0, 0, 1000)];
  const carimbo: Carimbo = { arquivo: "MOD.pdf", disciplina: "EST", tipo: "modulacao", torres: [1], titulo: "TORRE 1 - IMPLANTAÇÃO (L3 A L4)", lajes: [3, 4], revisao: null };
  const prancha: PranchaLida = {
    carimbo, escala: 75, paredes, totalBlocos: 10, contorno: contornoDasParedes(paredes), junta: { horizontal: false, valor: 1000 },
    quantitativo: [{ nome: "Bloco 39 (39×19×14)", categoria: "estrutural", comp: 39, esp: 14, qtd: 10 }],
    niveis: [{ nome: "1º PAVIMENTO", cota: 0, laje: 2 }, { nome: "2º PAVIMENTO", cota: 2.65, laje: 3 }, { nome: "3º PAVIMENTO", cota: 5.3, laje: 4 }, { nome: "COBERTURA", cota: 7.95 }],
  };
  const r = montarTorreDoPacote([prancha], 1, "2026-10-29");
  assert.ok(r);
  assert.deepEqual(r.pavimentos.map(p => p.id), ["p1", "p2", "p3"]);
  const xs = r.contorno.map(p => p[0]);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 20) < 0.3);
  assert.deepEqual(r.projeto.quantitativos[0].pavimentos, ["p2", "p3"]);
  assert.equal(r.projeto.quantitativos[0].metrosPorEspessura["14"], 60);
  assert.ok(r.junta && Math.abs(r.junta.a[0]) < 0.3, "junta vertical no meio da torre");
});

test("zip: lê o que o criarZip grava (store) e ignora pastas e arquivos de sistema", async () => {
  const enc = new TextEncoder();
  const z = criarZip([{ nome: "a.pdf", bytes: enc.encode("pdf") }, { nome: ".DS_Store", bytes: enc.encode("x") }, { nome: "b.txt", bytes: enc.encode("t") }]);
  const lidos = await lerZip(z, n => /\.pdf$/i.test(n));
  assert.deepEqual(lidos.map(e => [e.nome, new TextDecoder().decode(e.bytes)]), [["a.pdf", "pdf"]]);
  await assert.rejects(lerZip(enc.encode("não é zip")), /ZIP inválido/);
});

test("medição: blocos da torre (faixas × pavimentos) e o que já foi assentado pela escadinha", async () => {
  const { resumoBlocos, pesoDosLados } = await import("./projetoVetorial.ts");
  const projeto: ProjetoImportado = {
    importadoEm: "2026-10-29", torre: 1, escala: 75, pranchas: [], checklist: [],
    quantitativos: [
      { arquivo: "a", lajes: [3, 4], pavimentos: ["p2", "p3"], metrosPorEspessura: { "14": 100, "9": 20 }, itens: [
        { nome: "Bloco 39", categoria: "estrutural", comp: 39, esp: 14, qtd: 100 }, { nome: "Bloco 39×9", categoria: "vedacao", comp: 39, esp: 9, qtd: 10 }] },
      { arquivo: "b", lajes: [5, 5], pavimentos: ["p4"], metrosPorEspessura: { "14": 100 }, itens: [{ nome: "Bloco 39", categoria: "estrutural", comp: 39, esp: 14, qtd: 120 }] },
    ],
  };
  const r = resumoBlocos(projeto, p => (p === "p2" ? 1 : p === "p4" ? 0.5 : 0));
  assert.deepEqual(r.linhas.map(l => [l.categoria, l.total, l.executado]), [["estrutural", 320, 160], ["vedacao", 20, 10]]);
  assert.equal(r.total, 340);
  assert.equal(r.pavimentos, 3);
  assert.equal(r.metros, 340);
  const peso = pesoDosLados([{ a: [0, 0], b: [30, 0] }, { a: [0, 10], b: [10, 10] }], p => (p[1] > 5 ? "B" : "A"));
  assert.deepEqual(peso, { A: 0.75, B: 0.25 });
});
