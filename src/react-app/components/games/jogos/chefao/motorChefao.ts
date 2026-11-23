import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  ALTURA, CORACOES, LARGURA, TEMPO, escudo, novaPartidaChefao, passoChefao, pontosChefao,
  type EstadoChefao, type EventoChefao, type ModoChefao, type Perigo, type TipoChefe,
} from "@/react-app/utils/games/chefao";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, spriteDoAvatar } from "../../central/sprites";

export const CHEFES: Record<TipoChefe, { nome: string; chao: [string, string]; corpo: string; detalhe: string; olho: string }> = {
  golem: { nome: "Golem de Pedra", chao: ["#3f3f46", "#36363c"], corpo: "#78716c", detalhe: "#44403c", olho: "#f97316" },
  hidra: { nome: "Hidra do Pântano", chao: ["#14532d", "#166534"], corpo: "#16a34a", detalhe: "#14532d", olho: "#fde047" },
  maquina: { nome: "Máquina de Guerra", chao: ["#1e293b", "#172033"], corpo: "#64748b", detalhe: "#334155", olho: "#ef4444" },
};
const RAIO_CHEFE = 2.3;

/** Motor do Chefão Colossal (canvas 2D): arena vista de cima, o chefe, os avisos no chão, os pilares e os heróis. */
export function criarMotorChefao(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoChefao, chefe: TipoChefe, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Arena do Chefão Colossal");
  canvas.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const avatares = vagas.map((v, i) => spriteDoAvatar(v.avatar, `chefao-${i}-${JSON.stringify(v.avatar)}`));

  let estado: EstadoChefao | null = null;
  let pendentes: unknown[] = [];
  let tempo = 0, tremor = 0, flash = 0;
  const anteriores: { x: number; y: number }[] = [];
  let chefeAnt = { x: LARGURA / 2, y: 6 };
  const faiscas: { x: number; y: number; vx: number; vy: number; t: number; cor: string }[] = [];
  const faisca = (x: number, y: number, cor: string, n: number, f: number) => {
    for (let k = 0; k < n; k++) faiscas.push({ x, y, vx: (Math.random() - 0.5) * f, vy: (Math.random() - 0.5) * f, t: 0, cor });
  };

  function efeitosDoPasso(e: EstadoChefao) {
    for (const ev of e.eventos as EventoChefao[]) {
      if (ev.tipo === "tiro") { if (Math.random() < 0.3) som.clique(); }
      else if (ev.tipo === "acertou") { if (Math.random() < 0.4) { if (ev.escudo) som.escudo(); else som.bloco(); } faisca(ev.x, ev.y, ev.escudo ? "#7dd3fc" : "#fde68a", 2, 4); }
      else if (ev.tipo === "pilar") { som.explosao(1); faisca(ev.x, ev.y, "#a78bfa", 20, 9); }
      else if (ev.tipo === "fase") { som.alerta(); tremor = 0.8; flash = 0.5; }
      else if (ev.tipo === "aviso") som.alerta();
      else if (ev.tipo === "golpe") { som.morte(); tremor = Math.max(tremor, 0.3); if (!vagas[ev.jogador]?.bot) ganchos.vibrarLocal(ev.jogador, 150); }
      else if (ev.tipo === "caiu") { ganchos.morte(ev.jogador); }
      else if (ev.tipo === "levantou") som.powerup();
      else if (ev.tipo === "esquiva") som.arremesso();
      else if (ev.tipo === "derrotado") { som.explosao(3); tremor = 1.2; flash = 1; faisca(e.chefe.x, e.chefe.y, "#f97316", 60, 14); if (ev.proximo) som.vitoria(); }
    }
  }

  const guardarAnteriores = (e: EstadoChefao) => { e.herois.forEach((h, i) => { anteriores[i] = { x: h.x, y: h.y }; }); chefeAnt = { x: e.chefe.x, y: e.chefe.y }; };

  function perigo(p: Perigo, e: EstadoChefao, u: number) {
    const avisando = e.passo < p.dispara;
    const prog = avisando ? 1 - (p.dispara - e.passo) / 70 : 1;
    ctx.save();
    if (p.tipo === "martelo") {
      ctx.fillStyle = avisando ? "rgba(239,68,68,.18)" : "rgba(251,146,60,.85)";
      ctx.beginPath(); ctx.arc(p.x * u, p.y * u, p.r * u, 0, Math.PI * 2); ctx.fill();
      if (avisando) {
        ctx.strokeStyle = "rgba(239,68,68,.9)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "rgba(239,68,68,.35)";
        ctx.beginPath(); ctx.arc(p.x * u, p.y * u, p.r * u * Math.max(0, Math.min(1, prog)), 0, Math.PI * 2); ctx.fill();
      }
    } else if (p.tipo === "raio" || p.tipo === "investida") {
      ctx.translate(p.x * u, p.y * u); ctx.rotate(p.ang);
      const larg = p.largura * u;
      if (avisando) {
        ctx.fillStyle = p.tipo === "raio" ? "rgba(239,68,68,.15)" : "rgba(249,115,22,.18)";
        ctx.fillRect(0, -larg / 2, p.r * u, larg);
        ctx.fillStyle = "rgba(239,68,68,.6)";
        ctx.fillRect(0, -1, p.r * u * Math.max(0, Math.min(1, prog)), 2);
        if (p.tipo === "investida") { ctx.fillStyle = "rgba(249,115,22,.7)"; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(k * p.r * u / 5, -larg / 3); ctx.lineTo(k * p.r * u / 5 + u, 0); ctx.lineTo(k * p.r * u / 5, larg / 3); ctx.fill(); } }
      } else if (p.tipo === "raio") {
        const g = ctx.createLinearGradient(0, -larg / 2, 0, larg / 2);
        g.addColorStop(0, "rgba(254,240,138,0)"); g.addColorStop(0.5, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(254,240,138,0)");
        ctx.fillStyle = g; ctx.fillRect(0, -larg / 2 * 1.4, p.r * u, larg * 1.4);
      }
    } else {
      // Anel: aviso mostra a brecha (verde); depois a onda cresce.
      const raio = Math.max(0, (e.passo - p.dispara) * 0.16);
      if (avisando) {
        ctx.strokeStyle = "rgba(239,68,68,.55)"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(p.x * u, p.y * u, (RAIO_CHEFE + 1.2) * u, p.ang + p.brecha, p.ang - p.brecha + Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = "rgba(34,197,94,.22)";
      ctx.beginPath(); ctx.moveTo(p.x * u, p.y * u); ctx.arc(p.x * u, p.y * u, 40 * u, p.ang - p.brecha, p.ang + p.brecha); ctx.closePath(); ctx.fill();
      if (!avisando) {
        ctx.strokeStyle = "rgba(244,114,182,.95)"; ctx.lineWidth = p.largura * u * 2;
        ctx.beginPath(); ctx.arc(p.x * u, p.y * u, raio * u, p.ang + p.brecha, p.ang - p.brecha + Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function desenharChefe(e: EstadoChefao, x: number, y: number, u: number) {
    const c = e.chefe, t = CHEFES[c.tipo];
    const r = RAIO_CHEFE * u;
    ctx.save();
    ctx.translate(x * u, y * u);
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(0, r * 0.85, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    const pulso = 1 + Math.sin(tempo * 3) * 0.03;
    ctx.scale(pulso, pulso);
    if (c.tipo === "golem") {
      ctx.fillStyle = t.corpo; ctx.beginPath();
      for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = r * (0.9 + ((k * 37) % 10) / 60); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.fill();
      ctx.strokeStyle = t.detalhe; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.6); ctx.lineTo(-r * 0.1, -r * 0.1); ctx.lineTo(-r * 0.3, r * 0.4); ctx.stroke();
      ctx.fillStyle = t.detalhe; ctx.fillRect(-r * 1.25, -r * 0.2, r * 0.45, r * 0.6); ctx.fillRect(r * 0.8, -r * 0.2, r * 0.45, r * 0.6);
    } else if (c.tipo === "hidra") {
      ctx.fillStyle = t.corpo; ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.8, 0, Math.PI * 2); ctx.fill();
      for (let k = -1; k <= 1; k++) {
        const hx = k * r * 0.65 + Math.sin(tempo * 2 + k) * r * 0.08, hy = -r * 0.55 - (k === 0 ? r * 0.2 : 0);
        ctx.strokeStyle = t.corpo; ctx.lineWidth = r * 0.28; ctx.beginPath(); ctx.moveTo(k * r * 0.3, 0); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = t.detalhe; ctx.beginPath(); ctx.arc(hx, hy, r * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = t.olho; ctx.beginPath(); ctx.arc(hx - r * 0.1, hy - r * 0.05, r * 0.07, 0, Math.PI * 2); ctx.arc(hx + r * 0.1, hy - r * 0.05, r * 0.07, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = t.detalhe;
      ctx.save(); ctx.rotate(tempo * 0.8);
      for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-r * 0.12, -r * 1.05, r * 0.24, r * 0.3); }
      ctx.restore();
      ctx.fillStyle = t.corpo; ctx.beginPath(); ctx.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.25); ctx.fill();
      ctx.fillStyle = t.detalhe; ctx.fillRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.35);
    }
    if (c.tipo !== "hidra") {
      ctx.fillStyle = t.olho;
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.05, r * 0.12, 0, Math.PI * 2); ctx.arc(r * 0.3, -r * 0.05, r * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    if (escudo(e)) {
      ctx.strokeStyle = `rgba(125,211,252,${0.55 + Math.sin(tempo * 5) * 0.2})`; ctx.lineWidth = 4;
      ctx.fillStyle = "rgba(125,211,252,.12)";
      ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  return {
    iniciarRodada() {
      estado = novaPartidaChefao({ modo, chefe, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      pendentes = []; faiscas.length = 0;
      guardarAnteriores(estado);
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      guardarAnteriores(e);
      if (!e.terminado) { passoChefao(e, entradas); efeitosDoPasso(e); if (pendentes.length < 400) pendentes.push(...e.eventos.filter(x => x.tipo !== "tiro" && x.tipo !== "acertou")); }
      return e.terminado ? { vencedor: e.vencedor, pontos: pontosChefao(e) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      tempo += dt;
      const d = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, caixa.clientWidth - 8), h = Math.max(1, caixa.clientHeight - 8);
      if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) {
        canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
        canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      }
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, w, h);
      if (!e) return;
      const a = fase === "jogando" ? alfa : 1;
      const barraH = 26;
      const u = Math.min(w / LARGURA, (h - barraH - 4) / ALTURA);
      const ox = (w - LARGURA * u) / 2, oy = barraH + 4 + (h - barraH - 4 - ALTURA * u) / 2;
      tremor = Math.max(0, tremor - dt * 1.5); flash = Math.max(0, flash - dt * 1.5);
      const t = CHEFES[e.chefe.tipo];
      // Vida do chefe, com as marcas das fases.
      const c = e.chefe;
      ctx.fillStyle = "#1e293b"; ctx.fillRect(ox, 4, LARGURA * u, barraH - 8);
      ctx.fillStyle = escudo(e) ? "#7dd3fc" : c.fase === 3 ? "#ef4444" : c.fase === 2 ? "#f97316" : "#eab308";
      ctx.fillRect(ox, 4, LARGURA * u * Math.max(0, c.vida / c.max), barraH - 8);
      ctx.fillStyle = "#020617"; ctx.fillRect(ox + LARGURA * u / 3, 4, 2, barraH - 8); ctx.fillRect(ox + LARGURA * u * 2 / 3, 4, 2, barraH - 8);
      ctx.fillStyle = "#fff"; ctx.font = `800 ${barraH * 0.5}px system-ui,sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`${t.nome} · fase ${c.fase}${escudo(e) ? " · escudo" : ""}${modo === "rush" ? ` · chefe ${e.derrotados + 1}/3` : ""}`, ox + 8, 4 + (barraH - 8) / 2);
      ctx.save();
      ctx.translate(ox + (Math.random() - 0.5) * tremor * 10, oy + (Math.random() - 0.5) * tremor * 10);
      // Chão em ladrilhos.
      for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) { ctx.fillStyle = t.chao[(x + y) % 2]; ctx.fillRect(x * u, y * u, u + 0.5, u + 0.5); }
      ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 3; ctx.strokeRect(0, 0, LARGURA * u, ALTURA * u);
      for (const p of e.perigos) if (p.tipo !== "raio" || e.passo < p.dispara) perigo(p, e, u);
      // Pilares do escudo, com o feixe até o chefe.
      const cx = chefeAnt.x + (c.x - chefeAnt.x) * a, cy = chefeAnt.y + (c.y - chefeAnt.y) * a;
      for (const p of e.pilares) {
        if (p.vida <= 0) continue;
        ctx.strokeStyle = `rgba(167,139,250,${0.35 + Math.sin(tempo * 6) * 0.15})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x * u, p.y * u); ctx.lineTo(cx * u, cy * u); ctx.stroke();
        ctx.fillStyle = "#7c3aed";
        ctx.beginPath(); ctx.moveTo(p.x * u, (p.y - 1.1) * u); ctx.lineTo((p.x + 0.6) * u, p.y * u); ctx.lineTo(p.x * u, (p.y + 0.7) * u); ctx.lineTo((p.x - 0.6) * u, p.y * u); ctx.fill();
        ctx.fillStyle = "#1e1b4b"; ctx.fillRect((p.x - 0.7) * u, (p.y + 0.9) * u, 1.4 * u, 0.18 * u);
        ctx.fillStyle = "#a78bfa"; ctx.fillRect((p.x - 0.7) * u, (p.y + 0.9) * u, 1.4 * u * p.vida / p.max, 0.18 * u);
      }
      desenharChefe(e, cx, cy, u);
      for (const p of e.perigos) if (p.tipo === "raio" && e.passo >= p.dispara) perigo(p, e, u);
      for (const l of e.lacaios) {
        ctx.fillStyle = "#b91c1c"; ctx.beginPath(); ctx.arc(l.x * u, l.y * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fde047"; ctx.fillRect((l.x - 0.2) * u, (l.y - 0.15) * u, 0.12 * u, 0.12 * u); ctx.fillRect((l.x + 0.08) * u, (l.y - 0.15) * u, 0.12 * u, 0.12 * u);
      }
      for (const b of e.balas) {
        ctx.fillStyle = b.inimiga ? "#c084fc" : "#fde047";
        ctx.beginPath(); ctx.arc((b.x + b.vx * a) * u, (b.y + b.vy * a) * u, (b.inimiga ? 0.3 : 0.14) * u, 0, Math.PI * 2); ctx.fill();
        if (b.inimiga) { ctx.strokeStyle = "#581c87"; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      // Heróis.
      e.herois.forEach((hr, i) => {
        const an = anteriores[i] ?? hr;
        const x = (an.x + (hr.x - an.x) * a) * u, y = (an.y + (hr.y - an.y) * a) * u;
        const lado = u * 1.5;
        ctx.globalAlpha = hr.caido ? 0.45 : e.passo < hr.invulneravelAte && Math.sin(tempo * 30) > 0 ? 0.5 : 1;
        ctx.strokeStyle = CORES_JOGADORES[i % 8]; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, y + lado * 0.45, lado * 0.42, lado * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.imageSmoothingEnabled = false;
        const pulo = fase !== "jogando" && fase !== "contagem" && vencedor === i ? Math.abs(Math.sin(tempo * 7)) * u * 0.6 : 0;
        if (hr.caido) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); ctx.drawImage(avatares[i], -lado / 2, -lado / 2, lado, lado); ctx.restore(); }
        else ctx.drawImage(avatares[i], x - lado / 2, y - lado / 2 - pulo, lado, lado);
        ctx.globalAlpha = 1;
        if (!hr.caido) for (let k = 0; k < CORACOES; k++) { ctx.fillStyle = k < hr.coracoes ? "#ef4444" : "#334155"; ctx.fillRect(x - lado * 0.4 + k * lado * 0.21, y - lado * 0.72, lado * 0.16, lado * 0.14); }
        if (hr.caido && hr.levantar > 0) {
          ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(x, y, lado * 0.6, -Math.PI / 2, -Math.PI / 2 + (hr.levantar / 120) * Math.PI * 2); ctx.stroke();
        }
      });
      for (let k = faiscas.length - 1; k >= 0; k--) {
        const f = faiscas[k];
        f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.t > 0.5) { faiscas.splice(k, 1); continue; }
        ctx.globalAlpha = 1 - f.t / 0.5; ctx.fillStyle = f.cor; ctx.fillRect(f.x * u - 2, f.y * u - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`; ctx.fillRect(0, 0, w, h); }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.max(0, Math.ceil((TEMPO - e.passo) / 60)),
        alerta: e.herois.filter(h => !h.caido).length === 1 && e.herois.length > 1,
        jogadores: e.herois.map(h => ({
          vivo: !h.caido,
          texto: h.caido ? (h.voltaEm ? "caído · volta logo" : "caído · levante!") : `${"♥".repeat(h.coracoes)} · ${h.pontos} pts${e.herois.length === 1 ? ` · ${h.vidas} vidas` : ""}`,
        })),
      };
    },
    redimensionar() { /* o tamanho é recalculado a cada quadro */ },
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoChefao | null;
      if (!e || !Array.isArray(e.herois) || !e.chefe) return;
      if (estado) guardarAnteriores(estado); else guardarAnteriores(e);
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoChefao[];
      efeitosDoPasso(e);
    },
    destruir() { canvas.remove(); },
  };
}
