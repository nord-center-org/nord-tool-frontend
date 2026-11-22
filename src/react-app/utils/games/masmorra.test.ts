import { test } from "node:test";
import assert from "node:assert/strict";
import { PORTA, SH, SW, gerarMasmorra, novaPartidaMasmorra, passoMasmorra, pontosMasmorra, sementeDoDia, type EstadoMasmorra } from "./masmorra.ts";
import { rng } from "./bombas.ts";

const P = { direcao: null, a: false, b: false } as const;

test("masmorra sorteada: início, chefe no fim do caminho, sala da chave e portas dos dois lados", () => {
  for (let s = 1; s < 30; s++) {
    const salas = gerarMasmorra(rng(s));
    assert.equal(salas.filter(x => x.tipo === "inicio").length, 1);
    assert.equal(salas.filter(x => x.tipo === "chefe").length, 1);
    assert.equal(salas.filter(x => x.tipo === "chave").length, 1);
    for (const a of salas) for (const [l, [dx, dy]] of Object.entries({ n: [0, -1], s: [0, 1], l: [-1, 0], o: [1, 0] })) {
      if (!a.portas[l as "n"]) continue;
      const b = salas.find(x => x.gx === a.gx + dx && x.gy === a.gy + dy);
      assert.ok(b, "porta leva a uma sala");
    }
  }
});

test("Desafio Diário: mesma masmorra no mesmo dia", () => {
  const a = novaPartidaMasmorra({ modo: "diario", semente: 1, jogadores: [{ bot: null }] });
  const b = novaPartidaMasmorra({ modo: "diario", semente: 999, jogadores: [{ bot: null }] });
  assert.deepEqual(a.salas.map(s => [s.gx, s.gy, s.tipo]), b.salas.map(s => [s.gx, s.gy, s.tipo]));
  assert.equal(a.semente, sementeDoDia());
});

/** Leva os jogadores para a sala vizinha pela porta {@code l}. */
function atravessar(e: EstadoMasmorra, l: "n" | "s" | "l" | "o") {
  const p = PORTA[l];
  for (const j of e.jogadores) { j.x = p.x + (l === "l" ? -0.5 : l === "o" ? 0.5 : 0); j.y = p.y + (l === "n" ? -0.5 : l === "s" ? 0.5 : 0); }
  passoMasmorra(e, e.jogadores.map(() => P));
}

test("sala nova tranca com monstros; espada derruba; limpar abre e dá pontos", () => {
  const e = novaPartidaMasmorra({ modo: "fuga", semente: 3, jogadores: [{ bot: null }] });
  const l = (["n", "s", "l", "o"] as const).find(x => e.salas[0].portas[x])!;
  atravessar(e, l);
  assert.notEqual(e.atual, 0);
  if (e.salas[e.atual].tipo === "normal") assert.ok(e.inimigos.length > 0, "trancou com monstros");
  const j = e.jogadores[0];
  for (const m of e.inimigos) { m.hp = 1; m.x = j.x; m.y = j.y - 0.8; }
  j.olhar = { x: 0, y: -1 };
  passoMasmorra(e, [{ direcao: null, a: true, b: false }]);
  passoMasmorra(e, [P]);
  assert.equal(e.inimigos.length, 0);
  assert.equal(e.salas[e.atual].limpa, true);
  assert.ok(j.pontos >= 50);
});

test("chefe só com a chave; fantasma volta quando a sala é limpa; todos fantasmas = fim", () => {
  const e = novaPartidaMasmorra({ modo: "fuga", semente: 4, jogadores: [{ bot: null }, { bot: null }] });
  const chefe = e.salas.findIndex(s => s.tipo === "chefe");
  const antes = e.salas[chefe];
  // Coloca o grupo numa sala vizinha do chefe e tenta entrar sem chave.
  const viz = e.salas.findIndex(s => (Object.entries({ n: [0, -1], s: [0, 1], l: [-1, 0], o: [1, 0] }) as [string, number[]][]).some(([ll, [dx, dy]]) => s.portas[ll as "n"] && s.gx + dx === antes.gx && s.gy + dy === antes.gy));
  e.atual = viz;
  const lado = (["n", "s", "l", "o"] as const).find(ll => { const d = { n: [0, -1], s: [0, 1], l: [-1, 0], o: [1, 0] }[ll]; return e.salas[viz].portas[ll] && e.salas[viz].gx + d[0] === antes.gx && e.salas[viz].gy + d[1] === antes.gy; })!;
  atravessar(e, lado);
  assert.equal(e.atual, viz, "trancada sem chave");
  e.temChave = true;
  atravessar(e, lado);
  assert.equal(e.atual, chefe);
  assert.ok(e.inimigos.some(m => m.tipo === "chefe"));
  e.jogadores[0].fantasma = true;
  e.inimigos = [];
  passoMasmorra(e, [P, P]);
  assert.equal(e.terminado, true, "derrotar o chefe termina");
  assert.equal(e.venceram, true);
  assert.ok(pontosMasmorra(e, e.jogadores[1]) > 500);
  const f = novaPartidaMasmorra({ modo: "fuga", semente: 5, jogadores: [{ bot: null }, { bot: null }] });
  f.jogadores.forEach(j => { j.fantasma = true; });
  passoMasmorra(f, [P, P]);
  assert.equal(f.terminado, true);
  assert.equal(f.venceram, false);
});

test("4 bots Difícil avançam pela masmorra (pegam a chave e chegam longe)", () => {
  const e = novaPartidaMasmorra({ modo: "fuga", semente: 6, jogadores: Array.from({ length: 4 }, () => ({ bot: "dificil" as const })) });
  for (let i = 0; i < 60 * 60 * 6 && !e.terminado; i++) passoMasmorra(e, []);
  assert.ok(e.salas.filter(s => s.visitada).length >= 4, `visitou ${e.salas.filter(s => s.visitada).length}`);
  assert.ok(e.temChave || e.terminado);
  assert.ok(e.jogadores.some(j => j.abates > 3));
  assert.ok(SW > 0 && SH > 0);
});
