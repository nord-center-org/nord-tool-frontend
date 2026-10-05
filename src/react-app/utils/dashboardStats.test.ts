import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularDashboard, normalizarStatus, paraDataIso } from './dashboardStats.ts';

const apts = [
  { nmApartamentoVistoria: 'N1-01-0101', nmStatusVistoria: 'Aprovado', dtApartamentoVigente: '10/02/2026' },
  { nmApartamentoVistoria: 'N1-01-0102', nmStatusVistoria: 'Aprovado DAT', dtApartamentoVigente: '2026-02-12' },
  { nmApartamentoVistoria: 'N2-02-0201', nmStatusVistoria: 'Reprovado', dtApartamentoVigente: '15/03/2026' },
  { nmApartamentoVistoria: 'N2-02-0202', nmStatusVistoria: 'Pendente DAT', dtApartamentoVigente: null },
  { nmApartamentoVistoria: 'EN-02-1307', nmStatusVistoria: 'Não Liberado', dtApartamentoVigente: '01/04/2026' },
  { nmApartamentoVistoria: 'EN-02-1308', nmStatusVistoria: 'Agendado', dtApartamentoVigente: '02/04/2026' },
  { nmApartamentoVistoria: 'EN-02-1309', nmStatusVistoria: 'Liberado', dtApartamentoVigente: '03/04/2026' },
  { nmApartamentoVistoria: 'EN-02-1310', nmStatusVistoria: 'Pendente', dtApartamentoVigente: '04/04/2026' },
  { nmApartamentoVistoria: 'EN-02-1311', nmStatusVistoria: 'Status novo', dtApartamentoVigente: '05/04/2026' },
];

test('conta cada status; DAT soma com o status base; desconhecido só entra no total', () => {
  const t = calcularDashboard(apts);
  assert.equal(t.total, 9);
  assert.equal(t.total_cadastrados, 9);
  assert.equal(t.aprovados, 2);
  assert.equal(t.reprovados, 1);
  assert.equal(t.pendentes, 2);
  assert.equal(t.nao_liberados, 1);
  assert.equal(t.agendados, 1);
  assert.equal(t.liberados, 1);
});

test('filtra por condomínio pelo prefixo do apartamento', () => {
  assert.equal(calcularDashboard(apts, { condo: 'N1' }).total, 2);
  assert.equal(calcularDashboard(apts, { condo: 'n2' }).total, 2);
  assert.equal(calcularDashboard(apts, { condo: 'EN' }).total, 5);
});

test('filtra por período (inclusivo) e ignora apartamentos sem data', () => {
  const t = calcularDashboard(apts, { startDate: '2026-02-12', endDate: '2026-03-15' });
  assert.equal(t.total, 2); // 12/02 e 15/03
  assert.equal(calcularDashboard(apts, { startDate: '2026-01-01' }).total, 8); // o sem data fica de fora
  assert.equal(calcularDashboard(apts, {}).total, 9);
});

test('combina condomínio e período', () => {
  assert.equal(calcularDashboard(apts, { condo: 'EN', startDate: '2026-04-02', endDate: '2026-04-03' }).total, 2);
});

test('lista vazia gera zeros', () => {
  const t = calcularDashboard([]);
  assert.deepEqual(Object.values(t), [0, 0, 0, 0, 0, 0, 0, 0]);
});

test('normaliza status e datas', () => {
  assert.equal(normalizarStatus('Não Liberado'), 'naoliberado');
  assert.equal(normalizarStatus('Pendente DAT'), 'pendentedat');
  assert.equal(paraDataIso('05/04/2026'), '2026-04-05');
  assert.equal(paraDataIso('2026-04-05T10:00:00'), '2026-04-05');
  assert.equal(paraDataIso(''), null);
  assert.equal(paraDataIso('lixo'), null);
});
