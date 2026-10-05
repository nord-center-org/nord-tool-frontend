import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VALOR_VAZIO, aplicarFiltrosColuna, compararValores, normalizarTexto, valoresUnicos,
  type ColunasFiltro,
} from './filtroColuna.ts';

interface Linha { nome?: string | null; data?: string | null }
const colunas: ColunasFiltro<Linha, 'nome' | 'data'> = {
  nome: { valor: l => l.nome },
  data: { valor: l => l.data, data: true },
};
const linhas: Linha[] = [
  { nome: 'b', data: '2026-02-10' },
  { nome: 'A', data: null },
  { nome: null, data: '2026-01-05' },
  { nome: 'a10', data: '2026-03-01' },
  { nome: 'a2', data: '' },
];

test('normalizarTexto troca vazios por marcador', () => {
  assert.equal(normalizarTexto(null), VALOR_VAZIO);
  assert.equal(normalizarTexto('  '), VALOR_VAZIO);
  assert.equal(normalizarTexto(' x '), 'x');
});

test('vazios ficam por último em asc e desc', () => {
  for (const direcao of ['asc', 'desc'] as const) {
    const r = aplicarFiltrosColuna(linhas, colunas, {}, { coluna: 'data', direcao });
    assert.ok(!r[r.length - 1].data);
    assert.ok(!r[r.length - 2].data);
  }
});

test('ordenação por data usa a data real e texto usa ordem natural', () => {
  const porData = aplicarFiltrosColuna(linhas, colunas, {}, { coluna: 'data', direcao: 'asc' });
  assert.deepEqual(porData.slice(0, 3).map(l => l.data), ['2026-01-05', '2026-02-10', '2026-03-01']);
  const porNome = aplicarFiltrosColuna(linhas, colunas, {}, { coluna: 'nome', direcao: 'asc' });
  assert.deepEqual(porNome.map(l => l.nome), ['A', 'a2', 'a10', 'b', null]);
});

test('filtro por valores selecionados, incluindo vazio', () => {
  const r = aplicarFiltrosColuna(linhas, colunas, { data: [VALOR_VAZIO] }, null);
  assert.deepEqual(r.map(l => l.nome), ['A', 'a2']);
  const s = aplicarFiltrosColuna(linhas, colunas, { nome: ['b', 'A'] }, null);
  assert.equal(s.length, 2);
});

test('valoresUnicos devolve únicos ordenados com vazio no fim', () => {
  assert.deepEqual(valoresUnicos(linhas, colunas.nome), ['A', 'a2', 'a10', 'b', VALOR_VAZIO]);
});

test('compararValores com data inválida vai para o fim', () => {
  assert.equal(compararValores('x', '2026-01-01', 'asc', true), 1);
});
