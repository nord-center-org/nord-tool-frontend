import assert from "node:assert/strict";
import { test } from "node:test";

import { montarPavimentos } from "./escadinha.ts";
import {
  LEGENDA, MODELO_CURY, atividadesEmOrdem, avaliarGrade, camadaDaAtividade, camadasDoFiltro, camadasPorPavimento, chaveCelula, gargalos,
  lerGrade, lerModeloEscadinha, linhasDaGrade, periodoDe, resumir, type Grade, type ModeloEscadinha,
} from "./escadinhaCury.ts";

const pavimentos = montarPavimentos({ tipos: 3, subsolos: 1, terreo: true, mezanino: false, cobertura: false, barrilete: true }, [[0, 0], [10, 0], [10, 5], [0, 5]]);
const linhas = linhasDaGrade({ pavimentos });

/** Modelo pequeno: 2 ciclos de 10 dias, meta 1 pavimento. */
const mini: ModeloEscadinha = {
  versao: 2, diasPeriodo: 10, ciclos: [
    { id: "c1", nome: "Ciclo 1", cor: "#86e08a", dias: 10, metaPav: 1, metasAtivas: true, atividades: [
      { id: "alv", nome: "ALVENARIA", camada: "alvenaria" }, { id: "laje", nome: "LAJE TIPO", camada: "laje" }] },
    { id: "c2", nome: "Ciclo 2", cor: "#facc15", dias: 10, metaPav: 1, metasAtivas: true, atividades: [{ id: "gesso", nome: "GESSO", camada: "gesso" }] },
  ],
};

test("modelo da Cury: 13 ciclos, 96 atividades, ids únicos, install e camadas", () => {
  assert.equal(MODELO_CURY.ciclos.length, 13);
  const todas = atividadesEmOrdem(MODELO_CURY);
  assert.equal(todas.length, 96);
  assert.equal(new Set(todas.map(x => x.atividade.id)).size, 96);
  assert.equal(MODELO_CURY.ciclos[0].metaPav, 2);
  assert.equal(MODELO_CURY.ciclos[12].metasAtivas, false);
  const por = (nome: string) => todas.find(x => x.atividade.nome.startsWith(nome))!.atividade;
  assert.equal(por("ALVENARIA +").camada, "alvenaria");
  assert.equal(por("LOUÇAS E BANCADAS").camada, "loucas");
  assert.equal(por("LOUÇAS E BANCADAS").install, true);
  assert.equal(por("GESSO LISO").camada, "gesso");
  assert.equal(por("CAIXILHOS").camada, "esquadria");
  assert.equal(por("TEXTURA FACHADA").camada, "fachada");
  assert.equal(por("PRUMADAS GÁS").camada, "gas");
  assert.equal(por("ELEVADORES").camada, "elevador");
  assert.equal(por("RETIRADA DO RE-ESCORAMENTO").camada, "desescoramento");
  assert.equal(camadaDaAtividade("Piso laminado do quarto"), "piso");
});

test("lerModeloEscadinha: formato antigo vira Cury; saneia limites e ids repetidos", () => {
  assert.equal(lerModeloEscadinha({ atividades: ["Marcação"], diasPorCiclo: 7 }), MODELO_CURY);
  assert.equal(lerModeloEscadinha(null), MODELO_CURY);
  const m = lerModeloEscadinha({ versao: 2, diasPeriodo: 999, ciclos: [{ id: "c1", nome: " A ", cor: "vermelho", dias: 0, metaPav: 50, atividades: [{ id: "x", nome: "Gesso" }, { id: "x", nome: "Louças" }, { nome: "  " }] }] });
  assert.equal(m.diasPeriodo, 15);
  assert.equal(m.ciclos[0].nome, "A");
  assert.equal(m.ciclos[0].cor, "#94a3b8");
  assert.equal(m.ciclos[0].dias, 15);
  assert.equal(m.ciclos[0].metaPav, 1);
  assert.equal(m.ciclos[0].atividades.length, 2);
  assert.notEqual(m.ciclos[0].atividades[0].id, m.ciclos[0].atividades[1].id);
  assert.equal(m.ciclos[0].atividades[1].camada, "loucas");
});

test("linhas: do mais alto para o térreo, lados A e B, sem subsolo e barrilete", () => {
  assert.deepEqual(linhas.map(l => `${l.pavimento.id}|${l.lado}`), ["p3|A", "p3|B", "p2|A", "p2|B", "p1|A", "p1|B", "terreo|A", "terreo|B"]);
  assert.equal(linhas.find(l => l.pavimento.id === "terreo")!.nivel, 0);
});

test("legenda: exatamente os 9 status da obra, sem cadeado", () => {
  assert.deepEqual(LEGENDA.map(l => l.rotulo), [
    "Executado", "Em execução", "Atrasado", "Atividade atrasada em execução", "Atividade em atraso com atividade anterior pendente",
    "Atividade dentro do período do ciclo (15 dias)", "Não se aplica nessa obra", "Vazio", "Meta do ciclo (pendente) — automático",
  ]);
});

test("sem início da obra: só o que foi marcado; o resto fica vazio", () => {
  const g: Grade = { [chaveCelula("terreo", "A", "alv")]: { s: "E" }, [chaveCelula("terreo", "A", "laje")]: { s: "N" }, [chaveCelula("p1", "A", "alv")]: { s: "X" } };
  const av = avaliarGrade(mini, linhas, g, null, "2026-10-29");
  assert.equal(av.get(chaveCelula("terreo", "A", "alv"))!.status, "executado");
  assert.equal(av.get(chaveCelula("terreo", "A", "laje"))!.status, "na");
  assert.equal(av.get(chaveCelula("p1", "A", "alv"))!.status, "execucao");
  assert.equal(av.get(chaveCelula("p1", "B", "alv"))!.status, "vazio");
  assert.equal(av.get(chaveCelula("p2", "A", "alv"))!.status, "vazio");
});

test("plano: período, atrasado, atrasado em execução, atraso com anterior pendente e meta", () => {
  // Início 01/10, ciclos de 10 dias: térreo do ciclo 1 vence 11/10; p1 vence 21/10; p2 31/10.
  const g: Grade = { [chaveCelula("terreo", "A", "alv")]: { s: "X" } };
  const av = avaliarGrade(mini, linhas, g, "2026-10-01", "2026-10-25");
  assert.equal(av.get(chaveCelula("terreo", "A", "alv"))!.status, "atrasadoExec");
  assert.equal(av.get(chaveCelula("terreo", "B", "alv"))!.status, "atrasado");
  assert.equal(av.get(chaveCelula("p1", "A", "alv"))!.status, "atrasoAnterior", "venceu em 21/10 e o térreo não terminou");
  assert.equal(av.get(chaveCelula("p2", "A", "alv"))!.status, "periodo", "no período (até 31/10), mas o p1 ainda não terminou");
  assert.deepEqual(av.get(chaveCelula("p1", "A", "alv"))!.janela, ["2026-10-11", "2026-10-21"]);
  // Período de referência 21/10–31/10: p2 do ciclo 1 vence 31/10 → meta.
  assert.equal(av.get(chaveCelula("p2", "A", "alv"))!.meta, true);
  assert.equal(av.get(chaveCelula("p3", "A", "alv"))!.meta, false);
  assert.deepEqual(periodoDe("2026-10-01", "2026-10-25", 10), { indice: 2, inicio: "2026-10-21", fim: "2026-10-31" });
  // Liberado e dentro da janela = meta do ciclo (automático); fora da janela ainda = vazio.
  const g2: Grade = { [chaveCelula("terreo", "A", "alv")]: { s: "E" } };
  const av2 = avaliarGrade(mini, linhas, g2, "2026-10-01", "2026-10-15");
  assert.equal(av2.get(chaveCelula("p1", "A", "alv"))!.status, "meta");
  assert.equal(av2.get(chaveCelula("p2", "A", "alv"))!.status, "vazio");
});

test("resumo e gargalos: quem segura mais atrasos aparece primeiro", () => {
  const g: Grade = {};
  const av = avaliarGrade(mini, linhas, g, "2026-10-01", "2026-11-20");
  const r = resumir(mini, linhas, g, av);
  assert.equal(r.percentual, 0);
  assert.equal(r.avancoPorCiclo[0].pavimentosConcluidos, 0);
  const lista = gargalos(mini, linhas, av);
  assert.equal(lista[0].linha.pavimento.id, "terreo", "o térreo destrava tudo acima");
  assert.ok(lista[0].travaAtrasadas >= 3);

  const feito: Grade = {};
  for (const lado of ["A", "B"] as const) for (const a of ["alv", "laje"]) feito[chaveCelula("terreo", lado, a)] = { s: "E" };
  const r2 = resumir(mini, linhas, feito, avaliarGrade(mini, linhas, feito, null, "2026-10-29"));
  assert.equal(r2.avancoPorCiclo[0].pavimentosConcluidos, 1);
  assert.equal(r2.avancoPorCiclo[0].ultimo, "Térreo");
});

test("3D: camadas por pavimento/lado e filtro", () => {
  const g = lerGrade({ "p1|A|alv": { s: "E" }, "p1|A|laje": { s: "X" }, "p1|B|gesso": { s: "N" }, "lixo": { s: "Z" } });
  assert.equal(Object.keys(g).length, 3);
  const m = camadasPorPavimento(mini, g);
  assert.equal(m.get("p1|A")!.get("alvenaria"), "E");
  assert.equal(m.get("p1|A")!.get("laje"), "X");
  assert.equal(m.has("p1|B"), false, "N/A não acende nada");
  assert.equal(camadasDoFiltro(mini, { tipo: "tudo" }), null);
  assert.deepEqual([...camadasDoFiltro(mini, { tipo: "atividade", id: "gesso" })!], ["gesso"]);
  assert.deepEqual([...camadasDoFiltro(mini, { tipo: "ciclo", id: "c1" })!].sort(), ["alvenaria", "laje"]);
});
