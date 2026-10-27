import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alternarStatus, area, contornoEmMetros, cotas, escadinhaExemplo, gerarEscadinha, lerEscadinha, lerPavimentosDoTexto,
  montarPavimentos, opcoesDaTorre, ortogonalizar, pilares, progresso, reaproveitarCiclos, salvarEscadinha, simplificar,
  statusCiclo, CONTORNO_EXEMPLO, type Ponto,
} from "./escadinha.ts";
import { detectarContorno } from "./escadinhaPlanta.ts";

test("lerPavimentosDoTexto: intervalo de pavimentos tipo e pavimentos especiais", () => {
  const lido = lerPavimentosDoTexto("PLANTA CHAVE PAV. TIPO – TORRE 02 (1º AO 20º PAVIMENTO) · TÉRREO · BARRILETE / CASA DE MÁQUINAS");
  assert.equal(lido.tipos, 20);
  assert.equal(lido.terreo, true);
  assert.equal(lido.barrilete, true);
  assert.equal(lido.cobertura, false);
  assert.equal(lido.subsolos, 0);
});

test("lerPavimentosDoTexto: outras formas de escrever", () => {
  assert.equal(lerPavimentosDoTexto("PAVIMENTO TIPO (18X)").tipos, 18);
  assert.equal(lerPavimentosDoTexto("EDIFÍCIO COM 12 PAVIMENTOS").tipos, 12);
  assert.equal(lerPavimentosDoTexto("2º PAV · 3º PAV · 9º PAV").tipos, 9);
  assert.equal(lerPavimentosDoTexto("2º SUBSOLO e 1º SUBSOLO, COBERTURA").subsolos, 2);
  assert.equal(lerPavimentosDoTexto("PLANTA DO SUBSOLO").subsolos, 1);
  assert.equal(lerPavimentosDoTexto("sem informação").tipos, null);
});

test("montarPavimentos empilha de baixo para cima e cotas põem o térreo no zero", () => {
  const p = montarPavimentos({ tipos: 3, subsolos: 2, terreo: true, mezanino: false, cobertura: true, barrilete: true }, CONTORNO_EXEMPLO);
  assert.deepEqual(p.map(x => x.sigla), ["SS2", "SS1", "T", "1", "2", "3", "COB", "BAR"]);
  const c = cotas(p);
  assert.equal(c[2], 0);
  assert.equal(c[0], -6);
  assert.ok(p[7].contorno && Math.abs(area(p[7].contorno)) < Math.abs(area(CONTORNO_EXEMPLO)));
  assert.deepEqual(opcoesDaTorre({ nome: "", contorno: CONTORNO_EXEMPLO, pavimentos: p, origem: "exemplo" }).tipos, 3);
});

test("ortogonalizar endireita lados quase retos de um L", () => {
  const torto: Ponto[] = [[0, 0.3], [10, 0], [10.2, 5], [5, 5.2], [4.9, 10], [0.1, 10]];
  const reto = ortogonalizar(torto);
  assert.equal(reto.length, 6);
  for (let i = 0; i < reto.length; i++) {
    const a = reto[i], b = reto[(i + 1) % reto.length];
    assert.ok(a[0] === b[0] || a[1] === b[1], `lado ${i} não é reto`);
  }
});

test("simplificar tira os degraus pequenos", () => {
  const escada: Ponto[] = [[0, 0], [5, 0], [5, 0.2], [10, 0.2], [10, 10], [0, 10]];
  assert.equal(simplificar(escada, 0.5).length, 4);
});

test("contornoEmMetros centra, escala pela largura e inverte o eixo y", () => {
  const m = contornoEmMetros([[100, 100], [300, 100], [300, 200], [100, 200]], 20);
  const xs = m.map(p => p[0]), ys = m.map(p => p[1]);
  assert.equal(Math.max(...xs) - Math.min(...xs), 20);
  assert.equal(Math.max(...ys) - Math.min(...ys), 10);
  assert.ok(area(m) > 0);
});

test("pilares ficam dentro do L", () => {
  const ps = pilares(CONTORNO_EXEMPLO);
  assert.ok(ps.length >= 6);
});

test("escadinha: progresso, status e troca de status", () => {
  const p = montarPavimentos({ tipos: 4, subsolos: 0, terreo: true, mezanino: false, cobertura: false, barrilete: false }, CONTORNO_EXEMPLO);
  const ciclos = gerarEscadinha(p, "2026-10-01", "2026-10-20");
  assert.equal(ciclos.length, 5);
  assert.equal(ciclos[1].inicio, "2026-10-08");
  assert.equal(statusCiclo(ciclos[4]), "pendente");
  assert.equal(statusCiclo(ciclos[0]), "finalizado");
  assert.equal(statusCiclo(ciclos[2]), "andamento");
  const id = ciclos[4].atividades[0].id;
  const depois = alternarStatus(ciclos, id);
  assert.equal(depois[4].atividades[0].status, "andamento");
  assert.equal(progresso(depois[4]), 0.5 / 8);
  const refeito = reaproveitarCiclos(gerarEscadinha(p, "2026-10-01"), depois);
  assert.equal(refeito[4].atividades[0].status, "andamento");
});

test("armazenamento da escadinha por obra", () => {
  const dados = new Map<string, string>();
  const storage = { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v) };
  assert.equal(lerEscadinha(storage, 7), null);
  const e = escadinhaExemplo("2026-10-27");
  salvarEscadinha(storage, 7, e);
  assert.equal(lerEscadinha(storage, 7)?.torre.pavimentos.length, e.torre.pavimentos.length);
  assert.equal(lerEscadinha(storage, 8), null);
});

/** Desenha uma planta sintética: moldura da prancha, contorno em L com uma falha, texto solto. */
function plantaSintetica(w: number, h: number) {
  const lum = new Uint8Array(w * h).fill(255);
  const linha = (x1: number, y1: number, x2: number, y2: number) => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) lum[y * w + x] = 0;
  };
  linha(5, 5, w - 6, 5); linha(5, h - 6, w - 6, h - 6); linha(5, 5, 5, h - 6); linha(w - 6, 5, w - 6, h - 6);
  // L: (100,100)-(500,100)-(500,400)-(300,400)-(300,250)-(100,250)
  linha(100, 100, 500, 101); linha(500, 100, 501, 400); linha(300, 400, 500, 401);
  linha(300, 250, 301, 400); linha(100, 250, 300, 251); linha(100, 100, 101, 180); linha(100, 182, 101, 250);
  // paredes internas e "texto"
  linha(200, 100, 201, 250); linha(300, 100, 301, 250);
  for (let i = 0; i < 30; i++) linha(560 + i * 3, 450, 561 + i * 3, 456);
  return lum;
}

test("detectarContorno acha o L ignorando moldura, paredes internas e texto", () => {
  const w = 700, h = 500;
  const r = detectarContorno(plantaSintetica(w, h), w, h);
  assert.ok(r, "não achou a torre");
  assert.equal(r.contorno.length, 6);
  const xs = r.contorno.map(p => p[0]), ys = r.contorno.map(p => p[1]);
  assert.ok(Math.abs(Math.min(...xs) - 100) <= 4 && Math.abs(Math.max(...xs) - 502) <= 4);
  assert.ok(Math.abs(Math.min(...ys) - 100) <= 4 && Math.abs(Math.max(...ys) - 402) <= 4);
});

test("detectarContorno respeita o recorte e devolve coordenadas da imagem inteira", () => {
  const w = 700, h = 500;
  const r = detectarContorno(plantaSintetica(w, h), w, h, { recorte: { x: 80, y: 80, largura: 450, altura: 350 } });
  assert.ok(r);
  assert.ok(Math.abs(Math.min(...r.contorno.map(p => p[0])) - 100) <= 4);
  assert.equal(detectarContorno(new Uint8Array(w * h).fill(255), w, h), null);
});
