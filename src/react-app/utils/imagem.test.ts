import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOTO_MAX_BYTES, FOTO_MAX_LADO, MINIATURA_MAX_LADO,
  calcularDimensoes, nomeJpeg, validarTamanhoFinal, validarTipoFoto,
} from './imagem.ts';

test('reduz mantendo a proporção (paisagem e retrato)', () => {
  assert.deepEqual(calcularDimensoes(4000, 3000, FOTO_MAX_LADO), { width: 1280, height: 960 });
  assert.deepEqual(calcularDimensoes(3000, 4000, FOTO_MAX_LADO), { width: 960, height: 1280 });
  assert.deepEqual(calcularDimensoes(4000, 3000, MINIATURA_MAX_LADO), { width: 400, height: 300 });
});

test('nunca amplia imagens pequenas', () => {
  assert.deepEqual(calcularDimensoes(800, 600, FOTO_MAX_LADO), { width: 800, height: 600 });
});

test('mantém ao menos 1 px em imagens muito alongadas', () => {
  const d = calcularDimensoes(10000, 2, 400);
  assert.equal(d.width, 400);
  assert.equal(d.height, 1);
});

test('nome do arquivo vira .jpg', () => {
  assert.equal(nomeJpeg('IMG_001.PNG'), 'IMG_001.jpg');
  assert.equal(nomeJpeg('sem-extensao'), 'sem-extensao.jpg');
  assert.equal(nomeJpeg('.png'), 'foto.jpg');
  assert.equal(nomeJpeg('a.b.c.jpeg'), 'a.b.c.jpg');
});

test('aceita só JPG e PNG', () => {
  assert.doesNotThrow(() => validarTipoFoto('image/jpeg'));
  assert.doesNotThrow(() => validarTipoFoto('image/png'));
  assert.throws(() => validarTipoFoto('image/gif'), /JPG ou PNG/);
  assert.throws(() => validarTipoFoto(''), /JPG ou PNG/);
});

test('limita o tamanho final a 5 MB', () => {
  assert.doesNotThrow(() => validarTamanhoFinal(FOTO_MAX_BYTES));
  assert.throws(() => validarTamanhoFinal(FOTO_MAX_BYTES + 1), /5 MB/);
});
