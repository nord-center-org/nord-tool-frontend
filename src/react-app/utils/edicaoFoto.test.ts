import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ajustarRecorte, cabecaSeta, dimensoesGiradas, girarPonto, girarRetangulo, marcacaoValida, proximaRotacao, recorteMudou, retanguloDe,
} from "./edicaoFoto.ts";

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("girar 90° no sentido horário, quatro vezes volta ao início", () => {
  assert.deepEqual(girarPonto({ x: 0, y: 0 }), { x: 1, y: 0 });
  assert.deepEqual(girarPonto({ x: 1, y: 0 }), { x: 1, y: 1 });
  const r = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
  const g = girarRetangulo(r);
  assert.ok(perto(g.x, 0.4) && perto(g.y, 0.1) && perto(g.w, 0.4) && perto(g.h, 0.3));
  const volta = girarRetangulo(girarRetangulo(girarRetangulo(g)));
  for (const k of ["x", "y", "w", "h"] as const) assert.ok(perto(volta[k], r[k]));
  assert.equal(proximaRotacao(270), 0);
  assert.deepEqual(dimensoesGiradas(400, 300, 90), { largura: 300, altura: 400 });
  assert.deepEqual(dimensoesGiradas(400, 300, 180), { largura: 400, altura: 300 });
});

test("recorte por arrasto fica dentro da imagem e com tamanho mínimo", () => {
  assert.deepEqual(retanguloDe({ x: 0.8, y: 0.9 }, { x: 0.2, y: -0.5 }), { x: 0.2, y: 0, w: 0.6000000000000001, h: 0.9 });
  const r = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
  const movido = ajustarRecorte(r, "mover", 0.9, -0.9);
  assert.ok(perto(movido.x, 0.5) && perto(movido.y, 0) && perto(movido.w, 0.5));
  const encolhido = ajustarRecorte(r, "se", -0.9, -0.9);
  assert.ok(perto(encolhido.w, 0.05) && perto(encolhido.h, 0.05));
  const crescido = ajustarRecorte(r, "no", -1, -1);
  assert.ok(perto(crescido.x, 0) && perto(crescido.y, 0) && perto(crescido.w, 0.7));
  assert.ok(!recorteMudou({ x: 0, y: 0, w: 1, h: 1 }));
  assert.ok(recorteMudou(r));
});

test("cabeça da seta aponta para o destino e marcações vazias são descartadas", () => {
  const [ponta, a, b] = cabecaSeta({ x: 0, y: 0 }, { x: 100, y: 0 }, 4);
  assert.deepEqual(ponta, { x: 100, y: 0 });
  assert.ok(a.x < 100 && b.x < 100 && a.y * b.y < 0, "uma ponta de cada lado");
  assert.ok(!marcacaoValida({ ferramenta: "seta", cor: "#f00", espessura: 3, pontos: [{ x: 0.5, y: 0.5 }, { x: 0.501, y: 0.5 }] }));
  assert.ok(marcacaoValida({ ferramenta: "circulo", cor: "#f00", espessura: 3, pontos: [{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }] }));
  assert.ok(!marcacaoValida({ ferramenta: "livre", cor: "#f00", espessura: 3, pontos: [{ x: 0.2, y: 0.2 }] }));
});
