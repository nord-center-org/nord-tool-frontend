import { test } from "node:test";
import assert from "node:assert/strict";
import { CORACOES, TEMPO, atinge, escudo, novaPartidaChefao, passoChefao, pontosChefao, type EstadoChefao } from "./chefao.ts";
import type { Entrada } from "./bombas.ts";

const P: Entrada = { direcao: null, a: false, b: false };
const parados = (e: EstadoChefao) => e.herois.map(() => P);
const calmo = (e: EstadoChefao) => { e.chefe.proximoAtaque = 1e9; };
const nova = (n: number, modo: "coop" | "competitivo" | "rush" = "coop") => novaPartidaChefao({ modo, chefe: "golem", semente: 1, jogadores: Array.from({ length: n }, () => ({ bot: null })) });

test("começa com escudo de 3 pilares; com escudo o tiro no chefe não tira vida", () => {
  const e = nova(1); calmo(e);
  assert.equal(e.pilares.length, 3);
  assert.ok(escudo(e));
  const h = e.herois[0], vida = e.chefe.vida;
  // Atira no chefe com pilares de pé: a mira vai nos pilares.
  for (let i = 0; i < 2000 && escudo(e); i++) passoChefao(e, [{ direcao: null, a: true, b: false }]);
  assert.equal(escudo(e), false, "derrubou os pilares");
  assert.equal(e.chefe.vida, vida);
  for (let i = 0; i < 200; i++) passoChefao(e, [{ direcao: null, a: true, b: false }]);
  assert.ok(e.chefe.vida < vida);
  assert.ok(h.dano > 0 && h.pontos > 60);
});

test("ataque avisado: o martelo só machuca depois do aviso, e a esquiva protege", () => {
  const e = nova(2); calmo(e);
  const [a, b] = e.herois;
  e.perigos.push({ tipo: "martelo", x: a.x, y: a.y, r: 2, ang: 0, largura: 0, dispara: e.passo + 30, fim: e.passo + 36, brecha: 0 });
  e.perigos.push({ tipo: "martelo", x: b.x, y: b.y, r: 2, ang: 0, largura: 0, dispara: e.passo + 30, fim: e.passo + 36, brecha: 0 });
  for (let i = 0; i < 29; i++) passoChefao(e, parados(e));
  assert.equal(a.coracoes, CORACOES);
  // b esquiva um passo antes (invulnerável por 18 passos), a fica parado.
  b.dir = "direita";
  passoChefao(e, [P, { direcao: null, a: false, b: true }]);
  for (let i = 0; i < 8; i++) passoChefao(e, parados(e));
  assert.equal(a.coracoes, CORACOES - 1);
  assert.equal(b.coracoes, CORACOES);
});

test("anel: só a brecha salva; raio pega quem está na linha", () => {
  const anel = { tipo: "anel" as const, x: 10, y: 10, r: 0, ang: 0, largura: 0.5, dispara: 0, fim: 200, brecha: 0.5 };
  const passo = Math.round(5 / 0.16);
  assert.equal(atinge(anel, passo, 15, 10), false, "na brecha");
  assert.equal(atinge(anel, passo, 5, 10), true, "fora da brecha");
  const raio = { tipo: "raio" as const, x: 0, y: 0, r: 40, ang: 0, largura: 1, dispara: 0, fim: 10, brecha: 0 };
  assert.equal(atinge(raio, 1, 10, 0.3), true);
  assert.equal(atinge(raio, 1, 10, 1), false);
  assert.equal(atinge(raio, 1, -3, 0), false, "atrás do chefe");
});

test("fases: com 2/3 da vida vem a fase 2 e o escudo volta; na 3 aparecem lacaios", () => {
  const e = nova(1); calmo(e);
  e.pilares.forEach(p => { p.vida = 0; });
  e.chefe.vida = Math.floor(e.chefe.max * 2 / 3);
  passoChefao(e, parados(e));
  assert.equal(e.chefe.fase, 2);
  assert.ok(escudo(e));
  e.chefe.vida = Math.floor(e.chefe.max / 3);
  passoChefao(e, parados(e));
  assert.equal(e.chefe.fase, 3);
  calmo(e);
  while (e.passo % 300 !== 299) passoChefao(e, parados(e));
  passoChefao(e, parados(e));
  assert.ok(e.lacaios.length >= 2);
});

test("caído é levantado pelo aliado parado perto; sozinho, são 3 vidas", () => {
  const e = nova(2); calmo(e);
  const [a, b] = e.herois;
  a.coracoes = 1; a.invulneravelAte = 0;
  e.balas.push({ x: a.x, y: a.y, vx: 0, vy: 0, inimiga: true, dono: -1 });
  passoChefao(e, parados(e));
  assert.ok(a.caido);
  b.x = a.x + 1; b.y = a.y;
  for (let i = 0; i < 121; i++) passoChefao(e, parados(e));
  assert.equal(a.caido, false);
  assert.equal(a.coracoes, 2);
  const s = nova(1); calmo(s);
  const h = s.herois[0];
  for (let k = 0; k < 3; k++) {
    h.coracoes = 1; h.invulneravelAte = 0;
    s.balas.push({ x: h.x, y: h.y, vx: 0, vy: 0, inimiga: true, dono: -1 });
    for (let i = 0; i < 130 && !s.terminado; i++) passoChefao(s, parados(s));
  }
  assert.ok(s.terminado);
  assert.equal(s.venceram, false);
});

test("Boss Rush: derrotou um, vem o próximo, mais forte", () => {
  const e = nova(1, "rush"); calmo(e);
  const max = e.chefe.max;
  e.pilares.forEach(p => { p.vida = 0; });
  e.chefe.vida = 0;
  passoChefao(e, parados(e));
  assert.equal(e.terminado, false);
  assert.equal(e.chefe.tipo, "hidra");
  assert.ok(e.chefe.max > max);
  assert.ok(escudo(e));
});

test("bots nos três modos, de 1 a 8: a partida acaba com pontos", () => {
  for (const [modo, n] of [["coop", 1], ["coop", 4], ["coop", 8], ["competitivo", 2], ["competitivo", 8], ["rush", 3]] as const) {
    const e = novaPartidaChefao({ modo, chefe: "maquina", semente: 60 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    while (!e.terminado) passoChefao(e, []);
    assert.ok(e.passo <= TEMPO, `${modo} ${n}`);
    assert.ok(e.herois.some(h => h.dano > 0));
    assert.equal(pontosChefao(e).length, n);
    if (e.venceram) assert.notEqual(e.vencedor, null);
  }
});
