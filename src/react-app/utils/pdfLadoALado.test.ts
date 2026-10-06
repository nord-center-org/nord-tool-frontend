import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { gerarPdfLadoALado, type FotoParaPdf } from './pdfLadoALado.ts';

// PNG 1x1 válido
const PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

async function termo(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 600]).drawText('TERMO - PAGINA 1', { x: 20, y: 560, size: 16 });
  const girada = doc.addPage([600, 400]);  // página 2 (paisagem girada 90°)
  girada.setRotation(degrees(90));
  girada.drawText('TERMO - PAGINA 2', { x: 20, y: 365, size: 16 });
  doc.addPage([400, 600]).drawText('TERMO - PAGINA 3', { x: 20, y: 560, size: 16 });
  return doc.save();
}

const foto = (id: number, pagina: number, ordem: number, legenda: string | null = null): FotoParaPdf =>
  ({ id, pagina, ordem, legenda, bytes: PNG, tipo: 'image/png' });

const base = async () => ({
  codigoApartamento: 'EN-02-1307',
  nrTermo: 2,
  situacao: 'EM_ANDAMENTO',
  pdfBytes: await termo(),
  geradoEm: new Date('2026-10-05T15:00:00Z'),
});

test('1 página com 3 fotos gera 3 folhas A4 paisagem; demais páginas viram folha "sem foto"', async () => {
  const dados = { ...(await base()), fotos: [foto(1, 1, 0, 'Porta ajustada'), foto(2, 1, 1), foto(3, 1, 2, 'x'.repeat(400))] };
  const bytes = await gerarPdfLadoALado(dados, { incluirPaginasSemFoto: true });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 3 + 1 + 1); // 3 fotos + pág. 2 + pág. 3
  for (const p of pdf.getPages()) {
    assert.equal(p.getWidth(), 841.89);
    assert.equal(p.getHeight(), 595.28);
  }
  assert.match(pdf.getTitle() ?? '', /EN-02-1307 - Termo 2/);
});

test('omitir páginas sem foto gera só as folhas das fotos', async () => {
  const dados = { ...(await base()), fotos: [foto(1, 1, 0), foto(2, 3, 0)] };
  const pdf = await PDFDocument.load(await gerarPdfLadoALado(dados, { incluirPaginasSemFoto: false }));
  assert.equal(pdf.getPageCount(), 2);
});

test('página girada (rotação 90°) é desenhada sem erro', async () => {
  const dados = { ...(await base()), fotos: [foto(1, 2, 0, 'Página girada')] };
  const pdf = await PDFDocument.load(await gerarPdfLadoALado(dados, { incluirPaginasSemFoto: false }));
  assert.equal(pdf.getPageCount(), 1);
});

test('caracteres fora do alfabeto da fonte padrão não quebram a geração', async () => {
  const dados = { ...(await base()), fotos: [foto(1, 1, 0, 'Ação concluída ✓ 日本 — ok')] };
  const bytes = await gerarPdfLadoALado(dados, { incluirPaginasSemFoto: false });
  assert.ok(bytes.length > 500);
});

test('sem fotos e sem páginas vazias, recusa gerar', async () => {
  await assert.rejects(
    async () => gerarPdfLadoALado({ ...(await base()), fotos: [] }, { incluirPaginasSemFoto: false }),
    /Não há nada para gerar/,
  );
});

test('código fora do padrão ainda gera o cabeçalho', async () => {
  const dados = { ...(await base()), codigoApartamento: 'Apto 12', fotos: [foto(1, 1, 0)] };
  const pdf = await PDFDocument.load(await gerarPdfLadoALado(dados, { incluirPaginasSemFoto: false }));
  assert.equal(pdf.getPageCount(), 1);
});

test('página totalmente vazia no termo não derruba a exportação', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 600]).drawText('com conteudo', { x: 20, y: 560, size: 14 });
  doc.addPage([400, 600]); // sem /Contents: o pdf-lib não consegue incorporar
  const dados = { ...(await base()), pdfBytes: await doc.save(), fotos: [foto(1, 1, 0), foto(2, 2, 0, 'Página vazia')] };
  const pdf = await PDFDocument.load(await gerarPdfLadoALado(dados, { incluirPaginasSemFoto: false }));
  assert.equal(pdf.getPageCount(), 2);
});

test('imagem inválida gera erro claro, com a página', async () => {
  const ruim: FotoParaPdf = { id: 9, pagina: 2, ordem: 0, legenda: null, bytes: Uint8Array.from([1, 2, 3, 4]), tipo: 'image/jpeg' };
  const dados = { ...(await base()), fotos: [foto(1, 1, 0), ruim] };
  await assert.rejects(gerarPdfLadoALado(dados, { incluirPaginasSemFoto: false }), /página 2.*imagem está inválida/);
});
