import assert from "node:assert/strict";
import { test } from "node:test";

import { escada, novoCorpo, passoBola, passoCorda, passoCorpo, ponte, type Plataforma } from "./motor.ts";

const chao: Plataforma = { id: "chao", x: 0, y: 260, w: 480, tipo: "chao" };
const prateleira: Plataforma = { id: "p", x: 100, y: 220, w: 80, tipo: "prateleira" };
const parado = { dir: 0, pular: false, descer: false };
const rodar = (c: ReturnType<typeof novoCorpo>, plats: Plataforma[], e = parado, segundos = 1, t0 = 0) => {
  let n = c;
  for (let i = 0; i < segundos * 60; i++) n = passoCorpo(n, plats, 1 / 60, e, t0 + i / 60);
  return n;
};

test("cai e pousa no chão; puleiro só segura quem vem de cima", () => {
  const c = rodar(novoCorpo(50, 100), [chao, prateleira]);
  assert.equal(c.y, 260);
  assert.ok(c.noChao);
  const sobPrateleira = rodar(novoCorpo(140, 100), [chao, prateleira]);
  assert.equal(sobPrateleira.plataforma, "p");
  // Pulando de baixo atravessa o puleiro e pousa em cima.
  let d = rodar(novoCorpo(140, 260), [chao, prateleira], parado, 0.2);
  d = passoCorpo(d, [chao, prateleira], 1 / 60, { dir: 0, pular: true, descer: false }, 1);
  d = rodar(d, [chao, prateleira], parado, 1.5, 1.1);
  assert.equal(d.plataforma, "p", "pulo de 40 px alcança o puleiro");
});

test("descer atravessa o puleiro, mas não o chão", () => {
  let c = rodar(novoCorpo(140, 200), [chao, prateleira]);
  c = passoCorpo(c, [chao, prateleira], 1 / 60, { dir: 0, pular: false, descer: true }, 5);
  c = rodar(c, [chao, prateleira], parado, 1, 5.02);
  assert.equal(c.plataforma, "chao");
  c = passoCorpo(c, [chao, prateleira], 1 / 60, { dir: 0, pular: false, descer: true }, 7);
  assert.equal(c.y, 260);
});

test("sobe escadinha andando e cai ao sair da beirada", () => {
  const degraus = escada("e", 200, 256, 260, 224, 6);
  let c = rodar(novoCorpo(190, 260), [chao, ...degraus], parado, 0.3);
  c = rodar(c, [chao, ...degraus], { dir: 1, pular: false, descer: false }, 0.9, 1);
  assert.ok(c.y < 240, `subiu a escada (y=${c.y})`);
  let b = rodar(novoCorpo(170, 200), [chao, prateleira], parado, 0.5);
  b = rodar(b, [chao, prateleira], { dir: 1, pular: false, descer: false }, 1, 2);
  assert.equal(b.plataforma, "chao", "saiu da prateleira e caiu");
  assert.ok(b.x <= 480 - b.w / 2, "não sai da tela");
});

test("bolinha quica e para; ratinho de brinquedo desliza sem quicar", () => {
  let bola = { x: 50, y: 100, vx: 120, vy: 0, r: 4, segurada: false, cor: "#00f", quica: true };
  let maxSubida = 0, pousou = false;
  for (let i = 0; i < 600; i++) {
    const antes = bola.vy;
    bola = passoBola(bola, [chao], 1 / 60);
    if (antes > 0 && bola.vy < 0) { pousou = true; maxSubida = Math.max(maxSubida, -bola.vy); }
  }
  assert.ok(pousou && maxSubida > 0, "quicou");
  assert.equal(bola.y, 256);
  assert.equal(bola.vx, 0, "parou de rolar");
  let rato = { x: 50, y: 250, vx: 100, vy: 0, r: 3, segurada: false, cor: "#999", quica: false };
  for (let i = 0; i < 60; i++) rato = passoBola(rato, [chao], 1 / 60);
  assert.ok(rato.vy === 0 && rato.y === 257);
});

test("corda balança e volta ao repouso; ponte e escada geram degraus contínuos", () => {
  let c = { x: 0, y: 0, comprimento: 30, angulo: 0.8, vel: 0, cor: "#f00" };
  for (let i = 0; i < 600; i++) c = passoCorda(c, 1 / 60);
  assert.ok(Math.abs(c.angulo) < 0.05);
  const p = ponte("b", 100, 200, 110, 10, 10);
  assert.equal(p.length, 10);
  assert.ok(p[5].y > p[0].y, "barriga no meio");
  const e = escada("e", 0, 100, 50, 60, 5);
  assert.ok(e[0].y > e[4].y && e[0].x < e[4].x);
});
