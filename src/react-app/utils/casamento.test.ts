import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularContagem, dataBrParaIso, dataExtensa, dataIsoParaBr, estaAtrasado, formatarMoeda,
  hojeIso, instanteDoCasamento, percentual,
} from './casamento.ts';

test('contagem regressiva usa meio-dia no fuso -03:00', () => {
  const alvo = instanteDoCasamento('2027-10-12');
  assert.equal(alvo, Date.UTC(2027, 9, 12, 15, 0, 0)); // 12:00 -03:00 = 15:00 UTC
  const c = calcularContagem('2027-10-12', alvo - (2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000));
  assert.deepEqual(c, { dias: 2, horas: 3, minutos: 4, segundos: 5, passou: false });
});

test('data passada zera a contagem e marca como passou', () => {
  const alvo = instanteDoCasamento('2027-10-12');
  assert.deepEqual(calcularContagem('2027-10-12', alvo + 1000), { dias: 0, horas: 0, minutos: 0, segundos: 0, passou: true });
  assert.equal(calcularContagem('2027-10-12', alvo)?.passou, true);
});

test('sem data ou data inválida não há contagem', () => {
  assert.equal(calcularContagem(null, 0), null);
  assert.equal(calcularContagem('', 0), null);
  assert.equal(calcularContagem('12/10/2027', 0), null);
  assert.equal(calcularContagem('2027-99-99', 0), null);
});

test('editar a data muda a contagem (um dia a mais = 86400 s)', () => {
  const agora = Date.UTC(2026, 9, 5, 12, 0, 0);
  const a = calcularContagem('2027-10-12', agora)!;
  const b = calcularContagem('2027-10-13', agora)!;
  assert.equal(b.dias - a.dias, 1);
});

test('conversão de datas dd/MM/yyyy <-> yyyy-MM-dd', () => {
  assert.equal(dataBrParaIso('12/01/2027'), '2027-01-12');
  assert.equal(dataBrParaIso('2027-01-12'), null);
  assert.equal(dataBrParaIso(null), null);
  assert.equal(dataIsoParaBr('2027-01-12'), '12/01/2027');
  assert.equal(dataIsoParaBr('lixo'), '');
  assert.equal(dataExtensa('2027-10-12'), '12 de outubro de 2027');
  assert.equal(dataExtensa(null), '');
});

test('hoje no formato ISO local', () => {
  assert.equal(hojeIso(new Date(2026, 0, 5)), '2026-01-05');
});

test('marco atrasado: prazo vencido e não concluído', () => {
  assert.equal(estaAtrasado('01/01/2026', false, '2026-10-05'), true);
  assert.equal(estaAtrasado('01/01/2026', true, '2026-10-05'), false);
  assert.equal(estaAtrasado('05/10/2026', false, '2026-10-05'), false); // vence hoje: ainda não atrasou
  assert.equal(estaAtrasado('06/10/2026', false, '2026-10-05'), false);
  assert.equal(estaAtrasado(null, false, '2026-10-05'), false);
});

test('percentual inteiro e seguro com total zero', () => {
  assert.equal(percentual(3, 10), 30);
  assert.equal(percentual(2, 3), 67);
  assert.equal(percentual(0, 0), 0);
});

test('moeda em reais', () => {
  assert.match(formatarMoeda(16000.5), /R\$\s?16\.000,50/);
  assert.match(formatarMoeda(0), /R\$\s?0,00/);
});

test("totaisFornecedores soma contratado apenas para CONTRATADO", async () => {
  const { totaisFornecedores } = await import("./casamento.ts");
  const t = totaisFornecedores([
    { nmStatus: "CONTRATADO", vlValor: 100 },
    { nmStatus: "ORCAMENTO", vlValor: 50 },
    { nmStatus: "CONTRATADO", vlValor: 25.5 },
  ]);
  assert.deepEqual(t, { qtTotal: 3, qtContratados: 2, vlContratado: 125.5, vlEstimado: 175.5 });
});

test("ordenarMarcos ordena por prazo e deixa sem prazo no fim", async () => {
  const { ordenarMarcos } = await import("./casamento.ts");
  const r = ordenarMarcos([
    { id: 1, dtPrazo: null }, { id: 2, dtPrazo: "01/03/2027" }, { id: 3, dtPrazo: "15/12/2026" }, { id: 4, dtPrazo: null },
  ]);
  assert.deepEqual(r.map(m => m.id), [3, 2, 1, 4]);
});
