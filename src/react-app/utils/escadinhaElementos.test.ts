import assert from "node:assert/strict";
import { test } from "node:test";

import type { ParedeReal, Ponto, RotuloVao } from "./escadinha.ts";
import { lerComodos, unirContornos } from "./escadinhaComodos.ts";
import { MODELO_CURY, atividadesEmOrdem, chaveCelula, type Grade } from "./escadinhaCury.ts";
import { chaveIcone, elementoDaAtividade, elementosDoFiltro, elementosPorPavimento, iconeDaAtividade, mapaDeElementos, tudoPronto } from "./escadinhaElementos.ts";
import { pecasDaPlanta, pontoDentro } from "./escadinhaPecas.ts";
import { classificarPlanta, tipoDoRotulo } from "./escadinhaUsos.ts";

const P = (x1: number, y1: number, x2: number, y2: number, esp = 0.14): ParedeReal => ({ a: [x1, y1], b: [x2, y2], esp });
const R = (w: number, h: number, x: number, y: number, vertical = false): RotuloVao => ({ w, h, p: [x, y], vertical });

/**
 * Pavimento de teste (16 × 9 m): corredor no meio (y 3,75–5,25), dois apartamentos em cima e dois embaixo, cada um com
 * sala (entrada de 0,9 m) e quarto (porta de 0,8 m). Os rótulos do projeto dizem o que é cada vão; em cima, à esquerda,
 * uma porta-sacada de 1,41 m na fachada oeste e uma janela de 1,21 m na fachada norte.
 */
function pavimento(): { paredes: ParedeReal[]; contorno: Ponto[]; rotulos: RotuloVao[] } {
  const paredes: ParedeReal[] = [
    P(0, 0, 16, 0), P(16, 0, 16, 9), P(16, 9, 0, 9), P(0, 9, 0, 6.2), P(0, 4.8, 0, 0),
    P(0, 5.25, 2, 5.25), P(2.9, 5.25, 10, 5.25), P(10.9, 5.25, 16, 5.25),
    P(0, 3.75, 2, 3.75), P(2.9, 3.75, 10, 3.75), P(10.9, 3.75, 16, 3.75),
    P(8, 5.25, 8, 9), P(8, 0, 8, 3.75),
    P(0, 7, 5, 7), P(5.8, 7, 8, 7), P(8, 7, 13, 7), P(13.8, 7, 16, 7),
    P(0, 2, 5, 2), P(5.8, 2, 8, 2), P(8, 2, 13, 2), P(13.8, 2, 16, 2),
  ];
  const rotulos = [
    R(91, 216, 2.45, 5.6), R(91, 216, 10.45, 5.6), R(91, 216, 2.45, 3.4), R(91, 216, 10.45, 3.4),
    R(81, 216, 5.4, 7.4), R(81, 216, 13.4, 7.4), R(81, 216, 5.4, 1.6), R(81, 216, 13.4, 1.6),
    // porta-sacada no vão da fachada oeste (y 4,8–6,2), rótulo fora da torre
    R(141, 236, -0.9, 5.5),
    // janela do quarto de cima, na fachada norte: texto em pé, fora da torre
    R(121, 121, 3, 9.9, true),
  ];
  return { paredes, contorno: [[0, 0], [16, 0], [16, 9], [0, 9]], rotulos };
}

test("tipo do rótulo: porta, porta-sacada, janela e visita de shaft", () => {
  assert.equal(tipoDoRotulo({ w: 81, h: 216 }), "porta");
  assert.equal(tipoDoRotulo({ w: 116, h: 216 }), "porta");
  assert.equal(tipoDoRotulo({ w: 141, h: 236 }), "porta_sacada");
  assert.equal(tipoDoRotulo({ w: 121, h: 121 }), "janela");
  assert.equal(tipoDoRotulo({ w: 41, h: 41 }), "visita");
});

test("rótulos do projeto dão o uso dos cômodos, o tipo das portas, janelas, portas-sacada e sacadas", () => {
  const { paredes, contorno, rotulos } = pavimento();
  const l = lerComodos(paredes, contorno, rotulos);
  assert.equal(l.apartamentos.length, 4);
  const usos = l.comodos.filter(c => c.apto).map(c => c.uso).sort();
  assert.deepEqual(usos, ["dormitorio", "dormitorio", "dormitorio", "dormitorio", "sala", "sala", "sala", "sala"]);
  assert.equal(l.aberturas.filter(o => o.tipo === "entrada").length, 4);
  assert.equal(l.aberturas.filter(o => o.tipo === "dormitorio").length, 4);
  assert.equal(l.comodos.find(c => c.uso === "hall")?.uso, "hall");

  const janela = l.vaos.find(v => v.tipo === "janela");
  assert.ok(janela, "achou a janela");
  assert.equal(janela.peitoril, 1.15, "a janela de 121 termina com a porta-sacada (236)");
  assert.ok(Math.abs(janela.a[1] - 9) < 0.01 && Math.abs(janela.b[1] - 9) < 0.01, "na fachada norte");
  assert.ok(Math.abs(Math.abs(janela.b[0] - janela.a[0]) - 1.21) < 0.01);

  const sacada = l.vaos.find(v => v.tipo === "porta_sacada");
  assert.ok(sacada, "achou a porta-sacada");
  assert.equal(sacada.peitoril, 0);
  assert.equal(l.sacadas.length, 1);
  // sacada fora da torre, na frente da porta, com três bordas livres para o gradil
  assert.ok(l.sacadas[0].contorno.every(([x]) => x <= 0.001));
  assert.equal(l.sacadas[0].bordas.length, 3);
});

test("vão que fecha um shaft é fechamento (drywall), não porta; nota do elevador marca o poço e a frente dele", () => {
  const comodos = [
    { id: "h", contorno: [[0, 0], [10, 0], [10, 2], [0, 2]] as Ponto[], area: 20, tipo: "hall" as const },
    { id: "s", contorno: [[0, 2], [1, 2], [1, 3], [0, 3]] as Ponto[], area: 1, tipo: "shaft" as const },
    { id: "e", contorno: [[3, 2], [6, 2], [6, 5], [3, 5]] as Ponto[], area: 9, tipo: "outro" as const },
  ];
  const aberturas = [
    { a: [0.2, 2] as Ponto, b: [0.8, 2] as Ponto, largura: 0.6, entre: ["s", "h"] as [string, string] },
    { a: [4, 2] as Ponto, b: [5.3, 2] as Ponto, largura: 1.3, tipo: "elevador" as const },
  ];
  const paredes = [P(3, 2, 4, 2), P(5.3, 2, 6, 2), P(3, 2, 3, 5), P(6, 2, 6, 5)];
  const r = classificarPlanta(comodos, aberturas, paredes, [[0, 0], [10, 0], [10, 6], [0, 6]], [], [[4.5, 3.5]]);
  assert.equal(r.aberturas[0].tipo, "shaft");
  assert.equal(r.comodos.find(c => c.id === "e")?.uso, "elevador");
  assert.equal(r.paredes.filter(p => p.elevador).length, 2, "só os dois trechos da frente do poço");
});

test("contorno do apartamento cobre todos os cômodos mesmo com parede grossa entre eles", () => {
  const a: Ponto[] = [[0, 0], [4, 0], [4, 3], [0, 3]];
  const b: Ponto[] = [[0, 3.3], [4, 3.3], [4, 6], [0, 6]]; // 30 cm entre eles
  const u = unirContornos([a, b]);
  const lim = { minY: Math.min(...u.map(p => p[1])), maxY: Math.max(...u.map(p => p[1])) };
  assert.ok(lim.minY <= 0.05 && lim.maxY >= 5.95, `cobre os dois: ${JSON.stringify(lim)}`);
});

test("cada atividade da Cury acrescenta a sua peça: 71 elementos diferentes e o resto vira ícone no chão", () => {
  const lista = atividadesEmOrdem(MODELO_CURY).map(({ atividade }) => elementoDaAtividade(atividade.nome, atividade.camada));
  const fisicos = lista.filter(Boolean);
  assert.equal(lista.length, 96);
  assert.equal(new Set(fisicos).size, fisicos.length, "nenhuma peça repetida entre atividades");
  assert.equal(fisicos.length, 71);
  assert.equal(elementoDaAtividade("ALVENARIA + ALVENARIA FRISADA SHAFT"), "alvenaria");
  assert.equal(elementoDaAtividade("CAIXINHAS NA ALVENARIA"), "caixinhas");
  assert.equal(elementoDaAtividade("GRADIL"), "gradil");
  assert.equal(elementoDaAtividade("BATENTE PCF (PORTA CORTA FOGO)"), "pcf");
  assert.equal(elementoDaAtividade("PRUMADAS GÁS"), "prumada_gas");
  assert.equal(elementoDaAtividade("PENTE FINO ESCADA"), null);
  assert.equal(iconeDaAtividade("TESTE DE ELÉTRICA"), "⚡");
  assert.equal(iconeDaAtividade("LIMPEZA FINA"), "🧹");
});

test("estado por pavimento|lado: elemento da atividade e um ícone por atividade sem peça", () => {
  const ids = new Map(atividadesEmOrdem(MODELO_CURY).map(({ atividade }) => [atividade.nome, atividade.id]));
  const grade: Grade = {
    [chaveCelula("p2", "A", ids.get("GRADIL")!)]: { s: "E" },
    [chaveCelula("p2", "A", ids.get("ALVENARIA + ALVENARIA FRISADA SHAFT")!)]: { s: "X" },
    [chaveCelula("p2", "B", ids.get("PENTE FINO ESCADA")!)]: { s: "E" },
    [chaveCelula("p2", "B", ids.get("PEITORIL")!)]: { s: "N" },
  };
  const m = elementosPorPavimento(MODELO_CURY, grade);
  assert.equal(m.get("p2|A")?.get("gradil"), "E");
  assert.equal(m.get("p2|A")?.get("alvenaria"), "X");
  assert.equal(m.get("p2|A")?.has("muretas"), false, "alvenaria não sobe a mureta nem o fechamento do elevador");
  assert.equal(m.get("p2|B")?.get(chaveIcone(ids.get("PENTE FINO ESCADA")!)), "E");
  assert.equal(m.get("p2|B")?.has("peitoril"), false, "não se aplica não desenha");
  const ciclo1 = elementosDoFiltro(MODELO_CURY, { tipo: "ciclo", id: MODELO_CURY.ciclos[0].id });
  assert.ok(ciclo1?.has("gradil") && ciclo1.has("alvenaria") && !ciclo1.has("caixilhos"));
  assert.equal(tudoPronto(MODELO_CURY).has("escoramento"), false);
  assert.equal([...mapaDeElementos(MODELO_CURY).values()].filter(e => e.icone).length, 25);
});

test("peças: a alvenaria recorta a janela (peitoril e verga), o gradil fica na borda da sacada", () => {
  const { paredes, contorno, rotulos } = pavimento();
  const l = lerComodos(paredes, contorno, rotulos);
  const pecas = pecasDaPlanta({ ...l, contorno, altura: 2.63 });
  const janela = l.vaos.find(v => v.tipo === "janela")!;
  const xMeio = (janela.a[0] + janela.b[0]) / 2;
  const naJanela = (pecas.alvenaria ?? []).filter(p => p.k === "caixa" && Math.abs(p.y - 9) < 0.1 && Math.abs(p.x - xMeio) < 0.05);
  assert.deepEqual(naJanela.map(p => p.k === "caixa" ? [p.z, Math.round(p.h * 100) / 100] : []).sort((a, b) => a[0] - b[0]), [[0, 1.15], [2.36, 0.27]], "peitoril embaixo e verga em cima");
  assert.ok((pecas.gradil ?? []).length > 10, "gradil com montantes");
  assert.ok((pecas.gradil ?? []).every(p => p.k !== "caixa" || p.x <= 0.01), "gradil só na sacada, fora da torre");
  assert.equal((pecas.caixilhos ?? []).filter(p => p.k === "caixa" && p.cor === "vidro").length, 1);
  assert.equal((pecas.portas_sacada ?? []).filter(p => p.k === "caixa" && p.cor === "vidro").length, 1);
  assert.equal((pecas.portas_madeira ?? []).length, 8, "4 entradas e 4 quartos");
  assert.equal(pecas.muretas, undefined, "sem elevador nem shaft, nada de mureta");
  // filtro por apartamento: só as peças dele
  const ap = l.apartamentos[0];
  const doApto = pecasDaPlanta({ ...l, contorno, altura: 2.63, filtro: pt => l.comodos.some(c => c.apto === ap.id && Math.hypot(pt[0] - pontoDentro(c.contorno)[0], pt[1] - pontoDentro(c.contorno)[1]) < 6) });
  assert.ok((doApto.portas_madeira ?? []).length < 8);
});
