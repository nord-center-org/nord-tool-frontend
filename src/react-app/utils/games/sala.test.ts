import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTROLE_SOLTO, EntradasRemotas, esperaDaTentativa, lerAviso, lerEntrada, linkDoControle, mesmaEntrada, normalizarCodigo, urlDoSocket } from "./sala.ts";

test("código digitado vira o código da sala", () => {
  assert.equal(normalizarCodigo(" ab3k "), "AB3K");
  assert.equal(normalizarCodigo("a-b 3 k 9"), "AB3K");
  assert.equal(normalizarCodigo("o1i0"), "");
});

test("endereços do WebSocket e do controle", () => {
  assert.equal(urlDoSocket("https://api.x.com/api/v1/nord-tool", "https://app.x.com", "a+b/c"), "wss://api.x.com/api/v1/nord-tool/games/ws?bilhete=a%2Bb%2Fc");
  assert.equal(urlDoSocket("http://127.0.0.1:8091/api/v1/nord-tool/", "http://x", "t"), "ws://127.0.0.1:8091/api/v1/nord-tool/games/ws?bilhete=t");
  assert.equal(urlDoSocket("/api/v1/nord-tool", "https://app.x.com", "t"), "wss://app.x.com/api/v1/nord-tool/games/ws?bilhete=t");
  assert.equal(urlDoSocket("api", "http://app", "t"), "ws://app/api/games/ws?bilhete=t");
  assert.equal(linkDoControle("https://app.x.com", "AB3K"), "https://app.x.com/gestao/games/controle?sala=AB3K");
});

test("entrada da rede é lida com cuidado", () => {
  assert.deepEqual(lerEntrada({ x: "cima", a: true, b: 1, p: "sim" }), { x: "cima", a: true, b: false, p: false });
  assert.deepEqual(lerEntrada({ x: "voar" }), CONTROLE_SOLTO);
  assert.deepEqual(lerEntrada(null), CONTROLE_SOLTO);
  assert.equal(mesmaEntrada(CONTROLE_SOLTO, { x: null, a: false, b: false, p: false }), true);
  assert.equal(mesmaEntrada(CONTROLE_SOLTO, { x: "baixo", a: false, b: false, p: false }), false);
});

test("toque rápido do celular não se perde entre dois passos", () => {
  const r = new EntradasRemotas();
  assert.deepEqual(r.ler(2), CONTROLE_SOLTO);
  r.receber(2, { x: "esquerda", a: true });
  r.receber(2, { x: "esquerda", a: false });
  assert.deepEqual(r.ler(2), { x: "esquerda", a: true, b: false, p: false });
  assert.deepEqual(r.ler(2), { x: "esquerda", a: false, b: false, p: false });
  r.receber(2, { b: true });
  assert.equal(r.ler(2).b, true);
  assert.equal(r.ler(2).b, true, "segurando continua apertado");
  r.receber(3, { x: "cima" });
  r.soltar(3);
  assert.deepEqual(r.ler(3), CONTROLE_SOLTO);
});

test("avisos da tela são validados", () => {
  assert.deepEqual(lerAviso({ k: "lugar", indice: 12, cor: "#ef4444", jogo: "bombas" }), { k: "lugar", indice: 7, cor: "#ef4444", jogo: "bombas" });
  assert.equal(lerAviso({ k: "lugar", indice: 1, cor: "red" })?.k, "lugar");
  assert.deepEqual(lerAviso({ k: "lugar", indice: 0, cor: "#ef4444", jogo: "pescaria", modo: "mergulho" }), { k: "lugar", indice: 0, cor: "#ef4444", jogo: "pescaria", modo: "mergulho" });
  assert.deepEqual(lerAviso({ k: "fase", fase: "jogando" }), { k: "fase", fase: "jogando" });
  assert.equal(lerAviso({ k: "fase", fase: "x" }), null);
  assert.deepEqual(lerAviso({ k: "vibrar", ms: 5000 }), { k: "vibrar", ms: 1000, texto: undefined });
  const fim = lerAviso({ k: "fim", jogo: "bombas", modo: "times", pontos: 1200.4, venceu: true, colocacao: 1, jogadores: 4, bots: 2, dificuldade: "dificil", duracao: 90 });
  assert.deepEqual(fim, { k: "fim", jogo: "bombas", modo: "times", pontos: 1200, venceu: true, colocacao: 1, jogadores: 4, bots: 2, dificuldade: "dificil", duracao: 90 });
  assert.equal((lerAviso({ k: "fim", dificuldade: "impossivel", pontos: "x" }) as { dificuldade: null; pontos: number }).dificuldade, null);
  assert.equal(lerAviso({ k: "outro" }), null);
  assert.equal(lerAviso("x"), null);
});

test("espera para reconectar cresce até 10 s", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(esperaDaTentativa), [1000, 2000, 4000, 8000, 10000, 10000]);
});

test("aviso da mão: só cartas válidas, seleção dentro da mão e cor conhecida", () => {
  const a = lerAviso({ k: "mao", c: ["r5", "w+4", "x9", "<b>", "gP", 7], sel: 99, vez: true, topo: "b+2", cor: "z", info: "x".repeat(200) });
  assert.ok(a && a.k === "mao");
  if (a?.k !== "mao") return;
  assert.deepEqual(a.c, ["r5", "w+4", "gP"]);
  assert.equal(a.sel, 2);
  assert.equal(a.topo, "b+2");
  assert.equal(a.cor, "r");
  assert.equal(a.info?.length, 80);
  assert.equal(a.escolhendoCor, null);
});

test("celular: um toque rápido na seta (aperta e solta antes do passo) ainda conta uma vez", () => {
  const r = new EntradasRemotas();
  r.receber(2, { x: "esquerda" });
  r.receber(2, { x: null });
  assert.equal(r.ler(2).x, "esquerda");
  assert.equal(r.ler(2).x, null, "só uma vez");
  r.receber(2, { x: "cima" });
  assert.equal(r.ler(2).x, "cima");
  assert.equal(r.ler(2).x, "cima", "segurando continua");
});

test("diagonal atravessa a sala, inclusive toque rápido, e solta ao desconectar", () => {
  const r = new EntradasRemotas();
  const d = { x: "cima", eixoX: 1, eixoY: -1, a: false, b: false, p: false };
  r.receber(1, d); r.receber(1, CONTROLE_SOLTO);
  assert.deepEqual(r.ler(1), d);
  assert.deepEqual(r.ler(1), CONTROLE_SOLTO);
  r.receber(1, d); r.soltar(1);
  assert.deepEqual(r.ler(1), CONTROLE_SOLTO);
  assert.equal(mesmaEntrada(d as ReturnType<typeof lerEntrada>, { ...d, eixoX: 0 } as ReturnType<typeof lerEntrada>), false);
  assert.deepEqual(lerEntrada({ ...d, eixoX: Infinity }), { x: "cima", a: false, b: false, p: false });
});
