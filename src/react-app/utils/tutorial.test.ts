import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DESCRICAO_DAS_TELAS, TUTORIAIS_DAS_TELAS, alvosDoPasso, chaveTutorialVisto, contemTexto, idGrupoMenu, jaViuTutorial,
  marcarTutorialVisto, posicionarBalao, tutorialDaTela, tutorialGeral,
} from "./tutorial.ts";

const grupos = [
  { title: "Visão Geral", items: [{ path: "/", label: "Início" }] },
  { title: "Entrega", items: [{ path: "/entregas", label: "Agenda" }, { path: "/apartamentos", label: "Apartamentos" }] },
  { title: "Gestão Individual", items: [{ path: "/gestao/caixinha", label: "Caixinha" }] },
];

test("tour geral tem um passo por grupo do menu, só com as abas liberadas", () => {
  const { passos } = tutorialGeral({ nome: "Maria Souza", grupos, variasObras: false });
  assert.equal(passos[0].titulo, "Bem-vindo, Maria!");
  assert.match(passos[0].texto, /3 abas/);
  const deGrupo = passos.filter(p => p.grupo);
  assert.deepEqual(deGrupo.map(p => p.grupo), ["Entrega", "Gestão Individual"]);
  assert.deepEqual(deGrupo[0].lista?.map(i => i.nome), ["Agenda", "Apartamentos"]);
  assert.ok(deGrupo[0].lista?.every(i => i.texto.length > 0));
  assert.equal(alvosDoPasso(deGrupo[0])[0].css, "#menu-entrega");
  assert.ok(deGrupo.every(p => p.menu === "abrir"));
  assert.equal(passos.at(-1)?.alvo, undefined);
  assert.ok(!passos.some(p => p.titulo === "Acesso em liberação"));
});

test("sem nenhuma aba liberada o tour explica que o acesso está em liberação", () => {
  const { passos } = tutorialGeral({ nome: null, grupos: [grupos[0]], variasObras: false });
  assert.equal(passos[0].titulo, "Bem-vindo ao NordTool!");
  assert.ok(passos.some(p => p.titulo === "Acesso em liberação"));
  assert.ok(!passos.some(p => p.grupo));
});

test("com várias obras o tour fala da troca de obra", () => {
  const um = tutorialGeral({ grupos, variasObras: false }).passos.find(p => p.titulo === "Você e a sua obra");
  const varias = tutorialGeral({ grupos, variasObras: true }).passos.find(p => p.titulo === "Você e a sua obra");
  assert.doesNotMatch(um?.texto ?? "", /troque/);
  assert.match(varias?.texto ?? "", /troque/);
});

test("o id do grupo é o mesmo que o menu usa", () => {
  assert.equal(idGrupoMenu("Gestão Individual"), "menu-gestão-individual");
});

test("cada tela do menu tem descrição e as prontas têm passo a passo", () => {
  for (const [rota, descricao] of Object.entries(DESCRICAO_DAS_TELAS)) {
    assert.ok(descricao.length > 10, rota);
    if (rota !== "/") assert.ok(tutorialDaTela(rota), `sem tutorial: ${rota}`);
  }
  for (const [rota, t] of Object.entries(TUTORIAIS_DAS_TELAS)) {
    assert.ok(t.passos.length > 0, rota);
    for (const p of t.passos) assert.ok(p.titulo && p.texto, rota);
  }
});

test("tutorial da tela ignora barra no fim; tela em construção ganha o aviso; desconhecida não tem", () => {
  assert.equal(tutorialDaTela("/gestao/caixinha/")?.titulo, "Caixinha");
  assert.equal(tutorialDaTela("/organizacional/rte")?.titulo, "Tela em construção");
  assert.equal(tutorialDaTela("/nao-existe"), null);
});

test("compara texto sem maiúsculas e acentos", () => {
  assert.ok(contemTexto("  Novo   LANÇAMENTO ", "novo lancamento"));
  assert.ok(!contemTexto(null, "x"));
});

test("balão fica embaixo do alvo, ou em cima, ou ao lado, sempre dentro da tela", () => {
  const tela = { largura: 400, altura: 800 };
  const balao = { largura: 300, altura: 200 };
  assert.deepEqual(posicionarBalao({ x: 10, y: 20, largura: 40, altura: 40 }, tela, balao), { x: 12, y: 72, lado: "baixo" });
  assert.equal(posicionarBalao({ x: 100, y: 700, largura: 40, altura: 40 }, tela, balao).lado, "cima");
  const centro = posicionarBalao(null, tela, balao);
  assert.deepEqual(centro, { x: 50, y: 300, lado: "centro" });
  const largo = posicionarBalao({ x: 0, y: 100, largura: 60, altura: 600 }, { largura: 1000, altura: 800 }, balao);
  assert.equal(largo.lado, "direita");
  const enorme = posicionarBalao({ x: 0, y: 0, largura: 400, altura: 800 }, tela, balao);
  assert.equal(enorme.lado, "centro");
  assert.equal(enorme.y, 588);
});

test("lembra por usuário que o tour já foi visto", () => {
  const m = new Map<string, string>();
  const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  assert.equal(jaViuTutorial(s, 1), false);
  marcarTutorialVisto(s, 1);
  assert.equal(jaViuTutorial(s, 1), true);
  assert.equal(jaViuTutorial(s, 2), false);
  assert.equal(m.get(chaveTutorialVisto(1)), "1");
  const quebrado = { getItem: () => { throw new Error("sem acesso"); } };
  assert.equal(jaViuTutorial(quebrado, 1), true);
});
