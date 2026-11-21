import type { Jogo } from "@/react-app/utils/games/catalogo";

/**
 * Capas retrô da Central, desenhadas por código (nenhuma imagem): fundo em degradê, padrão de pixels,
 * o desenho do gênero (motivo) e o título em letra grossa com contorno.
 */
export function desenharCapa(ctx: CanvasRenderingContext2D, jogo: Jogo, w: number, h: number) {
  const [escuro, medio, claro] = jogo.cores;
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, medio);
  g.addColorStop(1, escuro);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Trama de pixels (semente pelo id, a capa é sempre igual).
  let s = [...jogo.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const px = Math.max(4, Math.round(w / 40));
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = claro;
  for (let i = 0; i < 90; i++) ctx.fillRect(Math.floor((r() * w) / px) * px, Math.floor((r() * h * 0.6) / px) * px, px, px);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(w / 2, h * 0.42);
  motivo(ctx, jogo, w, h, r);
  ctx.restore();
  // Faixa do título.
  const fg = ctx.createLinearGradient(0, h * 0.62, 0, h);
  fg.addColorStop(0, "rgba(0,0,0,0)");
  fg.addColorStop(1, "rgba(0,0,0,.75)");
  ctx.fillStyle = fg;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const palavras = jogo.nome.toUpperCase().split(" ");
  const linhas: string[] = [];
  let atual = "";
  const tam = Math.round(w * 0.105);
  ctx.font = `900 ${tam}px system-ui, sans-serif`;
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > w * 0.86 && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = teste;
  }
  linhas.push(atual);
  linhas.forEach((l, i) => {
    const y = h - w * 0.07 - (linhas.length - 1 - i) * tam * 1.02;
    ctx.lineWidth = tam * 0.18;
    ctx.strokeStyle = escuro;
    ctx.strokeText(l, w * 0.07, y);
    ctx.fillStyle = claro;
    ctx.fillText(l, w * 0.07, y);
  });
}

function motivo(ctx: CanvasRenderingContext2D, jogo: Jogo, w: number, h: number, r: () => number) {
  const [escuro, medio, claro] = jogo.cores;
  const u = w / 10;
  const bloco = (x: number, y: number, l: number, a: number, cor: string, borda = escuro) => {
    ctx.fillStyle = cor;
    ctx.fillRect(x, y, l, a);
    ctx.strokeStyle = borda;
    ctx.lineWidth = u * 0.12;
    ctx.strokeRect(x, y, l, a);
  };
  const circulo = (x: number, y: number, raio: number, cor: string) => {
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fill();
  };
  switch (jogo.motivo) {
    case "grade": {
      for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) {
        const pilar = x % 2 === 0 && y % 2 === 0;
        if (pilar) bloco(x * u - u / 2, y * u - u / 2, u, u, "#57534e", "#292524");
        else if (r() < 0.4) bloco(x * u - u / 2, y * u - u / 2, u, u, "#b45309", "#78350f");
      }
      circulo(0, u * 0.2, u * 1.1, "#111827");
      ctx.strokeStyle = claro;
      ctx.lineWidth = u * 0.25;
      ctx.beginPath();
      ctx.moveTo(u * 0.4, -u * 0.8);
      ctx.quadraticCurveTo(u * 1.2, -u * 1.8, u * 1.6, -u * 1.4);
      ctx.stroke();
      circulo(u * 1.7, -u * 1.45, u * 0.35, "#fde047");
      circulo(-u * 0.35, -u * 0.2, u * 0.3, "rgba(255,255,255,.35)");
      break;
    }
    case "cartas":
      ["#ef4444", "#3b82f6", "#22c55e", "#facc15"].forEach((cor, i) => {
        ctx.save();
        ctx.rotate((i - 1.5) * 0.28);
        ctx.translate(0, -u * 0.6);
        bloco(-u * 1.1, -u * 1.6, u * 2.2, u * 3.2, cor, "#fff");
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${u * 1.4}px system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(["+2", "↺", "⊘", "7"][i], 0, u * 0.5);
        ctx.restore();
      });
      break;
    case "mira":
      ctx.strokeStyle = claro;
      ctx.lineWidth = u * 0.25;
      for (const raio of [u * 2.4, u * 1.2]) {
        ctx.beginPath();
        ctx.arc(0, 0, raio, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x * u * 0.6, y * u * 0.6);
        ctx.lineTo(x * u * 3, y * u * 3);
        ctx.stroke();
      }
      circulo(0, 0, u * 0.3, medio);
      break;
    case "estrada":
    case "pista": {
      ctx.fillStyle = "#27272a";
      ctx.beginPath();
      ctx.moveTo(-u * 1.2, -u * 3);
      ctx.lineTo(u * 1.2, -u * 3);
      ctx.lineTo(u * 4.5, u * 3);
      ctx.lineTo(-u * 4.5, u * 3);
      ctx.fill();
      ctx.fillStyle = claro;
      for (let i = 0; i < 4; i++) ctx.fillRect(-u * 0.12 * (1 + i * 0.6), -u * 2.5 + i * u * 1.4, u * 0.24 * (1 + i * 0.6), u * 0.7);
      bloco(-u * 1.2, u * 0.6, u * 2.4, u * 1.2, medio);
      circulo(-u * 0.8, u * 1.9, u * 0.35, "#111");
      circulo(u * 0.8, u * 1.9, u * 0.35, "#111");
      break;
    }
    case "panela":
      bloco(-u * 2.6, u * 0.4, u * 5.2, u * 1.6, "#d6d3d1");
      circulo(0, -u * 0.2, u * 1.4, "#44403c");
      for (let i = 0; i < 5; i++) circulo((r() - 0.5) * u * 2, -u * 1.5 - r() * u, u * (0.2 + r() * 0.3), "#f97316");
      break;
    case "hexagono":
      for (const [cx, cy] of [[0, 0], [1.75, 1], [-1.75, 1], [0, 2], [1.75, -1], [-1.75, -1], [0, -2]]) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;
          ctx.lineTo(cx * u + Math.cos(a) * u * 0.95, cy * u + Math.sin(a) * u * 0.95);
        }
        ctx.closePath();
        ctx.fillStyle = r() < 0.3 ? claro : medio;
        ctx.fill();
        ctx.strokeStyle = escuro;
        ctx.lineWidth = u * 0.1;
        ctx.stroke();
      }
      break;
    case "tanque":
      bloco(-u * 1.8, -u * 0.3, u * 3.6, u * 1.6, medio);
      bloco(-u * 0.8, -u * 1.2, u * 1.6, u * 1, claro);
      bloco(u * 0.6, -u * 0.95, u * 2.2, u * 0.4, "#3f3f46");
      break;
    case "zumbi":
      circulo(0, 0, u * 3, "rgba(255,255,200,.15)");
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2, d = u * (1.5 + r() * 1.5);
        bloco(Math.cos(a) * d - u * 0.4, Math.sin(a) * d - u * 0.4, u * 0.8, u * 0.8, "#4d7c0f");
        circulo(Math.cos(a) * d - u * 0.15, Math.sin(a) * d - u * 0.1, u * 0.1, "#ef4444");
      }
      bloco(-u * 0.45, -u * 0.45, u * 0.9, u * 0.9, "#38bdf8");
      break;
    case "masmorra":
      for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) bloco(x * u - u / 2, y * u - u / 2, u, u, (x + y) % 2 ? "#44403c" : "#57534e", "#1c1917");
      bloco(-u * 0.6, -u * 0.5, u * 1.2, u * 0.9, "#b45309");
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-u * 0.15, -u * 0.2, u * 0.3, u * 0.3);
      break;
    case "mar":
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = claro;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = u * 0.12;
        ctx.beginPath();
        for (let x = -5; x <= 5; x += 0.5) ctx.lineTo(x * u, (i - 3) * u + Math.sin(x * 2 + i) * u * 0.2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      bloco(-u * 2, -u * 0.2, u * 4, u * 0.8, "#475569");
      bloco(-u * 0.6, -u * 0.9, u * 1.2, u * 0.7, "#64748b");
      break;
    case "torre":
      ["#b45309", "#78716c", "#b45309", "#94a3b8", "#b45309"].forEach((cor, i) => bloco(-u * 1.2 + (i % 2) * u * 0.2, u * 2 - i * u, u * 2.4, u * 0.9, cor));
      circulo(-u * 3, -u * 1.5, u * 0.5, "#1f2937");
      break;
    case "coroa":
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.moveTo(-u * 2, u);
      ctx.lineTo(-u * 2, -u);
      ctx.lineTo(-u, 0);
      ctx.lineTo(0, -u * 1.6);
      ctx.lineTo(u, 0);
      ctx.lineTo(u * 2, -u);
      ctx.lineTo(u * 2, u);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = escuro;
      ctx.lineWidth = u * 0.15;
      ctx.stroke();
      circulo(0, u * 0.3, u * 0.3, "#e11d48");
      break;
    case "muralha":
      for (let x = -4; x <= 4; x++) bloco(x * u - u / 2, u * 0.5, u, u * 1.5, "#64748b");
      for (let x = -4; x <= 4; x += 2) bloco(x * u - u / 2, -u * 0.2, u, u * 0.7, "#64748b");
      circulo(0, -u * 1.6, u * 0.6, claro);
      break;
    case "estrelas":
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = r();
        ctx.fillRect((r() - 0.5) * w, (r() - 0.5) * h * 0.8, u * 0.08, u * 0.08);
      }
      ctx.globalAlpha = 1;
      circulo(-u * 2, u, u * 1.4, medio);
      ctx.fillStyle = claro;
      ctx.beginPath();
      ctx.moveTo(u * 1.6, -u * 1.4);
      ctx.lineTo(u * 0.6, -u * 0.2);
      ctx.lineTo(u * 2.6, -u * 0.2);
      ctx.fill();
      break;
    case "sol":
      circulo(0, -u * 0.6, u * 2.2, claro);
      ctx.fillStyle = escuro;
      ctx.fillRect(-w, u * 1.2, w * 2, u * 3);
      bloco(-u * 3, u * 0.2, u * 0.5, u * 1, "#1c1917", "#1c1917");
      bloco(u * 2.5, u * 0.2, u * 0.5, u * 1, "#1c1917", "#1c1917");
      break;
    case "notas":
      for (let i = 0; i < 4; i++) {
        bloco(-u * 3 + i * u * 1.6, -u * 2.5, u * 1.2, u * 5, "rgba(255,255,255,.08)", claro);
        circulo(-u * 2.4 + i * u * 1.6, (r() - 0.3) * u * 3, u * 0.45, [claro, medio, "#facc15", "#22c55e"][i]);
      }
      break;
    case "blocos": {
      const cores = ["#06b6d4", "#a3e635", "#f472b6", "#facc15", "#a78bfa"];
      for (let y = 0; y < 5; y++) for (let x = -3; x <= 3; x++) if (r() < 0.75 || y > 3) bloco(x * u * 0.8, u * 2 - y * u * 0.8, u * 0.8, u * 0.8, cores[(x + y + 9) % 5]);
      break;
    }
    case "bolhas":
      for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = claro;
        ctx.lineWidth = u * 0.08;
        ctx.beginPath();
        ctx.arc((r() - 0.5) * u * 6, (r() - 0.5) * u * 5, u * (0.15 + r() * 0.4), 0, Math.PI * 2);
        ctx.stroke();
      }
      bloco(-u * 1.5, -u * 0.5, u * 3, u * 1.2, "#facc15");
      circulo(u * 0.6, 0, u * 0.3, "#0ea5e9");
      break;
    case "picareta":
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = u * 0.35;
      ctx.beginPath();
      ctx.moveTo(-u * 1.6, u * 1.6);
      ctx.lineTo(u * 1.2, -u * 1.2);
      ctx.stroke();
      ctx.strokeStyle = "#a8a29e";
      ctx.lineWidth = u * 0.4;
      ctx.beginPath();
      ctx.arc(u * 1.2, -u * 1.2, u * 1.5, Math.PI * 0.7, Math.PI * 1.8);
      ctx.stroke();
      for (let i = 0; i < 5; i++) circulo((r() - 0.5) * u * 5, u * 2 + r() * u, u * 0.25, "#facc15");
      break;
    case "chefao":
      circulo(0, 0, u * 2.6, medio);
      circulo(-u, -u * 0.5, u * 0.5, claro);
      circulo(u, -u * 0.5, u * 0.5, claro);
      circulo(-u, -u * 0.5, u * 0.2, "#000");
      circulo(u, -u * 0.5, u * 0.2, "#000");
      ctx.fillStyle = "#000";
      ctx.fillRect(-u * 1.2, u * 0.8, u * 2.4, u * 0.4);
      break;
  }
}
