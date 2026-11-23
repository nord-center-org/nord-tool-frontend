import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  LH, LW, META_SOLO, O2_MAX, PEIXES, SUPERFICIE, TEMPO, novaPartidaPescaria, passoPescaria,
  type EstadoPescaria, type EventoPescaria, type ModoPescaria, type Peixe, type TipoPeixe,
} from "@/react-app/utils/games/pescaria";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const MARES = {
  tropical: { nome: "Mar tropical", ceu: ["#38bdf8", "#bae6fd"], agua: ["#0ea5e9", "#0c4a6e"], areia: "#fcd34d", alga: "#16a34a" },
  entardecer: { nome: "Entardecer", ceu: ["#f97316", "#fde68a"], agua: ["#0e7490", "#164e63"], areia: "#d6a35c", alga: "#15803d" },
  abissal: { nome: "Fossa abissal", ceu: ["#1e1b4b", "#4338ca"], agua: ["#1e3a8a", "#020617"], areia: "#475569", alga: "#0f766e" },
} as const;
export type MarPescaria = keyof typeof MARES;

const COR_PEIXE: Record<TipoPeixe, [string, string]> = {
  sardinha: ["#cbd5e1", "#64748b"], robalo: ["#a3e635", "#3f6212"], baiacu: ["#fde047", "#a16207"],
  atum: ["#60a5fa", "#1e3a8a"], tubarao: ["#94a3b8", "#334155"], aguaviva: ["rgba(244,114,182,.65)", "#f9a8d4"],
};

/** Motor da Pescaria & Submarino (canvas 2D, vista de lado): céu, mar, fundo, barcos com linha, submarinos e peixes. */
export function criarMotorPescaria(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoPescaria, mar: MarPescaria, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Mar da Pescaria & Submarino");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const M = MARES[mar];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoPescaria | null = null;
  let pendentes: unknown[] = [];
  let w = 0, h = 0, t = 20, tempo = 0;
  const bolhas: { x: number; y: number; t: number; r: number }[] = [];
  const textos: { x: number; y: number; texto: string; cor: string; t: number }[] = [];
  let faixa: { texto: string; cor: string; t: number } | null = null;

  function redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, caixa.clientWidth - 8), ch = Math.max(1, caixa.clientHeight - 8);
    t = Math.max(6, Math.min(cw / LW, ch / LH));
    w = t * LW; h = t * LH;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redimensionar();

  function texto(x: number, y: number, s: string, cor: string) { textos.push({ x, y, texto: s, cor, t: 0 }); }

  function efeitosDoPasso(e: EstadoPescaria) {
    for (const ev of e.eventos as EventoPescaria[]) {
      const j = "jogador" in ev ? e.jogadores[ev.jogador] : null;
      const humano = j && !vagas[j.id]?.bot;
      if (ev.tipo === "fisgou") { som.colocar(); if (humano) ganchos.vibrarLocal(ev.jogador, 80); texto(j!.x, SUPERFICIE - 1.6, "Fisgou!", "#fde047"); }
      else if (ev.tipo === "pegou") { som.moeda(); texto(j!.x, SUPERFICIE - 1.6, `${PEIXES[ev.peixe].nome} +${ev.pontos}`, CORES_JOGADORES[ev.jogador % 8]); }
      else if (ev.tipo === "arrebentou") { som.maldicao(); if (humano) ganchos.vibrarLocal(ev.jogador, 160); texto(j!.x, SUPERFICIE - 1.6, "A linha arrebentou!", "#f87171"); }
      else if (ev.tipo === "escapou") { som.clique(); texto(j!.x, SUPERFICIE - 1.6, "Escapou…", "#e2e8f0"); }
      else if (ev.tipo === "arpao") som.arremesso();
      else if (ev.tipo === "acertou") { som.chute(); if (ev.matou) texto(ev.x, ev.y - 0.8, `${PEIXES[ev.peixe].nome}!`, "#fde047"); }
      else if (ev.tipo === "tesouro") { som.powerup(); texto(ev.x, ev.y - 0.8, `+${ev.valor} na carga`, "#fbbf24"); }
      else if (ev.tipo === "entregou") { som.moeda(); texto(j!.x, SUPERFICIE - 1.4, `+${ev.valor}`, CORES_JOGADORES[ev.jogador % 8]); }
      else if (ev.tipo === "ferido") { som.explosao(0.4); if (humano) ganchos.vibrarLocal(ev.jogador, 120); texto(j!.x, j!.y - 1, ev.por === "tubarao" ? "Mordida! −30 O₂" : "Queimou! −18 O₂", "#f87171"); }
      else if (ev.tipo === "afogou") { som.morte(); ganchos.morte(ev.jogador); faixa = { texto: `${vagas[ev.jogador].nome} ficou sem ar!`, cor: CORES_JOGADORES[ev.jogador % 8], t: 0 }; }
      else if (ev.tipo === "impulso") { for (let k = 0; k < 5; k++) bolhas.push({ x: j!.x - j!.olhando * 0.6, y: j!.y + (Math.random() - 0.5) * 0.4, t: 0, r: 0.1 + Math.random() * 0.1 }); }
    }
  }

  function peixe(p: Peixe) {
    const [c1, c2] = COR_PEIXE[p.tipo];
    const r = PEIXES[p.tipo].raio * t;
    const x = p.x * t, y = p.y * t;
    if (p.tipo === "aguaviva") {
      ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = c2; ctx.lineWidth = 1.5;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * r * 0.35, y); ctx.quadraticCurveTo(x + k * r * 0.35 + Math.sin(tempo * 4 + k) * 4, y + r, x + k * r * 0.35, y + r * 1.8); ctx.stroke(); }
      return;
    }
    const d = p.dir;
    const ondula = Math.sin(tempo * 10 + p.id) * r * 0.2;
    ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x - d * r * 0.8, y); ctx.lineTo(x - d * r * 1.6, y - r * 0.6 + ondula); ctx.lineTo(x - d * r * 1.6, y + r * 0.6 + ondula); ctx.closePath(); ctx.fill();
    if (p.tipo === "tubarao") { ctx.beginPath(); ctx.moveTo(x - d * r * 0.2, y - r * 0.4); ctx.lineTo(x - d * r * 0.5, y - r * 1.1); ctx.lineTo(x + d * r * 0.3, y - r * 0.4); ctx.fill(); }
    ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, p.tipo === "baiacu" ? r * 0.9 : r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(x + d * r * 0.6, y - r * 0.12, Math.max(1.5, r * 0.12), 0, Math.PI * 2); ctx.fill();
  }

  return {
    iniciarRodada() {
      estado = novaPartidaPescaria({ modo, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      bolhas.length = 0; textos.length = 0; faixa = null; pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      const fim = () => ({ vencedor: e.vencedor, pontos: e.jogadores.map(j => j.pontos) });
      if (e.terminado) return fim();
      passoPescaria(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? fim() : null;
    },
    desenhar(_alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      const ceu = ctx.createLinearGradient(0, 0, 0, SUPERFICIE * t);
      ceu.addColorStop(0, M.ceu[0]); ceu.addColorStop(1, M.ceu[1]);
      ctx.fillStyle = ceu; ctx.fillRect(0, 0, w, SUPERFICIE * t);
      const agua = ctx.createLinearGradient(0, SUPERFICIE * t, 0, h);
      agua.addColorStop(0, M.agua[0]); agua.addColorStop(1, M.agua[1]);
      ctx.fillStyle = agua; ctx.fillRect(0, SUPERFICIE * t, w, h - SUPERFICIE * t);
      // Raios de luz e ondas.
      ctx.fillStyle = "rgba(255,255,255,.05)";
      for (let k = 0; k < 5; k++) { const x = ((k * 9 + tempo * 0.6) % (LW + 8)) - 4; ctx.beginPath(); ctx.moveTo(x * t, SUPERFICIE * t); ctx.lineTo((x + 2) * t, SUPERFICIE * t); ctx.lineTo((x + 6) * t, h); ctx.lineTo((x + 3) * t, h); ctx.fill(); }
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x <= LW; x += 0.5) { const y = SUPERFICIE + Math.sin(x * 0.9 + tempo * 2) * 0.08; if (x === 0) ctx.moveTo(0, y * t); else ctx.lineTo(x * t, y * t); }
      ctx.stroke();
      // Fundo e algas.
      ctx.fillStyle = M.areia; ctx.beginPath(); ctx.moveTo(0, h);
      e.fundo.forEach((y, x) => { ctx.lineTo(x * t, y * t); ctx.lineTo((x + 1) * t, y * t); });
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = M.alga; ctx.lineWidth = 3;
      for (let x = 1.5; x < LW; x += 3.7) { const y = e.fundo[Math.floor(x)]; ctx.beginPath(); ctx.moveTo(x * t, y * t); ctx.quadraticCurveTo((x + Math.sin(tempo + x) * 0.5) * t, (y - 1) * t, (x + Math.sin(tempo * 1.3 + x) * 0.3) * t, (y - 2) * t); ctx.stroke(); }
      // Tesouros.
      for (const s of e.tesouros) {
        ctx.fillStyle = "#92400e"; ctx.fillRect((s.x - 0.4) * t, (s.y - 0.3) * t, t * 0.8, t * 0.55);
        ctx.fillStyle = "#facc15"; ctx.fillRect((s.x - 0.4) * t, (s.y - 0.1) * t, t * 0.8, t * 0.1); ctx.fillRect((s.x - 0.06) * t, (s.y - 0.2) * t, t * 0.12, t * 0.25);
      }
      for (const p of e.peixes) peixe(p);
      ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 2;
      for (const a of e.arpoes) { ctx.beginPath(); ctx.moveTo((a.x - Math.sign(a.vx) * 0.7) * t, a.y * t); ctx.lineTo(a.x * t, a.y * t); ctx.stroke(); }
      // Jogadores.
      e.jogadores.forEach((j, k) => {
        const cor = CORES_JOGADORES[k % 8];
        const comemora = (fase === "fimRodada" || fase === "fimPartida") && vencedor === k;
        if (e.modo === "pescaria") {
          const bx = j.x * t, by = (SUPERFICIE + Math.sin(tempo * 2 + k) * 0.06) * t;
          desenharCorpo(ctx, folhas[k], j.olhando < 0 ? "esquerda" : "direita", comemora ? "vitoria" : "parado", tempo + k * 0.3, bx, by - t * 0.2, t * 1.4);
          ctx.fillStyle = cor; ctx.beginPath(); ctx.moveTo(bx - t * 1.1, by - t * 0.3); ctx.lineTo(bx + t * 1.1, by - t * 0.3); ctx.lineTo(bx + t * 0.8, by + t * 0.35); ctx.lineTo(bx - t * 0.8, by + t * 0.35); ctx.closePath(); ctx.fill();
          // Vara e linha (fica vermelha quando a tensão passa de 75%).
          const px = bx + j.olhando * t * 0.9, py = by - t * 1.5;
          ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by - t * 0.6); ctx.lineTo(px, py); ctx.stroke();
          const ay = j.anzolY * t;
          ctx.strokeStyle = j.tensao > 0.75 ? "#ef4444" : "rgba(255,255,255,.85)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px, (py + ay) / 2 + (1 - j.tensao) * t, bx + (j.peixe !== null ? 0 : 0), ay); ctx.stroke();
          if (j.peixe === null) { ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, ay + t * 0.15, t * 0.15, 0, Math.PI); ctx.stroke(); ctx.fillStyle = "#f43f5e"; ctx.fillRect(bx - 2, ay - 2, 4, 4); }
          else {
            ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(bx - t, by - t * 2.6, t * 2, 6);
            ctx.fillStyle = j.tensao > 0.75 ? "#ef4444" : j.tensao > 0.45 ? "#facc15" : "#22c55e"; ctx.fillRect(bx - t, by - t * 2.6, t * 2 * Math.min(1, j.tensao), 6);
          }
        } else {
          if (j.voltaEm > e.passo) ctx.globalAlpha = 0.35;
          const sx = j.x * t, sy = j.y * t, d = j.olhando;
          ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(sx, sy, t * 0.8, t * 0.45, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(sx - t * 0.2, sy - t * 0.75, t * 0.4, t * 0.35);
          ctx.fillStyle = "#e0f2fe"; ctx.beginPath(); ctx.arc(sx + d * t * 0.4, sy - t * 0.05, t * 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#334155"; ctx.fillRect(sx - d * t * 0.95, sy - t * 0.2, t * 0.18, t * 0.4);
          if (Math.random() < 0.08 && j.y > SUPERFICIE + 0.5) bolhas.push({ x: j.x - d * 0.8, y: j.y, t: 0, r: 0.08 + Math.random() * 0.08 });
          ctx.globalAlpha = 1;
          // Oxigênio e carga.
          const o = j.oxigenio / O2_MAX;
          ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(sx - t * 0.8, sy - t * 1.15, t * 1.6, 5);
          ctx.fillStyle = o > 0.5 ? "#38bdf8" : o > 0.25 ? "#facc15" : "#ef4444"; ctx.fillRect(sx - t * 0.8, sy - t * 1.15, t * 1.6 * Math.max(0, o), 5);
          if (j.carga > 0) { ctx.fillStyle = "#fde68a"; ctx.font = `800 ${Math.max(9, t * 0.4)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`💰${j.carga}`, sx, sy - t * 1.6); }
          if (comemora) { ctx.font = `${t}px system-ui`; ctx.fillText("🏆", sx, sy - t * 2.2); }
        }
      });
      ctx.fillStyle = "rgba(255,255,255,.5)";
      for (let k = bolhas.length - 1; k >= 0; k--) {
        const b = bolhas[k]; b.t += dt; b.y -= dt * 1.5;
        if (b.t > 1.6 || b.y < SUPERFICIE) { bolhas.splice(k, 1); continue; }
        ctx.beginPath(); ctx.arc(b.x * t, b.y * t, b.r * t, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = "800 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let k = textos.length - 1; k >= 0; k--) {
        const x = textos[k]; x.t += dt;
        if (x.t > 1.3) { textos.splice(k, 1); continue; }
        ctx.globalAlpha = 1 - x.t / 1.3; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.strokeText(x.texto, x.x * t, (x.y - x.t) * t); ctx.fillStyle = x.cor; ctx.fillText(x.texto, x.x * t, (x.y - x.t) * t);
      }
      ctx.globalAlpha = 1;
      if (e.jogadores.length === 1) {
        ctx.fillStyle = "rgba(15,23,42,.75)"; ctx.fillRect(w / 2 - 100, 6, 200, 26);
        ctx.fillStyle = "#e2e8f0"; ctx.fillText(`Meta: ${e.jogadores[0].pontos}/${META_SOLO[e.modo]} pontos`, w / 2, 19);
      }
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 2) faixa = null;
        else { ctx.globalAlpha = Math.min(1, (2 - faixa.t) * 2); ctx.font = `900 ${Math.max(16, t * 1.1)}px system-ui`; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(faixa.texto, w / 2, h * 0.4); ctx.fillStyle = faixa.cor; ctx.fillText(faixa.texto, w / 2, h * 0.4); ctx.globalAlpha = 1; }
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.max(0, Math.ceil((TEMPO - e.passo) / 60)),
        alerta: e.modo === "mergulho" && e.jogadores.some((j, k) => !vagas[k]?.bot && j.oxigenio < 25),
        jogadores: e.jogadores.map(j => ({
          vivo: j.voltaEm <= e.passo,
          texto: e.modo === "pescaria" ? `🐟 ${j.capturas} · ${j.pontos} pts` : `O₂ ${Math.max(0, Math.round(j.oxigenio))} · 💰${j.carga} · ${j.pontos} pts`,
        })),
      };
    },
    redimensionar,
    destruir() { canvas.remove(); },
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoPescaria | null;
      if (!e || !Array.isArray(e.jogadores)) return;
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoPescaria[];
      efeitosDoPasso(e);
    },
  };
}
