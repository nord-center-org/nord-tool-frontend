import type { Entrada } from "@/react-app/utils/games/bombas";
import { H, SETORES, VOLTAS, W, novaPartidaEspacial, passoEspacial, pontosEspacial, type EstadoEspacial, type EventoEspacial, type ModoEspacial, type Setor } from "@/react-app/utils/games/espacial";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, spriteDoAvatar } from "../../central/sprites";

/** Motor da Corrida Espacial (canvas 2D): estrelas, planetas com brilho, anéis numerados, naves com o rosto do piloto. */
export function criarMotorEspacial(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoEspacial, setor: Setor, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Espaço da Corrida Espacial");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const S = SETORES[setor];
  const rostos = vagas.map(v => spriteDoAvatar(v.avatar, `rosto-${JSON.stringify(v.avatar)}`));
  const estrelas = Array.from({ length: 140 }, (_v, i) => ({ x: (i * 97.3) % W, y: (i * 53.7) % H, b: 0.3 + ((i * 7) % 10) / 14 }));
  let estado: EstadoEspacial | null = null;
  let anteriores: { x: number; y: number }[] = [];
  let pendentes: unknown[] = [];
  let w = 0, h = 0, t = 30, tempo = 0;
  const parts: { x: number; y: number; vx: number; vy: number; t: number; vida: number; cor: string }[] = [];
  const rastro: { x: number; y: number; t: number; cor: string }[] = [];
  let faixa: { texto: string; cor: string; t: number } | null = null;

  function redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, caixa.clientWidth - 8), ch = Math.max(1, caixa.clientHeight - 8);
    t = Math.max(8, Math.min(cw / W, ch / H));
    w = t * W; h = t * H;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redimensionar();

  function estouro(x: number, y: number, cor: string, n: number, v = 4) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = Math.random() * v; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, vida: 0.4 + Math.random() * 0.5, cor }); }
  }

  function efeitosDoPasso(e: EstadoEspacial) {
    for (const ev of e.eventos as EventoEspacial[]) {
      if (ev.tipo === "tiro") som.clique();
      else if (ev.tipo === "explodiu") { estouro(ev.x, ev.y, "#f97316", 30, 6); som.explosao(1.5); ganchos.morte(ev.nave); }
      else if (ev.tipo === "atordoou") { som.alerta(); ganchos.vibrarLocal(ev.nave, 60); const n = e.naves[ev.nave]; estouro(n.x, n.y, "#67e8f9", 10); }
      else if (ev.tipo === "anel") { som.moeda(); ganchos.vibrarLocal(ev.nave, 20); }
      else if (ev.tipo === "chegou") { som.vitoria(); faixa = { texto: `${vagas[ev.nave].nome} chegou em ${ev.lugar}º!`, cor: CORES_JOGADORES[ev.nave % 8], t: 0 }; }
      else if (ev.tipo === "rocha") { estouro(ev.x, ev.y, "#a8a29e", 14, 3); som.bloco(); }
      else if (ev.tipo === "cristal") som.powerup();
    }
  }

  return {
    iniciarRodada() {
      estado = novaPartidaEspacial({ modo, setor, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      anteriores = estado.naves.map(n => ({ x: n.x, y: n.y }));
      parts.length = 0; rastro.length = 0; faixa = null; pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      if (e.terminado) return { vencedor: e.vencedor, pontos: e.naves.map(n => pontosEspacial(e, n)) };
      anteriores = e.naves.map(n => ({ x: n.x, y: n.y }));
      passoEspacial(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? { vencedor: e.vencedor, pontos: e.naves.map(n => pontosEspacial(e, n)) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, w, h);
      for (const s of estrelas) { ctx.globalAlpha = s.b * (0.7 + Math.sin(tempo * 2 + s.x) * 0.3); ctx.fillStyle = "#e0f2fe"; ctx.fillRect(s.x * t, s.y * t, 2, 2); }
      ctx.globalAlpha = 1;
      for (const p of S.planetas) {
        const g = ctx.createRadialGradient(p.x * t, p.y * t, p.r * t * 0.6, p.x * t, p.y * t, p.r * t * 3);
        g.addColorStop(0, `${p.cor}40`); g.addColorStop(1, `${p.cor}00`);
        ctx.fillStyle = g; ctx.fillRect((p.x - p.r * 3) * t, (p.y - p.r * 3) * t, p.r * 6 * t, p.r * 6 * t);
        const c = ctx.createRadialGradient((p.x - p.r * 0.3) * t, (p.y - p.r * 0.3) * t, 2, p.x * t, p.y * t, p.r * t);
        c.addColorStop(0, "#ffffff"); c.addColorStop(0.15, p.cor); c.addColorStop(1, "#0f172a");
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x * t, p.y * t, p.r * t, 0, Math.PI * 2); ctx.fill();
      }
      if (e.modo === "corrida") {
        S.aneis.forEach(([x, y], i) => {
          const proximo = e.naves.some(n => !n.bot && n.anel % S.aneis.length === i);
          ctx.strokeStyle = proximo ? "#facc15" : "rgba(250,204,21,.35)"; ctx.lineWidth = proximo ? 4 : 2;
          ctx.beginPath(); ctx.arc(x * t, y * t, t * 1.1 + (proximo ? Math.sin(tempo * 6) * 2 : 0), 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "rgba(250,204,21,.8)"; ctx.font = `800 ${t * 0.5}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(i === 0 ? "🏁" : i), x * t, y * t);
        });
      }
      for (const r of e.rochas) {
        ctx.fillStyle = "#78716c"; ctx.beginPath();
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + r.id, rr = r.r * t * (0.8 + ((r.id * (k + 3)) % 5) / 15); ctx.lineTo(r.x * t + Math.cos(a) * rr, r.y * t + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      }
      for (const c of e.cristais) {
        ctx.save(); ctx.translate(c.x * t, c.y * t); ctx.rotate(tempo * 2 + c.id);
        ctx.fillStyle = "#22d3ee"; ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(0, -t * 0.3); ctx.lineTo(t * 0.2, 0); ctx.lineTo(0, t * 0.3); ctx.lineTo(-t * 0.2, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 3;
      for (const x of e.tiros) { ctx.beginPath(); ctx.moveTo(x.x * t, x.y * t); ctx.lineTo((x.x - x.vx * 0.6) * t, (x.y - x.vy * 0.6) * t); ctx.stroke(); }
      const ativo = fase === "jogando";
      e.naves.forEach((n, i) => {
        if (e.passo < n.explodidaAte || n.terminouEm !== null && e.modo === "corrida" && e.passo - n.terminouEm > 60) return;
        const a = anteriores[i] ?? n;
        const salto = Math.abs(n.x - a.x) > 3 || Math.abs(n.y - a.y) > 3;
        const px = (ativo && !salto ? a.x + (n.x - a.x) * alfa : n.x) * t, py = (ativo && !salto ? a.y + (n.y - a.y) * alfa : n.y) * t;
        const cor = CORES_JOGADORES[i % 8];
        if (Math.hypot(n.vx, n.vy) > 0.05) rastro.push({ x: px, y: py, t: 0, cor });
        ctx.save(); ctx.translate(px, py); ctx.rotate(n.ang);
        ctx.fillStyle = cor;
        ctx.beginPath(); ctx.moveTo(t * 0.6, 0); ctx.lineTo(-t * 0.45, -t * 0.38); ctx.lineTo(-t * 0.25, 0); ctx.lineTo(-t * 0.45, t * 0.38); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(rostos[i], px - t * 0.25, py - t * 0.25, t * 0.5, t * 0.5);
        if (e.passo < n.atordoadaAte) { ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, t * 0.7, 0, Math.PI * 2); ctx.stroke(); }
      });
      for (let k = rastro.length - 1; k >= 0; k--) {
        const r = rastro[k]; r.t += dt;
        if (r.t > 0.35 || rastro.length > 300) { rastro.splice(k, 1); continue; }
        ctx.globalAlpha = 0.5 * (1 - r.t / 0.35); ctx.fillStyle = r.cor; ctx.fillRect(r.x - 1.5, r.y - 1.5, 3, 3);
      }
      for (let k = parts.length - 1; k >= 0; k--) {
        const p = parts[k]; p.t += dt;
        if (p.t > p.vida) { parts.splice(k, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.t / p.vida; ctx.fillStyle = p.cor; ctx.fillRect(p.x * t - 2, p.y * t - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.font = `900 ${Math.max(12, t * 0.55)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "#e0f2fe";
      const resto = Math.max(0, Math.ceil((e.duracao - e.passo) / 60));
      ctx.fillText(e.modo === "corrida" ? `${VOLTAS} voltas pelos anéis · ${resto} s` : `${e.modo === "asteroides" ? "☄️ Asteroides" : "💎 Coleta"} · ${resto} s`, w / 2, t * 0.7);
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 2) faixa = null;
        else { ctx.globalAlpha = Math.min(1, (2 - faixa.t) * 2); ctx.font = `900 ${Math.max(16, t * 0.8)}px system-ui`; ctx.fillStyle = faixa.cor; ctx.fillText(faixa.texto, w / 2, h * 0.25); ctx.globalAlpha = 1; }
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      const n = SETORES[e.setor].aneis.length;
      return {
        tempo: Math.max(0, Math.ceil((e.duracao - e.passo) / 60)),
        jogadores: e.naves.map(x => ({
          vivo: e.passo >= x.explodidaAte,
          texto: e.modo === "corrida" ? (x.terminouEm !== null ? `chegou ${e.chegada.indexOf(x.id) + 1}º` : `volta ${Math.min(VOLTAS, x.volta + 1)} · anel ${x.anel % n}`) : e.modo === "coleta" ? `💎 ${x.cristais}` : `${x.pontos} pts`,
        })),
      };
    },
    redimensionar,
    destruir() { canvas.remove(); },
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoEspacial | null;
      if (!e || !Array.isArray(e.naves)) return;
      anteriores = (estado ?? e).naves.map(n => ({ x: n.x, y: n.y }));
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoEspacial[];
      efeitosDoPasso(e);
    },
  };
}
