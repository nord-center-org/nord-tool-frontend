import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avisoConferencia, caminho, cicloDaFatura, dadosDoGrafico, diaDoCiclo, ehEstimado, escalaBonita, linhasFechamento, mesCentralPadrao, mesesDoPainel, textoFolga,
  textoPrevistos, type AreaGrafico,
} from './financeiroConta.ts';

const AREA: AreaGrafico = { largura: 600, altura: 240, esquerda: 60, direita: 20, superior: 20, inferior: 40 };

test('só média, valor fixo e ritmo contam como estimativa', () => {
  assert.equal(ehEstimado({ origem: 'MEDIA' }), true);
  assert.equal(ehEstimado({ origem: 'RECORRENCIA' }), true);
  assert.equal(ehEstimado({ origem: 'RITMO' }), true);
  assert.equal(ehEstimado({ origem: 'REAL' }), false);
  assert.equal(ehEstimado({ origem: 'SEM_DADOS' }), false);
});

test('o painel compara o mês anterior com o central', () => {
  assert.deepEqual(mesesDoPainel('2026-10'), { anterior: '2026-09', atual: '2026-10' });
  assert.deepEqual(mesesDoPainel('2027-01'), { anterior: '2026-12', atual: '2027-01' });
});

test('lembrete da conferência: só do dia combinado em diante, com o mês a fechar aberto e visível', () => {
  const aberto = { fechado: false };
  assert.match(avisoConferencia('2026-10-08', 8, aberto, '2026-09', true) ?? '', /feche setembro de 2026/);
  assert.match(avisoConferencia('2026-10-20', 8, aberto, '2026-09', true) ?? '', /dia 8/);
  assert.equal(avisoConferencia('2026-10-07', 8, aberto, '2026-09', true), null);
  assert.equal(avisoConferencia('2026-10-08', 8, { fechado: true }, '2026-09', true), null);
  assert.equal(avisoConferencia('2026-10-08', 8, null, '2026-09', true), null);
  assert.equal(avisoConferencia('2026-10-08', 8, aberto, '2026-09', false), null);
});

test('textos da folga e dos previstos', () => {
  const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  assert.equal(textoFolga(1423.58, 500, brl), 'R$ 1423,58 acima da meta de R$ 500,00');
  assert.equal(textoFolga(-76.42, 500, brl), 'R$ 76,42 abaixo da meta de R$ 500,00');
  assert.equal(textoFolga(0, 500, brl), 'R$ 0,00 acima da meta de R$ 500,00');
  assert.equal(textoPrevistos(0), '');
  assert.equal(textoPrevistos(1), '1 lançamento ainda previsto');
  assert.equal(textoPrevistos(3), '3 lançamentos ainda previstos');
});

test('ciclo da fatura: do dia seguinte ao fechamento anterior até o fechamento do mês', () => {
  assert.deepEqual(cicloDaFatura('2026-10', 8), { inicio: '2026-09-09', fim: '2026-10-08', dias: 30 });
  // 2032 é bissexto: 21/02 a 20/03 = 29 dias
  assert.deepEqual(cicloDaFatura('2032-03', 20), { inicio: '2032-02-21', fim: '2032-03-20', dias: 29 });
  // dia 31 em fevereiro vale o último dia; o ciclo começa em 01/02
  assert.deepEqual(cicloDaFatura('2027-02', 31), { inicio: '2027-02-01', fim: '2027-02-28', dias: 28 });
  // virada de ano
  assert.deepEqual(cicloDaFatura('2027-01', 8), { inicio: '2026-12-09', fim: '2027-01-08', dias: 31 });
});

test('dia do ciclo conta a partir do primeiro dia', () => {
  const c = cicloDaFatura('2026-10', 8);
  assert.equal(diaDoCiclo(c, '2026-09-09'), 0);
  assert.equal(diaDoCiclo(c, '2026-09-24'), 15);
  assert.equal(diaDoCiclo(c, '2026-10-08'), 29);
  assert.equal(diaDoCiclo(c, '2026-09-01'), -8);
});

test('escala com topo redondo e 4 divisões', () => {
  assert.deepEqual(escalaBonita(2320), { topo: 2400, passo: 600 });
  assert.deepEqual(escalaBonita(1200), { topo: 1200, passo: 300 });
  assert.deepEqual(escalaBonita(950), { topo: 1000, passo: 250 });
  assert.deepEqual(escalaBonita(2000), { topo: 2000, passo: 500 });
  assert.deepEqual(escalaBonita(0), { topo: 4, passo: 1 });
  assert.equal(escalaBonita(7).topo, 8);
  for (const m of [0.5, 7, 123, 999, 4321, 123456, 9999999]) assert.ok(escalaBonita(m).topo >= m, `cobre ${m}`);
});

test('gráfico: leituras viram pontos, a projeção fica no fechamento e fora do ciclo é ignorado', () => {
  const ciclo = cicloDaFatura('2026-10', 8);
  const g = dadosDoGrafico([
    { dtLeitura: '24/09/2026', vlLeitura: 1200 },
    { dtLeitura: '12/09/2026', vlLeitura: 500 },
    { dtLeitura: '01/09/2026', vlLeitura: 99999 }, // antes do ciclo
  ], ciclo, 2320, AREA);

  assert.equal(g.pontos.length, 2);
  assert.deepEqual(g.pontos.map(p => p.rotulo), ['12/09', '24/09']); // ordenadas por data
  assert.equal(g.pontos[0].tipo, 'leitura');
  assert.ok(g.projecao);
  assert.equal(g.projecao?.rotulo, '08/10');
  assert.equal(g.projecao?.valor, 2320);
  // o fim do ciclo é o canto direito da área útil
  assert.equal(g.projecao?.x, AREA.largura - AREA.direita);
  // valores maiores ficam mais acima (y menor)
  assert.ok((g.projecao?.y ?? 0) < g.pontos[1].y);
  assert.ok(g.pontos[1].y < g.pontos[0].y);
  assert.equal(g.topo, 2400);
  assert.deepEqual(g.yTicks.map(t => t.valor), [0, 600, 1200, 1800, 2400]);
  assert.deepEqual(g.xTicks.map(t => t.rotulo), ['09/09', '24/09', '08/10']);
  // o 0 fica na base e o topo no limite superior
  assert.equal(g.yTicks[0].y, AREA.altura - AREA.inferior);
  assert.equal(g.yTicks[4].y, AREA.superior);
});

test('gráfico: sem projeção quando já está no valor final, quando não há leitura ou o ciclo acabou', () => {
  const ciclo = cicloDaFatura('2026-10', 8);
  assert.equal(dadosDoGrafico([{ dtLeitura: '24/09/2026', vlLeitura: 1200 }], ciclo, 1200, AREA).projecao, null);
  assert.equal(dadosDoGrafico([{ dtLeitura: '24/09/2026', vlLeitura: 1200 }], ciclo, null, AREA).projecao, null);
  assert.equal(dadosDoGrafico([], ciclo, 2000, AREA).projecao, null);
  assert.equal(dadosDoGrafico([], ciclo, 2000, AREA).pontos.length, 0);
  // leitura no último dia do ciclo: nada a projetar
  assert.equal(dadosDoGrafico([{ dtLeitura: '08/10/2026', vlLeitura: 1200 }], ciclo, 3000, AREA).projecao, null);
});

test('caminho SVG liga os pontos na ordem', () => {
  assert.equal(caminho([{ x: 1, y: 2 }, { x: 3.14159, y: 4 }]), 'M1.0 2.0 L3.1 4.0');
  assert.equal(caminho([]), '');
});

test("planilha do fechamento: saldo anterior, entradas, saídas, totais e saldo", () => {
  const linhas = linhasFechamento({
    competencia: "2026-10", fechado: false, comSaldoAnterior: true, saldoAnterior: 600,
    entradas: [{ nmCategoria: "Salário", projetado: 3000, origem: "REAL" }],
    saidas: [{ nmCategoria: "Fatura", projetado: 2000, origem: "RITMO" }, { nmCategoria: "Apartamento", projetado: 1000, origem: "REAL" }],
    totalEntradas: 3000, totalSaidas: 3000, saldoFinal: 600, metaSaldo: 500,
  });
  assert.deepEqual(linhas.map(l => l.Item), ["Saldo anterior", "Salário", "Total de entradas", "Fatura", "Apartamento", "Total de saídas", "Saldo projetado", "Meta de saldo"]);
  assert.equal(linhas.find(l => l.Item === "Fatura")?.Origem, "Estimado (Ritmo do ciclo)");
  assert.equal(linhas.find(l => l.Item === "Apartamento")?.Origem, "Lançado");
  assert.equal(linhas.find(l => l.Item === "Saldo projetado")?.Valor, 600);
});

test("planilha do fechamento: mês fechado e filtro de pessoa (sem saldo anterior nem meta)", () => {
  const linhas = linhasFechamento({
    competencia: "2026-09", fechado: true, comSaldoAnterior: false, saldoAnterior: null,
    entradas: [], saidas: [], totalEntradas: 0, totalSaidas: 0, saldoFinal: 0, metaSaldo: null,
  });
  assert.deepEqual(linhas.map(l => l.Item), ["Total de entradas", "Total de saídas", "Saldo final"]);
});

test('par padrão do dashboard: último fechado | mês a fechar (em outubro, agosto | setembro)', () => {
  assert.equal(mesCentralPadrao('2026-10', false), '2026-09');
  assert.deepEqual(mesesDoPainel(mesCentralPadrao('2026-10', false)), { anterior: '2026-08', atual: '2026-09' });
  // setembro já fechado: o par passa a ser setembro | outubro (corrente em projeção)
  assert.equal(mesCentralPadrao('2026-10', true), '2026-10');
  assert.deepEqual(mesesDoPainel(mesCentralPadrao('2026-10', true)), { anterior: '2026-09', atual: '2026-10' });
  // virada de ano
  assert.equal(mesCentralPadrao('2027-01', false), '2026-12');
});
