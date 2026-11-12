/**
 * Desenho do instrumento no canvas, no estilo dos vídeos de piano: as notas descem e, quando chegam ao braço (ou ao
 * teclado), acendem no lugar onde se toca. O braço fica deitado, com a corda mais grave embaixo, como na tablatura.
 */
import { ehPreta, type EventoQueda, type Instrumento } from "@/react-app/utils/musica/instrumentos";
import { NOTAS_SUSTENIDO } from "@/react-app/utils/musica/teoria";

export interface Cena {
  instrumento: Instrumento;
  eventos: EventoQueda[];
  casas: number;
  acordeAtual: string | null;
  proximoAcorde: string | null;
  /** Segundos que cabem na área de queda. */
  janela: number;
  escuro: boolean;
}

const CORES = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

/** Primeiro evento com fim > t (busca binária pelo início, os eventos vêm em ordem). */
function primeiroVisivel(ev: EventoQueda[], t: number, folga: number) {
  let lo = 0, hi = ev.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].inicio < t - folga) lo = m + 1; else hi = m; }
  return lo;
}

export function desenhar(ctx: CanvasRenderingContext2D, w: number, h: number, cena: Cena, t: number) {
  const { instrumento: ins, eventos, janela, escuro } = cena;
  const fundo = escuro ? "#0f172a" : "#f8fafc", tinta = escuro ? "#e2e8f0" : "#334155", fraco = escuro ? "#334155" : "#cbd5e1";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, w, h);
  const teclado = ins.id === "teclado";
  const altBase = teclado ? Math.min(h * 0.32, 110) : Math.min(h * 0.42, 30 * ins.cordas.length + 26);
  const topoBase = h - altBase;

  // ---------- onde cada evento cai (x, largura) e a linha da corda ----------
  let xDe: (e: EventoQueda) => { x: number; l: number };
  let desenharBase: (ativos: EventoQueda[]) => void;
  if (teclado) {
    const [ini, fim] = ins.faixa;
    const brancas: number[] = [];
    for (let m = ini; m <= fim; m++) if (!ehPreta(m)) brancas.push(m);
    const lb = w / brancas.length;
    const xTecla = (m: number) => {
      if (!ehPreta(m)) return { x: brancas.indexOf(m) * lb, l: lb };
      return { x: (brancas.indexOf(m - 1) + 1) * lb - lb * 0.3, l: lb * 0.6 };
    };
    xDe = e => xTecla(e.midi ?? ini);
    desenharBase = ativos => {
      const acesas = new Set(ativos.map(e => e.midi));
      for (const m of brancas) {
        const { x, l } = xTecla(m);
        ctx.fillStyle = acesas.has(m) ? "#3b82f6" : "#ffffff";
        ctx.fillRect(x + 0.5, topoBase, l - 1, altBase);
        ctx.strokeStyle = "#94a3b8"; ctx.strokeRect(x + 0.5, topoBase, l - 1, altBase);
        if (m % 12 === 0) { ctx.fillStyle = acesas.has(m) ? "#fff" : "#64748b"; ctx.font = `${Math.max(9, lb * 0.4)}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(`C${Math.floor(m / 12) - 1}`, x + l / 2, h - 6); }
      }
      for (let m = ini; m <= fim; m++) {
        if (!ehPreta(m)) continue;
        const { x, l } = xTecla(m);
        ctx.fillStyle = acesas.has(m) ? "#60a5fa" : "#1e293b";
        ctx.fillRect(x, topoBase, l, altBase * 0.62);
      }
    };
  } else {
    const n = ins.cordas.length;
    const margem = 30, x0 = margem + 16, larg = w - x0 - 10;
    const k = (f: number) => (1 - 2 ** (-f / 12)) / (1 - 2 ** (-cena.casas / 12));
    const xTraste = (f: number) => x0 + larg * k(f);
    const xCasa = (c: number) => (c === 0 ? x0 - 12 : (xTraste(c - 1) + xTraste(c)) / 2);
    const yCorda = (c: number) => topoBase + 12 + ((altBase - 30) * (n - 1 - c)) / Math.max(1, n - 1);
    xDe = e => {
      const c = e.casa ?? 0;
      const l = c === 0 ? 20 : Math.max(10, (xTraste(c) - xTraste(c - 1)) * 0.8);
      return { x: xCasa(c) - l / 2, l };
    };
    desenharBase = ativos => {
      ctx.fillStyle = escuro ? "#3f2a1d" : "#7c4a2d";
      ctx.fillRect(x0, topoBase + 4, larg, altBase - 22);
      // marcações
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (const f of [3, 5, 7, 9, 12, 15, 17, 19]) {
        if (f > cena.casas) continue;
        const x = xCasa(f), yMeio = topoBase + 4 + (altBase - 22) / 2;
        if (f === 12) { ctx.beginPath(); ctx.arc(x, yMeio - 8, 3, 0, 7); ctx.arc(x, yMeio + 8, 3, 0, 7); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(x, yMeio, 3, 0, 7); ctx.fill(); }
      }
      // trastes
      for (let f = 0; f <= cena.casas; f++) {
        ctx.fillStyle = f === 0 ? "#f1f5f9" : "#cbd5e1";
        ctx.fillRect(xTraste(f) - (f === 0 ? 2 : 1), topoBase + 4, f === 0 ? 4 : 2, altBase - 22);
        if (f > 0 && (f <= 12 || f % 2 === 1)) { ctx.fillStyle = tinta; ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(f), xCasa(f), h - 5); }
      }
      // cordas
      for (let c = 0; c < n; c++) {
        const y = yCorda(c);
        ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1 + (n - c) * 0.35;
        ctx.beginPath(); ctx.moveTo(x0 - 4, y); ctx.lineTo(x0 + larg, y); ctx.stroke();
        ctx.fillStyle = CORES[c % CORES.length]; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(ins.nomesCordas[c], 10, y + 4);
      }
      // notas tocando agora
      for (const e of ativos) {
        const c = e.corda ?? 0, x = xCasa(e.casa ?? 0), y = yCorda(c);
        ctx.save();
        ctx.shadowColor = CORES[c % CORES.length]; ctx.shadowBlur = 14;
        ctx.fillStyle = CORES[c % CORES.length];
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(e.casa ?? 0), x, y + 3.5);
      }
    };
  }

  // ---------- notas caindo ----------
  const ativos: EventoQueda[] = [];
  const pxPorSeg = topoBase / janela;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, topoBase); ctx.clip();
  // linhas de tempo (a cada segundo) para dar noção de velocidade
  ctx.strokeStyle = fraco; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
  for (let s = Math.ceil(t); s < t + janela; s++) { const y = topoBase - (s - t) * pxPorSeg; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.setLineDash([]);
  for (let i = primeiroVisivel(eventos, t, 10); i < eventos.length; i++) {
    const e = eventos[i];
    if (e.inicio > t + janela) break;
    if (e.fim < t) continue;
    if (e.inicio <= t) ativos.push(e);
    const yBase = topoBase - (e.inicio - t) * pxPorSeg;
    const yTopo = topoBase - (e.fim - t) * pxPorSeg;
    const { x, l } = xDe(e);
    const cor = teclado ? (ehPreta(e.midi ?? 0) ? "#60a5fa" : "#3b82f6") : CORES[(e.corda ?? 0) % CORES.length];
    const alt = Math.max(8, yBase - yTopo);
    ctx.fillStyle = cor;
    ctx.globalAlpha = e.inicio <= t ? 1 : 0.88;
    arredondado(ctx, x, yBase - alt, l, alt, Math.min(6, l / 2));
    ctx.fill();
    ctx.globalAlpha = 1;
    if (alt >= 14 && l >= 14) {
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(teclado ? NOTAS_SUSTENIDO[(e.midi ?? 0) % 12] : String(e.casa ?? 0), x + l / 2, yBase - 4);
    }
  }
  ctx.restore();
  // linha de chegada
  ctx.fillStyle = escuro ? "#38bdf8" : "#0ea5e9";
  ctx.fillRect(0, topoBase - 2, w, 2);
  desenharBase(ativos);

  // acorde atual e o próximo
  if (cena.acordeAtual) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#f97316"; ctx.font = "bold 22px sans-serif"; ctx.fillText(cena.acordeAtual, 10, 28);
    const largura = ctx.measureText(cena.acordeAtual).width;
    if (cena.proximoAcorde) { ctx.fillStyle = tinta; ctx.globalAlpha = 0.6; ctx.font = "bold 13px sans-serif"; ctx.fillText(`→ ${cena.proximoAcorde}`, 18 + largura, 27); ctx.globalAlpha = 1; }
  }
}

function arredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
