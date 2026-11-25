import { novaCampanha, passoCampanha, entrarCampanha, ETAPAS_CAMPANHA } from "./campanhaBombas.ts";
import { PassadaBombas } from "./passadaBombas.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVISO_MORTE_SUBITA, ENTRADA_VAZIA, atingir, posicaoRevanche, INTERVALO_MORTE_SUBITA, META_MOEDAS_SOLO, PAVIO, velocidadeEfetiva, alcance, aplicar, avisosMorteSubita, celula, espiral, idx, largadas, mapaDePerigo, novaPartida, passo, type Configuracao, type Estado,
} from "./bombas.ts";

const quatro = (bot: "facil" | "medio" | "dificil" | null = null): Configuracao => ({
  modo: "sobrevivencia", bioma: "fabrica", semente: 42,
  jogadores: [{ nome: "P1", bot }, { nome: "P2", bot: "medio" }, { nome: "P3", bot: "medio" }, { nome: "P4", bot: "medio" }],
});

function limpar(e: Estado) {
  for (let i = 0; i < e.grade.length; i++) if (e.grade[i] === "caixa") e.grade[i] = "chao";
}

test("mapa clássico: borda e pilares fixos, largadas livres, 15x13 até 4 e 17x15 até 8", () => {
  const e = novaPartida(quatro());
  assert.equal(e.largura, 15);
  assert.equal(e.altura, 13);
  assert.equal(celula(e, 0, 5), "pilar");
  assert.equal(celula(e, 2, 2), "pilar");
  for (const j of e.jogadores) {
    assert.equal(celula(e, j.x, j.y), "chao");
    assert.ok(celula(e, j.x + 1, j.y) !== "caixa" || celula(e, j.x - 1, j.y) !== "caixa");
  }
  const oito = novaPartida({ ...quatro(), jogadores: Array.from({ length: 8 }, (_, i) => ({ nome: `P${i + 1}`, bot: "medio" as const })) });
  assert.equal(oito.largura, 17);
  assert.equal(new Set(oito.jogadores.map(j => `${j.x},${j.y}`)).size, 8);
  assert.ok(largadas(17, 15).every(([x, y]) => x % 2 === 1 && y % 2 === 1), "largadas fora dos pilares");
});

test("mesma semente, mesmo mapa", () => {
  assert.deepEqual(novaPartida(quatro()).grade, novaPartida(quatro()).grade);
});

test("chama em cruz para no pilar e na primeira caixa", () => {
  const e = novaPartida(quatro());
  limpar(e);
  e.grade[idx(e, 3, 1)] = "caixa";
  e.grade[idx(e, 4, 1)] = "caixa";
  const casas = alcance(e, 1, 1, 5);
  assert.ok(casas.some(c => c.x === 3 && c.y === 1), "atinge a primeira caixa");
  assert.ok(!casas.some(c => c.x === 4 && c.y === 1), "não passa da caixa");
  assert.ok(!casas.some(c => c.x === 0), "não atravessa a borda");
});

test("bomba explode no pavio, destrói caixa e mata quem está na chama", () => {
  const e = novaPartida(quatro());
  limpar(e);
  e.grade[idx(e, 3, 1)] = "caixa";
  const p1 = e.jogadores[0];
  passo(e, [{ direcao: null, a: true, b: false }]);
  assert.equal(e.bombas.length, 1);
  // P1 fica parado em cima da bomba
  for (let i = 0; i < PAVIO + 2; i++) passo(e, [ENTRADA_VAZIA]);
  assert.equal(celula(e, 3, 1), "chao", "caixa destruída");
  assert.equal(p1.vivo, false, "quem ficou na chama morre");
});

test("reação em cadeia: a chama detona a outra bomba no mesmo passo", () => {
  const e = novaPartida(quatro());
  limpar(e);
  e.jogadores.forEach(j => (j.vivo = j.id !== 0 ? j.vivo : false));
  e.bombas.push({ id: 90, dono: 1, x: 5, y: 1, fogo: 2, pavio: 1, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: 5, destinoY: 1, origemX: 5, origemY: 1 });
  e.bombas.push({ id: 91, dono: 1, x: 7, y: 1, fogo: 2, pavio: 999, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: 7, destinoY: 1, origemX: 7, origemY: 1 });
  passo(e, []);
  assert.equal(e.bombas.length, 0);
  assert.ok(e.chamas.some(c => c.x === 9 && c.y === 1), "a segunda bomba explodiu");
});

test("escudo segura um golpe; power-ups aplicam", () => {
  const e = novaPartida(quatro());
  const j = e.jogadores[0];
  aplicar(e, j, "bomba"); aplicar(e, j, "fogo"); aplicar(e, j, "patins"); aplicar(e, j, "escudo"); aplicar(e, j, "chute");
  assert.deepEqual([j.bombas, j.fogo, j.chute, j.escudo], [2, 3, true, true]);
  assert.ok(j.velocidade > 3.6);
  aplicar(e, j, "fogoTotal");
  assert.equal(j.fogo, 10);
  aplicar(e, j, "caveira");
  assert.ok(j.maldicao);
  limpar(e);
  e.chamas.push({ x: j.x, y: j.y, ate: e.passo + 10, centro: true, eixo: "c" });
  passo(e, []);
  assert.equal(j.vivo, true, "o escudo segurou");
  assert.equal(j.escudo, false);
});

test("chute: andar contra a bomba a faz deslizar até o obstáculo", () => {
  const e = novaPartida(quatro());
  limpar(e);
  const j = e.jogadores[0];
  j.chute = true;
  e.bombas.push({ id: 5, dono: 1, x: 2, y: 1, fogo: 1, pavio: 9999, remota: false, deslizando: null, progresso: 0, voo: 0, destinoX: 2, destinoY: 1, origemX: 2, origemY: 1 });
  for (let i = 0; i < 120; i++) passo(e, [{ direcao: i < 2 ? "direita" : null, a: false, b: false }]);
  assert.ok(e.bombas[0].x > 4, `deslizou (x=${e.bombas[0].x})`);
});

test("mapa de perigo marca o alcance antes de explodir", () => {
  const e = novaPartida(quatro());
  limpar(e);
  const p = mapaDePerigo(e, { x: 5, y: 1, fogo: 2 });
  assert.equal(p[idx(e, 7, 1)], PAVIO);
  assert.equal(p[idx(e, 9, 1)], Infinity);
});

test("espiral da morte súbita cobre todo o interior", () => {
  const s = espiral(15, 13);
  assert.equal(new Set(s.map(([x, y]) => `${x},${y}`)).size, 13 * 11);
});

for (const dif of ["facil", "medio", "dificil"] as const) {
  test(`partida só de bots (${dif}) termina sem erro e com vencedor ou empate`, () => {
    const e = novaPartida({ ...quatro(dif), jogadores: quatro(dif).jogadores.map(j => ({ ...j, bot: dif })), segundos: 90 });
    let n = 0;
    while (!e.terminado && n++ < 90 * 60 + 10) passo(e, []);
    assert.ok(e.terminado);
    assert.ok(e.passo <= 90 * 60);
  });
}

test("bots difíceis sobrevivem mais que os fáceis (média de 6 partidas)", () => {
  let vitoriasDificil = 0;
  for (let s = 1; s <= 6; s++) {
    const e = novaPartida({ modo: "sobrevivencia", bioma: "gelo", semente: s * 101, segundos: 120,
      jogadores: [{ nome: "D1", bot: "dificil" }, { nome: "F1", bot: "facil" }, { nome: "D2", bot: "dificil" }, { nome: "F2", bot: "facil" }] });
    while (!e.terminado) passo(e, []);
    if (e.vencedor === 0 || e.vencedor === 2) vitoriasDificil++;
  }
  assert.ok(vitoriasDificil >= 3, `difíceis venceram ${vitoriasDificil} de 6`);
});

test("modo moedas: termina no tempo e quem tem mais moedas vence", () => {
  const e = novaPartida({ ...quatro("medio"), modo: "moedas", segundos: 40, jogadores: quatro("medio").jogadores.map(j => ({ ...j, bot: "medio" as const })) });
  while (!e.terminado) passo(e, []);
  const max = Math.max(...e.jogadores.map(j => j.moedas));
  if (e.vencedor !== null) assert.equal(e.jogadores[e.vencedor].moedas, max);
});

test("modo times: termina quando sobra um time", () => {
  const e = novaPartida({ ...quatro("medio"), modo: "times", segundos: 120, jogadores: quatro("medio").jogadores.map(j => ({ ...j, bot: "dificil" as const })) });
  while (!e.terminado) passo(e, []);
  if (e.timeVencedor !== null) assert.ok(e.jogadores.filter(j => j.vivo).every(j => j.time === e.timeVencedor));
});

test("sozinho: Desafio vence ao limpar todas as caixas e perde ao cair ou no fim do tempo", async () => {
  const solo: Configuracao = { modo: "sobrevivencia", bioma: "fabrica", semente: 7, jogadores: [{ nome: "Eu", bot: null }] };
  const e = novaPartida(solo);
  assert.equal(e.jogadores.length, 1);
  assert.ok(e.grade.includes("caixa"));
  passo(e, [ENTRADA_VAZIA]);
  assert.equal(e.terminado, false, "com caixas no mapa, continua");
  e.grade = e.grade.map(c => (c === "caixa" ? "chao" : c));
  passo(e, [ENTRADA_VAZIA]);
  assert.equal(e.terminado, true);
  assert.equal(e.vencedor, 0);

  const caiu = novaPartida(solo);
  caiu.jogadores[0].vivo = false;
  passo(caiu, [ENTRADA_VAZIA]);
  assert.equal(caiu.terminado, true);
  assert.equal(caiu.vencedor, null);

  const tempo = novaPartida({ ...solo, segundos: 1 });
  for (let i = 0; i < 61 && !tempo.terminado; i++) passo(tempo, [ENTRADA_VAZIA]);
  assert.equal(tempo.terminado, true);
  assert.equal(tempo.vencedor, null);
});

test("sozinho na Caça às Moedas: vence quem bate a meta", async () => {
  const { META_MOEDAS_SOLO } = await import("./bombas.ts");
  const solo: Configuracao = { modo: "moedas", bioma: "gelo", semente: 3, segundos: 1, jogadores: [{ nome: "Eu", bot: null }] };
  const pouco = novaPartida(solo);
  for (let i = 0; i < 61 && !pouco.terminado; i++) passo(pouco, [ENTRADA_VAZIA]);
  assert.equal(pouco.vencedor, null);
  const meta = novaPartida(solo);
  meta.jogadores[0].moedas = META_MOEDAS_SOLO;
  for (let i = 0; i < 61 && !meta.terminado; i++) passo(meta, [ENTRADA_VAZIA]);
  assert.equal(meta.vencedor, 0);
});

function arenaSemBots() {
  const e = novaPartida({ ...quatro(), jogadores: quatro().jogadores.map(j => ({ ...j, bot: null })) });
  limpar(e);
  return e;
}

test("curva antecipada: um toque entre casas é executado na próxima esquina", () => {
  const e = arenaSemBots(), j = e.jogadores[0];
  Object.assign(j, { x: 2.6, y: 1, alvoX: 3, alvoY: 1 });
  passo(e, [{ direcao: "baixo", a: false, b: false }]);
  for (let n = 0; n < 12; n++) passo(e, [ENTRADA_VAZIA]);
  assert.equal(j.x, 3);
  assert.ok(j.y > 1, "a curva sobrevive à soltura do botão antes da esquina");
  for (let n = 0; n < 40; n++) passo(e, [ENTRADA_VAZIA]);
  assert.equal(j.y, 2, "o toque não se repete por várias casas");
});

test("soltar a direção encerra o movimento na casa atual, sem andar uma casa extra", () => {
  const e = arenaSemBots(), j = e.jogadores[0];
  for (let n = 0; n < 5; n++) passo(e, [{ direcao: "direita", a: false, b: false }]);
  for (let n = 0; n < 40; n++) passo(e, [ENTRADA_VAZIA]);
  assert.equal(j.x, 2);
  assert.equal(j.alvoX, 2);
});

test("curva bloqueada expira e inversão no meio da casa continua imediata", () => {
  const e = arenaSemBots(), j = e.jogadores[0];
  Object.assign(j, { x: 1.6, y: 1, alvoX: 2, alvoY: 1 });
  passo(e, [{ direcao: "baixo", a: false, b: false }]); // (2,2) é pilar
  for (let n = 0; n < 25; n++) passo(e, [ENTRADA_VAZIA]);
  assert.equal(j.x, 2); assert.equal(j.y, 1); assert.equal(j.direcaoPendente, null);
  Object.assign(j, { x: 2.4, y: 1, alvoX: 3, alvoY: 1 });
  passo(e, [{ direcao: "esquerda", a: false, b: false }]);
  assert.equal(j.alvoX, 2); assert.ok(j.x < 2.4);
});

test("solo de moedas: 100 sementes sempre oferecem pelo menos a meta e continuam determinísticas", () => {
  for (let semente = 0; semente < 100; semente++) {
    const cfg: Configuracao = { modo: "moedas", bioma: "gelo", semente, jogadores: [{ nome: "Eu", bot: null }] };
    const e = novaPartida(cfg);
    assert.ok([...e.escondidos.values()].filter(i => i === "moeda").length >= META_MOEDAS_SOLO, `semente ${semente}`);
    assert.deepEqual(e.escondidos, novaPartida(cfg).escondidos);
  }
});

test("meta solo encerra a tentativa imediatamente; jogador ainda não espera o relógio zerar", () => {
  const e = novaPartida({ modo: "moedas", bioma: "fabrica", semente: 42, jogadores: [{ nome: "Eu", bot: null }] });
  e.jogadores[0].moedas = META_MOEDAS_SOLO - 1;
  e.moedas.push({ x: 1, y: 1 });
  passo(e, [ENTRADA_VAZIA]);
  assert.equal(e.terminado, true); assert.equal(e.vencedor, 0); assert.equal(e.passo, 1);
});

test("morte súbita anuncia a casa por 800 ms e o impacto segue o mesmo aviso público", () => {
  const e = arenaSemBots();
  e.duracao = 61 * 60;
  e.passo = 59;
  assert.deepEqual(avisosMorteSubita(e), []);
  passo(e, []);
  const primeiro = avisosMorteSubita(e)[0];
  assert.deepEqual(primeiro, { x: 1, y: 1, em: AVISO_MORTE_SUBITA });
  assert.equal(mapaDePerigo(e)[idx(e, 1, 1)], AVISO_MORTE_SUBITA, "bots também recebem o aviso");
  for (let n = 0; n < AVISO_MORTE_SUBITA - 1; n++) passo(e, []);
  assert.equal(celula(e, 1, 1), "chao");
  passo(e, []);
  assert.equal(celula(e, primeiro.x, primeiro.y), "pilar");
  assert.ok(e.eventos.some(ev => ev.tipo === "bloco" && ev.x === primeiro.x && ev.y === primeiro.y));
  assert.equal(e.jogadores[0].vivo, false);
  const segundo = avisosMorteSubita(e)[0];
  assert.equal(segundo.em, INTERVALO_MORTE_SUBITA);
  const espelho = { ...e, escondidos: new Map() };
  assert.deepEqual(avisosMorteSubita(espelho), avisosMorteSubita(e));
});

test("bomba plantada em uma chama ativa explode no mesmo passo", () => {
  const e = arenaSemBots();
  e.chamas.push({ x: 1, y: 1, ate: 20, centro: true, eixo: "c" });
  passo(e, [{ direcao: null, a: true, b: false }]);
  assert.equal(e.bombas.length, 0);
  assert.ok(e.eventos.some(ev => ev.tipo === "explosao"));
});


test("passada acompanha deslocamento real mesmo com destino igual à posição", () => {
  const p = new PassadaBombas();
  p.atualizar(1, 1, 1 / 60, true);
  p.atualizar(1.04, 1.04, 1 / 60, true);
  assert.ok(p.fase > 0); assert.ok(p.intensidade > 0);
  const fase = p.fase;
  p.atualizar(1.04, 1.04, 1 / 60, true);
  assert.equal(p.fase, fase);
  p.atualizar(1.04, 1.04, 0, true);
  assert.equal(p.fase, fase);
  p.atualizar(10, 10, 1 / 60, true);
  assert.equal(p.fase, fase, "teleporte não dispara passada");
  for (let i = 0; i < 60; i++) p.atualizar(10, 10, 1 / 60, true);
  assert.ok(p.intensidade < 0.001, "volta ao repouso quando para");
});

test("movimento em diagonal usa os dois eixos sem ganhar velocidade nem atravessar pilares", () => {
  const e = novaPartida(quatro()); limpar(e);
  const j = e.jogadores[0]; j.x = j.alvoX = 5; j.y = j.alvoY = 5;
  passo(e, [{ direcao: "baixo", eixoX: 1, eixoY: 1, a: false, b: false }]);
  assert.ok(j.x > 5 && j.y > 5);
  assert.ok(Math.abs(Math.hypot(j.x - 5, j.y - 5) - j.velocidade / 60) < 1e-8);
  for (let i = 0; i < 90; i++) passo(e, [{ direcao: "baixo", eixoX: 1, eixoY: 1, a: false, b: false }]);
  assert.ok(j.x < 5.5 && j.y < 5.5, "pilar 6,6 bloqueia a diagonal");
  const x = j.x, y = j.y;
  passo(e, [{ direcao: null, eixoX: 0, eixoY: 0, a: false, b: false }]);
  assert.equal(j.x, x); assert.equal(j.y, y);
});

test("plantar bomba permite sair por inteiro e impede voltar através dela", () => {
  for (const [dx, dy, direcao] of [[1, 0, "direita"], [-1, 0, "esquerda"], [0, 1, "baixo"], [0, -1, "cima"], [1, -1, "cima"]] as const) {
    const e = novaPartida(quatro()); limpar(e);
    for (let y = 1; y < e.altura - 1; y++) for (let x = 1; x < e.largura - 1; x++) e.grade[idx(e, x, y)] = "chao";
    const j = e.jogadores[0]; j.x = j.alvoX = 5; j.y = j.alvoY = 5;
    passo(e, [{ direcao: null, eixoX: 0, eixoY: 0, a: true, b: false }]);
    for (let i = 0; i < 20; i++) passo(e, [{ direcao, eixoX: dx, eixoY: dy, a: false, b: false }]);
    assert.ok(Math.hypot(j.x - 5, j.y - 5) > 0.8, `sai da bomba: ${dx},${dy}`);
    for (let i = 0; i < 20; i++) passo(e, [{ direcao, eixoX: -dx, eixoY: -dy, a: false, b: false }]);
    assert.ok(Math.hypot(j.x - 5, j.y - 5) > 0.7, "bomba continua sólida após sair");
  }
});


test("revanche: demora para entrar na borda, lança com cooldown e retorna ao eliminar", () => {
  const e = novaPartida(quatro()); limpar(e);
  const j = e.jogadores[0]; j.invulneravelAte = 0; atingir(e, j);
  assert.equal(posicaoRevanche(e, j), null);
  for (let i = 0; i < 48; i++) passo(e, []);
  assert.ok(posicaoRevanche(e, j));
  passo(e, [{ direcao: "direita", a: true, b: false }]);
  const b = e.bombas.find(b => b.revanche)!; assert.ok(b); assert.equal(b.dono, 0); assert.equal(b.voo, 23);
  passo(e, [{ ...ENTRADA_VAZIA }]); passo(e, [{ ...ENTRADA_VAZIA, a: true }]);
  assert.equal(e.bombas.filter(b => b.revanche).length, 1);
  const rival = e.jogadores[1]; rival.bot = null; rival.invulneravelAte = 0; rival.x = rival.alvoX = 5; rival.y = rival.alvoY = 5;
  e.chamas.push({ x: 5, y: 5, ate: e.passo + 30, centro: true, eixo: "c", dono: 0, revanche: true });
  passo(e, []);
  assert.equal(rival.vivo, false); assert.equal(j.vivo, true); assert.equal(j.revanche, undefined);
  assert.ok(j.invulneravelAte > e.passo); assert.ok(e.eventos.some(ev => ev.tipo === "retorno"));
});

test("revanche não premia escudo, não existe em moedas e encerra na morte súbita", () => {
  const e = novaPartida(quatro()); limpar(e); atingir(e, e.jogadores[0]);
  e.passo = 50; const rival = e.jogadores[1]; rival.bot = null; rival.escudo = true; rival.invulneravelAte = 0;
  e.chamas.push({ x: rival.x, y: rival.y, ate: 100, centro: true, eixo: "c", dono: 0, revanche: true }); passo(e, []);
  assert.equal(e.jogadores[0].vivo, false); assert.equal(rival.vivo, true);
  e.morteSubita = { ordem: [], indice: 0 }; assert.equal(posicaoRevanche(e, e.jogadores[0]), null);
  const moedas = novaPartida({ ...quatro(), modo: "moedas" }); atingir(moedas, moedas.jogadores[0]); assert.equal(moedas.jogadores[0].revanche, undefined);
});

test("campanha: nove fases, três chefes, entrada no meio consome uma vida sem reiniciar", () => {
  assert.equal(ETAPAS_CAMPANHA.length, 9);
  const e = novaCampanha(Array.from({ length: 8 }, (_, i) => `P${i + 1}`), [0]);
  const c = e.campanha!; assert.equal(c.vidas, 3); assert.equal(e.jogadores[1].vivo, false);
  passoCampanha(e, []); const tempo = e.passo; const mapa = [...e.grade];
  assert.equal(entrarCampanha(e, 1), true); assert.equal(c.vidas, 2); assert.equal(e.passo, tempo); assert.deepEqual(e.grade, mapa);
  assert.equal(entrarCampanha(e, 1), false); assert.equal(c.vidas, 2);
  c.vidas = 0; assert.equal(entrarCampanha(e, 2), false); assert.equal(e.jogadores[2].vivo, false);
  for (const etapa of [2, 5, 8]) {
    const chefe = novaCampanha(["P1"], [0], etapa); assert.equal(chefe.campanha!.inimigos[0].tipo, "chefe"); assert.ok(chefe.campanha!.inimigos[0].vida >= 4);
  }
});

test("campanha: portal depende de inimigos, passa de fase e termina com vitória cooperativa", () => {
  const e = novaCampanha(["P1", "P2"], [0, 1]); const c = e.campanha!;
  const j = e.jogadores[0]; j.x = j.alvoX = c.saida.x; j.y = j.alvoY = c.saida.y;
  passoCampanha(e, []); assert.equal(c.transicaoEm, 0);
  c.inimigos.forEach(o => o.vida = 0); passoCampanha(e, []); assert.ok(c.transicaoEm > 0);
  for (let i = 0; i < 121; i++) passoCampanha(e, []);
  assert.equal(c.etapa, 1); assert.equal(e.terminado, false); assert.equal(c.vidas, 4);
  const final = novaCampanha(["P1", "P2"], [0, 1], 8);
  final.campanha!.inimigos.forEach(o => o.vida = 0);
  final.jogadores[0].x = final.jogadores[0].alvoX = final.campanha!.saida.x;
  final.jogadores[0].y = final.jogadores[0].alvoY = final.campanha!.saida.y;
  passoCampanha(final, []); assert.equal(final.terminado, true); assert.equal(final.timeVencedor, 0);
});

test("campanha: morte usa reserva, retorno tem proteção e sem vidas termina a tentativa", () => {
  const e = novaCampanha(["P1", "P2"], [0]);
  atingir(e, e.jogadores[0]);
  for (let i = 0; i < 92; i++) passoCampanha(e, []);
  assert.equal(e.jogadores[0].vivo, true); assert.equal(e.campanha!.vidas, 2); assert.ok(e.jogadores[0].invulneravelAte > e.passo);
  e.campanha!.vidas = 0; e.jogadores[0].escudo = false; atingir(e, e.jogadores[0]); passoCampanha(e, []);
  assert.equal(e.terminado, true); assert.equal(e.vencedor, null);
});


test("ovo vira montaria original, protege de um golpe e mantém o jogador vivo", () => {
  const e = novaPartida(quatro()); limpar(e); const j = e.jogadores[0];
  aplicar(e, j, "ovo"); assert.ok(j.montaria); assert.ok(["brasa", "vento", "pedra"].includes(j.montaria.tipo));
  const tipo = j.montaria.tipo; aplicar(e, j, "ovo"); assert.equal(j.montaria.tipo, tipo);
  atingir(e, j); assert.equal(j.vivo, true); assert.equal(j.montaria, undefined); assert.ok(j.invulneravelAte > e.passo);
  assert.ok([...e.escondidos.values()].includes("ovo"));
});
test("montarias: habilidades diferentes respeitam recarga e não atravessam pilares", () => {
  for (const tipo of ["vento", "pedra", "brasa"] as const) {
    const e = novaPartida(quatro()); limpar(e); const j = e.jogadores[0];
    j.x = j.alvoX = 5; j.y = j.alvoY = 5; j.direcao = "direita";
    j.montaria = { tipo, recargaAte: 0, impulso: 0 };
    passo(e, [{ ...ENTRADA_VAZIA, b: true }]);
    assert.ok(j.montaria.recargaAte > e.passo);
    if (tipo === "vento") assert.ok(velocidadeEfetiva(j) > j.velocidade);
    if (tipo === "pedra") assert.ok(j.invulneravelAte > e.passo);
    if (tipo === "brasa") assert.ok(e.bombas.some(b => b.voo > 0 && b.destinoX === 8));
    const recarga = j.montaria.recargaAte;
    passo(e, [ENTRADA_VAZIA]); passo(e, [{ ...ENTRADA_VAZIA, b: true }]); assert.equal(j.montaria.recargaAte, recarga);
    for (let i = 0; i < 30; i++) passo(e, [{ direcao: "baixo", eixoX: 1, eixoY: 1, a: false, b: false }]);
    assert.ok(j.x < 5.5 && j.y < 5.5);
  }
});
test("campanha apresenta quatro espécies e chefes das três regiões", () => {
  const tipos = new Set<string>();
  for (let i = 0; i < 9; i++) { const e = novaCampanha(["P1"], [0], i); e.campanha!.inimigos.forEach(o => tipos.add(o.tipo)); if (i % 3 === 2) assert.equal(e.campanha!.inimigos[0].aspecto, Math.floor(i / 3)); }
  assert.deepEqual([...tipos].sort(), ["cauteloso", "cacador", "chefe", "patrulha", "saltador"].sort());
});
