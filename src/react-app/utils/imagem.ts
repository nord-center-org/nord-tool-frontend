/** Preparo de fotos no navegador: reduz e reencoda antes do upload (port de `preparePhoto` do Lugia). */

export const FOTO_MAX_LADO = 1280;
export const MINIATURA_MAX_LADO = 400;
export const FOTO_QUALIDADE = 0.78;
export const MINIATURA_QUALIDADE = 0.7;
export const FOTO_MAX_BYTES = 5 * 1024 * 1024;
const TIPOS_ACEITOS = ['image/jpeg', 'image/png'];

export interface FotoPreparada {
  imagem: Blob;
  miniatura: Blob;
  /** Nome sugerido para o arquivo (sempre .jpg). */
  nome: string;
}

/** Dimensões proporcionais com o maior lado limitado a `max` (nunca amplia). */
export function calcularDimensoes(largura: number, altura: number, max: number): { width: number; height: number } {
  const escala = Math.min(1, max / Math.max(largura, altura));
  return {
    width: Math.max(1, Math.round(largura * escala)),
    height: Math.max(1, Math.round(altura * escala)),
  };
}

export function nomeJpeg(nomeOriginal: string): string {
  const base = nomeOriginal.replace(/\.[^.]+$/, '').trim() || 'foto';
  return `${base}.jpg`;
}

export function validarTipoFoto(tipo: string): void {
  if (!TIPOS_ACEITOS.includes(tipo)) {
    throw new Error('Selecione uma foto JPG ou PNG.');
  }
}

export function validarTamanhoFinal(bytes: number): void {
  if (bytes > FOTO_MAX_BYTES) {
    throw new Error('A foto ficou maior que 5 MB mesmo depois de reduzida. Escolha outra imagem.');
  }
}

function canvasParaJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Não foi possível preparar a foto.'))),
      'image/jpeg',
      qualidade,
    );
  });
}

function desenhar(bitmap: ImageBitmap, max: number): HTMLCanvasElement {
  const { width, height } = calcularDimensoes(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('Não foi possível preparar a foto.');
  // PNG com transparência viraria preto no JPEG.
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, width, height);
  contexto.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

/**
 * Reduz a foto (máx. 1280 px, JPEG 0,78) e gera a miniatura (400 px).
 * Respeita a orientação EXIF e valida JPG/PNG e o tamanho final (≤ 5 MB).
 */
export async function prepararFoto(arquivo: File): Promise<FotoPreparada> {
  validarTipoFoto(arquivo.type);
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  try {
    const imagem = await canvasParaJpeg(desenhar(bitmap, FOTO_MAX_LADO), FOTO_QUALIDADE);
    validarTamanhoFinal(imagem.size);
    const miniatura = await canvasParaJpeg(desenhar(bitmap, MINIATURA_MAX_LADO), MINIATURA_QUALIDADE);
    return { imagem, miniatura, nome: nomeJpeg(arquivo.name) };
  } finally {
    bitmap.close();
  }
}
