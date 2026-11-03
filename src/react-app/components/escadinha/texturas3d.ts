import * as THREE from "three";

// ---------------------------------------------------------------- texturas (desenhadas uma vez)

let texturas: { bloco: THREE.Texture; piso: THREE.Texture; madeira: THREE.Texture; concreto: THREE.Texture } | null = null;
/** Texturas do estudo do Juan (bloco 39×19 em amarração, porcelanato 60×60, concreto): cada imagem cobre 1,2 m × 1,2 m. */
export const ESCALA_FOTO = 1.2;
function foto(url: string, reserva: THREE.Texture) {
  if (typeof document === "undefined") return reserva;
  const t = new THREE.TextureLoader().load(url, undefined, undefined, () => { /* sem a imagem, fica a reserva desenhada */ });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function canvas(w: number, h: number, desenhar: (c: CanvasRenderingContext2D) => void) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const c = el.getContext("2d");
  if (c) desenhar(c);
  const t = new THREE.CanvasTexture(el);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function obterTexturas() {
  if (texturas) return texturas;
  const desenhado = {
    // Bloco estrutural de concreto 39×19 com junta de argamassa, fiadas em amarração.
    bloco: canvas(128, 64, c => {
      c.fillStyle = "#d6d3d1";
      c.fillRect(0, 0, 128, 64);
      c.fillStyle = "#9ca3af";
      const blocos: [number, number][] = [[2, 2], [66, 2], [-30, 34], [34, 34], [98, 34]];
      for (const [x, y] of blocos) c.fillRect(x, y, 60, 28);
      c.fillStyle = "rgba(255,255,255,0.12)";
      for (const [x, y] of blocos) c.fillRect(x + 4, y + 4, 52, 6);
    }),
    piso: canvas(64, 64, c => {
      c.fillStyle = "#f5f0e6";
      c.fillRect(0, 0, 64, 64);
      c.strokeStyle = "#d6cdbb";
      c.lineWidth = 2;
      c.strokeRect(1, 1, 62, 62);
    }),
    madeira: canvas(64, 64, c => {
      c.fillStyle = "#b07a45";
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#9a6638";
      for (let y = 0; y < 64; y += 16) c.fillRect(0, y, 64, 2);
      c.fillRect(20, 0, 2, 16); c.fillRect(44, 16, 2, 16); c.fillRect(12, 32, 2, 16); c.fillRect(52, 48, 2, 16);
    }),
  };
  texturas = {
    bloco: foto("/texturas/bloco.jpg", desenhado.bloco),
    piso: foto("/texturas/ceramica.jpg", desenhado.piso),
    madeira: desenhado.madeira,
    concreto: foto("/texturas/concreto.jpg", desenhado.piso),
  };
  return texturas;
}

