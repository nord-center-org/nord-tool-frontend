import type { Bioma, Estado, Jogador, PowerUp } from "@/react-app/utils/games/bombas";
import { celula, PAVIO } from "@/react-app/utils/games/bombas";
import { CORES_JOGADORES } from "../../central/sprites";

/** Paleta de cada bioma: chão em xadrez, pilar com volume e caixa destrutível. Tudo desenhado por código. */
export const BIOMAS: Record<Bioma, { nome: string; chaoA: string; chaoB: string; pilar: string; pilarTopo: string; pilarSombra: string; caixa: string; caixaFrisos: string; fundo: string }> = {
  fabrica: { nome: "Fábrica", chaoA: "#4b5563", chaoB: "#525c6b", pilar: "#6b7280", pilarTopo: "#9ca3af", pilarSombra: "#374151", caixa: "#b45309", caixaFrisos: "#78350f", fundo: "#1f2937" },
  gelo: { nome: "Gelo", chaoA: "#bfdbfe", chaoB: "#c7e2fe", pilar: "#60a5fa", pilarTopo: "#dbeafe", pilarSombra: "#1d4ed8", caixa: "#e0f2fe", caixaFrisos: "#7dd3fc", fundo: "#0c4a6e" },
  vulcao: { nome: "Vulcão", chaoA: "#3f1d1d", chaoB: "#47201f", pilar: "#1c1917", pilarTopo: "#44403c", pilarSombra: "#0c0a09", caixa: "#57534e", caixaFrisos: "#292524", fundo: "#140a0a" },
};

export interface Interpolado { x: number; y: number }

/** O mapa fixo (chão e pilares) num canvas à parte, redesenhado só quando muda (morte súbita) ou a tela muda de tamanho. */
export function desenharChao(ctx: CanvasRenderingContext2D, e: Estado, t: number) {
  const b = BIOMAS[e.bioma];
  for (let y = 0; y < e.altura; y++) for (let x = 0; x < e.largura; x++) {
    ctx.fillStyle = (x + y) % 2 ? b.chaoA : b.chaoB;
    ctx.fillRect(x * t, y * t, t, t);
    if (e.bioma === "vulcao" && (x * 7 + y * 13) % 11 === 0) {
      ctx.strokeStyle = "rgba(249,115,22,.55)";
      ctx.lineWidth = Math.max(1, t * 0.05);
      ctx.beginPath();
      ctx.moveTo(x * t + t * 0.2, y * t + t * 0.3);
      ctx.lineTo(x * t + t * 0.5, y * t + t * 0.55);
      ctx.lineTo(x * t + t * 0.8, y * t + t * 0.45);
      ctx.stroke();
    }
    if (e.bioma === "gelo" && (x * 5 + y * 3) % 9 === 0) {
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fillRect(x * t + t * 0.2, y * t + t * 0.25, t * 0.25, t * 0.06);
    }
  }
}

export function desenharBlocos(ctx: CanvasRenderingContext2D, e: Estado, t: number) {
  const b = BIOMAS[e.bioma];
  for (let y = 0; y < e.altura; y++) for (let x = 0; x < e.largura; x++) {
    const c = celula(e, x, y);
    const px = x * t, py = y * t;
    if (c === "pilar") {
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.fillRect(px + t * 0.08, py + t * 0.12, t, t);
      ctx.fillStyle = b.pilarSombra;
      ctx.fillRect(px, py, t, t);
      ctx.fillStyle = b.pilar;
      ctx.fillRect(px, py, t, t * 0.82);
      ctx.fillStyle = b.pilarTopo;
      ctx.fillRect(px + t * 0.08, py + t * 0.06, t * 0.84, t * 0.14);
      if (e.bioma === "fabrica") {
        ctx.fillStyle = "rgba(0,0,0,.25)";
        for (const [rx, ry] of [[0.18, 0.3], [0.82, 0.3], [0.18, 0.7], [0.82, 0.7]]) ctx.fillRect(px + t * rx - t * 0.04, py + t * ry - t * 0.04, t * 0.08, t * 0.08);
      }
    } else if (c === "caixa") {
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.fillRect(px + t * 0.06, py + t * 0.1, t * 0.94, t * 0.9);
      ctx.fillStyle = b.caixa;
      ctx.fillRect(px + t * 0.04, py + t * 0.04, t * 0.92, t * 0.88);
      ctx.strokeStyle = b.caixaFrisos;
      ctx.lineWidth = Math.max(1, t * 0.07);
      ctx.strokeRect(px + t * 0.1, py + t * 0.1, t * 0.8, t * 0.76);
      ctx.beginPath();
      ctx.moveTo(px + t * 0.12, py + t * 0.12);
      ctx.lineTo(px + t * 0.88, py + t * 0.84);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.fillRect(px + t * 0.06, py + t * 0.06, t * 0.88, t * 0.08);
    }
  }
}

const CORES_ITEM: Record<PowerUp, string> = {
  bomba: "#2563eb", fogo: "#f97316", patins: "#0ea5e9", chute: "#22c55e", luva: "#eab308", detonador: "#ef4444", escudo: "#a855f7", fogoTotal: "#dc2626", caveira: "#4b5563",
};

export const NOME_ITEM: Record<PowerUp, string> = {
  bomba: "+1 bomba", fogo: "+1 fogo", patins: "Patins", chute: "Chute", luva: "Luva", detonador: "Detonador", escudo: "Escudo", fogoTotal: "Fogo total", caveira: "Caveira!",
};

/** Ícone do power-up desenhado por código (círculos, chamas, rodas…). */
export function desenharItem(ctx: CanvasRenderingContext2D, tipo: PowerUp, cx: number, cy: number, t: number, tempo: number) {
  const s = t * 0.78;
  const flutua = Math.sin(tempo * 4 + cx) * t * 0.04;
  const y = cy + flutua;
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.48, s * 0.4, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(cx - s / 2, y - s / 2, s, s, s * 0.2);
  ctx.fill();
  ctx.fillStyle = CORES_ITEM[tipo];
  ctx.beginPath();
  ctx.roundRect(cx - s / 2 + s * 0.08, y - s / 2 + s * 0.08, s * 0.84, s * 0.84, s * 0.16);
  ctx.fill();
  const u = s / 10;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = u * 0.9;
  ctx.lineCap = "round";
  const c = (x: number, yy: number, r: number, cor = "#fff") => {
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(cx + x * u, y + yy * u, r * u, 0, Math.PI * 2);
    ctx.fill();
  };
  const chama = (esc: number, cor: string) => {
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(cx, y - 3.6 * u * esc);
    ctx.quadraticCurveTo(cx + 3 * u * esc, y, cx, y + 3 * u * esc);
    ctx.quadraticCurveTo(cx - 3 * u * esc, y, cx, y - 3.6 * u * esc);
    ctx.fill();
  };
  switch (tipo) {
    case "bomba": c(0, 0.6, 2.6, "#fff"); c(0, 0.6, 2, "#111827"); ctx.beginPath(); ctx.moveTo(cx + u, y - 1.6 * u); ctx.lineTo(cx + 2.2 * u, y - 3 * u); ctx.stroke(); break;
    case "fogo": chama(1, "#fde047"); chama(0.55, "#fff"); break;
    case "fogoTotal": chama(1.1, "#fde047"); chama(0.7, "#fff"); c(2.6, -2.6, 0.9, "#fde047"); break;
    case "patins": ctx.fillRect(cx - 3 * u, y - 2.5 * u, 4 * u, 3.5 * u); ctx.fillRect(cx - 3 * u, y, 6 * u, 1.4 * u); c(-2, 2.4, 1); c(2, 2.4, 1); break;
    case "chute": ctx.fillRect(cx - 1.5 * u, y - 3 * u, 2.6 * u, 4 * u); ctx.fillRect(cx - 1.5 * u, y + 0.5 * u, 4.5 * u, 1.8 * u); break;
    case "luva": c(0, 0.4, 2.6); ctx.fillRect(cx - 2.6 * u, y - 3.2 * u, 1.3 * u, 3 * u); ctx.fillRect(cx - 0.9 * u, y - 3.6 * u, 1.3 * u, 3 * u); ctx.fillRect(cx + 0.8 * u, y - 3.2 * u, 1.3 * u, 3 * u); break;
    case "detonador": ctx.fillRect(cx - 2.4 * u, y - 1 * u, 4.8 * u, 3.6 * u); ctx.fillRect(cx - 0.4 * u, y - 3.6 * u, 0.8 * u, 2.6 * u); c(0, -3.6, 0.9, "#fde047"); break;
    case "escudo":
      ctx.beginPath();
      ctx.moveTo(cx, y - 3.4 * u);
      ctx.lineTo(cx + 3 * u, y - 2 * u);
      ctx.quadraticCurveTo(cx + 2.6 * u, y + 2.4 * u, cx, y + 3.6 * u);
      ctx.quadraticCurveTo(cx - 2.6 * u, y + 2.4 * u, cx - 3 * u, y - 2 * u);
      ctx.closePath();
      ctx.fill();
      break;
    case "caveira": c(0, -0.6, 2.8); ctx.fillRect(cx - 1.6 * u, y + 1.2 * u, 3.2 * u, 1.8 * u); c(-1.1, -0.6, 0.8, "#4b5563"); c(1.1, -0.6, 0.8, "#4b5563"); break;
  }
}

/** Bomba com sombra, brilho, pavio faiscando e o "respirar" (squash & stretch) que acelera perto de explodir. */
export function desenharBomba(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, pavio: number, remota: boolean, tempo: number, altura = 0) {
  const restante = remota ? 1 : Math.max(0, pavio / PAVIO);
  const ritmo = remota ? 4 : 6 + (1 - restante) * 18;
  const pulso = Math.sin(tempo * ritmo);
  const sx = 1 + pulso * 0.07, sy = 1 - pulso * 0.07;
  const r = t * 0.36;
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85 + altura * 0.3, r * 0.9 * (1 - altura / (t * 3)), r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy - altura);
  ctx.scale(sx, sy);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, remota ? "#fca5a5" : "#6b7280");
  g.addColorStop(1, remota ? "#7f1d1d" : "#0b0f19");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  if (!remota && restante < 0.3 && Math.sin(tempo * 30) > 0) {
    ctx.fillStyle = "rgba(239,68,68,.45)";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#374151";
  ctx.fillRect(-r * 0.25, -r * 1.15, r * 0.5, r * 0.3);
  ctx.strokeStyle = "#d6d3d1";
  ctx.lineWidth = Math.max(1, t * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.1);
  ctx.quadraticCurveTo(r * 0.4, -r * 1.5, r * 0.6, -r * 1.35);
  ctx.stroke();
  const faisca = 0.6 + Math.random() * 0.6;
  ctx.fillStyle = Math.random() < 0.5 ? "#fde047" : "#fb923c";
  ctx.beginPath();
  ctx.arc(r * 0.62, -r * 1.36, t * 0.07 * faisca, 0, Math.PI * 2);
  ctx.fill();
  if (remota) {
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.round(t * 0.28)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("R", 0, r * 0.1);
  }
  ctx.restore();
}

/** Chama: núcleo branco, meio amarelo e borda laranja, tremulando. */
export function desenharChama(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, eixo: "h" | "v" | "c", restante: number, tempo: number) {
  const vida = Math.min(1, restante * 3);
  const treme = 1 + Math.sin(tempo * 40 + x * 3 + y) * 0.08;
  const larg = t * (0.82 * vida + 0.1) * treme;
  const px = x * t + t / 2, py = y * t + t / 2;
  const camadas: [string, number][] = [["#f97316", 1], ["#fde047", 0.68], ["#fffbeb", 0.36]];
  for (const [cor, f] of camadas) {
    ctx.fillStyle = cor;
    const l = larg * f;
    if (eixo === "c") {
      ctx.beginPath();
      ctx.arc(px, py, l / 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(px - t / 2, py - l / 2, t, l);
      ctx.fillRect(px - l / 2, py - t / 2, l, t);
    } else if (eixo === "h") ctx.fillRect(x * t, py - l / 2, t, l);
    else ctx.fillRect(px - l / 2, y * t, l, t);
  }
}

/** Jogador: sombra, anel da cor P#, avatar pixel com balanço ao andar e o rótulo P#. */
export function desenharJogador(ctx: CanvasRenderingContext2D, j: Jogador, pos: Interpolado, t: number, sprite: HTMLCanvasElement | undefined, tempo: number, passo: number) {
  const cx = pos.x * t + t / 2, cy = pos.y * t + t / 2;
  const cor = CORES_JOGADORES[j.id % 8];
  const andando = j.andou > 0 && (Math.abs(pos.x - j.alvoX) > 0.01 || Math.abs(pos.y - j.alvoY) > 0.01);
  const balanco = andando ? Math.abs(Math.sin(tempo * 14)) : 0;
  const pisca = j.invulneravelAte > passo && Math.floor(tempo * 12) % 2 === 0;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + t * 0.38, t * 0.36 * (1 - balanco * 0.15), t * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cor;
  ctx.lineWidth = Math.max(2, t * 0.08);
  ctx.beginPath();
  ctx.ellipse(cx, cy + t * 0.36, t * 0.38, t * 0.13, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (pisca) return;
  const lado = t * 1.18;
  const sx = 1 + balanco * 0.06, sy = 1 - balanco * 0.06;
  ctx.save();
  ctx.translate(cx, cy + t * 0.4 - balanco * t * 0.12);
  if (j.direcao === "esquerda") ctx.scale(-1, 1);
  ctx.scale(sx, sy);
  if (sprite) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, -lado / 2, -lado, lado, lado);
  } else {
    ctx.fillStyle = cor;
    ctx.fillRect(-lado * 0.3, -lado * 0.8, lado * 0.6, lado * 0.7);
  }
  ctx.restore();
  if (j.escudo) {
    ctx.strokeStyle = `rgba(168,85,247,${0.5 + Math.sin(tempo * 6) * 0.25})`;
    ctx.lineWidth = Math.max(2, t * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy - t * 0.1, t * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (j.maldicao) {
    ctx.fillStyle = "rgba(75,85,99,.85)";
    ctx.font = `900 ${Math.round(t * 0.3)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("☠", cx + t * 0.42, cy - t * 0.6 + Math.sin(tempo * 6) * t * 0.05);
  }
  ctx.font = `900 ${Math.round(t * 0.26)}px system-ui`;
  ctx.textAlign = "center";
  ctx.lineWidth = Math.max(2, t * 0.06);
  ctx.strokeStyle = "rgba(0,0,0,.8)";
  ctx.strokeText(`P${j.id + 1}`, cx, cy - t * 0.8);
  ctx.fillStyle = cor;
  ctx.fillText(`P${j.id + 1}`, cx, cy - t * 0.8);
}

export function desenharMoeda(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, tempo: number) {
  const giro = Math.abs(Math.cos(tempo * 4 + cx * 0.1));
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + t * 0.3, t * 0.22, t * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ca8a04";
  ctx.beginPath();
  ctx.ellipse(cx, cy, t * 0.26 * giro + 1, t * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  ctx.ellipse(cx, cy, t * 0.19 * giro + 0.5, t * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
}
