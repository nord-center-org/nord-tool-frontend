import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_TERMO, classeSituacao, descricaoDoTermo, formatarPercentual, ordemFotos,
  progressoPaginas, restantes, situacaoDoTermo, valorFotos,
} from './termoLista.ts';

const semTermo = { inTermoAnexado: false, qtTermos: 0 };
const comTermo = { inTermoAnexado: true, qtTermos: 2, nrUltimoTermo: 2, nmSituacaoTermo: 'EM_ANDAMENTO', qtFotosTermo: 3, nrPaginasTermo: 4, nrPaginasComFoto: 2 };

test('situação do termo para a coluna Termo', () => {
  assert.equal(situacaoDoTermo(semTermo), SEM_TERMO);
  assert.equal(situacaoDoTermo({}), SEM_TERMO);
  assert.equal(situacaoDoTermo(comTermo), 'Em andamento');
  assert.equal(situacaoDoTermo({ ...comTermo, nmSituacaoTermo: 'CONCLUIDO' }), 'Concluído');
  assert.equal(situacaoDoTermo({ ...comTermo, nmSituacaoTermo: 'PENDENTE' }), 'Pendente');
  assert.equal(situacaoDoTermo({ ...comTermo, nmSituacaoTermo: null }), 'Pendente');
});

test('descrição mostra o nº do último termo e quantos existem', () => {
  assert.equal(descricaoDoTermo(comTermo), '2º termo · 2 termos');
  assert.equal(descricaoDoTermo({ ...comTermo, qtTermos: 1, nrUltimoTermo: 1 }), '1º termo');
  assert.equal(descricaoDoTermo(semTermo), '');
});

test('coluna Fotos: contagem, progresso por página e ordem', () => {
  assert.equal(valorFotos(comTermo), '3 fotos');
  assert.equal(valorFotos({ ...comTermo, qtFotosTermo: 1 }), '1 foto');
  assert.equal(valorFotos({ ...comTermo, qtFotosTermo: 0 }), '0 fotos');
  assert.equal(valorFotos(semTermo), null);
  assert.equal(progressoPaginas(comTermo), '2/4 págs com foto');
  assert.equal(progressoPaginas(semTermo), null);
  assert.equal(ordemFotos(comTermo), 3);
  assert.equal(ordemFotos(semTermo), null);
});

test('cores por situação', () => {
  assert.match(classeSituacao('Concluído'), /green/);
  assert.match(classeSituacao('Em andamento'), /blue/);
  assert.match(classeSituacao('Pendente'), /yellow/);
  assert.match(classeSituacao(SEM_TERMO), /slate/);
});

test('restantes e percentual do card do DAT', () => {
  assert.equal(restantes({ totalApartamentosComReprova: 10, concluidos: 4 }), 6);
  assert.equal(restantes({ totalApartamentosComReprova: 2, concluidos: 5 }), 0);
  assert.equal(formatarPercentual(40), '40,0%');
  assert.equal(formatarPercentual(33.3), '33,3%');
  assert.equal(formatarPercentual(120), '100,0%');
  assert.equal(formatarPercentual(-5), '0,0%');
});
