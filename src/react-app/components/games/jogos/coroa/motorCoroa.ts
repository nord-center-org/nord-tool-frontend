import type { Entrada } from "@/react-app/utils/games/bombas";
import { ALT, ARENAS, LARG, META_MOEDAS, novaPartidaCoroa, passoCoroa, pontosCoroa, type Arena, type EstadoCoroa, type EventoCoroa, type ModoCoroa } from "@/react-app/utils/games/coroa";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const VISUAL_ARENA: Record<Arena, { nome: string; ceu: [string, string]; plataforma: string; borda: string }> = {
  castelo: { nome: "Castelo", ceu: ["#312e81", "#0f172a"], plataforma: "#78716c", borda: "#a8a29e" },
  floresta: { nome: "Floresta", ceu: ["#14532d", "#052e16"], plataforma: "#78350f", borda: "#65a30d" },
  nuvens: { nome: "Nuvens", ceu: ["#38bdf8", "#1e3a8a"], plataforma: "#e0f2fe", borda: "#ffffff" },
};

/** Motor da Coroa Maldita (canvas 2D, vista de lado): plataformas, a coroa (ou a bomba) e os corpos animados. */
export function criarMotorCoroa(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoCoroa, arena: Arena, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Arena da Coroa Maldita");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const V = VISUAL_ARENA[arena];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoCoroa | null = null;
  let anteriores: { x: number; y: number }[] = [];
  let pendentes: unknown[] = [];
  let w = 0, h = 0, t = 30, tempo = 0;
  const brilhos: { x: number; y: number; vx: number; vy: number; t: number; cor: string }[] = [];
  let faixa: { texto: string; cor: string; t: number } | null = null;

  function redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, caixa.clientWidth - 8), ch = Math.max(1, caixa.clientHeight - 8);
    t = Math.max(8, Math.min(cw / LARG, ch / ALT));
    w = t * LARG; h = t * ALT;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redimensionar();

  function faiscas(x: number, y: number, cor: string, n = 12) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; brilhos.push({ x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 2, t: 0, cor }); }
  }

  function efeitosDoPasso(e: EstadoCoroa) {
    for (const ev of e.eventos as EventoCoroa[]) {
      if (ev.tipo === "pulo") som.clique();
      else if (ev.tipo === "investida") som.arremesso();
      else if (ev.tipo === "pisao") { som.chute(); ganchos.vibrarLocal(ev.em, 60); }
      else if (ev.tipo === "roubou") {
        const j = e.jogadores[ev.jogador];
        faiscas(j.x, j.y - 1.2, e.modo === "coroa" ? "#facc15" : "#f87171");
        if (e.modo === "coroa") som.powerup(); else som.alerta();
        ganchos.vibrarLocal(ev.jogador, 40);
        if (ev.de !== null) ganchos.vibrarLocal(ev.de, [40, 30, 40]);
      } else if (ev.tipo === "explodiu") {
        const j = e.jogadores[ev.jogador];
        faiscas(j.x, j.y - 0.6, "#f97316", 40); som.explosao(2); ganchos.morte(ev.jogador);
        faixa = { texto: `BUM! ${vagas[ev.jogador].nome} está fora`, cor: "#f97316", t: 0 };
      } else if (ev.tipo === "moeda") { som.moeda(); faiscas(e.jogadores[0].x, e.jogadores[0].y - 0.6, "#fde047", 8); }
    }
  }

  function coroaDesenho(x: number, y: number, s: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = "#facc15"; ctx.shadowBlur = 12;
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.5); ctx.lineTo(-s, -s * 0.3); ctx.lineTo(-s * 0.5, s * 0.1); ctx.lineTo(0, -s * 0.6); ctx.lineTo(s * 0.5, s * 0.1); ctx.lineTo(s, -s * 0.3); ctx.lineTo(s, s * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(0, s * 0.15, s * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function bombaDesenho(x: number, y: number, s: number, falta: number) {
    ctx.fillStyle = "#18181b"; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#a16207"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + s * 0.5, y - s * 0.8); ctx.quadraticCurveTo(x + s, y - s * 1.5, x + s * 1.2, y - s * 1.3); ctx.stroke();
    ctx.fillStyle = Math.floor(tempo * (falta < 5 ? 10 : 4)) % 2 ? "#f97316" : "#fde047";
    ctx.beginPath(); ctx.arc(x + s * 1.2, y - s * 1.3, s * 0.3, 0, Math.PI * 2); ctx.fill();
  }

  return {
    iniciarRodada() {
      estado = novaPartidaCoroa({ modo, arena, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      anteriores = estado.jogadores.map(j => ({ x: j.x, y: j.y }));
      brilhos.length = 0; faixa = null; pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      if (e.terminado) return { vencedor: e.vencedor, pontos: e.jogadores.map(j => pontosCoroa(e, j)) };
      anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      passoCoroa(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? { vencedor: e.vencedor, pontos: e.jogadores.map(j => pontosCoroa(e, j)) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, V.ceu[0]); g.addColorStop(1, V.ceu[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // Silhuetas de fundo (torres, árvores ou nuvens), em paralaxe lenta.
      ctx.fillStyle = "rgba(255,255,255,.06)";
      for (let k = 0; k < 8; k++) {
        const x = ((k * 3.7 + tempo * 0.2) % (LARG + 4)) - 2;
        if (arena === "nuvens") { ctx.beginPath(); ctx.ellipse(x * t, (2 + (k % 3) * 2) * t, t * 2, t * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(x * t, h - (4 + (k % 3) * 2) * t, t * (arena === "castelo" ? 1.6 : 0.8), (4 + (k % 3) * 2) * t);
      }
      for (const p of ARENAS[arena]) {
        ctx.fillStyle = V.plataforma; ctx.fillRect(p.x * t, p.y * t, p.w * t, t * 0.45);
        ctx.fillStyle = V.borda; ctx.fillRect(p.x * t, p.y * t, p.w * t, t * 0.1);
      }
      for (const m of e.moedas) {
        const s = Math.abs(Math.cos(tempo * 3)) * t * 0.25 + 2;
        ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.ellipse(m.x * t, m.y * t, s, t * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (e.dono === null && e.modo === "coroa") coroaDesenho(e.coroa.x * t, (e.coroa.y + Math.sin(tempo * 3) * 0.15) * t, t * 0.4);
      const ativo = fase === "jogando";
      e.jogadores.forEach((j, i) => {
        if (j.fora) return;
        const a = anteriores[i] ?? j;
        const px = (ativo ? a.x + (j.x - a.x) * alfa : j.x) * t, py = (ativo ? a.y + (j.y - a.y) * alfa : j.y) * t;
        const atordoado = e.passo < j.atordoadoAte;
        const comemora = (fase === "fimRodada" || fase === "fimPartida") && vencedor === i;
        if (e.dono === i) {
          const aura = ctx.createRadialGradient(px, py - t * 0.7, 0, px, py - t * 0.7, t * 1.4);
          aura.addColorStop(0, e.modo === "coroa" ? "rgba(250,204,21,.45)" : "rgba(248,113,113,.4)"); aura.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = aura; ctx.fillRect(px - t * 1.5, py - t * 2.2, t * 3, t * 3);
        }
        ctx.globalAlpha = e.dono === i && e.passo < e.protegidoAte && Math.floor(e.passo / 5) % 2 ? 0.6 : 1;
        desenharCorpo(ctx, folhas[i], comemora ? "baixo" : j.olhar > 0 ? "direita" : "esquerda", comemora ? "vitoria" : Math.abs(j.vx) > 0.02 && j.noChao ? "andando" : "parado", tempo + i * 0.3, px, py, t * 1.5);
        ctx.globalAlpha = 1;
        if (atordoado) { ctx.fillStyle = "#fde047"; ctx.font = `${t * 0.4}px system-ui`; ctx.textAlign = "center"; ctx.fillText("✦ ✦", px, py - t * 1.7 + Math.sin(tempo * 10) * 2); }
        if (e.dono === i) {
          if (e.modo === "coroa") coroaDesenho(px, py - t * 1.75, t * 0.3);
          else bombaDesenho(px, py - t * 1.9, t * 0.28, (e.bombaAte - e.passo) / 60);
        }
        ctx.fillStyle = CORES_JOGADORES[i % 8];
        ctx.font = `800 ${Math.max(9, t * 0.32)}px system-ui`; ctx.textAlign = "center";
        ctx.fillText(`P${i + 1}`, px, py - t * (e.dono === i ? 2.4 : 1.7));
      });
      for (let k = brilhos.length - 1; k >= 0; k--) {
        const b = brilhos[k]; b.t += dt;
        if (b.t > 0.7) { brilhos.splice(k, 1); continue; }
        b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 6 * dt;
        ctx.globalAlpha = 1 - b.t / 0.7; ctx.fillStyle = b.cor; ctx.fillRect(b.x * t - 2, b.y * t - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      // Topo: tempo e, no Pega-Pega, a contagem da bomba.
      ctx.font = `900 ${Math.max(12, t * 0.55)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
      const resto = Math.max(0, Math.ceil(((e.modo === "pegapega" ? e.bombaAte : e.duracao) - e.passo) / 60));
      ctx.fillText(e.modo === "pegapega" ? `💣 explode em ${resto} s` : e.modo === "moedas" ? `🪙 ${e.jogadores[0].moedas}/${META_MOEDAS} · ${resto} s` : `👑 ${resto} s`, w / 2, t * 0.75);
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 2) faixa = null;
        else { ctx.globalAlpha = Math.min(1, (2 - faixa.t) * 2); ctx.font = `900 ${Math.max(16, t * 0.8)}px system-ui`; ctx.fillStyle = faixa.cor; ctx.fillText(faixa.texto, w / 2, h * 0.3); ctx.globalAlpha = 1; }
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.max(0, Math.ceil((e.duracao - e.passo) / 60)),
        alerta: e.modo === "pegapega" && e.bombaAte - e.passo < 300,
        jogadores: e.jogadores.map((j, i) => ({
          vivo: !j.fora,
          texto: e.modo === "moedas" ? `🪙 ${j.moedas}` : j.fora ? "fora" : e.modo === "pegapega" ? (e.dono === i ? "💣 com a bomba" : `${Math.floor(j.tempoCoroa / 60)} s vivo`) : `👑 ${(j.tempoCoroa / 60).toFixed(1)} s${e.dono === i ? " ★" : ""}`,
        })),
      };
    },
    redimensionar,
    destruir() { canvas.remove(); },
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoCoroa | null;
      if (!e || !Array.isArray(e.jogadores)) return;
      anteriores = (estado ?? e).jogadores.map(j => ({ x: j.x, y: j.y }));
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoCoroa[];
      efeitosDoPasso(e);
    },
  };
}
