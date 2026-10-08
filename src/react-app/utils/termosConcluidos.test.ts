import test from 'node:test';
import assert from 'node:assert/strict';
import { nomeArquivoZip, nomeUnico, separarConcluidos, termoConcluido } from './termosConcluidos.ts';

const apt = (id: number, extra = {}) => ({ idApartamentoVistoria: id, nmApartamentoVistoria: `A${id}`, inTermoAnexado: true, nrUltimoTermo: 1, nmSituacaoTermo: 'CONCLUIDO', ...extra });

test('só o último termo concluído conta', () => {
  assert.equal(termoConcluido(apt(1)), true);
  assert.equal(termoConcluido(apt(1, { nmSituacaoTermo: 'EM_ANDAMENTO' })), false);
  assert.equal(termoConcluido(apt(1, { nmSituacaoTermo: 'PENDENTE' })), false);
  assert.equal(termoConcluido(apt(1, { inTermoAnexado: false })), false);
  assert.equal(termoConcluido(apt(1, { nrUltimoTermo: null })), false);
});

test('separa concluídos dos ignorados mantendo a ordem', () => {
  const { concluidos, ignorados } = separarConcluidos([
    apt(1), apt(2, { nmSituacaoTermo: 'PENDENTE' }), apt(3), apt(4, { inTermoAnexado: false }),
  ]);
  assert.deepEqual(concluidos.map(a => a.idApartamentoVistoria), [1, 3]);
  assert.deepEqual(ignorados.map(a => a.idApartamentoVistoria), [2, 4]);
});

test('nomes repetidos no ZIP ganham sufixo', () => {
  const usados = new Set<string>();
  assert.equal(nomeUnico('a-termo-1.pdf', usados), 'a-termo-1.pdf');
  assert.equal(nomeUnico('a-termo-1.pdf', usados), 'a-termo-1 (2).pdf');
  assert.equal(nomeUnico('A-TERMO-1.pdf', usados), 'A-TERMO-1 (3).pdf');
});

test('nome do ZIP leva a data', () => {
  assert.equal(nomeArquivoZip(new Date(2026, 9, 8)), 'termos-concluidos-2026-10-08.zip');
});
