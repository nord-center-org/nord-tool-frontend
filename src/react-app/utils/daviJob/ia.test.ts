import assert from "node:assert/strict";
import { test } from "node:test";

import { alcancaveis, decidirGato, decidirRato, lugarParaRato, type EstadoIA } from "./ia.ts";
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

test("gatos do computador não ficam um em cima do outro; o do jogador pode", async () => {
  const { separarGatos } = await import("./ia.ts");
  const plats: Plataforma[] = [{ id: "p", x: 100, y: 200, w: 80, tipo: "prateleira" }];
  const c = (x: number) => ({ ...novoCorpo(x, 200), noChao: true, plataforma: "p" });
  const [a, b] = separarGatos([c(140), c(144), c(142)], plats, 2);
  assert.ok(Math.abs(b.x - a.x) >= 15.99, `afastados: ${a.x} e ${b.x}`);
  const comJogador = separarGatos([c(140), c(141)], plats, 0);
  assert.equal(comJogador[0].x, 140);
  assert.equal(comJogador[1].x, 141, "jogador sobreposto não empurra ninguém");
  const naBeirada = separarGatos([c(102), c(104)], plats, -1);
  assert.ok(naBeirada[0].x >= 102 && naBeirada[1].x - naBeirada[0].x >= 15.99, "não cai da prateleira");
  const degraus: Plataforma[] = [{ id: "e1-0", x: 200, y: 250, w: 10, tipo: "degrau" }, { id: "e1-1", x: 209, y: 244, w: 10, tipo: "degrau" }, { id: "e1-2", x: 218, y: 238, w: 10, tipo: "degrau" }];
  const naEscada = separarGatos([{ ...c(205), y: 250, plataforma: "e1-0" }, { ...c(212), y: 244, plataforma: "e1-1" }], degraus, -1);
  assert.ok(Math.abs(naEscada[1].x - naEscada[0].x) >= 15.99, "na escada também se afastam");
  const emAndaresDiferentes = separarGatos([c(140), { ...c(140), y: 160, plataforma: "q" }], plats, -1);
  assert.equal(emAndaresDiferentes[1].x, 140);
});

test("rato novo nasce em lugares sorteados, em vários andares, longe dos gatos", () => {
  const s = sorteador(11);
  const gatos = [{ x: 60, y: 222 }, { x: 250, y: 186 }];
  const andares = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const l = lugarParaRato(HUB.nascer, gatos, s);
    andares.add(l.y);
    assert.ok(gatos.every(g => Math.hypot(g.x - l.x, g.y - l.y) >= 80));
  }
  assert.ok(andares.size >= 4, `andares: ${[...andares].join(",")}`);
  const cercado = lugarParaRato([{ x: 0, y: 0 }, { x: 50, y: 0 }], [{ x: 10, y: 0 }], () => 0);
  assert.deepEqual(cercado, { x: 50, y: 0 }, "sem lugar livre, vai para o mais afastado");
});

test("rato sem gato por perto passeia por andares diferentes (sobe e desce)", () => {
  const s = sorteador(5);
  let r = assentar(90, 114, HUB.plataformas);
  let estado = { ate: 0 };
  const alturas = new Set<number>();
  let anterior: number | null = null, subiu = false, desceu = false;
  for (let i = 0; i < 60 * 90; i++) {
    const d = decidirRato(r, estado, [{ x: 2000, y: 2000 }], HUB.plataformas, i / 60, s);
    estado = d.estado;
    r = passoCorpo(r, HUB.plataformas, 1 / 60, d.entrada, i / 60, { velocidade: 86, pulo: 300, gravidade: 820, largura: 480, altura: 270 });
    if (r.noChao) {
      const y = Math.round(r.y);
      if (anterior !== null && y < anterior - 20) subiu = true;
      if (anterior !== null && y > anterior + 20) desceu = true;
      anterior = y;
      alturas.add(y);
    }
  }
  assert.ok(alturas.size >= 4 && subiu && desceu, `alturas: ${[...alturas].sort().join(",")}`);
});
