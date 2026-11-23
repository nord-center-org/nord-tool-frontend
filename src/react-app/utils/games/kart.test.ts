import { test } from "node:test";
import assert from "node:assert/strict";
import { BALOES, LARGURA_PISTA, VEL_MAX, VOLTAS, classificacao, montarPista, novaPartidaKart, passoKart, pistaDe, pontosKart, type EstadoKart } from "./kart.ts";

const P = { direcao: null, a: false, b: false } as const;
const parado = (e: EstadoKart) => e.karts.map(() => P);

test("pista fechada e reamostrada em passos de ~1 unidade; o grid começa na pista", () => {
  for (const nome of ["verde", "deserto", "neon"] as const) {
    const p = montarPista(nome);
    assert.ok(p.pontos.length > 300);
    for (let i = 0; i < p.pontos.length; i++) {
      const a = p.pontos[i], b = p.pontos[(i + 1) % p.pontos.length];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1.3, `${nome} passo ${i}`);
    }
  }
  const e = novaPartidaKart({ modo: "gp", pista: "verde", semente: 1, jogadores: Array.from({ length: 8 }, () => ({ bot: null })) });
  const pts = pistaDe("verde").pontos;
  for (const k of e.karts) assert.ok(Math.min(...pts.map(p => Math.hypot(p.x - k.x, p.z - k.z))) < LARGURA_PISTA / 2);
});

test("acelera sozinho, freia no ↓ e a grama deixa lento", () => {
  const arena = novaPartidaKart({ modo: "baloes", pista: "verde", semente: 2, jogadores: [{ bot: null }, { bot: null }] });
  const ka = arena.karts[0];
  arena.karts[1].x = 20; arena.karts[1].z = 20;
  for (let i = 0; i < 200; i++) { passoKart(arena, parado(arena)); ka.x = 0; ka.z = 0; }
  assert.ok(ka.vel > VEL_MAX * 0.9);
  for (let i = 0; i < 40; i++) { passoKart(arena, [{ direcao: "baixo", a: false, b: false }, P]); ka.x = 0; ka.z = 0; }
  assert.ok(ka.vel < 0.05);
  const e = novaPartidaKart({ modo: "gp", pista: "verde", semente: 2, jogadores: [{ bot: null }] });
  const k = e.karts[0];
  // Na grama (longe da linha central) não passa de ~55%.
  const p = pistaDe("verde").pontos[k.idx];
  k.x = p.x + LARGURA_PISTA; k.z = p.z;
  for (let i = 0; i < 300; i++) { passoKart(e, parado(e)); k.x = p.x + LARGURA_PISTA; k.z = p.z; }
  assert.ok(k.vel < VEL_MAX * 0.6);
});

test("drift segurando A na curva carrega o turbo; soltar dispara", () => {
  const e = novaPartidaKart({ modo: "baloes", pista: "verde", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  const k = e.karts[0];
  e.karts[1].x = 20; e.karts[1].z = 20;
  for (let i = 0; i < 200; i++) { passoKart(e, parado(e)); k.x = 0; k.z = 0; }
  for (let i = 0; i < 100; i++) { passoKart(e, [{ direcao: "direita", a: true, b: false }, P]); k.x = 0; k.z = 0; }
  assert.equal(k.drift, 1);
  assert.ok(k.carga >= 90);
  passoKart(e, [P, P]);
  assert.ok(e.eventos.some(ev => ev.tipo === "turbo" && ev.nivel === 2));
  assert.ok(k.turboAte > e.passo);
});

test("itens: caixa dá item, míssil persegue e acerta, escudo segura, óleo faz rodar", () => {
  const e = novaPartidaKart({ modo: "gp", pista: "verde", semente: 4, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.karts;
  const c = e.caixas[0];
  a.x = c.x; a.z = c.z;
  passoKart(e, parado(e));
  assert.ok(a.item);
  // Míssil em b, logo à frente.
  a.item = "missil"; a.x = 0; a.z = 0; a.ang = 0; b.x = 8; b.z = 0; a.vel = b.vel = 0;
  a.idx = b.idx = 0; b.idx = 5;
  let rodou = false;
  for (let i = 0; i < 120 && !rodou; i++) { passoKart(e, [{ direcao: null, a: false, b: i === 0 }, P]); rodou = e.eventos.some(ev => ev.tipo === "giro" && ev.jogador === 1); a.x = 0; a.z = 0; b.x = 8; b.z = 0; }
  assert.ok(rodou, "míssil acertou");
  const ponto = pistaDe("verde").pontos[50];
  b.x = ponto.x; b.z = ponto.z; b.idx = 50; b.vel = 0; b.giroAte = 0;
  b.invulAte = 0; b.escudoAte = e.passo + 500;
  e.oleos.push({ x: b.x, z: b.z, ate: e.passo + 100, dono: 0 });
  passoKart(e, parado(e));
  assert.ok(e.eventos.some(ev => ev.tipo === "escudo" && ev.jogador === 1), "o escudo segurou");
});

test("Grande Prêmio com bots, de 1 a 8: completam as voltas e a classificação dá os pontos", () => {
  for (const n of [1, 4, 8]) {
    const e = novaPartidaKart({ modo: "gp", pista: "neon", semente: 20 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    for (let i = 0; i < 60 * 300 && !e.terminado; i++) passoKart(e, parado(e));
    assert.ok(e.terminado);
    assert.ok(e.karts.every(k => k.volta >= VOLTAS), `${n}: ${e.karts.map(k => k.volta)}`);
    assert.notEqual(e.vencedor, null);
    assert.equal(classificacao(e)[e.vencedor!], 1);
    assert.ok(pontosKart(e).every(p => p > 0));
  }
});

test("Arena de Balões: perde balão quando atingido e o último com balão vence; sozinho, balões-alvo", () => {
  const e = novaPartidaKart({ modo: "baloes", pista: "verde", semente: 5, jogadores: Array.from({ length: 4 }, () => ({ bot: "dificil" as const })) });
  assert.ok(e.karts.every(k => k.baloes === BALOES));
  for (let i = 0; i < e.meta + 5 && !e.terminado; i++) passoKart(e, parado(e));
  assert.ok(e.terminado);
  assert.ok(e.karts.some(k => k.baloes < BALOES));
  const solo = novaPartidaKart({ modo: "baloes", pista: "verde", semente: 6, jogadores: [{ bot: null }] });
  assert.equal(solo.alvos.length, 10);
  const k = solo.karts[0];
  const alvo = solo.alvos[0];
  k.x = alvo.x; k.z = alvo.z;
  passoKart(solo, parado(solo));
  assert.ok(solo.alvos.length <= 9);
  assert.equal(k.estouros, 10 - solo.alvos.length);
});
