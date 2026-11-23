import { test } from "node:test";
import assert from "node:assert/strict";
import { ALTURA_NIVEL, ARMAS, GRADE, TAMANHO, VIDA, altura, chaoEm, enxerga, novaPartidaFps, passoFps, pontosFps, type EstadoFps } from "./fps.ts";

const P = { direcao: null, a: false, b: false } as const;
const parado = (e: EstadoFps) => e.soldados.map(() => P);
const aplainar = (e: EstadoFps) => { for (let z = 1; z < GRADE - 1; z++) for (let x = 1; x < GRADE - 1; x++) e.alturas[z * GRADE + x] = 0; };
const pessoas = (n: number) => Array.from({ length: n }, () => ({ bot: null }));

test("arena simétrica com borda alta, colina no meio e todo mundo nascendo no chão livre", () => {
  const e = novaPartidaFps({ modo: "matamata", mapa: "templo", semente: 1, jogadores: pessoas(8) });
  for (let i = 0; i < GRADE; i++) { assert.ok(altura(e, i, 0) >= 3); assert.ok(altura(e, 0, i) >= 3); }
  for (let z = 0; z < GRADE; z++) for (let x = 0; x < GRADE; x++) assert.equal(altura(e, x, z), altura(e, GRADE - 1 - x, GRADE - 1 - z));
  assert.equal(altura(e, 11, 11), 1);
  for (const s of e.soldados) assert.equal(s.y, chaoEm(e, s.x, s.z));
  assert.equal(e.soldados.length, 8);
});

test("anda, gira, para na parede e sobe na cobertura pulando", () => {
  const e = novaPartidaFps({ modo: "matamata", mapa: "templo", semente: 2, jogadores: pessoas(2) });
  aplainar(e);
  const s = e.soldados[0];
  s.x = 5; s.z = TAMANHO / 2; s.ang = Math.PI;
  for (let i = 0; i < 120; i++) passoFps(e, [{ direcao: "cima", a: false, b: false }, P]);
  assert.ok(s.x >= 2 + 0.39 && s.x < 2.6, `parou na borda (${s.x})`);
  passoFps(e, [{ direcao: "direita", a: false, b: false }, P]);
  assert.ok(Math.abs(s.ang) < Math.PI);
  // Cobertura de um nível à frente: andando não sobe, pulando sobe.
  e.alturas[12 * GRADE + 6] = 1;
  s.x = 17; s.z = 12 * 2 + 1; s.ang = Math.PI; s.y = 0;
  for (let i = 0; i < 60; i++) passoFps(e, [{ direcao: "cima", a: false, b: false }, P]);
  assert.ok(s.x > 14, "parado antes da cobertura");
  for (let i = 0; i < 60; i++) passoFps(e, [{ direcao: "cima", a: false, b: i % 30 === 0 }, P]);
  assert.ok(s.x < 14, `subiu na cobertura (${s.x})`);
});

test("pulo encadeado acelera e segurar B ao cair desliza", () => {
  const e = novaPartidaFps({ modo: "matamata", mapa: "fabrica", semente: 3, jogadores: pessoas(2) });
  aplainar(e);
  const s = e.soldados[0];
  s.x = 4; s.z = TAMANHO / 2; s.ang = 0;
  const encadeados: number[] = [];
  let desliza = false;
  let b = false;
  for (let i = 0; i < 200; i++) {
    // Solta B no ar e aperta de novo no passo em que cai.
    b = s.noChao ? !b : false;
    passoFps(e, [{ direcao: "cima", a: false, b }, P]);
    for (const ev of e.eventos) if (ev.tipo === "pulo" && ev.jogador === 0) encadeados.push(ev.encadeado);
  }
  assert.ok(Math.max(...encadeados) >= 2, `encadeou ${encadeados}`);
  // Segura B até cair.
  const t = novaPartidaFps({ modo: "matamata", mapa: "fabrica", semente: 3, jogadores: pessoas(2) });
  aplainar(t);
  const q = t.soldados[0];
  q.x = 4; q.z = TAMANHO / 2; q.ang = 0;
  for (let i = 0; i < 60; i++) { passoFps(t, [{ direcao: "cima", a: false, b: true }, P]); if (t.eventos.some(ev => ev.tipo === "desliza")) desliza = true; }
  assert.ok(desliza);
});

test("mira assistida acerta na altura, parede bloqueia e o abate faz voltar em 3 s", () => {
  const e = novaPartidaFps({ modo: "matamata", mapa: "templo", semente: 4, jogadores: pessoas(2) });
  aplainar(e);
  const [a, b] = e.soldados;
  a.x = 10; a.z = 20; a.ang = 0.1; a.y = 0;
  b.x = 18; b.z = 20; b.y = ALTURA_NIVEL; e.alturas[10 * GRADE + 9] = 1; // b em cima de um bloco
  passoFps(e, [{ direcao: null, a: true, b: false }, P]);
  assert.equal(b.vida, VIDA - ARMAS.pistola.dano, "acertou mesmo mais alto");
  // Parede alta no meio: não enxerga nem acerta.
  e.alturas[10 * GRADE + 7] = 3;
  assert.equal(enxerga(e, { x: a.x, y: 1.5, z: a.z }, { x: b.x, y: b.y + 1.1, z: b.z }), false);
  const vida = b.vida;
  for (let i = 0; i < 40; i++) passoFps(e, [{ direcao: null, a: true, b: false }, P]);
  assert.equal(b.vida, vida);
  e.alturas[10 * GRADE + 7] = 0;
  for (let i = 0; i < 200 && b.vivo; i++) passoFps(e, [{ direcao: null, a: true, b: false }, P]);
  assert.equal(b.vivo, false);
  assert.equal(a.abates, 1);
  for (let i = 0; i < 181; i++) passoFps(e, parado(e));
  assert.ok(b.vivo);
  assert.equal(b.vida, VIDA);
});

test("pedestal troca a arma, a munição acaba e volta para a pistola", () => {
  const e = novaPartidaFps({ modo: "matamata", mapa: "gelo", semente: 5, jogadores: pessoas(2) });
  const s = e.soldados[0], p = e.pedestais.find(x => x.arma === "sniper")!;
  s.x = p.x; s.z = p.z; s.y = chaoEm(e, p.x, p.z);
  passoFps(e, parado(e));
  assert.equal(s.arma, "sniper");
  assert.ok(p.voltaEm > e.passo);
  s.reserva = 0; s.pente = 1; s.recarga = 0;
  passoFps(e, [{ direcao: null, a: true, b: false }, P]);
  assert.equal(s.arma, "pistola");
});

test("Bandeira: pega a bandeira inimiga e captura na própria base", () => {
  const e = novaPartidaFps({ modo: "bandeira", mapa: "templo", semente: 6, jogadores: pessoas(2) });
  const s = e.soldados[0], deles = e.bandeiras[1], minha = e.bandeiras[0];
  s.x = deles.x; s.z = deles.z; s.y = chaoEm(e, s.x, s.z);
  passoFps(e, parado(e));
  assert.equal(s.bandeira, 1);
  s.x = minha.baseX; s.z = minha.baseZ; s.y = chaoEm(e, s.x, s.z);
  passoFps(e, parado(e));
  assert.equal(e.placarTimes[0], 1);
  assert.equal(deles.com, null);
});

test("Rei da Colina: só ganha ponto quem está sozinho no topo", () => {
  const e = novaPartidaFps({ modo: "colina", mapa: "templo", semente: 7, jogadores: pessoas(3) });
  const [a, b, c] = e.soldados;
  for (const s of [a, b]) { s.x = TAMANHO / 2; s.z = TAMANHO / 2; s.y = ALTURA_NIVEL; }
  c.x = 5; c.z = 5;
  for (let i = 0; i < 60; i++) passoFps(e, parado(e));
  assert.equal(a.pontos, 0);
  b.x = 5; b.z = 6; b.y = 0;
  for (let i = 0; i < 60; i++) { a.x = TAMANHO / 2; a.z = TAMANHO / 2; a.y = ALTURA_NIVEL; passoFps(e, parado(e)); }
  assert.equal(a.pontos, 1);
});

test("sozinho vira Contra Bots e há bots da arena", () => {
  const e = novaPartidaFps({ modo: "matamata", mapa: "templo", semente: 8, jogadores: pessoas(1) });
  assert.equal(e.modo, "bots");
  assert.ok(e.soldados.filter(s => s.extra).length >= 3);
  assert.equal(pontosFps(e).length, 1);
});

test("bots nos quatro modos, de 1 a 8: a partida acaba e há abates", () => {
  for (const modo of ["matamata", "bandeira", "colina", "bots"] as const) for (const n of [1, 2, 4, 8]) {
    const e = novaPartidaFps({ modo, mapa: "templo", semente: 30 + n, jogadores: Array.from({ length: n }, () => ({ bot: "dificil" as const })) });
    let abates = 0;
    for (let i = 0; i < 60 * 200 && !e.terminado; i++) { passoFps(e, parado(e)); abates += e.eventos.filter(x => x.tipo === "abate").length; }
    assert.ok(e.terminado, `${modo} ${n}`);
    assert.ok(abates > 0, `${modo} ${n}: houve abates`);
    assert.equal(pontosFps(e).length, n);
  }
});
