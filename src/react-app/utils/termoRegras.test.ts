import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularNovaOrdem, contarFotosPorPagina, fotosDaPagina, legendaValida, limitarPagina, mensagemExclusaoTermo,
  rotuloPagina, rotuloSituacao, rotuloTermo,
} from './termoRegras.ts';

const fotos = [
  { idTermoFoto: 3, nrPagina: 2, nrOrdem: 1 },
  { idTermoFoto: 1, nrPagina: 1, nrOrdem: 0 },
  { idTermoFoto: 2, nrPagina: 2, nrOrdem: 0 },
  { idTermoFoto: 4, nrPagina: 2, nrOrdem: 1 },
];

test('rótulo ordinal do termo', () => {
  assert.equal(rotuloTermo(1), '1º termo');
  assert.equal(rotuloTermo(12), '12º termo');
});

test('fotos da página vêm na ordem do usuário, com desempate pelo id', () => {
  assert.deepEqual(fotosDaPagina(fotos, 2).map(f => f.idTermoFoto), [2, 3, 4]);
  assert.deepEqual(fotosDaPagina(fotos, 3), []);
});

test('conta fotos por página', () => {
  assert.deepEqual(contarFotosPorPagina(fotos), { 1: 1, 2: 3 });
  assert.deepEqual(contarFotosPorPagina([]), {});
});

test('rótulo do seletor de página', () => {
  assert.equal(rotuloPagina(2, 5, 3), '2 de 5 · 3 fotos');
  assert.equal(rotuloPagina(1, 5, 1), '1 de 5 · 1 foto');
  assert.equal(rotuloPagina(4, 5, 0), '4 de 5 · sem foto');
});

test('limita a página entre 1 e o total', () => {
  assert.equal(limitarPagina(0, 5), 1);
  assert.equal(limitarPagina(9, 5), 5);
  assert.equal(limitarPagina(3, 5), 3);
  assert.equal(limitarPagina(3, 0), 1);
});

test('mensagem de exclusão cita as fotos vinculadas', () => {
  assert.match(mensagemExclusaoTermo(3), /As 3 fotos vinculadas também serão removidas/);
  assert.match(mensagemExclusaoTermo(1), /A 1 foto vinculada também será removida/);
  assert.doesNotMatch(mensagemExclusaoTermo(0), /fotos/);
});

test('rótulos de situação', () => {
  assert.equal(rotuloSituacao('EM_ANDAMENTO'), 'Em andamento');
  assert.equal(rotuloSituacao('CONCLUIDO'), 'Concluído');
  assert.equal(rotuloSituacao('OUTRA'), 'OUTRA');
});

test('mover para cima/baixo troca vizinhos e normaliza a ordem da página', () => {
  // página 2 na ordem: 2, 3, 4
  assert.deepEqual(calcularNovaOrdem(fotos, 3, 'cima'), [
    { idTermoFoto: 3, nrOrdem: 0 }, { idTermoFoto: 2, nrOrdem: 1 }, { idTermoFoto: 4, nrOrdem: 2 },
  ]);
  assert.deepEqual(calcularNovaOrdem(fotos, 3, 'baixo'), [
    { idTermoFoto: 2, nrOrdem: 0 }, { idTermoFoto: 4, nrOrdem: 1 }, { idTermoFoto: 3, nrOrdem: 2 },
  ]);
});

test('não move além das pontas nem foto inexistente', () => {
  assert.equal(calcularNovaOrdem(fotos, 2, 'cima'), null);
  assert.equal(calcularNovaOrdem(fotos, 4, 'baixo'), null);
  assert.equal(calcularNovaOrdem(fotos, 1, 'baixo'), null); // única da página 1
  assert.equal(calcularNovaOrdem(fotos, 99, 'cima'), null);
});

test('legenda aceita até 240 caracteres', () => {
  assert.equal(legendaValida('x'.repeat(240)), true);
  assert.equal(legendaValida('x'.repeat(241)), false);
  assert.equal(legendaValida(''), true);
});
