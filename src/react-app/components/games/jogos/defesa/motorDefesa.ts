import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  ALTURA, BASE, ESTRADA, LARGURA, PONTOS_OBRA, TORRES, VIDA_BASE, atributos, novaPartidaDefesa, passoDefesa, precoMelhoria,
  type EstadoDefesa, type EventoDefesa, type ModoDefesa, type TipoInimigo, type TipoTorre,
} from "@/react-app/utils/games/defesa";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const MAPAS_DEFESA = {
  campo: { nome: "Campo", chao: "#3f6212", chao2: "#4d7c0f", estrada: "#a8a29e", borda: "#78716c", pedra: "#57534e" },
  vulcao: { nome: "Vulcão", chao: "#292524", chao2: "#3f2a1d", estrada: "#7c2d12", borda: "#ea580c", pedra: "#1c1917" },
  gelo: { nome: "Geleira", chao: "#cbd5e1", chao2: "#e2e8f0", estrada: "#64748b", borda: "#94a3b8", pedra: "#475569" },
} as const;
export type MapaDefesa = keyof typeof MAPAS_DEFESA;

export const COR_TORRE: Record<TipoTorre, string> = { flecha: "#16a34a", canhao: "#1f2937", gelo: "#38bdf8" };
export const ICONE_TORRE: Record<TipoTorre, string> = { flecha: "🏹", canhao: "💣", gelo: "❄" };
const COR_INIMIGO: Record<TipoInimigo, string> = { normal: "#dc2626", rapido: "#f59e0b", blindado: "#6b7280", chefe: "#7e22ce" };
const RAIO_INIMIGO: Record<TipoInimigo, number> = { normal: 0.35, rapido: 0.28, blindado: 0.45, chefe: 0.8 };

/** Motor da Defesa de Base (canvas 2D, vista de cima): estrada, pontos de obra, torres, inimigos, cristais e a base. */
export function criarMotorDefesa(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoDefesa, mapa: MapaDefesa, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Mapa da Defesa de Base");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const M = MAPAS_DEFESA[mapa];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoDefesa | null = null;
  let pendentes: unknown[] = [];
  let w = 0, h = 0, t = 20, tempo = 0;
  const parts: { x: number; y: number; vx: number; vy: number; t: number; vida: number; cor: string }[] = [];
  const raios: { x: number; y: number; ax: number; ay: number; t: number; cor: string; grosso: boolean }[] = [];
  const textos: { x: number; y: number; texto: string; cor: string; t: number }[] = [];
  let faixa: { texto: string; cor: string; t: number } | null = null;
  let fundo: HTMLCanvasElement | null = null;

  function redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, caixa.clientWidth - 8), ch = Math.max(1, caixa.clientHeight - 8);
    t = Math.max(6, Math.min(cw / LARGURA, ch / ALTURA));
    w = t * LARGURA; h = t * ALTURA;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fundo = null;
  }
  redimensionar();

  /** Chão, estrada e pontos de obra não mudam: desenha uma vez num canvas à parte. */
  function desenharFundo() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const f = document.createElement("canvas");
    f.width = canvas.width; f.height = canvas.height;
    const c = f.getContext("2d")!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) { c.fillStyle = (x + y) % 2 ? M.chao : M.chao2; c.fillRect(x * t, y * t, t + 1, t + 1); }
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let k = 0; k < 40; k++) { c.fillStyle = M.pedra; c.beginPath(); c.arc(r() * w, r() * h, t * (0.08 + r() * 0.15), 0, Math.PI * 2); c.fill(); }
    c.lineCap = "round"; c.lineJoin = "round";
    for (const [cor, larg] of [[M.borda, 1.7], [M.estrada, 1.3]] as [string, number][]) {
      c.strokeStyle = cor; c.lineWidth = t * larg;
      c.beginPath(); ESTRADA.forEach((p, i) => (i ? c.lineTo(p.x * t, p.y * t) : c.moveTo(p.x * t, p.y * t))); c.stroke();
    }
    for (const p of PONTOS_OBRA) {
      c.fillStyle = "rgba(15,23,42,.35)"; c.fillRect((p.x - 0.6) * t, (p.y - 0.6) * t, t * 1.2, t * 1.2);
      c.strokeStyle = "rgba(250,204,21,.8)"; c.setLineDash([3, 3]); c.lineWidth = 2; c.strokeRect((p.x - 0.6) * t, (p.y - 0.6) * t, t * 1.2, t * 1.2); c.setLineDash([]);
    }
    fundo = f;
  }

  function efeitosDoPasso(e: EstadoDefesa) {
    let tiros = 0;
    for (const ev of e.eventos as EventoDefesa[]) {
      if (ev.tipo === "tiro") { if (tiros++ < 2) som.clique(); }
      else if (ev.tipo === "torre") {
        raios.push({ x: ev.x, y: ev.y, ax: ev.ax, ay: ev.ay, t: 0, cor: ev.torre === "gelo" ? "#7dd3fc" : ev.torre === "canhao" ? "#f97316" : "#fde68a", grosso: ev.torre === "canhao" });
        if (ev.torre === "canhao") som.explosao(0.5); else if (Math.random() < 0.3) som.chute();
      } else if (ev.tipo === "acerto" && ev.area > 0) {
        for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, v = Math.random() * 4; parts.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.35, cor: "#fb923c" }); }
      } else if (ev.tipo === "abate") {
        for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3; parts.push({ x: ev.x, y: ev.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.5, cor: COR_INIMIGO[ev.inimigo] }); }
        if (ev.inimigo === "chefe") { som.explosao(2); faixa = { texto: "Chefão derrubado!", cor: "#facc15", t: 0 }; }
      } else if (ev.tipo === "base") { som.alerta(); vagas.forEach((v, k) => { if (!v.bot) ganchos.vibrarLocal(k, 60); }); }
      else if (ev.tipo === "obra") { som.powerup(); const p = PONTOS_OBRA[ev.ponto]; textos.push({ x: p.x, y: p.y - 0.8, texto: ev.nivel > 1 ? `nível ${ev.nivel}` : TORRES[ev.torre].nome, cor: CORES_JOGADORES[ev.jogador % 8], t: 0 }); }
      else if (ev.tipo === "semOuro") { som.maldicao(); const j = e.jogadores[ev.jogador]; textos.push({ x: j.x, y: j.y - 1.2, texto: "falta ouro", cor: "#f87171", t: 0 }); }
      else if (ev.tipo === "escolha") { som.colocar(); if (!vagas[ev.jogador]?.bot) ganchos.vibrarLocal(ev.jogador, 20); }
      else if (ev.tipo === "coleta") { som.moeda(); textos.push({ x: ev.x, y: ev.y - 0.6, texto: `+${ev.valor}`, cor: "#fde047", t: 0 }); }
      else if (ev.tipo === "onda") { som.contagem(true); faixa = { texto: ev.chefe ? `Onda ${ev.onda} · vem o chefão!` : `Onda ${ev.onda}`, cor: ev.chefe ? "#c084fc" : "#e2e8f0", t: 0 }; }
      else if (ev.tipo === "fim" && !ev.venceu) { som.morte(); faixa = { texto: "A base caiu…", cor: "#f87171", t: 0 }; }
    }
  }

  return {
    iniciarRodada() {
      estado = novaPartidaDefesa({ modo, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      parts.length = 0; raios.length = 0; textos.length = 0; faixa = null; pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      const fim = () => ({ vencedor: e.vencedor, pontos: e.jogadores.map(j => j.pontos) });
      if (e.terminado) return fim();
      passoDefesa(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? fim() : null;
    },
    desenhar(_alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      if (!fundo) desenharFundo();
      ctx.clearRect(0, 0, w, h);
      if (fundo) ctx.drawImage(fundo, 0, 0, w, h);
      // Base.
      const bx = BASE.x * t, by = BASE.y * t;
      ctx.fillStyle = "#475569"; ctx.fillRect(bx - t * 1.1, by - t * 1.3, t * 2.2, t * 2.2);
      ctx.fillStyle = "#64748b"; for (let k = 0; k < 3; k++) ctx.fillRect(bx - t * 1.1 + k * t * 0.8, by - t * 1.6, t * 0.6, t * 0.4);
      ctx.fillStyle = "#1e293b"; ctx.fillRect(bx - t * 0.3, by + t * 0.2, t * 0.6, t * 0.7);
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(bx - t * 1.1, by + t * 1.05, t * 2.2, 5);
      ctx.fillStyle = e.vidaBase > VIDA_BASE * 0.3 ? "#22c55e" : "#ef4444"; ctx.fillRect(bx - t * 1.1, by + t * 1.05, (t * 2.2 * e.vidaBase) / VIDA_BASE, 5);
      // Cristais.
      for (const c of e.cristais) {
        const s = 1 + Math.sin(tempo * 4 + c.id) * 0.1;
        ctx.fillStyle = "#a855f7"; ctx.beginPath();
        ctx.moveTo(c.x * t, (c.y - 0.4 * s) * t); ctx.lineTo((c.x + 0.28) * t, c.y * t); ctx.lineTo(c.x * t, (c.y + 0.4 * s) * t); ctx.lineTo((c.x - 0.28) * t, c.y * t);
        ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect((c.x - 0.06) * t, (c.y - 0.2) * t, t * 0.1, t * 0.2);
      }
      // Torres.
      for (const tr of e.torres) {
        const p = PONTOS_OBRA[tr.ponto];
        ctx.fillStyle = "#57534e"; ctx.beginPath(); ctx.arc(p.x * t, p.y * t, t * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COR_TORRE[tr.tipo]; ctx.beginPath(); ctx.arc(p.x * t, p.y * t, t * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = tr.tipo === "canhao" ? "#0f172a" : "#e2e8f0"; ctx.lineWidth = t * (tr.tipo === "canhao" ? 0.28 : 0.14);
        ctx.beginPath(); ctx.moveTo(p.x * t, p.y * t); ctx.lineTo((p.x + Math.cos(tr.mira) * 0.65) * t, (p.y + Math.sin(tr.mira) * 0.65) * t); ctx.stroke();
        for (let k = 0; k < tr.nivel; k++) { ctx.fillStyle = "#facc15"; ctx.fillRect((p.x - 0.45 + k * 0.33) * t, (p.y + 0.62) * t, t * 0.24, t * 0.16); }
      }
      // Inimigos.
      for (const i of e.inimigos) {
        const r = RAIO_INIMIGO[i.tipo];
        const lento = e.passo < i.lentoAte;
        ctx.fillStyle = COR_INIMIGO[i.tipo]; ctx.beginPath(); ctx.arc(i.x * t, i.y * t, r * t, 0, Math.PI * 2); ctx.fill();
        if (lento) { ctx.strokeStyle = "#bae6fd"; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = "#fff"; ctx.fillRect((i.x - r * 0.5) * t, (i.y - r * 0.3) * t, t * r * 0.3, t * r * 0.3); ctx.fillRect((i.x + r * 0.2) * t, (i.y - r * 0.3) * t, t * r * 0.3, t * r * 0.3);
        if (i.hp < i.hpMax) {
          ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect((i.x - r) * t, (i.y - r - 0.25) * t, t * r * 2, 3);
          ctx.fillStyle = "#4ade80"; ctx.fillRect((i.x - r) * t, (i.y - r - 0.25) * t, (t * r * 2 * Math.max(0, i.hp)) / i.hpMax, 3);
        }
      }
      // Engenheiros, com a torre escolhida em cima e o alcance dela quando está num ponto de obra.
      e.jogadores.forEach((j, k) => {
        const ponto = PONTOS_OBRA.findIndex(p => Math.hypot(p.x - j.x, p.y - j.y) < 0.9);
        if (ponto >= 0 && !vagas[k]?.bot) {
          const tr = e.torres.find(x => x.ponto === ponto);
          const alcance = tr ? atributos({ ...tr, nivel: Math.min(3, tr.nivel + 1) }).alcance : TORRES[j.escolha].alcance;
          const p = PONTOS_OBRA[ponto];
          ctx.strokeStyle = "rgba(250,204,21,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x * t, p.y * t, alcance * t, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "#0f172a"; ctx.font = `800 ${Math.max(10, t * 0.45)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const preco = tr ? (tr.nivel >= 3 ? "máximo" : `melhorar ${precoMelhoria(tr.nivel)}`) : `${TORRES[j.escolha].nome} ${TORRES[j.escolha].preco}`;
          ctx.fillStyle = "rgba(15,23,42,.8)"; const tw = ctx.measureText(preco).width + 10; ctx.fillRect(p.x * t - tw / 2, (p.y - 2.1) * t - 9, tw, 18);
          ctx.fillStyle = "#fde68a"; ctx.fillText(preco, p.x * t, (p.y - 2.1) * t);
        }
        const comemora = (fase === "fimRodada" || fase === "fimPartida") && vencedor === k;
        desenharCorpo(ctx, folhas[k], j.mira.x < 0 ? "esquerda" : "direita", comemora ? "vitoria" : "parado", tempo + k * 0.3, j.x * t, (j.y + 0.5) * t, t * 1.3);
        ctx.fillStyle = CORES_JOGADORES[k % 8]; ctx.beginPath(); ctx.arc(j.x * t, (j.y - 1.1) * t, t * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.font = `${Math.max(9, t * 0.36)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ICONE_TORRE[j.escolha], j.x * t, (j.y - 1.1) * t);
      });
      ctx.fillStyle = "#fef08a";
      for (const b of e.balas) { ctx.beginPath(); ctx.arc(b.x * t, b.y * t, t * 0.1, 0, Math.PI * 2); ctx.fill(); }
      for (let k = raios.length - 1; k >= 0; k--) {
        const r = raios[k]; r.t += dt;
        if (r.t > 0.15) { raios.splice(k, 1); continue; }
        ctx.strokeStyle = r.cor; ctx.lineWidth = r.grosso ? 4 : 2; ctx.globalAlpha = 1 - r.t / 0.15;
        ctx.beginPath(); ctx.moveTo(r.x * t, r.y * t); ctx.lineTo(r.ax * t, r.ay * t); ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (let k = parts.length - 1; k >= 0; k--) {
        const p = parts[k]; p.t += dt;
        if (p.t > p.vida) { parts.splice(k, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.t / p.vida; ctx.fillStyle = p.cor; ctx.fillRect(p.x * t - 2, p.y * t - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.font = "800 12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let k = textos.length - 1; k >= 0; k--) {
        const x = textos[k]; x.t += dt;
        if (x.t > 1) { textos.splice(k, 1); continue; }
        ctx.globalAlpha = 1 - x.t; ctx.fillStyle = x.cor; ctx.fillText(x.texto, x.x * t, (x.y - x.t * 0.8) * t);
      }
      ctx.globalAlpha = 1;
      // Ouro, onda e vida da base.
      ctx.fillStyle = "rgba(15,23,42,.8)"; ctx.fillRect(w / 2 - 140, 6, 280, 28);
      ctx.fillStyle = "#e2e8f0"; ctx.font = "800 13px system-ui";
      const onda = e.fase === "intervalo" ? `próxima onda em ${Math.ceil((e.faseAte - e.passo) / 60)}s` : `onda ${e.onda}${e.modo === "cooperativo" ? `/${e.meta}` : ""}`;
      ctx.fillText(`💰 ${e.ouro} · 🏰 ${e.vidaBase}/${VIDA_BASE} · ${onda}`, w / 2, 20);
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 2.2) faixa = null;
        else { ctx.globalAlpha = Math.min(1, (2.2 - faixa.t) * 2); ctx.font = `900 ${Math.max(16, t * 1.1)}px system-ui`; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.strokeText(faixa.texto, w / 2, h * 0.42); ctx.fillStyle = faixa.cor; ctx.fillText(faixa.texto, w / 2, h * 0.42); ctx.globalAlpha = 1; }
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.floor(e.passo / 60),
        alerta: e.vidaBase <= VIDA_BASE * 0.3,
        jogadores: e.jogadores.map(j => ({ vivo: true, texto: `${ICONE_TORRE[j.escolha]} ${j.abates}☠ · ${j.obras}🔨 · ${j.pontos} pts` })),
      };
    },
    redimensionar,
    destruir() { canvas.remove(); },
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoDefesa | null;
      if (!e || !Array.isArray(e.jogadores)) return;
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoDefesa[];
      efeitosDoPasso(e);
    },
  };
}
