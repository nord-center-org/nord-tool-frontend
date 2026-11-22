import { test } from "node:test";
import assert from "node:assert/strict";
import { ALT, META_MOEDAS, novaPartidaCoroa, passoCoroa, pontosCoroa, type EstadoCoroa } from "./coroa.ts";

const P = { direcao: null, a: false, b: false } as const;
const passos = (e: EstadoCoroa, n: number, ent: () => { direcao: "esquerda" | "direita" | "cima" | "baixo" | null; a: boolean; b: boolean }[] = () => e.jogadores.map(() => P)) => { for (let i = 0; i < n && !e.terminado; i++) passoCoroa(e, ent()); };

test("pulo sobe e a gravidade traz de volta ao chão; pulo duplo no ar", () => {
  const e = novaPartidaCoroa({ modo: "coroa", arena: "castelo", semente: 1, jogadores: [{ bot: null }, { bot: null }] });
  const j = e.jogadores[0];
  passoCoroa(e, [{ direcao: null, a: true, b: false }, P]);
  assert.ok(j.vy < 0);
  passos(e, 10);
  passoCoroa(e, [{ direcao: null, a: true, b: false }, P]);
  assert.equal(j.pulosAr, 0, "gastou o pulo duplo");
  passos(e, 200);
  assert.equal(j.noChao, true);
});

test("encostar em quem tem a coroa rouba; proteção de 1 s depois de pegar", () => {
  const e = novaPartidaCoroa({ modo: "coroa", arena: "castelo", semente: 2, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.jogadores;
  e.dono = 0; e.protegidoAte = e.passo + 60;
  b.x = a.x + 0.3; b.y = a.y;
  passoCoroa(e, [P, P]);
  assert.equal(e.dono, 0, "protegido");
  e.protegidoAte = 0; b.x = a.x + 0.3; b.y = a.y;
  passoCoroa(e, [P, P]);
  assert.equal(e.dono, 1);
});

test("Coroa: vence quem somou mais tempo com ela", () => {
  const e = novaPartidaCoroa({ modo: "coroa", arena: "floresta", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  e.dono = 1; e.protegidoAte = 1e9;
  e.jogadores[0].x = 1; e.jogadores[1].x = 20;
  passos(e, 90 * 60 + 5);
  assert.equal(e.terminado, true);
  assert.equal(e.vencedor, 1);
  assert.ok(pontosCoroa(e, e.jogadores[1]) > 800);
});

test("Pega-Pega: a bomba explode em quem está com ela; o último vence", () => {
  const e = novaPartidaCoroa({ modo: "pegapega", arena: "nuvens", semente: 4, jogadores: [{ bot: null }, { bot: null }, { bot: null }] });
  e.jogadores.forEach((j, i) => { j.x = 2 + i * 9; });
  const primeiro = e.dono!;
  passos(e, 20 * 60 + 2);
  assert.equal(e.jogadores[primeiro].fora, true);
  passos(e, 21 * 60);
  assert.equal(e.terminado, true);
  assert.equal(e.jogadores.filter(j => !j.fora).length, 1);
});

test("sozinho: pegar 20 moedas vence; bots perseguem e roubam a coroa", () => {
  const s = novaPartidaCoroa({ modo: "coroa", arena: "castelo", semente: 5, jogadores: [{ bot: null }] });
  assert.equal(s.modo, "moedas");
  for (let k = 0; k < META_MOEDAS && !s.terminado; k++) { const m = s.moedas[0]; s.jogadores[0].x = m.x; s.jogadores[0].y = m.y + 0.5; passoCoroa(s, [P]); }
  assert.equal(s.vencedor, 0);
  const e = novaPartidaCoroa({ modo: "coroa", arena: "castelo", semente: 6, jogadores: Array.from({ length: 6 }, () => ({ bot: "dificil" as const })) });
  let trocas = 0;
  for (let i = 0; i < 90 * 60 && !e.terminado; i++) { passoCoroa(e, []); trocas += e.eventos.filter(ev => ev.tipo === "roubou").length; }
  assert.ok(trocas >= 3, `trocas ${trocas}`);
  assert.ok(e.jogadores.every(j => j.y <= ALT));
});
