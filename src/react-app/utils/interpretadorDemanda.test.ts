import assert from "node:assert/strict";
import { test } from "node:test";

import { dividirPedidos, interpretarDemanda } from "./interpretadorDemanda.ts";

const HOJE = "2026-11-12"; // quinta-feira
const um = (texto: string) => { const r = interpretarDemanda(texto, HOJE); assert.equal(r.demandas.length, 1, texto); return r.demandas[0]; };

test("atividade fixa: dias da semana e horário", () => {
  const d = um("Reunião de obra toda segunda e quarta às 9h");
  assert.equal(d.nmCronogramaSemanal, "Reunião de obra");
  assert.equal(d.nmCategoria, "Engenharia");
  assert.equal(d.flFixo, true);
  assert.deepEqual(d.diasSemana, [1, 3]);
  assert.equal(d.nmHorario, "09:00");
  assert.deepEqual(um("Treino de segunda a sexta às 6h30").diasSemana, [1, 2, 3, 4, 5]);
  assert.equal(um("Treino de segunda a sexta às 6h30").nmCategoria, "Atlética");
  assert.deepEqual(um("Deploy todos os dias às 18:00").diasSemana, [1, 2, 3, 4, 5, 7]);
  assert.deepEqual(um("Conferir FVS nos dias úteis").diasSemana, [1, 2, 3, 4, 5]);
  assert.deepEqual(um("Célula toda terça, quinta e sábado 20h").diasSemana, [2, 4, 7]);
});

test("datas relativas, horários e prazo", () => {
  assert.equal(um("Ligar para o fornecedor de blocos amanhã às 14h").dtAgendamento, "2026-11-13T14:00");
  assert.equal(um("Ensaio da banda quinta que vem às 20h").dtAgendamento, "2026-11-19T20:00");
  assert.equal(um("Concretagem da laje sábado 7h").dtAgendamento, "2026-11-14T07:00");
  assert.equal(um("Consulta no dentista 25 de novembro às 3 da tarde").dtAgendamento, "2026-11-25T15:00");
  const v = um("Vistoria do bloco B dia 20/11 às 10h (levar a planta) #nord1");
  assert.equal(v.nmCronogramaSemanal, "Vistoria do bloco B");
  assert.equal(v.dtAgendamento, "2026-11-20T10:00");
  assert.equal(v.txObservacao, "levar a planta");
  assert.equal(v.nmTag, "nord1");
  const p = um("Pagar conta de luz até dia 15");
  assert.equal(p.dtPrazo, "2026-11-15");
  assert.equal(p.dtAgendamento, null);
  assert.equal(p.nmCategoria, "Pessoal");
  const r = um("Entregar o relatório de medição na sexta, prazo dia 6");
  assert.equal(r.dtAgendamento, "2026-11-13T09:00", "sem horário: 9h, como no formulário");
  assert.equal(r.dtPrazo, "2026-12-06", "dia 6 já passou neste mês");
  assert.match(interpretarDemanda("Reunião sexta", HOJE).mensagem, /coloquei 9h/);
});

test("período, domingo, status e categoria", () => {
  const f = um("Férias de 15 a 20/12");
  assert.equal(f.dtAgendamento, "2026-12-15T09:00");
  assert.equal(f.dtFimAgendamento, "2026-12-20");
  const c = interpretarDemanda("Culto domingo às 19h", HOJE);
  assert.equal(c.demandas[0].dtAgendamento, null);
  assert.match(c.mensagem, /domingo não existe/);
  assert.equal(um("Aguardar retorno do cliente sobre o orçamento").nmStatusCronograma, "aguardar");
  assert.equal(um("Estudar para a prova").nmCategoria, "Acadêmica");
  assert.equal(um("Revisar o pull request do app").nmCategoria, "Programação");
  assert.equal(um("Organizar a garagem categoria pessoal").nmCategoria, "Pessoal");
  assert.equal(um("Organizar a garagem categoria pessoal").nmCronogramaSemanal, "Organizar a garagem");
});

test("várias demandas e ajustes", () => {
  assert.deepEqual(dividirPedidos("Comprar cimento\nLigar pro arquiteto; - Revisar FVS do bloco A"), ["Comprar cimento", "Ligar pro arquiteto", "Revisar FVS do bloco A"]);
  const r = interpretarDemanda("Comprar cimento\nLigar pro arquiteto amanhã 8h\n- Revisar FVS do bloco A", HOJE);
  assert.deepEqual(r.demandas.map(d => d.nmCronogramaSemanal), ["Comprar cimento", "Ligar pro arquiteto", "Revisar FVS do bloco A"]);
  const base = interpretarDemanda("Reunião com o cliente sexta às 9h", HOJE).demandas;
  const a = interpretarDemanda("muda para segunda às 10h", HOJE, base);
  assert.equal(a.demandas[0].dtAgendamento, "2026-11-16T10:00");
  assert.equal(a.demandas[0].nmCronogramaSemanal, "Reunião com o cliente");
  assert.match(a.mensagem, /ajustei/);
  assert.equal(interpretarDemanda("às 15h", HOJE, base).demandas[0].dtAgendamento, "2026-11-13T15:00");
  const fixa = interpretarDemanda("toda terça e quinta", HOJE, base).demandas[0];
  assert.equal(fixa.flFixo, true);
  assert.deepEqual(fixa.diasSemana, [2, 4]);
  const nova = interpretarDemanda("Comprar cimento amanhã", HOJE, base);
  assert.equal(nova.demandas[0].nmCronogramaSemanal, "Comprar cimento", "pedido novo não vira ajuste");
  const duas = interpretarDemanda("Vistoria amanhã às 10h\nReunião toda segunda às 9h", HOJE).demandas;
  const so = interpretarDemanda("muda para sexta às 11h", HOJE, duas);
  assert.equal(so.demandas.length, 1, "só a última volta ajustada");
  assert.equal(so.demandas[0].nmCronogramaSemanal, "Reunião");
  assert.match(so.mensagem, /para mudar todas/);
  const ambas = interpretarDemanda("muda todas para as 11h", HOJE, duas);
  assert.equal(ambas.demandas.length, 2);
  assert.equal(ambas.demandas[0].dtAgendamento, "2026-11-13T11:00");
  assert.equal(ambas.demandas[1].nmHorario, "11:00");
  assert.equal(interpretarDemanda("", HOJE).demandas.length, 0);
  assert.equal(interpretarDemanda("amanhã às 9h", HOJE).demandas.length, 0, "só quando, sem o quê, e sem nada antes");
});
