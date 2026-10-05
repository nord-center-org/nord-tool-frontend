import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobCache } from './blobCache.ts';

test('guarda e devolve por chave', () => {
  const c = new BlobCache(2);
  const b = new Blob(['x']);
  c.set('a', b);
  assert.equal(c.get('a'), b);
  assert.equal(c.get('b'), undefined);
});

test('descarta a entrada menos recente ao passar do limite', () => {
  const c = new BlobCache(2);
  c.set('a', new Blob(['1']));
  c.set('b', new Blob(['2']));
  c.get('a'); // a fica mais recente
  c.set('c', new Blob(['3']));
  assert.equal(c.has('b'), false);
  assert.equal(c.has('a'), true);
  assert.equal(c.has('c'), true);
  assert.equal(c.tamanho, 2);
});

test('versão diferente é outra chave', () => {
  const c = new BlobCache(5);
  c.set('foto:1:imagem:100', new Blob(['v1']));
  assert.equal(c.has('foto:1:imagem:200'), false);
});
