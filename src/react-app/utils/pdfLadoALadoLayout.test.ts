import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AREA_FOTO, AREA_TERMO, LIMITE_AVISO_BYTES,
  ajustar, anguloDeDesenho, ehRetrato90, estimarTamanho, excedeLimiteEmail, formatarTamanho,
  limitarLinhas, montarFolhas, nomeArquivoRelatorio, origemPaginaGirada, quebrarTexto,
} from './pdfLadoALadoLayout.ts';

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('ajustar centraliza e não distorce (retrato e paisagem)', () => {
  const retrato = ajustar(300, 600, AREA_TERMO); // limitado pela altura 402
  assert.ok(perto(retrato.height, 402));
  assert.ok(perto(retrato.width, 201));
  assert.ok(perto(retrato.x, AREA_TERMO.x + (374 - 201) / 2));
  const paisagem = ajustar(800, 400, AREA_FOTO); // limitado pela largura 374
  assert.ok(perto(paisagem.width, 374));
  assert.ok(perto(paisagem.height, 187));
  assert.ok(perto(paisagem.y, AREA_FOTO.y + (402 - 187) / 2));
  assert.ok(perto(retrato.width / retrato.height, 0.5));
});

test('ajustar amplia imagens pequenas até preencher a área', () => {
  const r = ajustar(37.4, 40.2, AREA_FOTO);
  assert.ok(perto(r.width, 374) && perto(r.height, 402));
});

test('ângulo de desenho anula a rotação da página', () => {
  assert.equal(anguloDeDesenho(0), 0);
  assert.equal(anguloDeDesenho(90), 270);
  assert.equal(anguloDeDesenho(180), 180);
  assert.equal(anguloDeDesenho(270), 90);
  assert.equal(anguloDeDesenho(360), 0);
  assert.equal(ehRetrato90(90), true);
  assert.equal(ehRetrato90(270), true);
  assert.equal(ehRetrato90(0), false);
  assert.equal(ehRetrato90(180), false);
});

test('origem da página girada compensa a rotação em torno da origem', () => {
  const a = { x: 10, y: 20, width: 100, height: 200 };
  assert.deepEqual(origemPaginaGirada(0, a), { x: 10, y: 20 });
  assert.deepEqual(origemPaginaGirada(90, a), { x: 110, y: 20 });
  assert.deepEqual(origemPaginaGirada(180, a), { x: 110, y: 220 });
  assert.deepEqual(origemPaginaGirada(270, a), { x: 10, y: 220 });
});

const foto = (id: number, pagina: number, ordem: number) => ({ id, pagina, ordem });

test('1 página com 3 fotos gera 3 folhas, na ordem do usuário', () => {
  const folhas = montarFolhas(1, [foto(3, 1, 2), foto(1, 1, 0), foto(2, 1, 1)], true);
  assert.deepEqual(folhas.map(f => f.foto?.id), [1, 2, 3]);
  assert.deepEqual(folhas.map(f => f.numeroDaFoto), [1, 2, 3]);
  assert.ok(folhas.every(f => f.pagina === 1 && f.fotosNaPagina === 3));
});

test('página sem foto vira folha "sem foto" ou é omitida', () => {
  const fotos = [foto(1, 1, 0), foto(2, 3, 0)];
  const com = montarFolhas(4, fotos, true);
  assert.deepEqual(com.map(f => [f.pagina, f.foto?.id ?? null]), [[1, 1], [2, null], [3, 2], [4, null]]);
  const sem = montarFolhas(4, fotos, false);
  assert.deepEqual(sem.map(f => f.pagina), [1, 3]);
});

test('termo sem fotos e sem páginas vazias não gera folhas', () => {
  assert.deepEqual(montarFolhas(3, [], false), []);
  assert.equal(montarFolhas(3, [], true).length, 3);
});

test('desempate por id quando a ordem é igual', () => {
  const folhas = montarFolhas(1, [foto(9, 1, 0), foto(4, 1, 0)], true);
  assert.deepEqual(folhas.map(f => f.foto?.id), [4, 9]);
});

const medir = (t: string) => t.length; // 1 unidade por caractere

test('quebra texto por palavras respeitando a largura', () => {
  assert.deepEqual(quebrarTexto('um dois tres quatro', 9, medir), ['um dois', 'tres', 'quatro']);
  assert.deepEqual(quebrarTexto('abc', 10, medir), ['abc']);
});

test('respeita quebras de linha e parte palavras maiores que a linha', () => {
  assert.deepEqual(quebrarTexto('a\nb', 10, medir), ['a', 'b']);
  assert.deepEqual(quebrarTexto('abcdefghij', 4, medir), ['abcd', 'efgh', 'ij']);
});

test('limita a 5 linhas e sinaliza o corte', () => {
  const linhas = ['1', '2', '3', '4', '5', '6', '7'];
  const r = limitarLinhas(linhas);
  assert.equal(r.length, 5);
  assert.equal(r[4], '5...');
  assert.deepEqual(limitarLinhas(['a', 'b']), ['a', 'b']);
});

test('estimativa de tamanho e aviso acima de 20 MB', () => {
  assert.equal(estimarTamanho(1000, [100, 200], 2), 1000 + 300 + 6000);
  assert.equal(excedeLimiteEmail(LIMITE_AVISO_BYTES), false);
  assert.equal(excedeLimiteEmail(LIMITE_AVISO_BYTES + 1), true);
});

test('formata tamanhos em pt-BR', () => {
  assert.equal(formatarTamanho(500), '1 KB');
  assert.equal(formatarTamanho(820 * 1024), '820 KB');
  assert.equal(formatarTamanho(3.4 * 1024 * 1024), '3,4 MB');
});

test('nome do arquivo: <apto>-termo-<n>.pdf', () => {
  assert.equal(nomeArquivoRelatorio('EN-02-1307', 2), 'EN-02-1307-termo-2.pdf');
  assert.equal(nomeArquivoRelatorio('', 1), 'apartamento-termo-1.pdf');
});
