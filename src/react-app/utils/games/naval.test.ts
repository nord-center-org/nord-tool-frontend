import { test } from "node:test";
import assert from "node:assert/strict";
import { FROTA, LIMITE_BATALHA, LIMITE_CACADA, N, candidatasAlvo, densidade, disparar, novaPartidaNaval, passoNaval, pontosNaval, sortearFrota, type EstadoNaval } from "./naval.ts";
import { rng } from "./bombas.ts";

const P = { direcao: null, a: false, b: false } as const;
const ate = (e: EstadoNaval, cond: () => boolean, limite = 200000) => { for (let i = 0; i < limite && !cond(); i++) passoNaval(e, e.jogadores.map(() => P)); };
const esperarVez = (e: EstadoNaval) => ate(e, () => e.terminado || (e.tirosNaVez > 0 && e.passo >= e.esperaAte));

test("a frota sorteada tem 5 navios sem se encostar", () => {
  for (let s = 1; s < 40; s++) {
    const navios = sortearFrota(rng(s));
    assert.deepEqual(navios.map(n => n.tam), [...FROTA]);
    const todas = navios.flatMap(n => n.casas);
    assert.equal(new Set(todas).size, 17);
    for (const a of navios) for (const b of navios) if (a !== b)
      for (const ca of a.casas) for (const cb of b.casas)
        assert.ok(Math.abs((ca % N) - (cb % N)) > 1 || Math.abs(Math.floor(ca / N) - Math.floor(cb / N)) > 1);
  }
});

test("água, acerto e afundou; tiro repetido não vale; a vez passa", () => {
  const e = novaPartidaNaval({ modo: "classico", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  const quem = e.vez, rival = 1 - quem;
  const nav = e.frotas[rival].navios[4];
  assert.equal(disparar(e, quem, rival, nav.casas[0], "tiro"), true);
  assert.equal(e.frotas[rival].tiros[nav.casas[0]], 2);
  esperarVez(e);
  assert.equal(e.vez, rival);
  assert.equal(disparar(e, rival, rival, 0, "tiro"), false, "não atira na própria frota");
  const agua = e.frotas[quem].tiros.findIndex((_t, c) => !e.frotas[quem].navios.some(n => n.casas.includes(c)));
  disparar(e, rival, quem, agua, "tiro");
  esperarVez(e);
  assert.equal(disparar(e, quem, rival, nav.casas[0], "tiro"), false, "casa já atingida");
  disparar(e, quem, rival, nav.casas[1], "tiro");
  assert.equal(nav.afundado, true);
  assert.ok(nav.casas.every(c => e.frotas[rival].tiros[c] === 3));
});

test("Salva: tiros na vez = navios de pé", () => {
  const e = novaPartidaNaval({ modo: "salva", semente: 5, jogadores: [{ bot: null }, { bot: null }] });
  assert.equal(e.tirosNaVez, 5);
  const quem = e.vez, rival = 1 - quem;
  disparar(e, quem, rival, 0, "tiro");
  assert.equal(e.vez, quem);
  assert.equal(e.tirosNaVez, 4);
});

test("Especiais: sonar conta as partes intactas; cruz atinge 5 casas; cada um uma vez", () => {
  const e = novaPartidaNaval({ modo: "especiais", semente: 9, jogadores: [{ bot: null }, { bot: null }] });
  const quem = e.vez, rival = 1 - quem;
  const c = e.frotas[rival].navios[0].casas[2];
  disparar(e, quem, rival, c, "sonar");
  assert.ok(e.frotas[rival].sonar[0].n >= 1);
  esperarVez(e);
  disparar(e, rival, quem, 55, "tiro");
  esperarVez(e);
  assert.equal(disparar(e, quem, rival, c, "sonar"), false, "sonar só uma vez");
  assert.equal(disparar(e, quem, rival, 55, "cruz"), true);
  assert.equal(e.frotas[rival].tiros.filter(t => t !== 0).length, 5);
});

test("bot de alvo segue a linha de dois acertos", () => {
  const e = novaPartidaNaval({ modo: "classico", semente: 2, jogadores: [{ bot: null }, { bot: null }] });
  const f = e.frotas[1];
  const nav = f.navios[0];
  f.tiros[nav.casas[1]] = 2;
  f.tiros[nav.casas[2]] = 2;
  const cand = candidatasAlvo(f);
  assert.ok(cand.length >= 1 && cand.every(c => nav.casas.includes(c)), `${cand} ⊂ ${nav.casas}`);
  // Sonar zero apaga a região do mapa de probabilidade.
  f.sonar.push({ c: 0, n: 0 });
  const d = densidade(f);
  assert.equal(d[0] + d[1] + d[10] + d[11], 0);
});

test("8 bots jogam até sobrar uma frota; Difícil afunda mais rápido que Fácil", () => {
  const e = novaPartidaNaval({ modo: "especiais", semente: 11, jogadores: Array.from({ length: 8 }, (_v, i) => ({ bot: (["facil", "medio", "dificil"] as const)[i % 3] })) });
  ate(e, () => e.terminado);
  assert.ok(e.terminado);
  assert.ok(e.frotas.filter(f => f.viva).length === 1 || e.passo >= LIMITE_BATALHA, "acaba com uma frota ou no tempo");
  assert.equal(e.frotas[0].navios.length, 4, "com 5+ frotas, 4 navios");
  const q = novaPartidaNaval({ modo: "classico", semente: 3, jogadores: Array.from({ length: 4 }, () => ({ bot: "dificil" as const })) });
  ate(q, () => q.terminado);
  assert.equal(q.frotas.filter(f => f.viva).length, 1);
  assert.equal(q.frotas[q.vencedor!].dono, q.vencedor);
  const tiros = (bot: "facil" | "dificil") => {
    let soma = 0;
    for (let s = 1; s <= 6; s++) {
      const x = novaPartidaNaval({ modo: "classico", semente: s * 7, jogadores: [{ bot }, { bot }] });
      ate(x, () => x.terminado);
      soma += x.jogadores[x.vencedor!].tiros;
    }
    return soma;
  };
  assert.ok(tiros("dificil") < tiros("facil"));
});

test("Caçada sozinho: vence afundando tudo; perde ao passar do limite", () => {
  const e = novaPartidaNaval({ modo: "classico", semente: 4, jogadores: [{ bot: null }] });
  assert.equal(e.modo, "cacada");
  for (const n of e.frotas[0].navios) for (const c of n.casas) { esperarVez(e); disparar(e, 0, 0, c, "tiro"); }
  assert.equal(e.vencedor, 0);
  assert.equal(pontosNaval(e, e.jogadores[0]), 17 * 10 + 5 * 50 + 200 + (LIMITE_CACADA - 17) * 15);
  const p = novaPartidaNaval({ modo: "classico", semente: 4, jogadores: [{ bot: null }] });
  const agua = p.frotas[0].tiros.map((_t, c) => c).filter(c => !p.frotas[0].navios.some(n => n.casas.includes(c)));
  for (const c of agua.slice(0, LIMITE_CACADA)) { esperarVez(p); disparar(p, 0, 0, c, "tiro"); }
  assert.equal(p.terminado, true);
  assert.equal(p.vencedor, null);
});

test("tempo da batalha esgotado: vence a frota mais inteira", () => {
  const e = novaPartidaNaval({ modo: "classico", semente: 6, jogadores: [{ bot: null }, { bot: null }] });
  const quem = e.vez, rival = 1 - quem;
  disparar(e, quem, rival, e.frotas[rival].navios[0].casas[0], "tiro");
  e.passo = LIMITE_BATALHA - 1;
  passoNaval(e, [P, P]);
  assert.equal(e.terminado, true);
  assert.equal(e.vencedor, quem);
  // Empate nas partes: desempata quem acertou mais.
  const d = novaPartidaNaval({ modo: "classico", semente: 8, jogadores: [{ bot: null }, { bot: null }] });
  const a = d.vez, b2 = 1 - a;
  disparar(d, a, b2, d.frotas[b2].navios[0].casas[0], "tiro");
  d.frotas[a].navios[0].acertos = 1;
  d.passo = LIMITE_BATALHA - 1;
  passoNaval(d, [P, P]);
  assert.equal(d.vencedor, a);
});
