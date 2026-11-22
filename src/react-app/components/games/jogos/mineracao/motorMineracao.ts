import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  CARRINHOS, CHAO, LH, LW, META_SOLO, TEMPO, VALOR, alvoDaPicareta, bloco, novaPartidaMineracao, passoMineracao,
  type Bloco, type EstadoMineracao, type EventoMineracao, type ModoMineracao,
} from "@/react-app/utils/games/mineracao";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const MINAS = {
  classica: { nome: "Mina clássica", ceu: ["#7dd3fc", "#e0f2fe"], terra: "#92400e", cascalho: "#a8a29e", pedra: "#57534e", dura: "#1c1917", fundo: "#292524" },
  cristal: { nome: "Caverna de cristal", ceu: ["#c4b5fd", "#ede9fe"], terra: "#5b21b6", cascalho: "#a78bfa", pedra: "#3730a3", dura: "#1e1b4b", fundo: "#0f0a2e" },
  deserto: { nome: "Deserto", ceu: ["#fdba74", "#fef3c7"], terra: "#c2410c", cascalho: "#fcd34d", pedra: "#7c2d12", dura: "#431407", fundo: "#2a1206" },
} as const;
export type MinaMineracao = keyof typeof MINAS;

const COR_MINERIO: Partial<Record<Bloco, string>> = { 5: "#e2e8f0", 6: "#facc15", 7: "#67e8f9" };

/** Motor da Corrida do Ouro (canvas 2D, vista de lado): subsolo em blocos, mineiros, dinamite, carrinhos e lava. */
export function criarMotorMineracao(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoMineracao, mina: MinaMineracao, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Mina da Corrida do Ouro");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const M = MINAS[mina];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoMineracao | null = null;
  let pendentes: unknown[] = [];
  let w = 0, h = 0, t = 20, tempo = 0, tremor = 0;
  const parts: { x: number; y: number; vx: number; vy: number; t: number; vida: number; cor: string }[] = [];
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

  const poeira = (x: number, y: number, cor: string, n: number) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, t: 0, vida: 0.5, cor }); }
  };
  const corBloco = (b: number) => b === 1 ? M.terra : b === 2 ? M.cascalho : b === 3 ? M.pedra : b === 4 ? M.dura : M.pedra;

  function efeitosDoPasso(e: EstadoMineracao) {
    let golpes = 0;
    for (const ev of e.eventos as EventoMineracao[]) {
      if (ev.tipo === "golpe") { if (golpes++ < 2) som.bloco(); poeira(ev.x + 0.5, ev.y + 0.5, corBloco(ev.bloco), ev.quebrou ? 8 : 3); }
      else if (ev.tipo === "minerio") { som.moeda(); const j = e.jogadores[ev.jogador]; textos.push({ x: j.x, y: j.y - 1, texto: `+${VALOR[ev.bloco]}`, cor: COR_MINERIO[ev.bloco] ?? "#fff", t: 0 }); }
      else if (ev.tipo === "cheio") { const j = e.jogadores[ev.jogador]; if (Math.random() < 0.2) textos.push({ x: j.x, y: j.y - 1, texto: "carga cheia!", cor: "#f87171", t: 0 }); }
      else if (ev.tipo === "entrega") { som.powerup(); const j = e.jogadores[ev.jogador]; textos.push({ x: j.x, y: j.y - 1.2, texto: `+${ev.valor} pts`, cor: CORES_JOGADORES[ev.jogador % 8], t: 0 }); }
      else if (ev.tipo === "dinamite") som.colocar();
      else if (ev.tipo === "explosao") { som.explosao(2); tremor = 0.5; poeira(ev.x, ev.y, "#f97316", 30); poeira(ev.x, ev.y, "#78716c", 20); }
      else if (ev.tipo === "tonto") { som.maldicao(); if (!vagas[ev.jogador]?.bot) ganchos.vibrarLocal(ev.jogador, 150); }
      else if (ev.tipo === "cascalho") { if (Math.random() < 0.3) som.bloco(); }
      else if (ev.tipo === "lava") { som.alerta(); faixa = { texto: "A lava subiu!", cor: "#f97316", t: 0 }; }
      else if (ev.tipo === "queimou") { som.morte(); ganchos.morte(ev.jogador); faixa = { texto: `${vagas[ev.jogador].nome} encostou na lava!`, cor: CORES_JOGADORES[ev.jogador % 8], t: 0 }; }
    }
  }

  return {
    iniciarRodada() {
      estado = novaPartidaMineracao({ modo, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      parts.length = 0; textos.length = 0; faixa = null; pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      const fim = () => ({ vencedor: e.vencedor, pontos: e.jogadores.map(j => j.pontos) });
      if (e.terminado) return fim();
      passoMineracao(e, entradas);
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
      if (tremor > 0) ctx.translate((Math.random() - 0.5) * tremor * 12, (Math.random() - 0.5) * tremor * 12);
      const ceu = ctx.createLinearGradient(0, 0, 0, CHAO * t);
      ceu.addColorStop(0, M.ceu[0]); ceu.addColorStop(1, M.ceu[1]);
      ctx.fillStyle = ceu; ctx.fillRect(-20, -20, w + 40, CHAO * t + 20);
      ctx.fillStyle = M.fundo; ctx.fillRect(-20, CHAO * t, w + 40, h - CHAO * t + 20);
      // Blocos (com rachaduras pelo dano e brilho nos minérios).
      for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
        const b = bloco(e, x, y);
        if (!b) continue;
        const X = x * t, Y = y * t;
        ctx.fillStyle = corBloco(b); ctx.fillRect(X, Y, t + 0.5, t + 0.5);
        ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(X, Y + t * 0.8, t, t * 0.2);
        if (y === CHAO && b === 1) { ctx.fillStyle = mina === "deserto" ? "#fbbf24" : "#65a30d"; ctx.fillRect(X, Y, t + 0.5, t * 0.22); }
        const cor = COR_MINERIO[b as Bloco];
        if (cor) {
          ctx.fillStyle = cor;
          for (const [px, py] of [[0.3, 0.3], [0.65, 0.5], [0.4, 0.7]]) { ctx.beginPath(); ctx.arc(X + px * t, Y + py * t, t * (b === 7 ? 0.13 : 0.11), 0, Math.PI * 2); ctx.fill(); }
          if (Math.sin(tempo * 3 + x * 7 + y) > 0.9) { ctx.fillStyle = "#fff"; ctx.fillRect(X + t * 0.6, Y + t * 0.25, 2, 2); }
        }
        const dano = e.danos[y * LW + x];
        if (dano > 0) { ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X + t * 0.2, Y + t * 0.2); ctx.lineTo(X + t * 0.5, Y + t * 0.55); ctx.lineTo(X + t * 0.8, Y + t * 0.35); if (dano > 1) { ctx.moveTo(X + t * 0.5, Y + t * 0.55); ctx.lineTo(X + t * 0.45, Y + t * 0.9); } ctx.stroke(); }
      }
      // Carrinhos.
      for (const c of CARRINHOS) {
        const X = c * t, Y = CHAO * t;
        ctx.fillStyle = "#475569"; ctx.fillRect(X - t * 0.9, Y - t * 0.85, t * 1.8, t * 0.6);
        ctx.fillStyle = "#facc15"; ctx.fillRect(X - t * 0.7, Y - t * 1.0, t * 1.4, t * 0.2);
        ctx.fillStyle = "#0f172a"; for (const d of [-0.5, 0.5]) { ctx.beginPath(); ctx.arc(X + d * t, Y - t * 0.2, t * 0.18, 0, Math.PI * 2); ctx.fill(); }
      }
      // Lava.
      if (e.lavaY < LH) {
        const Y = e.lavaY * t;
        const g = ctx.createLinearGradient(0, Y - t, 0, h);
        g.addColorStop(0, "rgba(249,115,22,0)"); g.addColorStop(0.15, "#f97316"); g.addColorStop(1, "#7f1d1d");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= LW; x += 0.5) ctx.lineTo(x * t, Y + Math.sin(x * 1.3 + tempo * 3) * t * 0.12);
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      }
      // Dinamites.
      for (const d of e.dinamites) {
        ctx.fillStyle = "#dc2626"; ctx.fillRect(d.x * t - t * 0.12, d.y * t - t * 0.3, t * 0.24, t * 0.5);
        if (Math.sin(tempo * 30) > 0) { ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(d.x * t, d.y * t - t * 0.4, t * 0.1, 0, Math.PI * 2); ctx.fill(); }
      }
      // Mineiros, com a lanterna do capacete e o bloco que a picareta alcança.
      e.jogadores.forEach((j, k) => {
        if (e.passo < j.foraAte) return;
        if (!vagas[k]?.bot) {
          const a = alvoDaPicareta(j);
          if (bloco(e, a.x, a.y) > 0) { ctx.strokeStyle = CORES_JOGADORES[k % 8]; ctx.lineWidth = 2; ctx.strokeRect(a.x * t + 1, a.y * t + 1, t - 2, t - 2); }
        }
        if (j.y > CHAO) {
          const luz = ctx.createRadialGradient(j.x * t, j.y * t, 0, j.x * t, j.y * t, t * 2.4);
          luz.addColorStop(0, "rgba(254,240,138,.25)"); luz.addColorStop(1, "rgba(254,240,138,0)");
          ctx.fillStyle = luz; ctx.fillRect(j.x * t - t * 2.4, j.y * t - t * 2.4, t * 4.8, t * 4.8);
        }
        const comemora = (fase === "fimRodada" || fase === "fimPartida") && vencedor === k;
        ctx.globalAlpha = j.atordoado > 0 && Math.sin(tempo * 20) > 0 ? 0.5 : 1;
        desenharCorpo(ctx, folhas[k], j.lado < 0 ? "esquerda" : "direita", comemora ? "vitoria" : j.vx ? "andando" : "parado", tempo + k * 0.3, j.x * t, (j.y + 0.45) * t, t * 1.1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = CORES_JOGADORES[k % 8]; ctx.fillRect(j.x * t - t * 0.3, (j.y - 0.62) * t, t * 0.6, t * 0.14);
        if (j.carga.length) { ctx.font = `800 ${Math.max(9, t * 0.42)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fde68a"; ctx.fillText(`⛏${j.carga.length}`, j.x * t, (j.y - 1) * t); }
      });
      for (let k = parts.length - 1; k >= 0; k--) {
        const p = parts[k]; p.t += dt;
        if (p.t > p.vida) { parts.splice(k, 1); continue; }
        p.vy += 10 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.t / p.vida; ctx.fillStyle = p.cor; ctx.fillRect(p.x * t - 2, p.y * t - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.font = "800 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let k = textos.length - 1; k >= 0; k--) {
        const x = textos[k]; x.t += dt;
        if (x.t > 1.2) { textos.splice(k, 1); continue; }
        ctx.globalAlpha = 1 - x.t / 1.2; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.strokeText(x.texto, x.x * t, (x.y - x.t) * t); ctx.fillStyle = x.cor; ctx.fillText(x.texto, x.x * t, (x.y - x.t) * t);
      }
      ctx.globalAlpha = 1;
      if (e.jogadores.length === 1) {
        ctx.fillStyle = "rgba(15,23,42,.75)"; ctx.fillRect(w / 2 - 100, 6, 200, 26);
        ctx.fillStyle = "#e2e8f0"; ctx.fillText(`Meta: ${e.jogadores[0].pontos}/${META_SOLO[e.modo]} pontos`, w / 2, 19);
      }
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 2) faixa = null;
        else { ctx.globalAlpha = Math.min(1, (2 - faixa.t) * 2); ctx.font = `900 ${Math.max(16, t * 1.1)}px system-ui`; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(faixa.texto, w / 2, h * 0.35); ctx.fillStyle = faixa.cor; ctx.fillText(faixa.texto, w / 2, h * 0.35); ctx.globalAlpha = 1; }
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.max(0, Math.ceil((TEMPO - e.passo) / 60)),
        alerta: e.modo === "sobrevivencia" && e.jogadores.some((j, k) => !vagas[k]?.bot && e.lavaY - j.y < 3),
        jogadores: e.jogadores.map(j => ({ vivo: e.passo >= j.foraAte, texto: `⛏${j.carga.length} · 🧨${j.dinamites} · ${j.pontos} pts` })),
      };
    },
    redimensionar,
    destruir() { canvas.remove(); },
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoMineracao | null;
      if (!e || !Array.isArray(e.jogadores)) return;
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoMineracao[];
      efeitosDoPasso(e);
    },
  };
}
