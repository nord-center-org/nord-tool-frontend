import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarApartamento, nomeArquivoSeguro } from './apartamentoNome.ts';

test('interpreta prefixo, torre e unidade', () => {
  assert.deepEqual(interpretarApartamento('EN-02-1307'), {
    empreendimento: 'Energy', torre: '02', unidade: '1307', codigo: 'EN-02-1307',
  });
  assert.equal(interpretarApartamento('N1-01-0101').empreendimento, 'Nord 1');
  assert.equal(interpretarApartamento('n2-03-0905').empreendimento, 'Nord 2');
});

test('prefixo desconhecido mantém o texto original', () => {
  assert.equal(interpretarApartamento('XX-01-0202').empreendimento, 'XX');
});

test('formato fora do padrão cai na unidade', () => {
  const r = interpretarApartamento('Apto 12');
  assert.equal(r.unidade, 'Apto 12');
  assert.equal(r.empreendimento, '');
});

test('nome de arquivo sem caracteres proibidos', () => {
  assert.equal(nomeArquivoSeguro('EN-02-1307: termo/1?.pdf'), 'EN-02-1307- termo-1-.pdf');
});

test('barra invertida e caracteres de controle também são trocados', () => {
  const barra = String.fromCharCode(92);
  assert.equal(nomeArquivoSeguro('a' + barra + 'b' + String.fromCharCode(1) + 'c.pdf'), 'a-b-c.pdf');
});
