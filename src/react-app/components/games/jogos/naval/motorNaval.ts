import type { Entrada } from "@/react-app/utils/games/bombas";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import {
  LIMITE_BATALHA, LIMITE_CACADA, N, TEMPO_VEZ, casasDaCruz, coordenadas, naviosDePe, novaPartidaNaval, passoNaval, pontosNaval,
  type EstadoNaval, type ModoNaval,
} from "@/react-app/utils/games/naval";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const TEMAS_NAVAL = {
  oceano: { nome: "Mar aberto", fundo: ["#0c4a6e", "#082f49"], casa: "#0e5a86", linha: "rgba(186,230,253,.18)", onda: "rgba(186,230,253,.10)" },
  noite: { nome: "Noite de radar", fundo: ["#052e16", "#020617"], casa: "#064e3b", linha: "rgba(134,239,172,.22)", onda: "rgba(134,239,172,.10)" },
  artico: { nome: "Ártico", fundo: ["#1e3a5f", "#0f172a"], casa: "#335b84", linha: "rgba(241,245,249,.25)", onda: "rgba(241,245,249,.12)" },
} as const;
export type TemaNaval = keyof typeof TEMAS_NAVAL;

interface Particula { x: number; y: number; vx: number; vy: number; t: number; vida: number; cor: string; r: number }

/**
 * Motor da Guerra Naval (canvas 2D): uma grade por frota no mar animado, com a mira de quem está na vez, fumaça e
 * fogo nos acertos, respingo na água, o casco dos navios afundados e, no fim, todas as frotas reveladas.
 */
export function criarMotorNaval(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoNaval, tema: TemaNaval, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Mar da Guerra Naval");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const t = TEMAS_NAVAL[tema];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoNaval | null = null;
  let pendentes: unknown[] = [];
  /** No celular de quem joga, a própria frota aparece (em nenhum outro lugar). */
  const minha = vagas.findIndex(v => v.privada);
  let w = 0, h = 0, tempo = 0, tremor = 0;
  const parts: Particula[] = [];
  const avisos: { texto: string; cor: string; t: number; frota: number }[] = [];
  let faixa: { texto: string; cor: string; t: number } | null = null;

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

  /** Posição de cada grade: linhas e colunas que deixam as casas maiores. */
  function layout(e: EstadoNaval) {
    const k = e.frotas.length;
    let melhor = { cols: 1, rows: 1, cel: 0 };
    for (let cols = 1; cols <= k; cols++) {
      const rows = Math.ceil(k / cols);
      const cel = Math.min((w - 16) / cols / (N + 0.8), (h - 70) / rows / (N + 2.2));
      if (cel > melhor.cel) melhor = { cols, rows, cel };
    }
    const cel = Math.floor(melhor.cel);
    const gw = cel * N, bw = cel * (N + 0.8), bh = cel * (N + 2.2);
    const x0 = (w - bw * melhor.cols) / 2, y0 = 60 + (h - 66 - bh * melhor.rows) / 2;
    return e.frotas.map((_f, i) => {
      const linha = Math.floor(i / melhor.cols), col = i % melhor.cols;
      const naLinha = Math.min(melhor.cols, k - linha * melhor.cols);
      const desloc = (melhor.cols - naLinha) * bw / 2;
      return { x: x0 + desloc + col * bw + cel * 0.4, y: y0 + linha * bh + cel * 1.8, cel, gw };
    });
  }

  function centroCasa(e: EstadoNaval, fi: number, c: number) {
    const g = layout(e)[fi];
    const [x, y] = coordenadas(c);
    return { x: g.x + (x + 0.5) * g.cel, y: g.y + (y + 0.5) * g.cel, cel: g.cel };
  }

  function explodir(x: number, y: number, cel: number, fogo: boolean) {
    const n = fogo ? 26 : 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.5 + Math.random()) * cel * (fogo ? 3 : 2.2);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - cel * 2, t: 0, vida: 0.5 + Math.random() * 0.5,
        cor: fogo ? ["#fde047", "#f97316", "#ef4444", "#78716c"][i % 4] : ["#e0f2fe", "#bae6fd", "#ffffff"][i % 3], r: cel * (0.08 + Math.random() * 0.12) });
    }
  }

  function tratarEventos(e: EstadoNaval) {
    for (const ev of e.eventos) {
      if (ev.tipo === "agua") { const p = centroCasa(e, ev.frota, ev.casa); explodir(p.x, p.y, p.cel, false); som.chute(); }
      else if (ev.tipo === "acerto") {
        const p = centroCasa(e, ev.frota, ev.casa);
        explodir(p.x, p.y, p.cel, true);
        som.explosao(0.6);
        tremor = Math.max(tremor, 0.15);
        const dono = e.frotas[ev.frota].dono;
        if (dono !== null) ganchos.vibrarLocal(dono, 80);
      } else if (ev.tipo === "afundou") {
        const nome = ev.nome;
        avisos.push({ texto: `${nome} afundou!`, cor: CORES_JOGADORES[ev.jogador % 8], t: 0, frota: ev.frota });
        som.explosao(1);
        tremor = 0.4;
      } else if (ev.tipo === "eliminada") {
        const dono = e.frotas[ev.frota].dono;
        if (dono !== null) { ganchos.morte(dono); faixa = { texto: `Frota de ${vagas[dono].nome} afundada!`, cor: CORES_JOGADORES[dono % 8], t: 0 }; }
        som.morte();
      } else if (ev.tipo === "sonar") {
        avisos.push({ texto: ev.n ? `Sonar: ${ev.n} parte${ev.n > 1 ? "s" : ""} de navio` : "Sonar: nada aqui", cor: "#67e8f9", t: 0, frota: ev.frota });
        som.escudo();
      } else if (ev.tipo === "vez") {
        if (e.modo !== "cacada") faixa = { texto: `Vez de ${vagas[ev.jogador].nome}`, cor: CORES_JOGADORES[ev.jogador % 8], t: 0 };
        if (!vagas[ev.jogador].bot) { som.clique(); ganchos.vibrarLocal(ev.jogador, [40, 40, 40]); }
      } else if (ev.tipo === "invalido") som.alerta();
      else if (ev.tipo === "fim") { if (ev.vencedor !== null) som.vitoria(); }
    }
  }

  function desenharMar(dt: number) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, t.fundo[0]);
    g.addColorStop(1, t.fundo[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = t.onda;
    ctx.lineWidth = 2;
    for (let y = 20; y < h; y += 26) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const yy = y + Math.sin(x / 40 + tempo * 1.4 + y) * 4;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    void dt;
  }

  /** Casco simples de navio (vista de cima) sobre as casas. */
  function casco(x: number, y: number, tam: number, hor: boolean, cel: number, cor: string) {
    const L = tam * cel - cel * 0.2, A = cel * 0.62;
    ctx.save();
    ctx.translate(x, y);
    if (!hor) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(-L / 2 + A / 2, -A / 2);
    ctx.lineTo(L / 2 - A * 0.6, -A / 2);
    ctx.quadraticCurveTo(L / 2, 0, L / 2 - A * 0.6, A / 2);
    ctx.lineTo(-L / 2 + A / 2, A / 2);
    ctx.quadraticCurveTo(-L / 2, 0, -L / 2 + A / 2, -A / 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.25)";
    for (let k = 0; k < tam - 1; k++) ctx.fillRect(-L / 2 + cel * (0.6 + k), -A * 0.18, cel * 0.35, A * 0.36);
    ctx.restore();
  }

  function desenharGrade(e: EstadoNaval, fi: number, g: { x: number; y: number; cel: number; gw: number }, fase: FasePartida, vencedor: number | null) {
    const f = e.frotas[fi];
    const { x, y, cel, gw } = g;
    const dono = f.dono;
    const ehVez = e.modo !== "cacada" && dono === e.vez && !e.terminado;
    const alvoAtual = !e.terminado && e.cursor.frota === fi && e.tirosNaVez > 0 && e.passo >= e.esperaAte;
    // Cabeçalho: corpo do dono, nome e navios de pé.
    ctx.textBaseline = "middle";
    if (dono !== null) {
      const cor = CORES_JOGADORES[dono % 8];
      const comemora = (fase === "fimRodada" || fase === "fimPartida") && vencedor === dono;
      desenharCorpo(ctx, folhas[dono], "baixo", comemora ? "vitoria" : "parado", tempo + dono * 0.4, x + cel * 0.6, y - cel * 0.15, cel * 1.6);
      ctx.fillStyle = cor;
      ctx.font = `700 ${Math.max(11, cel * 0.5)}px system-ui, sans-serif`;
      ctx.fillText(`${vagas[dono].nome}${ehVez ? "  ◀ na vez" : ""}`, x + cel * 1.4, y - cel * 1.1);
    } else {
      ctx.fillStyle = "#e0f2fe";
      ctx.font = `700 ${Math.max(11, cel * 0.5)}px system-ui, sans-serif`;
      ctx.fillText("Frota inimiga escondida", x, y - cel * 1.1);
    }
    // Ícones dos navios (riscados quando afundam).
    f.navios.forEach((n, k) => {
      const ix = x + cel * 1.4 + k * cel * 1.25, iy = y - cel * 0.45;
      ctx.fillStyle = n.afundado ? "rgba(248,113,113,.5)" : "#e2e8f0";
      for (let p = 0; p < n.tam; p++) ctx.fillRect(ix + p * cel * 0.2, iy - cel * 0.1, cel * 0.17, cel * 0.2);
    });
    // Moldura (brilha para quem é o alvo da mira; dourada para a vez).
    ctx.save();
    ctx.globalAlpha = f.viva ? 1 : 0.45;
    ctx.fillStyle = t.casa;
    ctx.fillRect(x, y, gw, gw);
    ctx.strokeStyle = alvoAtual ? CORES_JOGADORES[e.vez % 8] : ehVez ? "#fbbf24" : "rgba(255,255,255,.35)";
    ctx.lineWidth = alvoAtual ? 3 : 2;
    ctx.strokeRect(x - 1, y - 1, gw + 2, gw + 2);
    ctx.strokeStyle = t.linha;
    ctx.lineWidth = 1;
    for (let k = 1; k < N; k++) {
      ctx.beginPath(); ctx.moveTo(x + k * cel, y); ctx.lineTo(x + k * cel, y + gw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + k * cel); ctx.lineTo(x + gw, y + k * cel); ctx.stroke();
    }
    // Navios afundados e, no fim, todos.
    const revelar = e.terminado;
    f.navios.forEach(n => {
      if (!n.afundado && !revelar && !(f.dono === minha && n.casas.length)) return;
      const [ax, ay] = coordenadas(n.casas[0]);
      const hor = n.casas.length > 1 && n.casas[1] - n.casas[0] === 1;
      const cx = x + (ax + (hor ? n.tam / 2 : 0.5)) * cel, cy = y + (ay + (hor ? 0.5 : n.tam / 2)) * cel;
      casco(cx, cy, n.tam, hor, cel, n.afundado ? "#3f3f46" : revelar ? "#94a3b8" : "rgba(148,163,184,.55)");
    });
    // Tiros.
    f.tiros.forEach((s, c) => {
      if (!s) return;
      const [cx, cy] = coordenadas(c);
      const px = x + (cx + 0.5) * cel, py = y + (cy + 0.5) * cel;
      if (s === 1) {
        ctx.strokeStyle = "rgba(255,255,255,.75)";
        ctx.lineWidth = Math.max(1, cel * 0.07);
        ctx.beginPath(); ctx.arc(px, py, cel * 0.16, 0, Math.PI * 2); ctx.stroke();
      } else {
        const tremula = 0.75 + Math.sin(tempo * 12 + c) * 0.25;
        ctx.fillStyle = s === 3 ? "rgba(127,29,29,.85)" : `rgba(239,68,68,${tremula})`;
        ctx.beginPath(); ctx.arc(px, py, cel * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(253,224,71,${s === 3 ? 0.4 : tremula})`;
        ctx.beginPath(); ctx.arc(px, py - cel * 0.05, cel * 0.13, 0, Math.PI * 2); ctx.fill();
        // Fumaça subindo.
        ctx.fillStyle = "rgba(120,113,108,.35)";
        const fy = (tempo * 0.8 + c * 0.37) % 1;
        ctx.beginPath(); ctx.arc(px + Math.sin(tempo + c) * cel * 0.1, py - fy * cel * 0.8, cel * (0.1 + fy * 0.15), 0, Math.PI * 2); ctx.fill();
      }
    });
    // Leituras do sonar.
    for (const s of f.sonar) {
      const [sx, sy] = coordenadas(s.c);
      ctx.strokeStyle = "rgba(103,232,249,.8)";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + (sx - 1) * cel, y + (sy - 1) * cel, cel * 3, cel * 3);
      ctx.setLineDash([]);
      ctx.fillStyle = "#67e8f9";
      ctx.font = `800 ${cel * 0.55}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(s.n), x + (sx + 0.5) * cel, y + (sy + 0.5) * cel);
      ctx.textAlign = "left";
    }
    ctx.restore();
    // Mira.
    if (alvoAtual) {
      const cor = CORES_JOGADORES[e.vez % 8];
      const c0 = e.cursor.y * N + e.cursor.x;
      const casas = e.arma === "cruz" ? casasDaCruz(c0) : e.arma === "sonar" ? casas3(c0) : [c0];
      ctx.fillStyle = `${cor}55`;
      for (const c of casas) { const [cx, cy] = coordenadas(c); ctx.fillRect(x + cx * cel, y + cy * cel, cel, cel); }
      const px = x + (e.cursor.x + 0.5) * cel, py = y + (e.cursor.y + 0.5) * cel;
      const r = cel * (0.42 + Math.sin(tempo * 8) * 0.05);
      ctx.strokeStyle = cor;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - r * 1.4, py); ctx.lineTo(px - r * 0.5, py);
      ctx.moveTo(px + r * 0.5, py); ctx.lineTo(px + r * 1.4, py);
      ctx.moveTo(px, py - r * 1.4); ctx.lineTo(px, py - r * 0.5);
      ctx.moveTo(px, py + r * 0.5); ctx.lineTo(px, py + r * 1.4);
      ctx.stroke();
    }
    if (!f.viva) {
      ctx.fillStyle = "rgba(248,113,113,.95)";
      ctx.font = `900 ${cel * 0.9}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("AFUNDADA", x + gw / 2, y + gw / 2);
      ctx.textAlign = "left";
    }
  }

  function casas3(c: number) {
    const [cx, cy] = coordenadas(c);
    const l: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (cx + dx >= 0 && cy + dy >= 0 && cx + dx < N && cy + dy < N) l.push((cy + dy) * N + cx + dx);
    return l;
  }

  return {
    iniciarRodada() {
      estado = novaPartidaNaval({ modo, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      parts.length = 0;
      avisos.length = 0;
      faixa = null;
      pendentes = [];
      tratarEventos(estado);
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e || e.terminado) return e?.terminado ? { vencedor: e.vencedor, pontos: e.jogadores.map(j => pontosNaval(e, j)) } : null;
      passoNaval(e, entradas);
      tratarEventos(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      if (e.terminado) return { vencedor: e.vencedor, pontos: e.jogadores.map(j => pontosNaval(e, j)) };
      return null;
    },
    desenhar(_alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      tremor = Math.max(0, tremor - dt);
      ctx.save();
      if (tremor > 0) ctx.translate((Math.random() - 0.5) * tremor * 14, (Math.random() - 0.5) * tremor * 14);
      desenharMar(dt);
      const grades = layout(e);
      e.frotas.forEach((_f, i) => desenharGrade(e, i, grades[i], fase, vencedor));
      // Partículas.
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t > p.vida) { parts.splice(i, 1); continue; }
        p.vy += 900 * dt * 0.4;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.t / p.vida;
        ctx.fillStyle = p.cor;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Barra do topo: vez, arma e tempo.
      const j = e.jogadores[e.vez];
      ctx.fillStyle = "rgba(2,6,23,.6)";
      ctx.fillRect(0, 0, w, 52);
      ctx.textBaseline = "middle";
      ctx.font = "800 18px system-ui, sans-serif";
      ctx.fillStyle = CORES_JOGADORES[e.vez % 8];
      const resto = Math.max(0, TEMPO_VEZ * (e.modo === "salva" ? 2 : 1) - (e.passo - e.inicioVez));
      const quem = e.modo === "cacada" ? `Tiros: ${j.tiros}/${LIMITE_CACADA}` : `${vagas[e.vez].nome}${j.bot ? " (bot)" : ""}`;
      const extra = e.modo === "salva" ? ` · salva: ${e.tirosNaVez} tiro${e.tirosNaVez === 1 ? "" : "s"}` : "";
      const arma = e.modo === "especiais" ? ` · arma: ${e.arma === "tiro" ? "tiro" : e.arma === "sonar" ? `sonar (${j.especiais.sonar})` : `cruz (${j.especiais.cruz})`}` : "";
      ctx.fillText(`${quem}${extra}${arma}`, 16, 26);
      if (e.modo !== "cacada") {
        const seg = Math.max(0, Math.ceil((LIMITE_BATALHA - e.passo) / 60));
        const estreita = w < 760;
        ctx.font = `700 ${estreita ? 11 : 14}px system-ui, sans-serif`;
        ctx.textAlign = estreita ? "left" : "center";
        ctx.fillStyle = seg <= 60 ? "#f87171" : "rgba(226,232,240,.8)";
        ctx.fillText(`Batalha: ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}${seg <= 60 ? " · depois vence a frota mais inteira" : ""}`, estreita ? 16 : w / 2, estreita ? 45 : 26);
        ctx.textAlign = "left";
      }
      if (e.modo !== "cacada" && !j.bot && !e.terminado) {
        ctx.fillStyle = "rgba(255,255,255,.15)";
        ctx.fillRect(w - 216, 20, 200, 12);
        ctx.fillStyle = resto < 300 ? "#f87171" : "#fbbf24";
        ctx.fillRect(w - 216, 20, 200 * (resto / (TEMPO_VEZ * (e.modo === "salva" ? 2 : 1))), 12);
      }
      // Avisos sobre as grades.
      for (let i = avisos.length - 1; i >= 0; i--) {
        const a = avisos[i];
        a.t += dt;
        if (a.t > 2.2) { avisos.splice(i, 1); continue; }
        const g = grades[a.frota];
        ctx.globalAlpha = Math.min(1, (2.2 - a.t) * 2);
        ctx.font = `900 ${Math.max(14, g.cel * 0.7)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(2,6,23,.85)";
        const ty = g.y + g.gw / 2 - a.t * 18;
        ctx.strokeText(a.texto, g.x + g.gw / 2, ty);
        ctx.fillStyle = a.cor;
        ctx.fillText(a.texto, g.x + g.gw / 2, ty);
        ctx.textAlign = "left";
      }
      ctx.globalAlpha = 1;
      if (faixa) {
        faixa.t += dt;
        if (faixa.t > 1.6) faixa = null;
        else {
          ctx.globalAlpha = Math.min(1, (1.6 - faixa.t) * 3);
          ctx.font = "900 22px system-ui, sans-serif";
          ctx.textAlign = "right";
          ctx.fillStyle = faixa.cor;
          ctx.fillText(faixa.texto, w - (e.modo !== "cacada" && !j.bot ? 232 : 16), 26);
          ctx.textAlign = "left";
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        // Sozinho: tempo corrido; com rivais: segundos que restam da vez.
        tempo: e.modo === "cacada" ? Math.floor(e.passo / 60)
          : Math.max(0, Math.ceil((TEMPO_VEZ * (e.modo === "salva" ? 2 : 1) - (e.passo - e.inicioVez)) / 60)),
        alerta: e.passo - e.inicioVez > TEMPO_VEZ - 300,
        jogadores: e.jogadores.map(j => {
          if (j.frota === null) return { vivo: true, texto: `${j.tiros}/${LIMITE_CACADA} tiros` };
          const f = e.frotas[j.frota];
          return { vivo: f.viva, texto: f.viva ? `${naviosDePe(f)} navios · ${j.acertos} acertos` : "afundada" };
        }),
      };
    },
    redimensionar,
    quadro(para: number) {
      const e = estado;
      if (!e) return null;
      // Navios inteiros dos outros ficam escondidos (só a própria frota e os afundados vão; no fim, todos).
      const frotas = e.frotas.map(f => (e.terminado || f.dono === para ? f
        : { ...f, navios: f.navios.map(n => (n.afundado ? n : { ...n, casas: [] })) }));
      return serializar({ ...e, frotas, eventos: [] });
    },
    tirarEventos() {
      const l = pendentes.map(x => serializar(x));
      pendentes = [];
      return l;
    },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoNaval | null;
      if (!e || !Array.isArray(e.frotas)) return;
      if (estado && e.passo < estado.passo) { parts.length = 0; avisos.length = 0; faixa = null; }
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EstadoNaval["eventos"];
      tratarEventos(e);
    },
    destruir() { canvas.remove(); },
  };
}
