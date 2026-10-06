import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDF_MAX_BYTES, PDF_MAX_PAGINAS, escalaRender,
  validarArquivoPdf, validarPaginasPdf, validarTamanhoPdf,
} from './pdfTermoRegras.ts';

test('aceita PDF dentro do limite e recusa outras extensões', () => {
  assert.doesNotThrow(() => validarArquivoPdf({ name: 'termo.PDF', size: 1000 }));
  assert.throws(() => validarArquivoPdf({ name: 'termo.docx', size: 1000 }), /PDF/);
});

test('limite de 15 MB é inclusivo', () => {
  assert.doesNotThrow(() => validarTamanhoPdf(PDF_MAX_BYTES));
  assert.throws(() => validarTamanhoPdf(PDF_MAX_BYTES + 1), /15 MB/);
});

test('limite de 1 a 80 páginas', () => {
  assert.doesNotThrow(() => validarPaginasPdf(1));
  assert.doesNotThrow(() => validarPaginasPdf(PDF_MAX_PAGINAS));
  assert.throws(() => validarPaginasPdf(0), /não tem páginas/);
  assert.throws(() => validarPaginasPdf(PDF_MAX_PAGINAS + 1), /80 páginas/);
});

test('escala de renderização é limitada a 2 e a 1400 px de largura', () => {
  assert.equal(escalaRender(595), 2); // A4 em pontos: 1400/595 > 2
  assert.equal(escalaRender(1400), 1);
  assert.equal(escalaRender(2800), 0.5);
});
