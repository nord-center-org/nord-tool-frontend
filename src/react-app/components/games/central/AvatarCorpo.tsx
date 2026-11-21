import { useEffect, useRef } from "react";
import type { AvatarConfig } from "@/react-app/utils/avatar";
import type { AcaoCorpo } from "@/react-app/utils/games/corpo";
import { desenharCorpo, folhaDoCorpo } from "./sprites";

/** Avatar de corpo inteiro animado (parado respirando, andando ou comemorando), desenhado em canvas. */
export default function AvatarCorpo({ config, acao = "parado", direcao = "baixo", altura = 96, rotulo, atraso = 0 }: {
  config: AvatarConfig; acao?: AcaoCorpo; direcao?: "baixo" | "cima" | "esquerda" | "direita"; altura?: number; rotulo?: string; atraso?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const largura = Math.round(altura * (32 / 48));
    c.width = Math.round(largura * dpr);
    c.height = Math.round(altura * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const folha = folhaDoCorpo(config, `ui-${JSON.stringify(config)}`);
    const parar = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let quadro = 0;
    const inicio = performance.now() - atraso * 1000;
    const desenhar = (agora: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      desenharCorpo(ctx, folha, direcao, acao, parar ? 0 : (agora - inicio) / 1000, c.width / 2, c.height, c.height);
      if (!parar) quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [config, acao, direcao, altura, atraso]);
  return <canvas ref={ref} role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}
    style={{ width: Math.round(altura * (32 / 48)), height: altura, imageRendering: "pixelated" }} />;
}
