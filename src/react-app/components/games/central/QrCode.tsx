import { useEffect, useRef } from "react";
import { gerarQr } from "@/react-app/utils/games/qrcode";

/** QR Code desenhado no canvas (o gerador é nosso, nada de imagem pronta). */
export default function QrCode({ texto, tamanho = 200, rotulo }: { texto: string; tamanho?: number; rotulo: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const q = gerarQr(texto);
    const margem = 4;
    const lado = q.tamanho + margem * 2;
    const escala = Math.max(1, Math.floor((tamanho * (window.devicePixelRatio || 1)) / lado));
    c.width = lado * escala;
    c.height = lado * escala;
    const g = c.getContext("2d");
    if (!g) return;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#0f172a";
    q.modulos.forEach((linha, y) => linha.forEach((escuro, x) => { if (escuro) g.fillRect((x + margem) * escala, (y + margem) * escala, escala, escala); }));
  }, [texto, tamanho]);
  return <canvas ref={ref} role="img" aria-label={rotulo} style={{ width: tamanho, height: tamanho, imageRendering: "pixelated" }} className="rounded-xl" />;
}
