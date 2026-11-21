import { useEffect, useRef } from "react";

/**
 * Fundo da Central de Games: horizonte neon com grade em perspectiva correndo e partículas subindo, tudo desenhado
 * no canvas (nada de imagem). Para quem prefere menos movimento, fica parado.
 */
export default function FundoGamer({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const parado = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const particulas = Array.from({ length: 46 }, (_, i) => ({ x: (i * 97) % 100 / 100, y: (i * 53) % 100 / 100, v: 0.012 + ((i * 31) % 10) / 600, r: 0.6 + (i % 3) * 0.6, cor: i % 3 === 0 ? "#22d3ee" : i % 3 === 1 ? "#e879f9" : "#a3e635" }));
    let quadro = 0;
    let anterior = performance.now();
    let deslocamento = 0;
    const desenhar = (agora: number) => {
      const dt = Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ceu = ctx.createLinearGradient(0, 0, 0, h);
      ceu.addColorStop(0, "#05060f");
      ceu.addColorStop(0.55, "#0b0820");
      ceu.addColorStop(1, "#140a2e");
      ctx.fillStyle = ceu;
      ctx.fillRect(0, 0, w, h);
      // Sol neon no horizonte.
      const hz = h * 0.62;
      const sol = ctx.createRadialGradient(w * 0.5, hz, 0, w * 0.5, hz, Math.max(w, h) * 0.45);
      sol.addColorStop(0, "rgba(236,72,153,.35)");
      sol.addColorStop(0.4, "rgba(124,58,237,.16)");
      sol.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sol;
      ctx.fillRect(0, 0, w, h);
      // Grade em perspectiva correndo para a frente.
      deslocamento = (deslocamento + (parado ? 0 : dt * 0.35)) % 1;
      ctx.strokeStyle = "rgba(34,211,238,.22)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const t = (i + deslocamento) / 14;
        const y = hz + (h - hz) * t * t;
        ctx.globalAlpha = 0.2 + t * 0.8;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let i = -12; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + i * w * 0.02, hz);
        ctx.lineTo(w / 2 + i * w * 0.16, h);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(232,121,249,.55)";
      ctx.fillRect(0, hz - 1, w, 2);
      // Partículas subindo.
      for (const p of particulas) {
        if (!parado) p.y -= p.v * dt * 4;
        if (p.y < -0.02) p.y = 1.02;
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(agora / 600 + p.x * 20);
        ctx.fillStyle = p.cor;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!parado) quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, []);
  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
