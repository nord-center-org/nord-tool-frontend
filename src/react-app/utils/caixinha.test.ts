import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrarPorBusca, hojeSaoPaulo, lerValor, linhasPlanilha, periodoDoMes, totaisCaixinha, validarPdfComprovante,
} from './caixinha.ts';

const item = (dtLancamento: string, nmResponsavel: string, txInsumo: string, vlValor: number, inLancado: boolean, inPago: boolean) =>
  ({ dtLancamento, nmResponsavel, txInsumo, vlValor, inLancado, inPago, qtComprovantes: 0 });

const itens = [
  item('01/10/2026', 'Ana', 'Cimento', 100.1, true, true),
  item('05/10/2026', 'Beto', 'Areia média', 0.2, false, false),
  item('02/11/2026', 'Beto', 'Brita', 20.25, true, false),
];

test('totais somam em centavos (0,1 + 0,2 não vira 0,30000000000000004)', () => {
  const t = totaisCaixinha([item('01/10/2026', 'A', 'x', 0.1, false, false), item('01/10/2026', 'A', 'y', 0.2, false, false)]);
  assert.equal(t.total, 0.3);
  assert.deepEqual(totaisCaixinha(itens), { total: 120.55, pago: 100.1, aPagar: 20.45, qtLancamentos: 3, qtPagos: 1, qtPendentes: 2 });
  assert.deepEqual(totaisCaixinha([]), { total: 0, pago: 0, aPagar: 0, qtLancamentos: 0, qtPagos: 0, qtPendentes: 0 });
});

test('busca ignora caixa e acentos e olha insumo e responsável', () => {
  assert.equal(filtrarPorBusca(itens, 'MEDIA').length, 1);
  assert.equal(filtrarPorBusca(itens, 'beto').length, 2);
  assert.equal(filtrarPorBusca(itens, '  ').length, 3);
  assert.equal(filtrarPorBusca(itens, 'inexistente').length, 0);
});

test('hoje usa o fuso de São Paulo (23h de 5/out em SP já é 6/out em UTC)', () => {
  assert.equal(hojeSaoPaulo(new Date('2026-10-06T02:30:00Z')), '2026-10-05');
  assert.equal(hojeSaoPaulo(new Date('2026-10-06T15:00:00Z')), '2026-10-06');
});

test('período do mês cobre fevereiro bissexto e meses de 30/31 dias', () => {
  assert.deepEqual(periodoDoMes('2028-02-10'), { de: '2028-02-01', ate: '2028-02-29' });
  assert.deepEqual(periodoDoMes('2026-11-30'), { de: '2026-11-01', ate: '2026-11-30' });
  assert.deepEqual(periodoDoMes('2026-12-01'), { de: '2026-12-01', ate: '2026-12-31' });
});

test('valor aceita vírgula, milhar e prefixo R$ e recusa zero/negativo/texto', () => {
  assert.equal(lerValor('1.234,56'), 1234.56);
  assert.equal(lerValor('R$ 12,5'), 12.5);
  assert.equal(lerValor('12.50'), 12.5);
  assert.equal(lerValor('0'), null);
  assert.equal(lerValor('-3'), null);
  assert.equal(lerValor('abc'), null);
  assert.equal(lerValor(''), null);
});

const bytes = (texto: string) => new TextEncoder().encode(texto);

test('PDF do comprovante: assinatura, %%EOF nos últimos 1024 bytes, nome e tamanho', () => {
  const ok = bytes('%PDF-1.4\nconteudo\n%%EOF\n');
  assert.equal(validarPdfComprovante({ name: 'nota.pdf', size: ok.length }, ok.slice(0, 8), ok), null);
  assert.match(validarPdfComprovante({ name: 'nota.txt', size: 10 }, ok, ok) ?? '', /PDF/);
  assert.match(validarPdfComprovante({ name: 'nota.pdf', size: 6 * 1024 * 1024 }, ok, ok) ?? '', /5 MB/);
  assert.match(validarPdfComprovante({ name: 'nota.pdf', size: 10 }, bytes('GIF89a....'), ok) ?? '', /válido/);
  assert.match(validarPdfComprovante({ name: 'nota.pdf', size: 10 }, ok, bytes('%PDF-1.4 cortado')) ?? '', /incompleto/);
  assert.match(validarPdfComprovante({ name: 'nota.pdf', size: 0 }, ok, ok) ?? '', /vazio/);
  // %%EOF fora da janela de 1024 bytes não vale
  const longe = new Uint8Array(3000);
  longe.set(bytes('%%EOF'), 0);
  assert.match(validarPdfComprovante({ name: 'nota.pdf', size: 3000 }, ok, longe) ?? '', /incompleto/);
});

test('linhas da planilha trazem data ISO, Sim/Não e valor numérico', () => {
  const [linha] = linhasPlanilha([{ ...itens[0], qtComprovantes: 2 }]);
  assert.deepEqual(linha, { Data: '2026-10-01', 'Responsável': 'Ana', Insumo: 'Cimento', Valor: 100.1, 'Lançado': 'Sim', Pago: 'Sim', Comprovantes: 2 });
});
