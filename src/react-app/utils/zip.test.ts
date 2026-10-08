import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, criarZip } from './zip.ts';

const texto = (s: string) => new TextEncoder().encode(s);

test('crc32 bate com o valor de referência', () => {
  assert.equal(crc32(texto('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

test('zip tem assinaturas, tamanhos e conteúdo corretos', () => {
  const zip = criarZip([
    { nome: 'a.pdf', bytes: texto('conteudo A') },
    { nome: 'ápto-2.pdf', bytes: texto('B') },
  ], new Date(2026, 9, 8, 10, 30, 0));
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  // fim do diretório central
  const fim = zip.length - 22;
  assert.equal(v.getUint32(fim, true), 0x06054b50);
  assert.equal(v.getUint16(fim + 10, true), 2);
  const inicioDiretorio = v.getUint32(fim + 16, true);
  assert.equal(v.getUint32(fim + 12, true), fim - inicioDiretorio);

  // 1º arquivo local
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint16(6, true) & 0x0800, 0x0800);
  assert.equal(v.getUint32(14, true), crc32(texto('conteudo A')));
  assert.equal(v.getUint32(22, true), 'conteudo A'.length);
  assert.equal(new TextDecoder().decode(zip.slice(30, 35)), 'a.pdf');
  assert.equal(new TextDecoder().decode(zip.slice(35, 45)), 'conteudo A');

  // diretório central aponta para o 2º arquivo local
  assert.equal(v.getUint32(inicioDiretorio, true), 0x02014b50);
  const segundo = inicioDiretorio + 46 + 5;
  assert.equal(v.getUint32(segundo, true), 0x02014b50);
  const deslocamento2 = v.getUint32(segundo + 42, true);
  assert.equal(v.getUint32(deslocamento2, true), 0x04034b50);
});

test('zip vazio é válido', () => {
  const zip = criarZip([]);
  assert.equal(zip.length, 22);
  assert.equal(new DataView(zip.buffer).getUint32(0, true), 0x06054b50);
});
