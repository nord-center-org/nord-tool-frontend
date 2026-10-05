import test from 'node:test';
import assert from 'node:assert/strict';
import { temPermissao } from './permissao.ts';

test('módulo * libera qualquer módulo e ação', () => {
  const p = [{ cdModulo: '*', cdAcao: 'ESCRITA' }];
  assert.equal(temPermissao(p, 'CASAMENTO', 'ESCRITA'), true);
  assert.equal(temPermissao(p, 'ENTREGA'), true);
});

test('LEITURA não permite ESCRITA', () => {
  const p = [{ cdModulo: 'ENTREGA', cdAcao: 'LEITURA' }];
  assert.equal(temPermissao(p, 'entrega', 'LEITURA'), true);
  assert.equal(temPermissao(p, 'ENTREGA', 'ESCRITA'), false);
});

test('módulo diferente ou sem permissões é negado', () => {
  assert.equal(temPermissao([{ cdModulo: 'ENTREGA', cdAcao: 'ESCRITA' }], 'CASAMENTO'), false);
  assert.equal(temPermissao(undefined, 'ENTREGA'), false);
  assert.equal(temPermissao([], 'ENTREGA'), false);
});
