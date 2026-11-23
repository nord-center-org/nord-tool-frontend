import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  BPM, QUEDA, acerto, gerarPartitura, multiplicador, novaPartidaRitmo, passoRitmo, pontosRitmo,
  type Andamento, type EstadoRitmo, type EventoRitmo, type ModoRitmo,
} from "@/react-app/utils/games/ritmo";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, spriteDoAvatar } from "../../central/sprites";

export const ANDAMENTOS: Record<Andamento, string> = { lento: "Lento (100 BPM)", medio: "Médio (128 BPM)", rapido: "Rápido (156 BPM)" };
const COR_TRILHA = ["#a855f7", "#22c55e", "#ef4444", "#eab308"];
const SETA = ["←", "↓", "↑", "→"];
const GRAU = ["Perfeito!", "Ótimo!", "Bom"];
// Escala pentatônica menor e a progressão de acordes por compasso (graus).
const ESCALA = [0, 3, 5, 7, 10, 12, 15, 17];
const PROGRESSAO = [0, 5, 3, 7];
const RAIZ = 110;

/** Motor da Batalha de Banda (canvas 2D): uma pista de 4 trilhas por pessoa, a música tocada no compasso das notas. */
export function criarMotorRitmo(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoRitmo, andamento: Andamento, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Palco da Batalha de Banda");
  canvas.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const avatares = vagas.map((v, i) => spriteDoAvatar(v.avatar, `ritmo-${i}-${JSON.stringify(v.avatar)}`));

  // Tela de uma pessoa só (o celular dela): só a própria pista, grande.
  const minhas = vagas.map((v, i) => ({ v, i })).filter(({ v }) => v.privada);
  const so = minhas.length === 1 ? minhas[0].i : -1;

  let estado: EstadoRitmo | null = null;
  let pendentes: unknown[] = [];
  let tempo = 0;
  let melodiaTocada = new Set<number>();
  let ultimaColcheia = -1;
  const brilho: { j: number; l: number; ate: number; cor: string }[] = [];
  const textos: { j: number; texto: string; cor: string; t: number }[] = [];
  /** Um texto por pista: o novo substitui o anterior. */
  const avisar = (j: number, texto: string, cor: string) => {
    const i = textos.findIndex(x => x.j === j);
    if (i >= 0) textos.splice(i, 1);
    textos.push({ j, texto, cor, t: 0 });
  };

  /** Bateria e baixo no compasso do jogo; a melodia sai das notas acertadas. */
  function musica(e: EstadoRitmo) {
    const batida = 3600 / e.bpm, t0 = QUEDA + 60;
    const colcheia = Math.floor((e.passo - t0) / (batida / 2));
    // No celular os quadros podem pular passos: toca a colcheia nova uma vez só.
    if (e.passo < t0 || colcheia <= ultimaColcheia) return;
    ultimaColcheia = colcheia;
    const pos = colcheia % 8, compasso = Math.floor(colcheia / 8);
    som.bateria("chimbal");
    if (pos === 0 || pos === 4 || (pos === 5 && compasso % 2)) som.bateria("bumbo");
    if (pos === 2 || pos === 6) som.bateria("caixa");
    const grau = PROGRESSAO[compasso % 4];
    if (pos % 2 === 0) som.nota((RAIZ / 2) * 2 ** ((grau + (pos === 6 ? 7 : 0)) / 12), 0.22, "triangle", 0.22);
  }
  function melodia(e: EstadoRitmo, nota: number) {
    if (melodiaTocada.has(nota)) return;
    melodiaTocada.add(nota);
    const n = e.notas[nota];
    const compasso = Math.floor((n.t - QUEDA - 60) / (3600 / e.bpm) / 4);
    const semitom = PROGRESSAO[compasso % 4] + ESCALA[(n.l * 2 + (nota % 3)) % ESCALA.length];
    som.nota(RAIZ * 2 * 2 ** (semitom / 12), n.d ? 0.6 : 0.22, "square", 0.09);
  }

  function efeitosDoPasso(e: EstadoRitmo) {
    musica(e);
    for (const ev of e.eventos as EventoRitmo[]) {
      if (ev.tipo === "acerto") {
        melodia(e, ev.nota);
        brilho.push({ j: ev.jogador, l: ev.l, ate: tempo + 0.15, cor: COR_TRILHA[ev.l] });
        if (ev.grau === 0 || so === ev.jogador || vagas.length <= 4) avisar(ev.jogador, GRAU[ev.grau], ev.grau === 0 ? "#fde047" : "#e2e8f0");
      } else if (ev.tipo === "erro") {
        if (ev.l !== null) brilho.push({ j: ev.jogador, l: ev.l, ate: tempo + 0.12, cor: "#475569" });
        if (!vagas[ev.jogador]?.bot) { som.nota(92, 0.12, "sawtooth", 0.08); ganchos.vibrarLocal(ev.jogador, 40); }
      } else if (ev.tipo === "show") { som.powerup(); avisar(ev.jogador, "SHOW!", "#38bdf8"); }
      else if (ev.tipo === "ataque") {
        som.maldicao();
        avisar(ev.alvo, ev.ataque === "neblina" ? "Neblina!" : ev.ataque === "acelera" ? "Acelerou!" : "Espelho!", "#f472b6");
        if (!vagas[ev.alvo]?.bot) ganchos.vibrarLocal(ev.alvo, [80, 40, 80]);
      } else if (ev.tipo === "vaiado") { som.morte(); ganchos.morte(ev.jogador); avisar(ev.jogador, "Vaiado…", "#94a3b8"); }
    }
  }

  function pista(e: EstadoRitmo, j: number, x0: number, y0: number, w: number, h: number, alfa: number) {
    const m = e.musicos[j];
    const cab = Math.min(56, h * 0.13);
    // Cabeçalho: avatar, nome, pontos, multiplicador, público e energia.
    ctx.fillStyle = "rgba(15,23,42,.92)";
    ctx.fillRect(x0, y0, w, cab);
    ctx.imageSmoothingEnabled = false;
    const lado = cab - 8;
    ctx.drawImage(avatares[j], x0 + 4, y0 + 4, lado, lado);
    ctx.fillStyle = CORES_JOGADORES[j % 8];
    ctx.font = `800 ${Math.max(10, cab * 0.24)}px system-ui,sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`P${j + 1}`, x0 + lado + 8, y0 + cab * 0.32);
    ctx.fillStyle = "#fff";
    ctx.fillText(`${m.pontos.toLocaleString("pt-BR")}`, x0 + lado + 8 + cab * 0.55, y0 + cab * 0.32);
    ctx.fillStyle = m.show ? "#38bdf8" : "#fde047";
    ctx.fillText(`×${multiplicador(m)}${m.combo >= 10 ? ` · ${m.combo}` : ""}`, x0 + lado + 8, y0 + cab * 0.6);
    const bx = x0 + lado + 8, bw = w - lado - 14;
    const vida = e.modo === "banda" ? e.vidaBanda : m.vida;
    barra(bx, y0 + cab * 0.68, bw, cab * 0.1, vida, vida < 0.3 ? "#ef4444" : vida < 0.55 ? "#eab308" : "#22c55e");
    barra(bx, y0 + cab * 0.82, bw * (e.modo === "duelo" ? 0.6 : 1), cab * 0.1, m.energia, m.show ? (Math.sin(tempo * 12) > 0 ? "#7dd3fc" : "#0ea5e9") : "#38bdf8");
    if (e.modo === "duelo") barra(bx + bw * 0.63, y0 + cab * 0.82, bw * 0.37, cab * 0.1, m.ataque, m.ataque >= 1 && Math.sin(tempo * 10) > 0 ? "#fbcfe8" : "#f472b6");
    // Pista.
    const py = y0 + cab + 2, ph = h - cab - 2;
    const larg = w / 4;
    // Nada da pista vaza para o cabeçalho.
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, py, w, ph); ctx.clip();
    const grad = ctx.createLinearGradient(0, py, 0, py + ph);
    grad.addColorStop(0, "#0b1020"); grad.addColorStop(1, m.show ? "#0c4a6e" : "#1e1b4b");
    ctx.fillStyle = grad;
    ctx.fillRect(x0, py, w, ph);
    const espelho = m.efeito === "espelho";
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = c % 2 ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)";
      ctx.fillRect(x0 + c * larg, py, larg, ph);
    }
    // Linha do compasso descendo.
    const batida = 3600 / e.bpm, agora = e.passo + alfa;
    const linhaY = py + ph * 0.86;
    const queda = m.efeito === "acelera" ? QUEDA * 0.55 : QUEDA;
    const yDe = (t: number) => linhaY - ((t - agora) / queda) * (linhaY - py);
    const t0 = QUEDA + 60;
    for (let k = Math.ceil((agora - t0) / batida); ; k++) {
      const y = yDe(t0 + k * batida);
      if (y < py) break;
      if (y > py + ph) continue;
      ctx.fillStyle = k % 4 === 0 ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.06)";
      ctx.fillRect(x0, y, w, k % 4 === 0 ? 2 : 1);
    }
    // Receptores.
    for (let l = 0; l < 4; l++) {
      const c = espelho ? 3 - l : l;
      const cx = x0 + c * larg + larg / 2;
      const aceso = brilho.find(b => b.j === j && b.l === l && b.ate > tempo);
      ctx.strokeStyle = COR_TRILHA[l]; ctx.lineWidth = Math.max(2, larg * 0.06);
      ctx.fillStyle = aceso ? aceso.cor : "rgba(0,0,0,.35)";
      ctx.beginPath(); ctx.arc(cx, linhaY, larg * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.font = `900 ${larg * 0.34}px system-ui,sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(SETA[espelho ? 3 - l : l], cx, linhaY + 1);
    }
    // Notas.
    for (let i = Math.max(0, m.proxima - 4); i < e.notas.length; i++) {
      const n = e.notas[i];
      const y = yDe(n.t);
      if (y < py - 40) break;
      const r = m.res[i];
      if (r >= 1 && r <= 3 && !n.d) continue;
      const c = espelho ? 3 - n.l : n.l;
      const cx = x0 + c * larg + larg / 2;
      if (n.d) {
        const yf = Math.max(py, yDe(n.t + n.d));
        const segurando = m.segurando === i;
        ctx.fillStyle = r === 4 ? "rgba(71,85,105,.6)" : segurando ? "#fff" : COR_TRILHA[n.l];
        ctx.globalAlpha = r === 1 && !segurando ? 0.25 : 0.7;
        ctx.fillRect(cx - larg * 0.1, yf, larg * 0.2, Math.max(0, (segurando ? linhaY : y) - yf));
        ctx.globalAlpha = 1;
        if (r !== 0 && !segurando) continue;
        if (segurando) continue;
      }
      if (y > py + ph + 30) continue;
      ctx.fillStyle = r === 4 ? "#475569" : COR_TRILHA[n.l];
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, y, larg * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = `900 ${larg * 0.3}px system-ui,sans-serif`;
      ctx.fillText(SETA[espelho ? 3 - n.l : n.l], cx, y + 1);
    }
    // Neblina cobre a parte de baixo.
    if (m.efeito === "neblina") {
      const g = ctx.createLinearGradient(0, py + ph * 0.35, 0, py + ph * 0.7);
      g.addColorStop(0, "rgba(148,163,184,0)"); g.addColorStop(1, "rgba(148,163,184,.97)");
      ctx.fillStyle = g; ctx.fillRect(x0, py + ph * 0.35, w, ph * 0.55);
    }
    if (m.fora) {
      ctx.fillStyle = "rgba(2,6,23,.75)"; ctx.fillRect(x0, py, w, ph);
      ctx.fillStyle = "#94a3b8"; ctx.font = `800 ${Math.max(12, w * 0.1)}px system-ui,sans-serif`;
      ctx.fillText("VAIADO", x0 + w / 2, py + ph / 2);
    }
    // Textos que sobem.
    for (const tx of textos) if (tx.j === j) {
      ctx.globalAlpha = Math.max(0, 1 - tx.t / 0.7);
      ctx.fillStyle = tx.cor; ctx.font = `900 ${Math.max(12, w * 0.09)}px system-ui,sans-serif`;
      ctx.fillText(tx.texto, x0 + w / 2, linhaY - ph * 0.12 - tx.t * 60);
      ctx.globalAlpha = 1;
    }
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }
  function barra(x: number, y: number, w: number, h: number, f: number, cor: string) {
    ctx.fillStyle = "#334155"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = cor; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
  }

  return {
    iniciarRodada() {
      estado = novaPartidaRitmo({ modo, andamento, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      pendentes = [];
      melodiaTocada = new Set();
      ultimaColcheia = -1;
      brilho.length = 0; textos.length = 0;
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      if (!e.terminado) { passoRitmo(e, entradas); efeitosDoPasso(e); if (pendentes.length < 400) pendentes.push(...e.eventos.filter(x => x.tipo !== "batida")); }
      return e.terminado ? { vencedor: e.vencedor, pontos: pontosRitmo(e) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida) {
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
      for (let k = textos.length - 1; k >= 0; k--) { textos[k].t += dt; if (textos[k].t > 0.7) textos.splice(k, 1); }
      for (let k = brilho.length - 1; k >= 0; k--) if (brilho[k].ate < tempo) brilho.splice(k, 1);
      const lista = so >= 0 ? [so] : e.musicos.map(m => m.id);
      // Pistas lado a lado, cada uma no máximo 3/5 da altura de largura.
      const gap = 6;
      const lw = Math.min((w - gap * (lista.length + 1)) / lista.length, h * 0.62);
      const total = lw * lista.length + gap * (lista.length - 1);
      const a = fase === "jogando" ? alfa : 1;
      lista.forEach((j, k) => pista(e, j, (w - total) / 2 + k * (lw + gap), 4, lw, h - 8, a));
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.max(0, Math.ceil((e.fimMusica - e.passo) / 60)),
        alerta: e.modo === "banda" ? e.vidaBanda < 0.25 : false,
        jogadores: e.musicos.map(m => ({
          vivo: !m.fora,
          texto: m.fora ? "vaiado" : `${m.pontos.toLocaleString("pt-BR")} · ${Math.round(acerto(m) * 100)}% · combo ${m.maiorCombo}`,
        })),
      };
    },
    redimensionar() { /* o tamanho é recalculado a cada quadro */ },
    // A partitura sai da semente: não vai no quadro.
    quadro() { return estado ? serializar({ ...estado, notas: undefined, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoRitmo | null;
      if (!e || !Array.isArray(e.musicos) || typeof e.semente !== "number") return;
      e.notas = estado && estado.semente === e.semente && estado.bpm === e.bpm ? estado.notas : gerarPartitura(e.semente, e.bpm || BPM[andamento]);
      if (!estado || estado.semente !== e.semente) { melodiaTocada = new Set(); ultimaColcheia = -1; }
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoRitmo[];
      efeitosDoPasso(e);
    },
    destruir() { canvas.remove(); },
  };
}

