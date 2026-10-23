import assert from "node:assert/strict";
import { test } from "node:test";

import { alcancaveis, decidirGato, decidirRato, type EstadoIA } from "./ia.ts";
import { novoCorpo, passoCorpo, type Plataforma } from "./motor.ts";
import { ARENA, HUB } from "./mundo.ts";

const sorteador = (s = 1) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

const assentar = (x: number, y: number, plats: Plataforma[]) => {
  let c = novoCorpo(x, y - 1);
  for (let i = 0; i < 30; i++) c = passoCorpo(c, plats, 1 / 60, { dir: 0, pular: false, descer: false }, i / 60);
  return c;
};

test("todo puleiro do mapa tem outro alcançável (ninguém fica preso)", () => {
  for (const mapa of [HUB, ARENA]) for (const p of mapa.plataformas.filter(x => x.tipo === "prateleira")) {
    const c = { ...novoCorpo(p.x + p.w / 2, p.y), noChao: true, plataforma: p.id };
    assert.ok(alcancaveis(c, mapa.plataformas).length > 0, p.id);
  }
});

test("gato passeia pelo puleiro: muda de lugar com o tempo e não sai da tela", () => {
  const s = sorteador(7);
  let c = assentar(110, 186, HUB.plataformas);
  let ia: EstadoIA = { modo: "parar", ate: 0 };
  const plataformas = new Set<string>();
  for (let i = 0; i < 60 * 60; i++) {
    const t = i / 60;
    const d = decidirGato(c, ia, { plats: HUB.plataformas, agora: t, sorteio: s, interesses: [] });
    ia = d.ia;
    c = passoCorpo(c, HUB.plataformas, 1 / 60, d.entrada, t);
    if (c.plataforma) plataformas.add(c.plataforma);
    assert.ok(c.x >= 0 && c.x <= 480 && c.y <= 258);
  }
  assert.ok(plataformas.size >= 4, `visitou ${plataformas.size} puleiros`);
});

test("gato persegue a presa e chega perto dela", () => {
  const s = sorteador(3);
  let c = assentar(40, 258, HUB.plataformas);
  let ia: EstadoIA = { modo: "perseguir", ate: 99, alvo: { x: 200, y: 258 } };
  for (let i = 0; i < 180; i++) {
    const d = decidirGato(c, ia, { plats: HUB.plataformas, agora: i / 60, sorteio: s, presa: { x: 200, y: 258 }, interesses: [] });
    ia = d.ia;
    c = passoCorpo(c, HUB.plataformas, 1 / 60, d.entrada, i / 60);
  }
  assert.ok(Math.abs(c.x - 200) < 12, `chegou em x=${c.x}`);
});

test("rato foge do gato: abre distância e pula de puleiro quando encurralado", () => {
  const s = sorteador(11);
  let r = { ...assentar(240, 150, ARENA.plataformas), w: 10 };
  let estado = { ate: 0 };
  const gato = { x: 220, y: 150 };
  const inicio = r.plataforma;
  let mudou = false;
  for (let i = 0; i < 240; i++) {
    const d = decidirRato(r, estado, [gato], ARENA.plataformas, i / 60, s);
    estado = d.estado;
    r = passoCorpo(r, ARENA.plataformas, 1 / 60, d.entrada, i / 60, { velocidade: 100, pulo: 300, gravidade: 820, largura: 480, altura: 270 });
    if (r.plataforma && r.plataforma !== inicio) mudou = true;
  }
  assert.ok(Math.hypot(r.x - gato.x, r.y - gato.y) > 30, "ficou longe do gato");
  assert.ok(mudou, "pulou para outro puleiro");
});
