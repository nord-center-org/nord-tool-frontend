/** SAC: imagens dos prints (vêm da captura em base64) e o ajuste ao limite do servidor (5 MB). */
import { MAX_BYTES_PRINT } from "@/react-app/utils/sac";

export function base64ParaBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}


/** Imagem grande demais para o servidor (5 MB) vira JPEG reduzido. */
export async function caber(blob: Blob): Promise<Blob> {
  if (blob.size <= MAX_BYTES_PRINT) return blob;
  const bitmap = await createImageBitmap(blob);
  let escala = 1;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * escala);
    c.height = Math.round(bitmap.height * escala);
    c.getContext("2d")?.drawImage(bitmap, 0, 0, c.width, c.height);
    const saida = await new Promise<Blob | null>(ok => c.toBlob(ok, "image/jpeg", 0.85));
    if (saida && saida.size <= MAX_BYTES_PRINT) return saida;
    escala *= 0.75;
  }
  throw new Error("A imagem é grande demais.");
}
