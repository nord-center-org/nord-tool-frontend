import assert from "node:assert/strict";
import { test } from "node:test";

import type { ParedeReal, Ponto } from "./escadinha.ts";
import { aberturasDasParedes, completarComodos, lerComodos } from "./escadinhaComodos.ts";
import { corteConsolidado, ehModulacaoTipo, precisaDesenho, revisaoDoArquivo, revisoesVigentes, torresDoCodigo } from "./projetoVetorial.ts";
import { criarZip, extrairDoZip, indiceZip } from "./zip.ts";

const P = (x1: number, y1: number, x2: number, y2: number, esp = 0.14): ParedeReal => ({ a: [x1, y1], b: [x2, y2], esp });

/**
 * Pavimento de teste (16 × 9 m): corredor de 1,5 m no meio (y 3,75–5,25), dois apartamentos em cima e dois embaixo,
 * cada um com sala (porta de 0,9 m para o corredor) e quarto (porta de 0,8 m para a sala).
 */
function pavimento(): { paredes: ParedeReal[]; contorno: Ponto[] } {
  const paredes: ParedeReal[] = [
    // fachada
    P(0, 0, 16, 0), P(16, 0, 16, 9), P(16, 9, 0, 9), P(0, 9, 0, 0),
    // corredor: paredes com as portas de entrada (vão de 0,9 m) em x 2–2,9 e 10–10,9
    P(0, 5.25, 2, 5.25), P(2.9, 5.25, 10, 5.25), P(10.9, 5.25, 16, 5.25),
    P(0, 3.75, 2, 3.75), P(2.9, 3.75, 10, 3.75), P(10.9, 3.75, 16, 3.75),
    // divisa entre apartamentos (x = 8)
    P(8, 5.25, 8, 9), P(8, 0, 8, 3.75),
    // sala × quarto (y = 7 em cima, y = 2 embaixo), com porta de 0,8 m em x 5–5,8 e 13–13,8
    P(0, 7, 5, 7), P(5.8, 7, 8, 7), P(8, 7, 13, 7), P(13.8, 7, 16, 7),
    P(0, 2, 5, 2), P(5.8, 2, 8, 2), P(8, 2, 13, 2), P(13.8, 2, 16, 2),
  ];
  return { paredes, contorno: [[0, 0], [16, 0], [16, 9], [0, 9]] };
}

test("vãos: portas entre trechos da mesma parede (0,55 a 1,1 m); corredor não vira porta", () => {
  const { paredes } = pavimento();
  const vaos = aberturasDasParedes(paredes);
  const largos = vaos.map(v => Math.round(v.largura * 10) / 10).sort();
  assert.equal(vaos.filter(v => Math.abs(v.largura - 0.9) < 0.01).length, 4, "4 entradas de 0,9 m");
  assert.equal(vaos.filter(v => Math.abs(v.largura - 0.8) < 0.01).length, 4, "4 portas de quarto de 0,8 m");
  assert.ok(largos.every(l => l <= 1.1), "nada maior que porta");
});

test("cômodos: hall pelo número de portas e quatro apartamentos com sala + quarto", () => {
  const { paredes, contorno } = pavimento();
  const r = lerComodos(paredes, contorno);
  const halls = r.comodos.filter(c => c.tipo === "hall");
  assert.equal(halls.length, 1);
  assert.ok(Math.abs(halls[0].area - 16 * 1.36) < 1.5, `hall com ~21 m² livres (veio ${halls[0].area})`);
  assert.equal(r.apartamentos.length, 4);
  for (const ap of r.apartamentos) assert.equal(r.comodos.filter(c => c.apto === ap.id).length, 2, `${ap.nome}: sala + quarto`);
  assert.deepEqual(r.apartamentos.map(a => a.nome), ["Apto 01", "Apto 02", "Apto 03", "Apto 04"]);
  assert.equal(r.aberturas.filter(o => o.entrada).length, 4, "as 4 entradas dão para o hall");
});

test("completarComodos: troca a malha de exemplo pelos apartamentos reais e mantém os desenhados à mão", () => {
  const { paredes, contorno } = pavimento();
  const t = completarComodos({ nome: "T", contorno, pavimentos: [], origem: "projeto", paredes });
  assert.equal(t.apartamentos?.length, 4);
  assert.ok(t.comodos?.length);
  const mao = { id: "x", nome: "Apto 99", contorno: [[0, 0], [1, 0], [1, 1]] as Ponto[], lado: "A" as const };
  const t2 = completarComodos({ nome: "T", contorno, pavimentos: [], origem: "projeto", paredes, apartamentos: [mao] });
  assert.deepEqual(t2.apartamentos, [mao]);
  assert.equal(completarComodos(t), t, "já tem cômodos: não refaz");
});

test("revisões: fica a mais nova de cada prancha (R04 > T04 > R03)", () => {
  assert.deepEqual(revisaoDoArquivo("5875-AU02-EST-LO-304-MOD-TIA_R04.pdf"), { base: "5875-AU02-EST-LO-304-MOD-TIA", ordem: 9 });
  const { vigentes, antigas } = revisoesVigentes(
    ["X-304-MOD-TIA_R03.pdf", "X-304-MOD-TIA_R04.pdf", "X-314-MOD-TIB_T04.pdf", "X-314-MOD-TIB_R03.pdf", "solto.pdf"], n => n);
  assert.deepEqual(vigentes, ["X-304-MOD-TIA_R04.pdf", "X-314-MOD-TIB_T04.pdf", "solto.pdf"]);
  assert.equal(antigas.length, 2);
});

test("torre pelo código do arquivo e quais pranchas precisam ser desenhadas", () => {
  assert.deepEqual(torresDoCodigo(["ARQ", "105", "TAC", "TIP"]), [1, 3]);
  assert.deepEqual(torresDoCodigo(["EST", "314", "MOD", "TIB"]), [2]);
  assert.deepEqual(torresDoCodigo(["ARQ", "114", "TOA", "ELV"]), [1]);
  assert.equal(precisaDesenho("5875-AU02-EST-LO-304-MOD-TIA_R04.pdf"), true);
  assert.equal(precisaDesenho("5875-AU02-ARQ-LO-105-TAC-TIP-R03.pdf"), false);
  assert.equal(precisaDesenho("5875-AU02-HID-LO-103-TOA-TIP-R00.pdf"), false);
  assert.equal(precisaDesenho("planta qualquer.pdf"), true);
});

test("corte consolidado: vota o nome por cota e corrige o 1º pavimento escrito como térreo", () => {
  const a = [
    { nome: "TERREO", cota: 729.2, laje: 1 }, { nome: "TERREO", cota: 733.3, laje: 2 }, { nome: "2º PAVIMENTO", cota: 736.15, laje: 3 },
  ];
  const b = [{ nome: "TERREO", cota: 729.2 }, { nome: "TERREO", cota: 733.3 }, { nome: "2º PAVIMENTO", cota: 736.15 }];
  const c = corteConsolidado([a, b]);
  assert.deepEqual(c.map(n => n.nome), ["TERREO", "1º PAVIMENTO", "2º PAVIMENTO"]);
  assert.equal(c[1].laje, 2);
});

test("zip: índice e extração por partes (sem carregar o arquivo inteiro)", async () => {
  const enc = new TextEncoder();
  const z = criarZip([{ nome: "pasta/a.pdf", bytes: enc.encode("%PDF a") }, { nome: "b.dwg", bytes: enc.encode("dwg") }]);
  const blob = new Blob([z]);
  const indice = await indiceZip(blob);
  assert.deepEqual(indice.map(e => e.nome), ["a.pdf", "b.dwg"]);
  assert.equal(new TextDecoder().decode(await extrairDoZip(blob, indice[0])), "%PDF a");
  await assert.rejects(indiceZip(new Blob([enc.encode("não é zip")])), /ZIP inválido/);
});

test("base do modelo: só a 1ª fiada do pavimento tipo (subsolo, térreo e cobertura não servem)", () => {
  const p = (arquivo: string, titulo: string | null) => ({
    carimbo: { arquivo, disciplina: "EST", tipo: "modulacao" as const, torres: [1], titulo, lajes: null, revisao: null },
    escala: 75, niveis: [], paredes: [], quantitativo: [], totalBlocos: 0, contorno: null, junta: null,
  });
  assert.equal(ehModulacaoTipo(p("X-304-MOD-TIA_R04.pdf", "TORRE 1 - IMPLANTAÇÃO DE 1ª FIADA DO PAVIMENTO TIPO (L3 A L5)")), true);
  assert.equal(ehModulacaoTipo(p("X-301-MOD-PSA_R06.pdf", "TORRE 1 - IMPLANTAÇÃO DE 1ª FIADA E CHUMBADORES DO PRIMEIRO SUBSOLO (L0)")), false);
  assert.equal(ehModulacaoTipo(p("X-302-MOD-TEA_R04.pdf", "TORRE 1 - IMPLANTAÇÃO DE 1ª FIADA DO TÉRREO (L1)")), false);
  assert.equal(ehModulacaoTipo(p("X-309-MOD-COA_R01.pdf", "TORRE 1 - IMPLANTAÇÃO DE 1ª FIADA DO BARRILETE E COBERTURA (L26)")), false);
  assert.equal(ehModulacaoTipo(p("X-314-MOD-TIB_T04.pdf", null)), true, "sem título: pelo código TIB");
});
