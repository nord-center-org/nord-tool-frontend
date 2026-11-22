import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  PORTA, SH, SW, espinhosAltos, novaPartidaMasmorra, passoMasmorra, pontosMasmorra,
  type EstadoMasmorra, type EventoMasmorra, type Lado, type ModoMasmorra,
} from "@/react-app/utils/games/masmorra";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const TEMAS_MASMORRA = {
  pedra: { nome: "Masmorra de pedra", chao: "#3f3a36", chao2: "#46403b", parede: "#1c1917", tocha: "#f59e0b" },
  gelo: { nome: "Cripta de gelo", chao: "#1e3a5f", chao2: "#234569", parede: "#0b1530", tocha: "#67e8f9" },
  lava: { nome: "Fornalha", chao: "#3b1a14", chao2: "#45201a", parede: "#1c0a06", tocha: "#f97316" },
} as const;
export type TemaMasmorra = keyof typeof TEMAS_MASMORRA;

const NOME_ITEM = { coracao: "+Coração", vidaMax: "+Vida máx.", dano: "+Dano", velocidade: "+Velocidade", moeda: "+10", chave: "CHAVE!" } as const;
interface Particula { x: number; y: number; vx: number; vy: number; t: number; vida: number; cor: string }

/** Motor da Fuga da Masmorra (canvas 2D, visão de cima): a sala atual, portas, monstros, golpes e o minimapa. */
export function criarMotorMasmorra(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoMasmorra, tema: TemaMasmorra, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Sala da Fuga da Masmorra");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const T = TEMAS_MASMORRA[tema];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoMasmorra | null = null;
  let anteriores: { x: number; y: number }[] = [];
  let pendentes: unknown[] = [];
  let w = 0, h = 0, t = 30, ox = 0, oy = 0, tempo = 0, tremor = 0;
  const parts: Particula[] = [];
  const textos: { x: number; y: number; texto: string; cor: string; t: number }[] = [];
  let faixa: { texto: string; cor: string; t: number } | null = null;

  function redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, caixa.clientWidth - 8), ch = Math.max(1, caixa.clientHeight - 8);
    t = Math.max(8, Math.min(cw / (SW + 2), ch / (SH + 2)));
    w = t * (SW + 2); h = t * (SH + 2);
    ox = t; oy = t;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redimensionar();
  const X = (x: number) => ox + x * t, Y = (y: number) => oy + y * t;

  function respingo(x: number, y: number, cor: string, n = 10) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.5, cor }); }
  }

  function efeitosDoPasso(e: EstadoMasmorra) {
    for (const ev of e.eventos as EventoMasmorra[]) {
      switch (ev.tipo) {
        case "golpe": som.arremesso(); break;
        case "esquiva": som.chute(); break;
        case "acerto": respingo(ev.x, ev.y, "#e5e7eb", 5); som.clique(); break;
        case "abate":
          respingo(ev.x, ev.y, ev.inimigo === "slime" ? "#4ade80" : ev.inimigo === "morcego" ? "#a78bfa" : "#e7e5e4", ev.inimigo === "chefe" ? 40 : 12);
          if (ev.inimigo === "chefe") som.vitoria(); else som.bloco();
          break;
        case "ferido": ganchos.vibrarLocal(ev.jogador, 50); tremor = 0.15; som.alerta(); break;
        case "fantasma": som.morte(); ganchos.morte(ev.jogador); faixa = { texto: `${vagas[ev.jogador].nome} virou fantasma — limpem a sala para trazê-lo de volta`, cor: "#c4b5fd", t: 0 }; break;
        case "voltou": som.escudo(); break;
        case "sala": som.colocar(); if (ev.tipoSala === "tesouro") faixa = { texto: "Sala do tesouro", cor: "#fde047", t: 0 }; break;
        case "trancou": faixa = { texto: "As portas trancaram!", cor: "#f87171", t: 0 }; som.alerta(); break;
        case "limpou": faixa = { texto: "Sala limpa", cor: "#86efac", t: 0 }; som.moeda(); break;
        case "bau": som.powerup(); break;
        case "pegou": {
          const j = e.jogadores[ev.jogador];
          textos.push({ x: j.x, y: j.y - 0.6, texto: NOME_ITEM[ev.coisa], cor: ev.coisa === "chave" ? "#fde047" : "#fff", t: 0 });
          if (ev.coisa === "chave") { som.vitoria(); faixa = { texto: "Vocês pegaram a CHAVE do chefe!", cor: "#fde047", t: 0 }; } else som.moeda();
          break;
        }
        case "trancada": faixa = { texto: "Trancada: achem a chave", cor: "#fca5a5", t: 0 }; som.alerta(); break;
        case "chefe": faixa = { texto: "O GUARDIÃO DA MASMORRA!", cor: "#ef4444", t: 0 }; som.maldicao(); tremor = 0.4; break;
        case "fim": break;
      }
    }
  }

  function inimigo(m: EstadoMasmorra["inimigos"][number]) {
    const x = X(m.x), y = Y(m.y);
    if (m.tipo === "slime") {
      const pulo = Math.abs(Math.sin(tempo * 6 + m.id)) * t * 0.08;
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.ellipse(x, y - pulo, t * 0.38, t * 0.3, 0, Math.PI, 0); ctx.lineTo(x + t * 0.38, y + t * 0.12 - pulo); ctx.lineTo(x - t * 0.38, y + t * 0.12 - pulo); ctx.fill();
      ctx.fillStyle = "#052e16"; ctx.fillRect(x - t * 0.15, y - t * 0.12 - pulo, t * 0.08, t * 0.1); ctx.fillRect(x + t * 0.07, y - t * 0.12 - pulo, t * 0.08, t * 0.1);
    } else if (m.tipo === "morcego") {
      const asa = Math.sin(tempo * 18 + m.id) * t * 0.2;
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - t * 0.45, y - asa); ctx.lineTo(x - t * 0.2, y + t * 0.1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + t * 0.45, y - asa); ctx.lineTo(x + t * 0.2, y + t * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#4c1d95"; ctx.beginPath(); ctx.arc(x, y, t * 0.15, 0, Math.PI * 2); ctx.fill();
    } else if (m.tipo === "esqueleto") {
      ctx.fillStyle = "#e7e5e4";
      ctx.beginPath(); ctx.arc(x, y - t * 0.28, t * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - t * 0.05, y - t * 0.1, t * 0.1, t * 0.35);
      ctx.fillRect(x - t * 0.22, y, t * 0.44, t * 0.06);
      ctx.fillStyle = "#1c1917"; ctx.fillRect(x - t * 0.1, y - t * 0.32, t * 0.06, t * 0.06); ctx.fillRect(x + t * 0.04, y - t * 0.32, t * 0.06, t * 0.06);
    } else {
      const r = t * 1;
      ctx.fillStyle = "#57534e"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#292524"; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + tempo; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, t * 0.22, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = m.fase ? "#ef4444" : "#facc15"; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.2, t * 0.14, 0, Math.PI * 2); ctx.arc(x + r * 0.35, y - r * 0.2, t * 0.14, 0, Math.PI * 2); ctx.fill();
    }
    if (m.hp < m.hpMax) {
      const larg = m.tipo === "chefe" ? t * 2.4 : t * 0.7;
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(x - larg / 2, y - t * (m.tipo === "chefe" ? 1.4 : 0.6), larg, 4);
      ctx.fillStyle = "#ef4444"; ctx.fillRect(x - larg / 2, y - t * (m.tipo === "chefe" ? 1.4 : 0.6), larg * (m.hp / m.hpMax), 4);
    }
  }

  function sala(e: EstadoMasmorra) {
    const s = e.salas[e.atual];
    ctx.fillStyle = T.parede; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { ctx.fillStyle = (x + y) % 2 ? T.chao : T.chao2; ctx.fillRect(X(x), Y(y), t + 0.5, t + 0.5); }
    // Tochas nas paredes.
    for (const [tx, ty] of [[3, -0.5], [SW - 3, -0.5], [3, SH + 0.5], [SW - 3, SH + 0.5]]) {
      const fl = 0.8 + Math.sin(tempo * 12 + tx) * 0.2;
      const g = ctx.createRadialGradient(X(tx), Y(ty), 0, X(tx), Y(ty), t * 3 * fl);
      g.addColorStop(0, `${T.tocha}88`); g.addColorStop(1, `${T.tocha}00`);
      ctx.fillStyle = g; ctx.fillRect(X(tx - 3), Y(ty - 3), t * 6, t * 6);
      ctx.fillStyle = T.tocha; ctx.beginPath(); ctx.arc(X(tx), Y(ty), t * 0.15 * fl, 0, Math.PI * 2); ctx.fill();
    }
    // Portas: abertas, fechadas com grades (monstros) ou trancadas (chefe sem chave).
    const limpa = e.inimigos.length === 0;
    for (const l of Object.keys(PORTA) as Lado[]) {
      if (!s.portas[l]) continue;
      const p = PORTA[l];
      const viz = e.salas.find(x => x.gx === s.gx + ({ n: 0, s: 0, l: -1, o: 1 })[l] && x.gy === s.gy + ({ n: -1, s: 1, l: 0, o: 0 })[l]);
      const trancada = viz?.tipo === "chefe" && !e.temChave;
      const hor = l === "n" || l === "s";
      const rx = X(p.x - (hor ? 1.1 : 0.5)), ry = Y(p.y - (hor ? 0.5 : 1.1)), rw = t * (hor ? 2.2 : 1), rh = t * (hor ? 1 : 2.2);
      ctx.fillStyle = viz?.tipo === "chefe" ? "#450a0a" : "#0c0a09"; ctx.fillRect(rx, ry, rw, rh);
      if (!limpa || trancada) {
        ctx.strokeStyle = trancada ? "#facc15" : "#78716c"; ctx.lineWidth = 3;
        for (let k = 1; k < 5; k++) { ctx.beginPath(); if (hor) { ctx.moveTo(rx + (rw * k) / 5, ry); ctx.lineTo(rx + (rw * k) / 5, ry + rh); } else { ctx.moveTo(rx, ry + (rh * k) / 5); ctx.lineTo(rx + rw, ry + (rh * k) / 5); } ctx.stroke(); }
        if (trancada) { ctx.fillStyle = "#facc15"; ctx.font = `900 ${t * 0.55}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🔒", X(p.x), Y(p.y)); }
      }
    }
    // Espinhos.
    const altos = espinhosAltos(e);
    for (const sp of s.espinhos) {
      ctx.fillStyle = "#292524"; ctx.fillRect(X(sp.x) + 2, Y(sp.y) + 2, t - 4, t - 4);
      ctx.fillStyle = altos ? "#d6d3d1" : "#57534e";
      for (let k = 0; k < 3; k++) for (let q = 0; q < 3; q++) {
        const cx = X(sp.x + 0.2 + k * 0.3), cy = Y(sp.y + 0.25 + q * 0.3);
        ctx.beginPath(); ctx.moveTo(cx - t * 0.07, cy + t * 0.08); ctx.lineTo(cx, cy - (altos ? t * 0.14 : t * 0.02)); ctx.lineTo(cx + t * 0.07, cy + t * 0.08); ctx.fill();
      }
    }
    if (s.bau) {
      ctx.fillStyle = s.bau.aberto ? "#78350f" : "#b45309"; ctx.fillRect(X(s.bau.x - 0.4), Y(s.bau.y - 0.3), t * 0.8, t * 0.6);
      ctx.fillStyle = "#facc15"; ctx.fillRect(X(s.bau.x - 0.06), Y(s.bau.y - 0.1), t * 0.12, t * 0.18);
    }
  }

  function minimapa(e: EstadoMasmorra) {
    const c = Math.max(6, t * 0.32);
    const x0 = w - c * 5.6 - 6, y0 = 6;
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x0 - 4, y0 - 4, c * 5.6 + 8, c * 4.6 + 8);
    e.salas.forEach((s, i) => {
      const viz = s.visitada || e.salas.some(o => o.visitada && Math.abs(o.gx - s.gx) + Math.abs(o.gy - s.gy) === 1);
      if (!viz) return;
      ctx.fillStyle = i === e.atual ? "#fafafa" : !s.visitada ? "#44403c" : s.tipo === "chefe" ? "#dc2626" : s.tipo === "chave" ? "#facc15" : s.tipo === "tesouro" ? "#f59e0b" : "#a8a29e";
      ctx.fillRect(x0 + s.gx * c * 1.1, y0 + s.gy * c * 1.1, c, c);
    });
  }

  return {
    iniciarRodada() {
      estado = novaPartidaMasmorra({ modo, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      anteriores = estado.jogadores.map(j => ({ x: j.x, y: j.y }));
      parts.length = 0; textos.length = 0; faixa = null; pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      if (e.terminado) return { vencedor: e.vencedor, pontos: e.jogadores.map(j => pontosMasmorra(e, j)) };
      const salaAntes = e.atual;
      anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      passoMasmorra(e, entradas);
      if (e.atual !== salaAntes) anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? { vencedor: e.vencedor, pontos: e.jogadores.map(j => pontosMasmorra(e, j)) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      tremor = Math.max(0, tremor - dt);
      ctx.save();
      if (tremor > 0) ctx.translate((Math.random() - 0.5) * tremor * 16, (Math.random() - 0.5) * tremor * 16);
      sala(e);
      for (const c of e.coletas) {
        const y = Y(c.y) - Math.abs(Math.sin(tempo * 4 + c.id)) * t * 0.1;
        ctx.font = `900 ${t * 0.5}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(c.tipo === "moeda" ? "🪙" : c.tipo === "chave" ? "🗝️" : c.tipo === "coracao" ? "❤️" : c.tipo === "vidaMax" ? "💖" : c.tipo === "dano" ? "🗡️" : "👟", X(c.x), y);
      }
      for (const m of e.inimigos) inimigo(m);
      ctx.fillStyle = "#e7e5e4";
      for (const p of e.projeteis) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), t * 0.12, 0, Math.PI * 2); ctx.fill(); }
      const ativo = fase === "jogando";
      for (const j of [...e.jogadores].sort((a, b) => a.y - b.y)) {
        const a = anteriores[j.id] ?? j;
        const px = ativo ? a.x + (j.x - a.x) * alfa : j.x, py = ativo ? a.y + (j.y - a.y) * alfa : j.y;
        const dir = Math.abs(j.olhar.x) > Math.abs(j.olhar.y) ? (j.olhar.x > 0 ? "direita" : "esquerda") : j.olhar.y > 0 ? "baixo" : "cima";
        const pisca = e.passo < j.invulAte && Math.floor(e.passo / 4) % 2 === 0;
        ctx.globalAlpha = j.fantasma ? 0.35 : pisca ? 0.5 : 1;
        ctx.fillStyle = `${CORES_JOGADORES[j.id % 8]}55`;
        ctx.beginPath(); ctx.ellipse(X(px), Y(py) + t * 0.3, t * 0.4, t * 0.15, 0, 0, Math.PI * 2); ctx.fill();
        const comemora = (fase === "fimRodada" || fase === "fimPartida") && (vencedor === j.id || e.venceram);
        desenharCorpo(ctx, folhas[j.id], dir, comemora ? "vitoria" : ativo && Math.abs(j.x - a.x) + Math.abs(j.y - a.y) > 0.001 ? "andando" : "parado", tempo + j.id * 0.3, X(px), Y(py) + t * 0.35, t * 1.3);
        // Golpe de espada: arco na frente.
        if (j.ataque > 12) {
          const ang = Math.atan2(j.olhar.y, j.olhar.x);
          ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(X(px), Y(py), t * 1.1, ang - 1.1 + (20 - j.ataque) * 0.15, ang + 0.2 + (20 - j.ataque) * 0.15); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Corações sobre a cabeça.
        for (let k = 0; k < j.hpMax / 2; k++) {
          const cheio = j.hp - k * 2;
          ctx.fillStyle = cheio >= 2 ? "#ef4444" : cheio === 1 ? "#fca5a5" : "rgba(255,255,255,.2)";
          ctx.fillRect(X(px) - (j.hpMax / 4) * t * 0.22 + k * t * 0.22, Y(py) - t * 1.35, t * 0.18, t * 0.16);
        }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt;
        if (p.t > p.vida) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.t / p.vida; ctx.fillStyle = p.cor;
        ctx.fillRect(X(p.x) - 2, Y(p.y) - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = textos.length - 1; i >= 0; i--) {
        const x = textos[i]; x.t += dt;
        if (x.t > 1.2) { textos.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - x.t / 1.2; ctx.font = `900 ${Math.max(11, t * 0.45)}px system-ui`; ctx.fillStyle = x.cor;
        ctx.fillText(x.texto, X(x.x), Y(x.y - x.t));
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      minimapa(e);
      ctx.font = `800 ${Math.max(11, t * 0.42)}px system-ui`; ctx.textAlign = "left"; ctx.fillStyle = "#fde68a";
      ctx.fillText(`${e.temChave ? "🗝️ Chave na mão" : "Ache a chave"}${modo === "diario" ? " · Desafio Diário" : ""}`, 8, t * 0.5);
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 2) faixa = null;
        else {
          ctx.globalAlpha = Math.min(1, (2 - faixa.t) * 2); ctx.textAlign = "center";
          ctx.font = `900 ${Math.max(15, t * 0.75)}px system-ui`; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.85)";
          ctx.strokeText(faixa.texto, w / 2, h * 0.22); ctx.fillStyle = faixa.cor; ctx.fillText(faixa.texto, w / 2, h * 0.22);
          ctx.globalAlpha = 1;
        }
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.floor(e.passo / 60),
        jogadores: e.jogadores.map(j => ({ vivo: !j.fantasma, texto: j.fantasma ? "fantasma" : `❤${j.hp / 2} · 🪙${j.moedas} · ${j.abates}☠` })),
      };
    },
    redimensionar,
    destruir() { canvas.remove(); },
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoMasmorra | null;
      if (!e || !Array.isArray(e.jogadores) || !Array.isArray(e.salas)) return;
      if (estado && e.passo < estado.passo) { parts.length = 0; textos.length = 0; faixa = null; }
      anteriores = (estado && estado.atual === e.atual ? estado : e).jogadores.map(j => ({ x: j.x, y: j.y }));
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoMasmorra[];
      efeitosDoPasso(e);
    },
  };
}
