import type { Entrada } from "@/react-app/utils/games/bombas";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import { mediaReacao, novaPartidaDuelo, passoDuelo, pontosDuelo, type EstadoDuelo, type ModoDuelo } from "@/react-app/utils/games/duelo";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const CENARIOS_DUELO = {
  meiodia: { nome: "Meio-dia", ceu: ["#fde68a", "#fb923c"], chao: ["#d97706", "#92400e"], serra: "#b45309", sol: "#fff7ed" },
  poente: { nome: "Pôr do sol", ceu: ["#fb7185", "#7c2d12"], chao: ["#9a3412", "#431407"], serra: "#4c0519", sol: "#fde047" },
  lua: { nome: "Lua cheia", ceu: ["#1e1b4b", "#020617"], chao: ["#334155", "#0f172a"], serra: "#0b1120", sol: "#e2e8f0" },
} as const;
export type CenarioDuelo = keyof typeof CENARIOS_DUELO;

const TEXTO_FINTA = { passaro: "PIU! (só um pássaro)", foguete: "FO… FOGUETE!", sino: "DONG! (o sino)" } as const;

interface Particula { x: number; y: number; vx: number; vy: number; t: number; cor: string; vida: number }

/**
 * Motor do Duelo ao Meio-Dia (canvas 2D): deserto ao meio-dia com sol, serra, cactos, rolo de mato e poeira com o
 * vento; no Duelo cada um encara a sua garrafa na cerca (de costas para a câmera), no Torneio a dupla fica frente a
 * frente. Câmera lenta e zoom no tiro decisivo.
 */
export function criarMotorDuelo(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoDuelo, cenario: CenarioDuelo, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Arena do Duelo ao Meio-Dia");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const tema = CENARIOS_DUELO[cenario];
  const folhas = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  let estado: EstadoDuelo | null = null;
  let w = 0, h = 0;
  let tempo = 0;
  let lento = 0;
  let focoLento: number | null = null;
  let flash = 0;
  let aviso: { texto: string; t: number; cor: string } | null = null;
  const textos: { quem: number; texto: string; cor: string; t: number }[] = [];
  const cacos: Particula[] = [];
  const poeira = Array.from({ length: 40 }, (_, i) => ({ x: (i * 37) % 100 / 100, y: 0.55 + ((i * 53) % 45) / 100, v: 0.5 + (i % 5) * 0.2 }));
  const quebradas = new Set<number>();
  let rolo = -0.2;

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

  /** Onde cada atirador fica e para onde olha. */
  function posicoes(e: EstadoDuelo): { x: number; y: number; esc: number; dir: "cima" | "esquerda" | "direita" | "baixo"; garrafa: { x: number; y: number } | null }[] {
    const chao = h * 0.86;
    if (e.modo === "torneio") {
      const dupla = e.atiradores.filter(a => a.noDuelo).map(a => a.id);
      const plateia = e.atiradores.filter(a => !a.noDuelo).map(a => a.id);
      return e.atiradores.map(a => {
        const i = dupla.indexOf(a.id);
        if (i >= 0) return { x: w * (i === 0 ? 0.28 : 0.72), y: h * 0.78, esc: h * 0.3, dir: i === 0 ? "direita" : "esquerda", garrafa: null };
        const k = plateia.indexOf(a.id);
        return { x: w * (0.08 + (k / Math.max(1, plateia.length)) * 0.84) + w * 0.05, y: chao + h * 0.12, esc: h * 0.12, dir: "cima", garrafa: null };
      });
    }
    const n = e.atiradores.length;
    return e.atiradores.map((_a, i) => {
      const x = w * ((i + 0.5) / n);
      return { x, y: chao, esc: Math.min(h * 0.3, (w / n) * 1.1), dir: "cima", garrafa: { x, y: h * 0.5 } };
    });
  }

  function desenharCenario(e: EstadoDuelo, dt: number) {
    const ceu = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    ceu.addColorStop(0, tema.ceu[0]);
    ceu.addColorStop(1, tema.ceu[1]);
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = tema.sol;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.16, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Serra recortada.
    ctx.fillStyle = tema.serra;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.52);
    for (let i = 0; i <= 12; i++) ctx.lineTo((i / 12) * w, h * (0.4 + ((i * 7919) % 13) / 100));
    ctx.lineTo(w, h * 0.55);
    ctx.lineTo(0, h * 0.55);
    ctx.fill();
    const chao = ctx.createLinearGradient(0, h * 0.52, 0, h);
    chao.addColorStop(0, tema.chao[0]);
    chao.addColorStop(1, tema.chao[1]);
    ctx.fillStyle = chao;
    ctx.fillRect(0, h * 0.52, w, h * 0.48);
    // Cactos.
    for (const cx of [0.06, 0.93]) {
      const x = w * cx, base = h * 0.62, alt = h * 0.16, larg = w * 0.018;
      ctx.fillStyle = "#166534";
      ctx.fillRect(x - larg / 2, base - alt, larg, alt);
      ctx.fillRect(x - larg * 2, base - alt * 0.7, larg * 1.5, larg);
      ctx.fillRect(x - larg * 2, base - alt * 0.95, larg, alt * 0.3);
      ctx.fillRect(x + larg / 2, base - alt * 0.5, larg * 1.4, larg);
      ctx.fillRect(x + larg * 1.4, base - alt * 0.75, larg, alt * 0.3);
    }
    // Cerca com as garrafas (Duelo e treino).
    if (e.modo !== "torneio") {
      ctx.fillStyle = "#78350f";
      ctx.fillRect(0, h * 0.52, w, h * 0.018);
      ctx.fillRect(0, h * 0.56, w, h * 0.012);
    }
    // Vento: bandeira e poeira.
    const v = e.vento === "esquerda" ? -1 : e.vento === "direita" ? 1 : 0;
    const px = w * 0.86, py = h * 0.24;
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(px, py, 4, h * 0.36);
    ctx.fillStyle = v ? "#ef4444" : "#a1a1aa";
    ctx.beginPath();
    const ondula = Math.sin(tempo * 9) * 6;
    if (v) {
      ctx.moveTo(px + 2, py);
      ctx.lineTo(px + 2 + v * w * 0.06, py + 10 + ondula);
      ctx.lineTo(px + 2, py + 26);
    } else {
      ctx.moveTo(px + 4, py);
      ctx.lineTo(px + 14, py + 22);
      ctx.lineTo(px + 4, py + 26);
    }
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = `900 ${Math.round(h * 0.03)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(v ? `VENTO ${v < 0 ? "←" : "→"} segure ${v < 0 ? "→" : "←"}` : "sem vento", px, py + h * 0.4);
    ctx.fillStyle = "rgba(255,237,213,.45)";
    for (const p of poeira) {
      p.x += (v * 0.25 + 0.02) * p.v * dt;
      if (p.x > 1.05) p.x = -0.05;
      if (p.x < -0.05) p.x = 1.05;
      ctx.fillRect(p.x * w, p.y * h, 3, 2);
    }
    // Rolo de mato atravessando.
    rolo += dt * (0.12 + Math.abs(v) * 0.1) * (v || 1);
    if (rolo > 1.2) rolo = -0.2;
    if (rolo < -0.2) rolo = 1.2;
    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = 2;
    const rx = rolo * w, ry = h * 0.66 - Math.abs(Math.sin(tempo * 5)) * h * 0.02, rr = h * 0.03;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(rx, ry, rr, rr * 0.7, tempo * 4 + k, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function garrafa(x: number, y: number, tam: number) {
    ctx.fillStyle = "#15803d";
    ctx.fillRect(x - tam * 0.18, y - tam, tam * 0.36, tam * 0.7);
    ctx.fillRect(x - tam * 0.07, y - tam * 1.3, tam * 0.14, tam * 0.32);
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.fillRect(x - tam * 0.12, y - tam * 0.95, tam * 0.06, tam * 0.5);
  }

  let pendentes: unknown[] = [];
  function efeitosDoPasso(e: EstadoDuelo) {
    const pos = posicoes(e);
    for (const ev of e.eventos) {
      switch (ev.tipo) {
        case "finta": aviso = { texto: TEXTO_FINTA[ev.finta], t: 0, cor: "#fef3c7" }; som.clique(); break;
        case "sinal": aviso = { texto: "FOGO!", t: 0, cor: "#dc2626" }; flash = 0.35; som.contagem(true); break;
        case "queimou": textos.push({ quem: ev.atirador, texto: "QUEIMOU!", cor: "#f87171", t: 0 }); som.morte(); ganchos.morte(ev.atirador); break;
        case "errou": textos.push({ quem: ev.atirador, texto: "ERROU! (vento)", cor: "#fbbf24", t: 0 }); som.chute(); break;
        case "acertou": {
          som.explosao(1);
          textos.push({ quem: ev.atirador, texto: `${ev.ms} ms`, cor: "#ffffff", t: 0 });
          const p = pos[ev.atirador];
          const alvo = p.garrafa ?? { x: e.modo === "torneio" ? (p.dir === "direita" ? w * 0.72 : w * 0.28) : p.x, y: h * 0.55 };
          quebradas.add(ev.atirador);
          for (let k = 0; k < 18; k++) cacos.push({ x: alvo.x, y: alvo.y - 20, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 240, t: 0, cor: k % 3 ? "#22c55e" : "#d9f99d", vida: 0.9 });
          if (ev.decisivo) { lento = 0.7; focoLento = ev.atirador; ganchos.vibrarLocal(ev.atirador, 60); }
          break;
        }
        case "duelo": quebradas.clear(); break;
        default: break;
      }
    }
    if (e.fase === "espera" && e.passo === e.inicioDuelo + 1) { quebradas.clear(); aviso = { texto: "Mãos ao coldre… espere o sinal", t: 0, cor: "#fff7ed" }; }
  }

  return {
    iniciarRodada() {
      estado = novaPartidaDuelo({ modo, jogadores: vagas.map(v => ({ bot: v.bot })) });
      quebradas.clear();
      cacos.length = 0;
      textos.length = 0;
      aviso = null;
      pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      passoDuelo(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      if (!e.terminado) return null;
      return { vencedor: e.vencedor, pontos: e.atiradores.map(pontosDuelo) };
    },
    desenhar(_alfa: number, dtReal: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      // Câmera lenta: o mundo anda devagar por um instante no tiro decisivo.
      const dt = lento > 0 ? dtReal * 0.25 : dtReal;
      lento = Math.max(0, lento - dtReal);
      tempo += dt;
      flash = Math.max(0, flash - dtReal);
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      const pos = posicoes(e);
      if (lento > 0 && focoLento !== null) {
        const z = 1 + 0.15 * Math.min(1, lento / 0.3);
        const f = pos[focoLento];
        ctx.translate(f.x, f.y - f.esc / 2);
        ctx.scale(z, z);
        ctx.translate(-f.x, -(f.y - f.esc / 2));
      }
      desenharCenario(e, dt);
      e.atiradores.forEach((a, i) => {
        const p = pos[i];
        if (p.garrafa && !quebradas.has(i) && a.noDuelo) garrafa(p.garrafa.x, p.garrafa.y, h * 0.06);
        const comemora = (fase !== "jogando" && fase !== "contagem" && vencedor === i) || (e.fase === "resultado" && e.vencedorDuelo === i);
        ctx.globalAlpha = a.queimou || a.fora ? 0.45 : 1;
        // Sombra, anel da cor e o corpo inteiro.
        ctx.fillStyle = "rgba(0,0,0,.3)";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.esc * 0.22, p.esc * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = CORES_JOGADORES[i];
        ctx.lineWidth = Math.max(2, p.esc * 0.02);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.esc * 0.24, p.esc * 0.07, 0, 0, Math.PI * 2);
        ctx.stroke();
        desenharCorpo(ctx, folhas[i], comemora ? "baixo" : p.dir, comemora ? "vitoria" : "parado", tempo + i * 0.3, p.x, p.y, p.esc);
        // Clarão do tiro.
        if (a.acertouEm !== null && e.passo - a.acertouEm < 8) {
          ctx.fillStyle = "#fde047";
          const fx = p.dir === "direita" ? p.x + p.esc * 0.3 : p.dir === "esquerda" ? p.x - p.esc * 0.3 : p.x;
          ctx.beginPath();
          ctx.arc(fx, p.y - p.esc * 0.55, p.esc * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.font = `900 ${Math.round(Math.max(12, p.esc * 0.1))}px system-ui`;
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,.7)";
        ctx.strokeText(`P${i + 1}`, p.x, p.y - p.esc * 1.05);
        ctx.fillStyle = CORES_JOGADORES[i];
        ctx.fillText(`P${i + 1}`, p.x, p.y - p.esc * 1.05);
      });
      for (let k = cacos.length - 1; k >= 0; k--) {
        const c = cacos[k];
        c.t += dt;
        c.vy += 600 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        ctx.fillStyle = c.cor;
        ctx.fillRect(c.x, c.y, 4, 4);
        if (c.t > c.vida) cacos.splice(k, 1);
      }
      for (let k = textos.length - 1; k >= 0; k--) {
        const t = textos[k];
        t.t += dtReal;
        const p = pos[t.quem];
        ctx.globalAlpha = Math.max(0, 1 - t.t / 1.6);
        ctx.font = `900 ${Math.round(Math.max(14, p.esc * 0.13))}px system-ui`;
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(0,0,0,.75)";
        ctx.strokeText(t.texto, p.x, p.y - p.esc * 1.25 - t.t * 30);
        ctx.fillStyle = t.cor;
        ctx.fillText(t.texto, p.x, p.y - p.esc * 1.25 - t.t * 30);
        ctx.globalAlpha = 1;
        if (t.t > 1.6) textos.splice(k, 1);
      }
      ctx.restore();
      if (aviso) {
        aviso.t += dtReal;
        const grande = aviso.texto === "FOGO!";
        ctx.globalAlpha = Math.max(0, 1 - aviso.t / (grande ? 1.4 : 1.8));
        ctx.font = `900 ${Math.round(h * (grande ? 0.16 : 0.06))}px system-ui`;
        ctx.textAlign = "center";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(0,0,0,.6)";
        ctx.strokeText(aviso.texto, w / 2, h * 0.34);
        ctx.fillStyle = aviso.cor;
        ctx.fillText(aviso.texto, w / 2, h * 0.34);
        ctx.globalAlpha = 1;
        if (aviso.t > 1.8) aviso = null;
      }
      if (e.modo === "treino") {
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(12, 12, 230, 34);
        ctx.fillStyle = "#fff";
        ctx.font = "800 15px system-ui";
        ctx.textAlign = "left";
        const m = mediaReacao(e.atiradores[0]);
        ctx.fillText(`Sinal ${Math.min(e.tiros + 1, 5)}/5 · média ${m ?? "—"} ms`, 22, 35);
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 1.6})`;
        ctx.fillRect(0, 0, w, h);
      }
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.floor((e.passo - e.inicioDuelo) / 60),
        jogadores: e.atiradores.map(a => ({
          vivo: !a.fora && !a.queimou,
          texto: a.fora ? "fora" : a.queimou ? "queimou" : a.reacoes.length ? `${a.reacoes[a.reacoes.length - 1]} ms` : e.modo === "torneio" && !a.noDuelo ? "aguardando" : "no coldre",
        })),
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
      const e = desserializar(s) as EstadoDuelo | null;
      if (!e || !Array.isArray(e.atiradores)) return;
      if (estado && e.passo < estado.passo) { quebradas.clear(); cacos.length = 0; textos.length = 0; aviso = null; }
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EstadoDuelo["eventos"];
      efeitosDoPasso(e);
    },
    destruir() { canvas.remove(); },
  };
}
