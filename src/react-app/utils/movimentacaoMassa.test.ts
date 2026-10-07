import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agendasIncompletas, dataParaIso, ehStatusAgendado, executarEmLotes, formDaMovimentacao, formDoApartamento, idDiaSemanaDaData,
} from './movimentacaoMassa.ts';

const apt = {
  idApartamentoVistoria: 7, nmApartamentoVistoria: 'N1-01-0101', idDiaSemana: 2, dtApartamentoVigente: '10/02/2026',
  nmHorarioVistoria: '14:00', idStatusVistoria: 3, inMarcarRevistoria: true, txObservacaoRevistoria: 'obs', dtRevistoriaVigente: '2026-03-01',
};

test('data aceita dd/MM/yyyy, ISO e ISO com hora', () => {
  assert.equal(dataParaIso('10/02/2026'), '2026-02-10');
  assert.equal(dataParaIso('2026-02-10'), '2026-02-10');
  assert.equal(dataParaIso('2026-02-10T03:00:00'), '2026-02-10');
  assert.equal(dataParaIso('5/2/2026'), '2026-02-05');
  assert.equal(dataParaIso(null), '');
});

test('dia da semana no padrão do banco (segunda=1 … domingo=7)', () => {
  assert.equal(idDiaSemanaDaData('2026-10-05'), 1); // segunda
  assert.equal(idDiaSemanaDaData('2026-10-10'), 6); // sábado
  assert.equal(idDiaSemanaDaData('2026-10-11'), 7); // domingo
});

test('status agendado é reconhecido sem diferenciar caixa', () => {
  assert.equal(ehStatusAgendado('Agendado'), true);
  assert.equal(ehStatusAgendado('AGENDADO'), true);
  assert.equal(ehStatusAgendado('Liberado'), false);
  assert.equal(ehStatusAgendado(undefined), false);
});

test('mover para um status comum mantém data, horário, dia e observações do apartamento', () => {
  const form = formDaMovimentacao(apt, 4);
  assert.equal(form.idStatusVistoria, 4);
  assert.equal(form.dtApartamentoVigente, '2026-02-10');
  assert.equal(form.nmHorarioVistoria, '14:00');
  assert.equal(form.idDiaSemana, 2);
  assert.equal(form.txObservacaoRevistoria, 'obs');
  assert.equal(form.inMarcarRevistoria, true);
  assert.equal(form.idApartamentoVistoria, 7);
});

test('mover para agendado grava a data e o horário individuais e recalcula o dia da semana', () => {
  const form = formDaMovimentacao(apt, 2, { data: '2026-10-11', horario: '09:30' });
  assert.equal(form.idStatusVistoria, 2);
  assert.equal(form.dtApartamentoVigente, '2026-10-11');
  assert.equal(form.nmHorarioVistoria, '09:30');
  assert.equal(form.idDiaSemana, 7);
  assert.equal(form.nmApartamentoVistoria, 'N1-01-0101');
  assert.deepEqual(formDoApartamento(apt).dtApartamentoVigente, '2026-02-10'); // original intacto
});

test('agenda incompleta: sem data, sem horário ou horário inválido', () => {
  const agendas = {
    1: { data: '2026-10-05', horario: '08:00' },
    2: { data: '', horario: '08:00' },
    3: { data: '2026-10-05', horario: '' },
    4: { data: '2026-10-05', horario: '25:00' },
    5: undefined,
  };
  assert.deepEqual(agendasIncompletas([1, 2, 3, 4, 5], agendas), [2, 3, 4, 5]);
  assert.deepEqual(agendasIncompletas([1], agendas), []);
});

test('lotes: respeita a concorrência, mantém a ordem e uma falha não interrompe as outras', async () => {
  let ativos = 0, pico = 0;
  const progresso: number[] = [];
  const resultados = await executarEmLotes([1, 2, 3, 4, 5, 6, 7], async n => {
    ativos += 1; pico = Math.max(pico, ativos);
    await new Promise(r => setTimeout(r, 5));
    ativos -= 1;
    if (n === 4) throw new Error('boom');
  }, 3, feitos => progresso.push(feitos));
  assert.equal(pico, 3);
  assert.deepEqual(resultados.map(r => r.item), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(resultados.map(r => r.erro), [null, null, null, 'boom', null, null, null]);
  assert.equal(progresso.length, 7);
  assert.equal(progresso[6], 7);
  assert.deepEqual(await executarEmLotes([], async () => undefined), []);
});
