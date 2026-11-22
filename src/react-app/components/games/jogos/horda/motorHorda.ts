import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  ALTURA, ARMAS, BANCADAS, CASA, LARGURA, PAREDES, PORTAS, PRECO, TABUAS_MAX, novaPartidaHorda, passoHorda, pontosHorda,
  type EstadoHorda, type EventoHorda, type ModoHorda,
} from "@/react-app/utils/games/horda";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const CENARIOS_HORDA = {
  bairro: { nome: "Bairro à noite", chao: "#1f2a1f", chao2: "#253325", piso: "#3b3329", parede: "#5b4636", escuro: "rgba(3,6,12,.86)" },
  fazenda: { nome: "Fazenda", chao: "#3a2f1c", chao2: "#45391f", piso: "#4a3a26", parede: "#6b4c2a", escuro: "rgba(8,5,2,.84)" },
  hospital: { nome: "Hospital", chao: "#1e293b", chao2: "#243247", piso: "#475569", parede: "#94a3b8", escuro: "rgba(2,6,23,.88)" },
} as const;
export type CenarioHorda = keyof typeof CENARIOS_HORDA;

const COR_ZUMBI = { normal: "#65a30d", corredor: "#a3e635", bruto: "#4d7c0f", chefe: "#7f1d1d" } as const;
const NOME_BANCADA = { arma: "Arma", vida: "Vida", dano: "Dano" } as const;

interface Particula { x: number; y: number; vx: number; vy: number; t: number; vida: number; cor: string; r: number }

/**
 * Motor da Horda Zumbi (canvas 2D, visão de cima): a casa com portas de tábuas e bancadas, zumbis, tiros, sangue e a
 * escuridão da noite cortada pelas lanternas de cada jogador.
 */
export function criarMotorHorda(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoHorda, cenario: CenarioHorda, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Mapa da Horda Zumbi");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const luz = document.createElement("canvas");
  const lctx = luz.getContext("2d")!;
  const tema = CENARIOS_HORDA[cenario];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoHorda | null = null;
  let anteriores: { x: number; y: number }[] = [];
  let pendentes: unknown[] = [];
  let w = 0, h = 0, t = 20, ox = 0, oy = 0, tempo = 0;
  const parts: Particula[] = [];
  const textos: { x: number; y: number; texto: string; cor: string; t: number }[] = [];
  const flashes: { x: number; y: number; t: number }[] = [];
  let faixa: { texto: string; cor: string; t: number } | null = null;

  function redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, caixa.clientWidth - 8);
    h = Math.max(1, caixa.clientHeight - 8);
    t = Math.max(6, Math.min(w / LARGURA, h / ALTURA));
    const cw = t * LARGURA, ch = t * ALTURA;
    ox = 0; oy = 0;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    luz.width = canvas.width; luz.height = canvas.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = cw; h = ch;
  }
  redimensionar();

  const X = (x: number) => ox + x * t, Y = (y: number) => oy + y * t;

  function sangue(x: number, y: number, n: number, cor = "#7f1d1d") {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.4 + Math.random() * 0.4, cor, r: 0.06 + Math.random() * 0.08 });
    }
  }

  function efeitosDoPasso(e: EstadoHorda) {
    let tiros = 0;
    for (const ev of e.eventos as EventoHorda[]) {
      switch (ev.tipo) {
        case "tiro": {
          tiros++;
          const j = e.jogadores[ev.jogador];
          flashes.push({ x: j.x + j.mira.x * 0.5, y: j.y + j.mira.y * 0.5, t: 0 });
          if (ev.arma === "espingarda") som.chute();
          break;
        }
        case "acerto": sangue(ev.x, ev.y, 4, "#65a30d"); break;
        case "abate":
          sangue(ev.x, ev.y, ev.zumbi === "chefe" ? 40 : 12, "#3f6212");
          textos.push({ x: ev.x, y: ev.y, texto: `+${ev.zumbi === "chefe" ? 2000 : ev.zumbi === "bruto" ? 150 : ev.zumbi === "corredor" ? 80 : 60}`, cor: CORES_JOGADORES[ev.jogador % 8], t: 0 });
          if (ev.zumbi === "chefe") som.vitoria(); else som.bloco();
          break;
        case "ferido": ganchos.vibrarLocal(ev.jogador, 40); sangue(e.jogadores[ev.jogador].x, e.jogadores[ev.jogador].y, 5); break;
        case "caiu":
          som.morte(); ganchos.morte(ev.jogador);
          faixa = { texto: `${vagas[ev.jogador].nome} caiu! Segure B perto para levantar`, cor: CORES_JOGADORES[ev.jogador % 8], t: 0 };
          break;
        case "levantou": som.escudo(); textos.push({ x: e.jogadores[ev.jogador].x, y: e.jogadores[ev.jogador].y, texto: "De pé!", cor: "#86efac", t: 0 }); break;
        case "fora": faixa = { texto: `${vagas[ev.jogador].nome} volta na próxima onda`, cor: "#fca5a5", t: 0 }; break;
        case "tabua": if (ev.quebrou) som.bloco(); else som.colocar(); break;
        case "compra":
          som.powerup();
          textos.push({ x: e.jogadores[ev.jogador].x, y: e.jogadores[ev.jogador].y - 0.6, texto: ev.item === "arma" ? ARMAS[e.jogadores[ev.jogador].arma].nome : ev.item === "vida" ? "+Vida" : "+Dano", cor: "#fde047", t: 0 });
          break;
        case "semDinheiro": som.alerta(); break;
        case "onda": faixa = { texto: `Onda ${ev.onda}`, cor: "#f87171", t: 0 }; som.alerta(); break;
        case "chefe": faixa = { texto: "O CHEFÃO CHEGOU!", cor: "#ef4444", t: 0 }; som.maldicao(); break;
        case "salvo": som.moeda(); faixa = { texto: "Sobrevivente salvo! +300", cor: "#86efac", t: 0 }; break;
        case "civilMorreu": som.morte(); break;
        case "fim": if (ev.venceu) som.vitoria(); break;
      }
    }
    if (tiros) som.clique();
  }

  function zumbi(x: number, y: number, tipo: keyof typeof COR_ZUMBI, hp: number, hpMax: number, rumo: number) {
    const r = (tipo === "chefe" ? 1 : tipo === "bruto" ? 0.5 : 0.36) * t;
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(rumo);
    // Braços esticados para a frente, corpo e cabeça.
    ctx.fillStyle = COR_ZUMBI[tipo];
    ctx.fillRect(r * 0.3, -r * 0.75, r * 0.9, r * 0.28);
    ctx.fillRect(r * 0.3, r * 0.47, r * 0.9, r * 0.28);
    ctx.fillStyle = tipo === "chefe" ? "#450a0a" : "#3f3f46";
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COR_ZUMBI[tipo];
    ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(r * 0.35, -r * 0.25, r * 0.14, r * 0.14);
    ctx.fillRect(r * 0.35, r * 0.11, r * 0.14, r * 0.14);
    ctx.restore();
    if (hpMax > 1 && hp < hpMax) {
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(X(x) - r, Y(y) - r * 1.5, r * 2, 4);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(X(x) - r, Y(y) - r * 1.5, r * 2 * Math.max(0, hp / hpMax), 4);
    }
  }

  function cenarioFundo(e: EstadoHorda) {
    ctx.fillStyle = tema.chao;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = tema.chao2;
    for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) if ((x * 7 + y * 13) % 5 === 0) ctx.fillRect(X(x), Y(y), t, t);
    // Piso da casa, paredes, portas com tábuas e bancadas.
    ctx.fillStyle = tema.piso;
    ctx.fillRect(X(CASA.x0), Y(CASA.y0), (CASA.x1 - CASA.x0) * t, (CASA.y1 - CASA.y0) * t);
    ctx.fillStyle = tema.parede;
    for (const [a, b, c, d] of PAREDES) ctx.fillRect(X(a), Y(b), (c - a) * t, (d - b) * t);
    PORTAS.forEach((p, i) => {
      const n = e.tabuas[i];
      for (let k = 0; k < TABUAS_MAX; k++) {
        ctx.fillStyle = k < n ? "#a16207" : "rgba(161,98,7,.12)";
        if (p.eixo === "h") ctx.fillRect(X(p.x - 1.05 + k * 0.42), Y(p.y - 0.18), t * 0.36, t * 0.36);
        else ctx.fillRect(X(p.x - 0.18), Y(p.y - 1.05 + k * 0.42), t * 0.36, t * 0.36);
      }
    });
    for (const b of BANCADAS) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(X(b.x - 0.7), Y(b.y - 0.4), t * 1.4, t * 0.8);
      ctx.strokeStyle = "#facc15"; ctx.lineWidth = 1.5;
      ctx.strokeRect(X(b.x - 0.7), Y(b.y - 0.4), t * 1.4, t * 0.8);
      ctx.fillStyle = "#fde68a";
      ctx.font = `800 ${Math.max(8, t * 0.32)}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`${NOME_BANCADA[b.tipo]} $${b.tipo === "arma" ? "500/900" : PRECO[b.tipo]}`, X(b.x), Y(b.y));
    }
  }

  function escuridao(e: EstadoHorda) {
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, w, h);
    lctx.fillStyle = tema.escuro;
    lctx.fillRect(0, 0, w, h);
    lctx.globalCompositeOperation = "destination-out";
    // Lâmpada fraca dentro da casa.
    const g0 = lctx.createRadialGradient(X(18), Y(11), t, X(18), Y(11), t * 7);
    g0.addColorStop(0, "rgba(0,0,0,.65)"); g0.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g0;
    lctx.fillRect(0, 0, w, h);
    for (const j of e.jogadores) {
      if (j.estado !== "vivo") continue;
      // Lanterna: cone para onde mira e um halo em volta.
      const ang = Math.atan2(j.mira.y, j.mira.x);
      const g = lctx.createRadialGradient(X(j.x), Y(j.y), t * 0.5, X(j.x), Y(j.y), t * 9);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.moveTo(X(j.x), Y(j.y));
      lctx.arc(X(j.x), Y(j.y), t * 9, ang - 0.5, ang + 0.5);
      lctx.closePath();
      lctx.fill();
      const g2 = lctx.createRadialGradient(X(j.x), Y(j.y), 0, X(j.x), Y(j.y), t * 2.2);
      g2.addColorStop(0, "rgba(0,0,0,.95)"); g2.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g2;
      lctx.fillRect(X(j.x - 2.5), Y(j.y - 2.5), t * 5, t * 5);
    }
    for (const f of flashes) {
      const g = lctx.createRadialGradient(X(f.x), Y(f.y), 0, X(f.x), Y(f.y), t * 3);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g;
      lctx.fillRect(X(f.x - 3), Y(f.y - 3), t * 6, t * 6);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(luz, 0, 0);
    ctx.restore();
  }

  return {
    iniciarRodada() {
      estado = novaPartidaHorda({ modo, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      anteriores = estado.jogadores.map(j => ({ x: j.x, y: j.y }));
      parts.length = 0; textos.length = 0; flashes.length = 0; faixa = null; pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      if (e.terminado) return { vencedor: e.vencedor, pontos: e.jogadores.map(j => pontosHorda(e, j)) };
      anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      passoHorda(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? { vencedor: e.vencedor, pontos: e.jogadores.map(j => pontosHorda(e, j)) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      cenarioFundo(e);
      // Sobreviventes do resgate.
      for (const c of e.civis) {
        if (c.hp <= 0) continue;
        ctx.fillStyle = c.salvo ? "rgba(134,239,172,.5)" : "#fbbf24";
        ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), t * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.max(9, t * 0.4)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("!", X(c.x), Y(c.y - 0.6));
      }
      for (const z of e.zumbis) {
        const alvo = e.jogadores.filter(j => j.estado === "vivo").sort((a, b) => Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y))[0];
        zumbi(z.x, z.y, z.tipo, z.hp, z.hpMax, alvo ? Math.atan2(alvo.y - z.y, alvo.x - z.x) : 0);
      }
      // Balas.
      ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 2;
      for (const b of e.balas) { ctx.beginPath(); ctx.moveTo(X(b.x), Y(b.y)); ctx.lineTo(X(b.x - b.vx * 0.8), Y(b.y - b.vy * 0.8)); ctx.stroke(); }
      // Jogadores (corpo inteiro), barra de vida e o progresso de consertar/levantar.
      const ativo = fase === "jogando";
      const ordem = [...e.jogadores].sort((a, b) => a.y - b.y);
      for (const j of ordem) {
        if (j.estado === "fora") continue;
        const a = anteriores[j.id] ?? j;
        const px = ativo ? a.x + (j.x - a.x) * alfa : j.x, py = ativo ? a.y + (j.y - a.y) * alfa : j.y;
        const dir = Math.abs(j.mira.x) > Math.abs(j.mira.y) ? (j.mira.x > 0 ? "direita" : "esquerda") : j.mira.y > 0 ? "baixo" : "cima";
        const cor = CORES_JOGADORES[j.id % 8];
        ctx.fillStyle = `${cor}55`;
        ctx.beginPath(); ctx.ellipse(X(px), Y(py) + t * 0.3, t * 0.45, t * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = j.estado === "caido" ? 0.5 : 1;
        const comemora = (fase === "fimRodada" || fase === "fimPartida") && (vencedor === j.id || e.venceram);
        desenharCorpo(ctx, folhas[j.id], dir, comemora ? "vitoria" : j.estado === "vivo" && ativo && (Math.abs(j.x - a.x) + Math.abs(j.y - a.y) > 0.001) ? "andando" : "parado", tempo + j.id * 0.3, X(px), Y(py) + t * 0.35, t * 1.5);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(0,0,0,.6)";
        ctx.fillRect(X(px) - t * 0.5, Y(py) - t * 1.35, t, 4);
        ctx.fillStyle = j.estado === "caido" ? "#f87171" : "#4ade80";
        ctx.fillRect(X(px) - t * 0.5, Y(py) - t * 1.35, t * (j.estado === "caido" ? Math.max(0, (j.sangraAte - e.passo) / 1800) : j.hp / j.hpMax), 4);
        if (j.acao) {
          const prog = Math.min(1, (e.passo - j.acao.desde) / (j.acao.tipo === "reviver" ? 120 : 30));
          ctx.strokeStyle = "#facc15"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(X(px), Y(py) - t * 0.4, t * 0.6, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
        }
      }
      // Partículas, textos e flashes.
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t > p.vida) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
        ctx.fillStyle = p.cor; ctx.globalAlpha = 1 - p.t / p.vida;
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r * t, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].t += dt; if (flashes[i].t > 0.06) flashes.splice(i, 1); }
      escuridao(e);
      for (const f of flashes) { ctx.fillStyle = "rgba(253,230,138,.9)"; ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), t * 0.18, 0, Math.PI * 2); ctx.fill(); }
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = textos.length - 1; i >= 0; i--) {
        const x = textos[i];
        x.t += dt;
        if (x.t > 1.1) { textos.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - x.t / 1.1;
        ctx.font = `900 ${Math.max(10, t * 0.5)}px system-ui, sans-serif`;
        ctx.fillStyle = x.cor;
        ctx.fillText(x.texto, X(x.x), Y(x.y - 0.8 - x.t));
      }
      ctx.globalAlpha = 1;
      // Topo: onda, zumbis e intervalo.
      ctx.fillStyle = "rgba(2,6,23,.65)";
      ctx.fillRect(0, 0, w, Math.max(22, t * 0.9));
      ctx.font = `800 ${Math.max(11, t * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = "left"; ctx.fillStyle = "#fecaca";
      const restam = e.zumbis.length + e.paraSurgir;
      const meta = e.modo === "ondas" ? ` de ${e.meta}` : e.modo === "chefe" ? " (chefe na 4ª)" : "";
      ctx.fillText(e.fase === "intervalo" ? `Próxima onda em ${Math.max(0, Math.ceil((e.faseAte - e.passo) / 60))} s · conserte as portas e compre nas bancadas` : `Onda ${e.onda}${meta} · ${restam} zumbi${restam === 1 ? "" : "s"}`, 8, Math.max(11, t * 0.45));
      if (e.modo === "resgate") {
        ctx.textAlign = "right";
        ctx.fillText(`Salvos ${e.civis.filter(c => c.salvo).length}/${e.civis.length}`, w - 8, Math.max(11, t * 0.45));
      }
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 2.2) faixa = null;
        else {
          ctx.globalAlpha = Math.min(1, (2.2 - faixa.t) * 2);
          ctx.textAlign = "center";
          ctx.font = `900 ${Math.max(16, t * 1.1)}px system-ui, sans-serif`;
          ctx.lineWidth = 5; ctx.strokeStyle = "rgba(2,6,23,.9)";
          ctx.strokeText(faixa.texto, w / 2, h * 0.3);
          ctx.fillStyle = faixa.cor;
          ctx.fillText(faixa.texto, w / 2, h * 0.3);
          ctx.globalAlpha = 1;
        }
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.floor(e.passo / 60),
        alerta: e.jogadores.some(j => j.estado === "caido"),
        jogadores: e.jogadores.map(j => ({
          vivo: j.estado === "vivo",
          texto: j.estado === "caido" ? "caído!" : j.estado === "fora" ? "fora" : `❤${Math.ceil(j.hp)} · $${j.dinheiro} · ${j.abates}☠`,
        })),
      };
    },
    redimensionar,
    destruir() { canvas.remove(); },
    quadro() {
      return estado ? serializar({ ...estado, eventos: [] }) : null;
    },
    tirarEventos() {
      const l = pendentes.map(x => serializar(x));
      pendentes = [];
      return l;
    },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoHorda | null;
      if (!e || !Array.isArray(e.jogadores)) return;
      if (estado && e.passo < estado.passo) { parts.length = 0; textos.length = 0; faixa = null; }
      anteriores = (estado ?? e).jogadores.map(j => ({ x: j.x, y: j.y }));
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoHorda[];
      efeitosDoPasso(e);
    },
  };
}
