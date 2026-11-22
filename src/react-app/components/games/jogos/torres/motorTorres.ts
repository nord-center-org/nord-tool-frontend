import type { Entrada } from "@/react-app/utils/games/bombas";
import { LH, LW, TEMPO_DA_VEZ, TIROS_SOLO, bloco, novaPartidaTorres, passoTorres, type EstadoTorres, type EventoTorres, type ModoTorres, type Paisagem } from "@/react-app/utils/games/torres";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const PAISAGENS: Record<Paisagem, { nome: string; ceu: [string, string]; chao: string; topo: string }> = {
  campo: { nome: "Campo", ceu: ["#7dd3fc", "#e0f2fe"], chao: "#4d7c0f", topo: "#65a30d" },
  deserto: { nome: "Deserto", ceu: ["#fdba74", "#fef3c7"], chao: "#b45309", topo: "#d97706" },
  neve: { nome: "Neve", ceu: ["#94a3b8", "#e2e8f0"], chao: "#cbd5e1", topo: "#f8fafc" },
};
const COR_MATERIAL = ["", "#a16207", "#78716c", "#475569"];

/** Motor das Torres em Colapso (canvas 2D, vista de lado): terreno, torres de blocos, reis, mira, vento e explosões. */
export function criarMotorTorres(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoTorres, paisagem: Paisagem, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Campo das Torres em Colapso");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const P = PAISAGENS[paisagem];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoTorres | null = null;
  let pendentes: unknown[] = [];
  let w = 0, h = 0, t = 20, tempo = 0, tremor = 0;
  const parts: { x: number; y: number; vx: number; vy: number; t: number; vida: number; cor: string }[] = [];
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

  function efeitosDoPasso(e: EstadoTorres) {
    for (const ev of e.eventos as EventoTorres[]) {
      if (ev.tipo === "disparo") som.arremesso();
      else if (ev.tipo === "explosao") {
        som.explosao(ev.raio > 2 ? 2 : 1); tremor = ev.raio > 2 ? 0.5 : 0.3;
        for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, v = Math.random() * 8; parts.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, t: 0, vida: 0.6, cor: ["#f97316", "#fde047", "#78716c"][i % 3] }); }
      } else if (ev.tipo === "caiu") { if (Math.random() < 0.4) som.bloco(); }
      else if (ev.tipo === "reiFora") { som.morte(); ganchos.morte(ev.jogador); faixa = { texto: `O rei de ${vagas[ev.jogador].nome} caiu!`, cor: CORES_JOGADORES[ev.jogador % 8], t: 0 }; }
      else if (ev.tipo === "alvo") som.moeda();
      else if (ev.tipo === "vez" && !vagas[ev.jogador]?.bot) { som.clique(); ganchos.vibrarLocal(ev.jogador, 40); }
    }
  }

  return {
    iniciarRodada() {
      estado = novaPartidaTorres({ modo, paisagem, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      parts.length = 0; faixa = null; pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      const fim = () => ({ vencedor: e.vencedor, pontos: e.reis.map(r => r.pontos) });
      if (e.terminado) return fim();
      passoTorres(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? fim() : null;
    },
    desenhar(_alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      tremor = Math.max(0, tremor - dt);
      ctx.save();
      if (tremor > 0) ctx.translate((Math.random() - 0.5) * tremor * 14, (Math.random() - 0.5) * tremor * 14);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, P.ceu[0]); g.addColorStop(1, P.ceu[1]);
      ctx.fillStyle = g; ctx.fillRect(-20, -20, w + 40, h + 40);
      // Terreno.
      ctx.fillStyle = P.chao;
      ctx.beginPath(); ctx.moveTo(0, h);
      e.chao.forEach((y, x) => { ctx.lineTo(x * t, y * t); ctx.lineTo((x + 1) * t, y * t); });
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.topo;
      e.chao.forEach((y, x) => ctx.fillRect(x * t, y * t, t, t * 0.25));
      // Blocos.
      for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
        const m = bloco(e, x, y);
        if (!m) continue;
        ctx.fillStyle = COR_MATERIAL[m]; ctx.fillRect(x * t + 0.5, y * t + 0.5, t - 1, t - 1);
        ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.strokeRect(x * t + 0.5, y * t + 0.5, t - 1, t - 1);
      }
      // Alvos (sozinho).
      for (const a of e.alvos) {
        for (const [r, c] of [[0.6, "#dc2626"], [0.4, "#fff"], [0.2, "#dc2626"]] as [number, string][]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(a.x * t, a.y * t, r * t, 0, Math.PI * 2); ctx.fill(); }
      }
      // Reis, mira de quem está na vez.
      e.reis.forEach((r, i) => {
        if (!r.vivo) return;
        const comemora = (fase === "fimRodada" || fase === "fimPartida") && vencedor === i;
        desenharCorpo(ctx, folhas[i], r.x * t > w / 2 ? "esquerda" : "direita", comemora ? "vitoria" : "parado", tempo + i * 0.3, r.x * t, r.y * t, t * 1.6);
        ctx.fillStyle = "#facc15"; ctx.fillRect(r.x * t - t * 0.25, r.y * t - t * 1.75, t * 0.5, t * 0.18);
        if (e.vez === i && !e.projetil && !e.terminado) {
          const a = (r.angulo * Math.PI) / 180;
          ctx.strokeStyle = CORES_JOGADORES[i % 8]; ctx.lineWidth = 3; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(r.x * t, (r.y - 1.2) * t); ctx.lineTo((r.x + Math.cos(a) * (1 + r.forca * 3)) * t, (r.y - 1.2 + Math.sin(a) * (1 + r.forca * 3)) * t); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(r.x * t - t, (r.y + 0.3) * t, t * 2, 5);
          ctx.fillStyle = "#f97316"; ctx.fillRect(r.x * t - t, (r.y + 0.3) * t, t * 2 * r.forca, 5);
          ctx.fillStyle = "#0f172a"; ctx.font = `800 ${Math.max(10, t * 0.5)}px system-ui`; ctx.textAlign = "center";
          ctx.fillText(`${Math.round(-r.angulo)}° · ${Math.round(r.forca * 100)}%${r.arma === "bomba" ? " · 💣" : ""}`, r.x * t, (r.y - 2.4) * t);
        }
      });
      if (e.projetil) {
        ctx.fillStyle = e.projetil.arma === "bomba" ? "#18181b" : "#334155";
        ctx.beginPath(); ctx.arc(e.projetil.x * t, e.projetil.y * t, t * (e.projetil.arma === "bomba" ? 0.4 : 0.25), 0, Math.PI * 2); ctx.fill();
      }
      for (let k = parts.length - 1; k >= 0; k--) {
        const p = parts[k]; p.t += dt;
        if (p.t > p.vida) { parts.splice(k, 1); continue; }
        p.vy += 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.t / p.vida; ctx.fillStyle = p.cor; ctx.fillRect(p.x * t - 2, p.y * t - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // Vento e vez.
      ctx.fillStyle = "rgba(15,23,42,.75)"; ctx.fillRect(w / 2 - 110, 6, 220, 30);
      ctx.fillStyle = "#e2e8f0"; ctx.font = "800 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const seta = e.vento > 0 ? "→".repeat(Math.ceil(Math.abs(e.vento) * 3)) : e.vento < 0 ? "←".repeat(Math.ceil(Math.abs(e.vento) * 3)) : "–";
      ctx.fillText(e.modo === "alvos" ? `Vento ${seta} · tiros ${e.tiros}/${TIROS_SOLO}` : `Vento ${seta} · vez de ${vagas[e.vez]?.nome ?? ""}`, w / 2, 21);
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 2) faixa = null;
        else { ctx.globalAlpha = Math.min(1, (2 - faixa.t) * 2); ctx.font = `900 ${Math.max(16, t * 1.1)}px system-ui`; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(faixa.texto, w / 2, h * 0.3); ctx.fillStyle = faixa.cor; ctx.fillText(faixa.texto, w / 2, h * 0.3); ctx.globalAlpha = 1; }
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.max(0, Math.ceil((TEMPO_DA_VEZ - (e.passo - e.inicioVez)) / 60)),
        jogadores: e.reis.map(r => ({ vivo: r.vivo, texto: e.modo === "alvos" ? `🎯 ${r.acertos}/5` : r.vivo ? `👑 ${r.acertos} derrubados${e.vez === r.id ? " · na vez" : ""}` : "caiu" })),
      };
    },
    redimensionar,
    destruir() { canvas.remove(); },
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoTorres | null;
      if (!e || !Array.isArray(e.reis)) return;
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoTorres[];
      efeitosDoPasso(e);
    },
  };
}
