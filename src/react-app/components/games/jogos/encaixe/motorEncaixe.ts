import type { Entrada } from "@/react-app/utils/games/bombas";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import {
  ALTURA, ESCONDIDAS, LARGURA, LIXO, META_MARATONA, META_SPRINT, TIPOS, alturaDeQueda, celulasDaPeca, nivelDe, novaPartidaEncaixe, passoEncaixe,
  segundosRestantesEncaixe, type EstadoEncaixe, type ModoEncaixe, type TipoPeca,
} from "@/react-app/utils/games/encaixe";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

/** Cores neon das peças (I, O, T, S, Z, J, L) e do lixo. */
export const CORES_PECAS = ["#22d3ee", "#facc15", "#a855f7", "#22c55e", "#ef4444", "#3b82f6", "#f97316", "#64748b"];

export const TEMAS_ENCAIXE = {
  noite: { nome: "Noite neon", fundo: "#0a0a1a", grade: "rgba(148,163,184,.08)", moldura: "#7c3aed" },
  arcade: { nome: "Arcade", fundo: "#111827", grade: "rgba(250,204,21,.07)", moldura: "#f59e0b" },
  oceano: { nome: "Oceano", fundo: "#04131f", grade: "rgba(56,189,248,.09)", moldura: "#0ea5e9" },
} as const;
export type TemaEncaixe = keyof typeof TEMAS_ENCAIXE;

function bloco(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cor: string, alfa = 1) {
  ctx.globalAlpha = alfa;
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, t, t);
  const b = Math.max(1, t * 0.16);
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(x, y, t, b);
  ctx.fillRect(x, y, b, t);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.fillRect(x, y + t - b, t, b);
  ctx.fillRect(x + t - b, y, b, t);
  ctx.globalAlpha = 1;
}

function miniPeca(ctx: CanvasRenderingContext2D, tipo: TipoPeca, cx: number, cy: number, t: number, alfa = 1) {
  const cels = celulasDaPeca(tipo, 0, 0, 0);
  const xs = cels.map(c => c[0]), ys = cels.map(c => c[1]);
  const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
  for (const [x, y] of cels) bloco(ctx, cx + (x - Math.min(...xs) - w / 2) * t, cy + (y - Math.min(...ys) - h / 2) * t, t, CORES_PECAS[TIPOS.indexOf(tipo)], alfa);
}

/**
 * Motor do Encaixe Versus (canvas 2D): até 8 tabuleiros lado a lado, cada um com o avatar de corpo inteiro, a peça
 * guardada, as próximas, o fantasma, a barra de lixo chegando, o flash das linhas limpas e o "K.O." de quem caiu.
 */
export function criarMotorEncaixe(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoEncaixe, tema: TemaEncaixe, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Tabuleiros do Encaixe Versus");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const cores = TEMAS_ENCAIXE[tema];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoEncaixe | null = null;
  let pendentes: unknown[] = [];
  function efeitosDoPasso(e: EstadoEncaixe) {
    for (const ev of e.eventos) {
      switch (ev.tipo) {
        case "girou": if (!e.tabuleiros[ev.tabuleiro].bot) som.clique(); break;
        case "travou": if (!e.tabuleiros[ev.tabuleiro].bot) som.colocar(); break;
        case "linhas": {
          const nome = ["", "", "Dupla!", "Tripla!", "ENCAIXE 4!"][ev.quantas] ?? "";
          const tab = e.tabuleiros[ev.tabuleiro];
          const texto = [nome, tab.combo >= 2 ? `combo ${tab.combo}` : "", ev.ataque ? `+${ev.ataque} lixo` : ""].filter(Boolean).join(" · ");
          flashes.push({ tab: ev.tabuleiro, ys: ev.linhasY, t: 0, texto });
          if (ev.quantas >= 4) som.vitoria(); else som.moeda();
          ganchos.vibrarLocal(ev.tabuleiro, 30);
          break;
        }
        case "lixo": tremor[ev.tabuleiro] = 0.6; som.alerta(); ganchos.vibrarLocal(ev.tabuleiro, [40, 30, 40]); break;
        case "nocaute": ordemNocaute.push(ev.tabuleiro); som.morte(); ganchos.morte(ev.tabuleiro); break;
        default: break;
      }
    }
  }
  let tempo = 0;
  let w = 0, h = 0;
  const flashes: { tab: number; ys: number[]; t: number; texto: string }[] = [];
  const tremor = vagas.map(() => 0);
  const ordemNocaute: number[] = [];

  function redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, caixa.clientWidth - 8);
    h = Math.max(1, caixa.clientHeight - 8);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redimensionar();

  function desenharTabuleiro(i: number, x0: number, y0: number, t: number, fase: FasePartida, vencedor: number | null) {
    const e = estado!;
    const tab = e.tabuleiros[i];
    const cor = CORES_JOGADORES[i];
    const tx = x0 + t * 4.4 + (Math.random() - 0.5) * tremor[i] * t;
    const ty = y0 + t * 3;
    // Cabeçalho: avatar de corpo inteiro, nome e números.
    const comemora = fase === "fimPartida" || fase === "fimRodada" ? vencedor === i : false;
    desenharCorpo(ctx, folhas[i], "baixo", comemora ? "vitoria" : tab.vivo ? "parado" : "parado", tempo + i * 0.4, x0 + t * 2, ty - t * 0.2, t * 2.8);
    ctx.font = `900 ${Math.round(t * 0.85)}px system-ui`;
    ctx.textAlign = "left";
    ctx.fillStyle = cor;
    ctx.fillText(`P${i + 1}`, tx, ty - t * 1.6);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = `700 ${Math.round(t * 0.62)}px system-ui`;
    const meta = e.modo === "sprint" ? `${tab.linhas}/${META_SPRINT}` : e.modo === "maratona" ? `${tab.linhas}/${META_MARATONA} · nv ${nivelDe(tab)}` : `${tab.linhas} linhas`;
    ctx.fillText(`${vagas[i].nome} · ${meta}`, tx + t * 1.6, ty - t * 1.6);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillText(`${tab.pontos.toLocaleString("pt-BR")} pts`, tx, ty - t * 0.5);
    // Moldura e grade.
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(tx, ty, LARGURA * t, ALTURA * t);
    ctx.strokeStyle = cores.grade;
    ctx.lineWidth = 1;
    for (let gx = 1; gx < LARGURA; gx++) { ctx.beginPath(); ctx.moveTo(tx + gx * t, ty); ctx.lineTo(tx + gx * t, ty + ALTURA * t); ctx.stroke(); }
    for (let gy = 1; gy < ALTURA; gy++) { ctx.beginPath(); ctx.moveTo(tx, ty + gy * t); ctx.lineTo(tx + LARGURA * t, ty + gy * t); ctx.stroke(); }
    ctx.strokeStyle = cor;
    ctx.lineWidth = Math.max(2, t * 0.14);
    ctx.shadowColor = cor;
    ctx.shadowBlur = t * 0.8;
    ctx.strokeRect(tx - 1, ty - 1, LARGURA * t + 2, ALTURA * t + 2);
    ctx.shadowBlur = 0;
    // Blocos parados.
    for (let y = ESCONDIDAS; y < tab.grade.length; y++) {
      for (let x = 0; x < LARGURA; x++) {
        const c = tab.grade[y][x];
        if (c) bloco(ctx, tx + x * t, ty + (y - ESCONDIDAS) * t, t, CORES_PECAS[c === LIXO ? 7 : c - 1], tab.vivo ? 1 : 0.45);
      }
    }
    // Peça caindo e o fantasma.
    const p = tab.peca;
    if (p && tab.vivo) {
      const corP = CORES_PECAS[TIPOS.indexOf(p.tipo)];
      const fy = alturaDeQueda(tab);
      for (const [cx, cy] of celulasDaPeca(p.tipo, p.rot, p.x, fy)) {
        if (cy < ESCONDIDAS) continue;
        ctx.strokeStyle = corP;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = Math.max(1, t * 0.1);
        ctx.strokeRect(tx + cx * t + 1.5, ty + (cy - ESCONDIDAS) * t + 1.5, t - 3, t - 3);
        ctx.globalAlpha = 1;
      }
      for (const [cx, cy] of celulasDaPeca(p.tipo, p.rot, p.x, p.y)) if (cy >= ESCONDIDAS) bloco(ctx, tx + cx * t, ty + (cy - ESCONDIDAS) * t, t, corP);
    }
    // Lixo chegando (barra vermelha à esquerda).
    const pendente = tab.lixoPendente.reduce((a, b) => a + b, 0);
    if (pendente) {
      const alt = Math.min(ALTURA, pendente) * t;
      ctx.fillStyle = Math.sin(tempo * 12) > 0 ? "#ef4444" : "#f87171";
      ctx.fillRect(tx - t * 0.55, ty + ALTURA * t - alt, t * 0.35, alt);
    }
    // Guardada (esquerda) e próximas (direita).
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.font = `800 ${Math.round(t * 0.5)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("GUARDA", x0 + t * 2, ty + t * 0.9);
    if (tab.guardada) miniPeca(ctx, tab.guardada, x0 + t * 2.1, ty + t * 2.4, t * 0.7, tab.podeGuardar ? 1 : 0.35);
    const px = tx + LARGURA * t + t * 2.2;
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillText("PRÓXIMAS", px, ty + t * 0.9);
    tab.fila.slice(0, 3).forEach((tipo, k) => miniPeca(ctx, tipo, px, ty + t * (2.4 + k * 2.6), t * 0.7));
    // Flash das linhas limpas.
    for (const f of flashes) {
      if (f.tab !== i) continue;
      ctx.globalAlpha = Math.max(0, 1 - f.t / 0.35);
      ctx.fillStyle = "#ffffff";
      for (const y of f.ys) ctx.fillRect(tx, ty + (y - ESCONDIDAS) * t, LARGURA * t, t);
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
      ctx.fillStyle = "#fde047";
      ctx.font = `900 ${Math.round(t * 1.1)}px system-ui`;
      ctx.fillText(f.texto, tx + LARGURA * t / 2, ty + ALTURA * t * 0.45 - f.t * t * 2);
      ctx.globalAlpha = 1;
    }
    if (!tab.vivo) {
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(tx, ty, LARGURA * t, ALTURA * t);
      ctx.fillStyle = "#f87171";
      ctx.font = `900 ${Math.round(t * 1.8)}px system-ui`;
      ctx.fillText("K.O.", tx + LARGURA * t / 2, ty + ALTURA * t / 2);
      const pos = vagas.length - ordemNocaute.indexOf(i);
      if (ordemNocaute.includes(i)) {
        ctx.font = `800 ${Math.round(t * 0.8)}px system-ui`;
        ctx.fillStyle = "#fff";
        ctx.fillText(`${pos}º lugar`, tx + LARGURA * t / 2, ty + ALTURA * t / 2 + t * 1.4);
      }
    }
  }

  return {
    iniciarRodada() {
      estado = novaPartidaEncaixe({ modo, jogadores: vagas.map(v => ({ bot: v.bot })) });
      flashes.length = 0;
      ordemNocaute.length = 0;
      pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      passoEncaixe(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? { vencedor: e.vencedor, pontos: e.tabuleiros.map(t => t.pontos) } : null;
    },
    desenhar(_alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      for (let k = flashes.length - 1; k >= 0; k--) { flashes[k].t += dt; if (flashes[k].t > 1.2) flashes.splice(k, 1); }
      for (let k = 0; k < tremor.length; k++) tremor[k] = Math.max(0, tremor[k] - dt * 2);
      ctx.clearRect(0, 0, w, h);
      // Grade de tabuleiros: até 4 por linha; cada um ocupa 19 × 24 células.
      const n = e.tabuleiros.length;
      const colunas = n <= 4 ? n : Math.ceil(n / 2);
      const linhas = Math.ceil(n / colunas);
      const t = Math.max(6, Math.floor(Math.min(w / (colunas * 19), h / (linhas * 24))));
      const larguraTotal = colunas * 19 * t, alturaTotal = linhas * 24 * t;
      const ox = (w - larguraTotal) / 2, oy = (h - alturaTotal) / 2;
      for (let i = 0; i < n; i++) desenharTabuleiro(i, ox + (i % colunas) * 19 * t, oy + Math.floor(i / colunas) * 24 * t, t, fase, vencedor);
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      const restante = segundosRestantesEncaixe(e);
      return {
        tempo: restante,
        alerta: e.modo === "versus" && restante <= 30,
        jogadores: e.tabuleiros.map(t => ({ vivo: t.vivo, texto: t.vivo ? `${t.linhas} linhas` : "K.O." })),
      };
    },
    redimensionar,
    quadro() {
      return estado ? serializar({ ...estado, eventos: [] }) : null;
    },
    tirarEventos() {
      const l = pendentes.map(x => serializar(x));
      pendentes = [];
      return l;
    },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoEncaixe | null;
      if (!e || !Array.isArray(e.tabuleiros)) return;
      if (estado && e.passo < estado.passo) { flashes.length = 0; ordemNocaute.length = 0; }
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EstadoEncaixe["eventos"];
      efeitosDoPasso(e);
    },
    destruir() { canvas.remove(); },
  };
}
