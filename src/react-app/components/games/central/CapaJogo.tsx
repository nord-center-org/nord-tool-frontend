import { useEffect, useRef } from "react";
import type { Jogo } from "@/react-app/utils/games/catalogo";
import { desenharCapa } from "./capas";

/** Capa do jogo desenhada em canvas (nítida em telas de alta densidade). */
export default function CapaJogo({ jogo, className = "" }: { jogo: Jogo; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = 300, h = 400;
    c.width = w * d;
    c.height = h * d;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(d, d);
    desenharCapa(ctx, jogo, w, h);
  }, [jogo]);
  return <canvas ref={ref} role="img" aria-label={`Capa de ${jogo.nome}`} className={`block aspect-[3/4] w-full ${className}`} />;
}
