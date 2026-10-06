/** Reencoda uma foto em JPEG menor (opção "leve" do PDF lado a lado). Só funciona no navegador. */

export interface FotoReencodada {
  bytes: Uint8Array;
  tipo: "image/jpeg";
}

export const LEVE_MAX_LADO = 1000;
export const LEVE_QUALIDADE = 0.6;

export async function reencodarFoto(
  bytes: Uint8Array,
  tipo: string,
  maxLado = LEVE_MAX_LADO,
  qualidade = LEVE_QUALIDADE,
): Promise<FotoReencodada> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: tipo }), { imageOrientation: "from-image" });
  try {
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Não foi possível reduzir a foto.");
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Não foi possível reduzir a foto."))), "image/jpeg", qualidade));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), tipo: "image/jpeg" };
  } finally {
    bitmap.close();
  }
}
