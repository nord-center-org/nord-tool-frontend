/** Cache das imagens do bloco (as coladas e os fundos de PDF), lidas com o token e guardadas como bitmap. */
import { blocoNotasService as servico } from "@/react-app/services/BlocoNotasService";

const imagens = new Map<number, Promise<ImageBitmap | null>>();
const fundos = new Map<number, Promise<ImageBitmap | null>>();

const bitmap = (blob: Promise<Blob>) => blob.then(b => createImageBitmap(b)).catch(() => null);

export function imagemDoBloco(id: number): Promise<ImageBitmap | null> {
  if (!imagens.has(id)) imagens.set(id, bitmap(servico.imagem(id)));
  return imagens.get(id)!;
}

export function fundoDaPagina(idPagina: number): Promise<ImageBitmap | null> {
  if (!fundos.has(idPagina)) fundos.set(idPagina, bitmap(servico.fundo(idPagina)));
  return fundos.get(idPagina)!;
}

/** Imagem recém-enviada: já entra no cache sem baixar de novo. */
export function guardarImagem(id: number, bmp: ImageBitmap) {
  imagens.set(id, Promise.resolve(bmp));
}
