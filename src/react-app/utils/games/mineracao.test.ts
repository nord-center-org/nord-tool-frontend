import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AR, CARGA_MAX, alvoDaPicareta, CARRINHOS, CASCALHO, CHAO, DINAMITES, DURA, LW, OURO, PEDRA, TEMPO, TERRA, VALOR, bloco, mapaDeCaminhos,
  novaPartidaMineracao, passoMineracao, type EstadoMineracao,
} from "./mineracao.ts";

const P = { direcao: null, a: false, b: false } as const;
const parado = (e: EstadoMineracao) => e.jogadores.map(() => P);
const por = (e: EstadoMineracao, x: number, y: number, b: number) => { e.blocos[y * LW + x] = b; e.danos[y * LW + x] = 0; };

test("o mapa tem céu, chão de terra, minérios e rocha dura no fundo", () => {
  const e = novaPartidaMineracao({ modo: "corrida", semente: 1, jogadores: [{ bot: null }] });
  for (let x = 0; x < LW; x++) { assert.equal(bloco(e, x, 0), AR); assert.equal(bloco(e, x, CHAO - 1), AR); }
  assert.ok(e.blocos.some(b => b === OURO));
  assert.ok(e.blocos.slice(-LW).every(b => b === DURA));
});

test("picareta: terra sai com 1 golpe, pedra com 2; minério vai para a carga e é entregue no carrinho", () => {
  const e = novaPartidaMineracao({ modo: "corrida", semente: 2, jogadores: [{ bot: null }] });
  const j = e.jogadores[0];
  j.x = 10.5; j.y = CHAO - 0.43;
  por(e, 10, CHAO, TERRA);
  const cavar = (direcao: "baixo" | "esquerda", n: number) => { for (let i = 0; i < n; i++) passoMineracao(e, [{ direcao, a: true, b: false }]); };
  cavar("baixo", 3);
  assert.equal(bloco(e, 10, CHAO), AR, "terra caiu com 1 golpe");
  for (let i = 0; i < 40; i++) passoMineracao(e, parado(e));
  // Pedra e ouro ao lado.
  const cy = Math.floor(j.y);
  por(e, 9, cy, PEDRA);
  cavar("esquerda", 10);
  assert.equal(bloco(e, 9, cy), PEDRA, "pedra aguenta o 1º golpe");
  cavar("esquerda", 20);
  assert.equal(bloco(e, 9, cy), AR);
  // Andou para o buraco: o ouro vai na frente da picareta.
  const alvo = alvoDaPicareta(j);
  por(e, alvo.x, alvo.y, OURO);
  cavar("esquerda", 30);
  assert.deepEqual(j.carga, [OURO]);
  // Leva até o carrinho.
  j.x = CARRINHOS[0] + 0.3; j.y = CHAO - 0.43; j.vy = 0;
  passoMineracao(e, parado(e));
  assert.equal(j.pontos, VALOR[OURO]);
  assert.equal(j.carga.length, 0);
});

test("carga cheia não pega mais minério e deixa o mineiro mais lento", () => {
  const e = novaPartidaMineracao({ modo: "corrida", semente: 3, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.jogadores;
  a.x = 5.5; b.x = 20.5; a.y = b.y = CHAO - 0.43;
  b.carga = Array(CARGA_MAX).fill(OURO);
  for (let i = 0; i < 30; i++) passoMineracao(e, [{ direcao: "direita", a: false, b: false }, { direcao: "direita", a: false, b: false }]);
  assert.ok(a.x - 5.5 > b.x - 20.5 + 0.5);
});

test("dinamite abre buraco, poupa minério e rocha dura, e atordoa quem estiver perto", () => {
  const e = novaPartidaMineracao({ modo: "corrida", semente: 4, jogadores: [{ bot: null }, { bot: null }] });
  const [a, b] = e.jogadores;
  a.x = 12.5; a.y = CHAO - 0.43; b.x = 13.5; b.y = CHAO - 0.43; b.carga = [OURO, OURO];
  por(e, 12, CHAO + 1, OURO); por(e, 13, CHAO + 1, DURA); por(e, 11, CHAO + 1, PEDRA);
  passoMineracao(e, [{ direcao: null, a: false, b: true }, P]);
  assert.equal(a.dinamites, DINAMITES - 1);
  for (let i = 0; i < 130; i++) passoMineracao(e, parado(e));
  assert.equal(bloco(e, 12, CHAO + 1), OURO);
  assert.equal(bloco(e, 13, CHAO + 1), DURA);
  assert.equal(bloco(e, 11, CHAO + 1), AR);
  assert.equal(b.carga.length, 1, "perdeu metade da carga");
});

test("cascalho sem apoio cai; em cima de alguém, atordoa e esfarela", () => {
  const e = novaPartidaMineracao({ modo: "corrida", semente: 5, jogadores: [{ bot: null }] });
  const j = e.jogadores[0];
  for (let y = CHAO; y < CHAO + 6; y++) por(e, 20, y, AR);
  por(e, 20, CHAO + 6, TERRA);
  por(e, 20, CHAO, CASCALHO);
  j.x = 20.5; j.y = CHAO + 5.57; j.carga = [OURO];
  const ev: string[] = [];
  for (let i = 0; i < 200; i++) { passoMineracao(e, parado(e)); ev.push(...e.eventos.map(x => x.tipo)); }
  assert.ok(ev.includes("cascalho"));
  assert.ok(ev.includes("tonto"));
  assert.equal(j.carga.length, 0);
});

test("caminhos: a rocha dura bloqueia e cavar custa mais que andar no ar", () => {
  const e = novaPartidaMineracao({ modo: "corrida", semente: 6, jogadores: [{ bot: null }] });
  const { dist } = mapaDeCaminhos(e, 5, CHAO - 1);
  assert.equal(dist[(CHAO - 1) * LW + 8], 3);
  for (let i = 0; i < e.blocos.length; i++) if (e.blocos[i] === DURA) assert.equal(dist[i], Infinity);
});

test("só bots, de 1 a 8, nos dois modos: cavam, entregam e a lava sobe na sobrevivência", () => {
  for (const modo of ["corrida", "sobrevivencia"] as const) for (const n of [1, 4, 8]) {
    const e = novaPartidaMineracao({ modo, semente: 20 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    for (let i = 0; i < TEMPO + 5 && !e.terminado; i++) passoMineracao(e, parado(e));
    assert.ok(e.terminado);
    const total = e.jogadores.reduce((s, j) => s + j.pontos, 0);
    assert.ok(total >= 100, `${modo} ${n}: ${total}`);
    if (modo === "sobrevivencia") assert.ok(e.lavaY < 22);
  }
});
