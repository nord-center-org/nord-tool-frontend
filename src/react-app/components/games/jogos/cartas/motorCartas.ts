import type { Entrada } from "@/react-app/utils/games/bombas";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import {
  AVISO_PASSOS, CORES, NOME_COR, corDe, ehCoringa, novaPartidaCartas, passoCartas, podeJogar, pontosCartas, topo, valorDe,
  type Carta, type Cor, type EstadoCartas, type ModoCartas,
} from "@/react-app/utils/games/cartas";
import { avatarPadrao } from "@/react-app/utils/avatar";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, desenharCorpo, folhaDoCorpo } from "../../central/sprites";

export const MESAS_CARTAS = {
  feltro: { nome: "Feltro verde", centro: "#166534", borda: "#052e16", aro: "#78350f" },
  neon: { nome: "Neon", centro: "#3b0764", borda: "#0f0a1f", aro: "#db2777" },
  madeira: { nome: "Madeira", centro: "#92400e", borda: "#431407", aro: "#1c1917" },
} as const;
export type MesaCartas = keyof typeof MESAS_CARTAS;

export const COR_HEX: Record<Cor | "w", string> = { r: "#e11d48", g: "#16a34a", b: "#2563eb", y: "#eab308", w: "#18181b" };
const ROTULO: Record<string, string> = { P: "⊘", I: "⇄", "+2": "+2", C: "", "+4": "+4" };

/** Desenha uma carta (frente ou verso) com o canto superior esquerdo em x, y. */
export function desenharCarta(ctx: CanvasRenderingContext2D, c: Carta | null, x: number, y: number, w: number, apagada = false) {
  const h = w * 1.5, r = w * 0.12;
  ctx.save();
  ctx.globalAlpha *= apagada ? 0.45 : 1;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.roundRect(x + w * 0.04, y + w * 0.06, w, h, r); ctx.fill();
  ctx.fillStyle = "#fafafa";
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  const m = w * 0.07;
  if (!c) {
    // Verso: preto com a elipse vermelha e o "V" da Virada.
    ctx.fillStyle = "#18181b";
    ctx.beginPath(); ctx.roundRect(x + m, y + m, w - 2 * m, h - 2 * m, r * 0.7); ctx.fill();
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.5);
    ctx.fillStyle = "#e11d48"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.3, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#facc15";
    ctx.font = `900 ${w * 0.42}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("V", x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }
  const cor = corDe(c), v = valorDe(c);
  ctx.fillStyle = COR_HEX[cor];
  ctx.beginPath(); ctx.roundRect(x + m, y + m, w - 2 * m, h - 2 * m, r * 0.7); ctx.fill();
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.5);
  if (cor === "w") {
    // Elipse em quatro cores.
    CORES.forEach((k, i) => {
      ctx.fillStyle = COR_HEX[k];
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.ellipse(0, 0, w * 0.3, h * 0.36, 0, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2); ctx.fill();
    });
  } else {
    ctx.fillStyle = "#fafafa"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.3, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const texto = /^\d$/.test(v) ? v : ROTULO[v];
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (texto) {
    ctx.font = `900 ${w * (texto.length > 1 ? 0.4 : 0.52)}px system-ui, sans-serif`;
    ctx.lineWidth = w * 0.05;
    ctx.strokeStyle = "#0f172a";
    ctx.strokeText(texto, x + w / 2, y + h / 2);
    ctx.fillStyle = cor === "w" ? "#fafafa" : COR_HEX[cor];
    ctx.fillText(texto, x + w / 2, y + h / 2);
    ctx.font = `900 ${w * 0.2}px system-ui, sans-serif`;
    ctx.fillStyle = "#fafafa";
    ctx.fillText(texto, x + w * 0.2, y + w * 0.22);
  }
  ctx.restore();
}

interface Voo { carta: Carta | null; de: { x: number; y: number }; para: { x: number; y: number }; t: number }

/**
 * Motor das Cartas da Virada (canvas 2D): mesa redonda com os jogadores em volta (corpo, nome e o leque de cartas
 * viradas), o monte e o descarte no centro com a cor da vez e o sentido girando. A mão de quem joga no teclado/tela
 * aparece embaixo; quem joga pelo celular vê a própria mão só no celular.
 */
export function criarMotorCartas(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoCartas, mesa: MesaCartas, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Mesa das Cartas da Virada");
  canvas.className = "rounded-lg";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const tema = MESAS_CARTAS[mesa];
  const privada = vagas.findIndex(v => v.privada);
  const local = privada >= 0 ? privada : vagas.findIndex(v => !v.bot && v.controle === undefined && v.gamepad === undefined);
  let folhas: HTMLCanvasElement[] = [];
  let estado: EstadoCartas | null = null;
  let pendentes: unknown[] = [];
  let w = 0, h = 0, tempo = 0, giro = 0;
  const voos: Voo[] = [];
  const baloes: { quem: number; texto: string; cor: string; t: number }[] = [];
  const enviados = new Map<number, string>();

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

  const temMao = local >= 0;
  /** Lugar de cada jogador em volta da mesa (o jogador local fica embaixo). */
  function lugares(e: EstadoCartas) {
    const n = e.jogadores.length;
    const cx = w / 2, cy = temMao ? h * 0.4 : h * 0.5;
    const rx = w * 0.4, ry = (temMao ? h * 0.3 : h * 0.38);
    const base = temMao ? local : 0;
    return e.jogadores.map((_j, i) => {
      const k = (i - base + n) % n;
      const ang = Math.PI / 2 + (k / n) * Math.PI * 2;
      return { x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry };
    });
  }
  const centro = () => ({ x: w / 2, y: temMao ? h * 0.4 : h * 0.5 });
  const larguraCarta = () => Math.max(34, Math.min(w, h) * 0.075);

  function avisarCelulares(e: EstadoCartas) {
    e.jogadores.forEach(j => {
      if (j.bot || j.interno) return;
      const escolhendo = e.vez === j.id && e.etapa === "cor" ? e.selCor : null;
      const info = e.vez !== j.id ? `Vez de ${e.jogadores[e.vez].nome}`
        : e.etapa === "cor" ? "Escolha a cor: ←/→ e Jogar"
        : e.etapa === "comprada" ? "Jogue a carta comprada ou Comprar para passar"
        : e.acumulado > 0 ? `+${e.acumulado} acumulado: jogue +2/+4 ou Comprar paga`
        : "Sua vez! ←/→ escolhe, Jogar descarta, ↑ avisa Virada!";
      const d = { c: j.mao, sel: j.sel, vez: e.vez === j.id, topo: topo(e), cor: e.corAtual, info, escolhendoCor: escolhendo };
      const chave = JSON.stringify(d);
      if (enviados.get(j.id) !== chave) { enviados.set(j.id, chave); ganchos.privado(j.id, d); }
    });
  }

  function tratarEventos(e: EstadoCartas) {
    const pos = lugares(e);
    const c = centro();
    for (const ev of e.eventos) {
      if (ev.tipo === "jogou") {
        voos.push({ carta: ev.carta, de: pos[ev.jogador], para: c, t: 0 });
        som.colocar();
      } else if (ev.tipo === "comprou") {
        for (let k = 0; k < Math.min(ev.n, 6); k++) voos.push({ carta: null, de: { x: c.x - larguraCarta() * 1.4, y: c.y }, para: pos[ev.jogador], t: -k * 0.08 });
        if (ev.n >= 2) baloes.push({ quem: ev.jogador, texto: `+${ev.n}`, cor: "#f87171", t: 0 });
        som.clique();
      } else if (ev.tipo === "pulou") { baloes.push({ quem: ev.jogador, texto: "Pulou!", cor: "#fbbf24", t: 0 }); som.alerta(); }
      else if (ev.tipo === "inverteu") som.arremesso();
      else if (ev.tipo === "virada") { baloes.push({ quem: ev.jogador, texto: "VIRADA!", cor: "#facc15", t: 0 }); som.powerup(); }
      else if (ev.tipo === "esqueceu") {
        baloes.push({ quem: ev.jogador, texto: "Esqueceu! +2", cor: "#f87171", t: 0 });
        som.maldicao();
        if (!e.jogadores[ev.jogador].interno) ganchos.vibrarLocal(ev.jogador, [80, 40, 80]);
      } else if (ev.tipo === "cor") baloes.push({ quem: ev.jogador, texto: NOME_COR[ev.cor], cor: COR_HEX[ev.cor], t: 0 });
      else if (ev.tipo === "trocou") { baloes.push({ quem: ev.jogador, texto: "Troca de mãos!", cor: "#a78bfa", t: 0 }); som.escudo(); }
      else if (ev.tipo === "girou") som.escudo();
      else if (ev.tipo === "invalida") som.alerta();
      else if (ev.tipo === "vez" && !e.jogadores[ev.jogador].bot) ganchos.vibrarLocal(ev.jogador, 40);
      else if (ev.tipo === "fim") som.vitoria();
    }
  }

  const passoParaVencedor = (e: EstadoCartas) => {
    const v = e.vencedor;
    return v === null || e.jogadores[v].interno ? null : v;
  };

  return {
    iniciarRodada() {
      estado = novaPartidaCartas({
        modo, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot, nome: v.nome })),
        botsSozinho: "medio",
      });
      folhas = estado.jogadores.map((_j, i) => {
        const av = vagas[i]?.avatar ?? avatarPadrao(9000 + i);
        return folhaDoCorpo(av, `corpo-${JSON.stringify(av)}`);
      });
      voos.length = 0;
      baloes.length = 0;
      enviados.clear();
      pendentes = [];
      avisarCelulares(estado);
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      if (e.terminado) return { vencedor: passoParaVencedor(e), pontos: pontosCartas(e) };
      passoCartas(e, entradas);
      tratarEventos(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      avisarCelulares(e);
      if (e.terminado) return { vencedor: passoParaVencedor(e), pontos: pontosCartas(e) };
      return null;
    },
    desenhar(_alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      giro += dt * e.sentido * 0.8;
      // Mesa.
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, w, h);
      const c = centro();
      const rx = w * 0.46, ry = temMao ? h * 0.36 : h * 0.44;
      ctx.fillStyle = tema.aro;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, rx + 14, ry + 14, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, rx);
      g.addColorStop(0, tema.centro);
      g.addColorStop(1, tema.borda);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      // Anel da cor da vez, com setas girando no sentido do jogo.
      const cw = larguraCarta() * 1.5;
      ctx.strokeStyle = COR_HEX[e.corAtual];
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(c.x, c.y, cw * 1.55, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = COR_HEX[e.corAtual];
      for (let k = 0; k < 3; k++) {
        const a = giro + (k * Math.PI * 2) / 3;
        ctx.save(); ctx.translate(c.x + Math.cos(a) * cw * 1.55, c.y + Math.sin(a) * cw * 1.55); ctx.rotate(a + (e.sentido === 1 ? Math.PI / 2 : -Math.PI / 2));
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.fill(); ctx.restore();
      }
      // Monte e descarte.
      for (let k = 2; k >= 0; k--) desenharCarta(ctx, null, c.x - cw * 1.25 - k * 2, c.y - cw * 0.75 - k * 2, cw);
      desenharCarta(ctx, topo(e), c.x + cw * 0.1, c.y - cw * 0.75, cw);
      if (e.acumulado > 0) {
        ctx.fillStyle = "#f87171"; ctx.font = `900 ${cw * 0.4}px system-ui, sans-serif`; ctx.textAlign = "center";
        ctx.fillText(`+${e.acumulado} acumulado`, c.x, c.y + cw * 1.05);
      }
      // Jogadores.
      const pos = lugares(e);
      const lc = larguraCarta() * 0.7;
      e.jogadores.forEach((j, i) => {
        const p = pos[i];
        const cor = CORES_JOGADORES[i % 8];
        const naVez = e.vez === i && !e.terminado;
        if (naVez) {
          ctx.fillStyle = `${cor}44`;
          ctx.beginPath(); ctx.arc(p.x, p.y - lc * 0.6, lc * 1.6 + Math.sin(tempo * 6) * 3, 0, Math.PI * 2); ctx.fill();
          // Tempo da vez para pessoas.
          if (!j.bot) {
            const resto = 1 - (e.passo - e.inicioVez) / e.tempoVez;
            ctx.strokeStyle = resto < 0.3 ? "#f87171" : "#fbbf24";
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(p.x, p.y - lc * 0.6, lc * 1.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, resto)); ctx.stroke();
          }
        }
        const comemora = (fase === "fimRodada" || fase === "fimPartida") && (vencedor === i || e.vencedor === i);
        // Leque de cartas viradas (não mostra a mão de quem joga aqui embaixo).
        if (i !== local) {
          const n = Math.min(j.mao.length, 12);
          for (let k = 0; k < n; k++) {
            ctx.save();
            ctx.translate(p.x + (k - (n - 1) / 2) * lc * 0.28, p.y + lc * 0.2);
            ctx.rotate((k - (n - 1) / 2) * 0.07);
            desenharCarta(ctx, null, -lc / 2, -lc * 0.75, lc);
            ctx.restore();
          }
        }
        desenharCorpo(ctx, folhas[i], "baixo", comemora ? "vitoria" : "parado", tempo + i * 0.3, p.x, p.y - lc * 0.1, lc * 1.9);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `800 ${Math.max(11, lc * 0.34)}px system-ui, sans-serif`;
        ctx.fillStyle = cor;
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(2,6,23,.9)";
        const rot = `${j.nome}${j.bot ? " 🤖" : ""} · ${j.mao.length}`;
        ctx.strokeText(rot, p.x, p.y + lc * 1.15);
        ctx.fillText(rot, p.x, p.y + lc * 1.15);
        if (j.mao.length === 1 && j.avisou) {
          ctx.fillStyle = "#facc15";
          ctx.font = `900 ${Math.max(10, lc * 0.3)}px system-ui, sans-serif`;
          ctx.fillText("VIRADA!", p.x, p.y + lc * 1.55);
        } else if (j.avisoAte !== null) {
          ctx.fillStyle = "#f87171";
          ctx.fillRect(p.x - lc, p.y + lc * 1.5, lc * 2 * ((j.avisoAte - e.passo) / AVISO_PASSOS), 4);
        }
      });
      // A mão de quem joga aqui (teclado/toque), embaixo.
      if (temMao) {
        const j = e.jogadores[local];
        const mw = Math.min(larguraCarta() * 1.35, (w - 40) / Math.max(1, j.mao.length * 0.62 + 0.4));
        const total = mw + (j.mao.length - 1) * mw * 0.62;
        const x0 = (w - total) / 2, y0 = h - mw * 1.5 - 12;
        const minhaVez = e.vez === local && !e.terminado;
        j.mao.forEach((carta, k) => {
          const sel = k === j.sel && minhaVez && e.etapa !== "cor";
          const serve = podeJogar(e, j, carta) && (e.etapa !== "comprada" || carta === e.comprada);
          desenharCarta(ctx, carta, x0 + k * mw * 0.62, y0 - (sel ? mw * 0.35 : 0), mw, minhaVez && !serve);
          if (sel) {
            ctx.strokeStyle = "#facc15"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect(x0 + k * mw * 0.62 - 2, y0 - mw * 0.35 - 2, mw + 4, mw * 1.5 + 4, mw * 0.12); ctx.stroke();
          }
        });
        if (minhaVez) {
          ctx.fillStyle = "#fef3c7"; ctx.font = "800 15px system-ui, sans-serif"; ctx.textAlign = "center";
          const dica = e.etapa === "cor" ? "Escolha a cor: ←/→ e Espaço"
            : e.etapa === "comprada" ? "Espaço joga a carta comprada · X passa"
            : e.acumulado > 0 ? `+${e.acumulado}: jogue +2/+4 ou X para comprar tudo`
            : "←/→ escolhe · Espaço joga · X compra · ↑ avisa VIRADA!";
          ctx.fillText(dica, w / 2, y0 - mw * 0.55);
        }
      }
      // Escolha da cor do coringa (para todos verem).
      if (e.etapa === "cor" && !e.terminado) {
        const r = larguraCarta() * 0.55;
        CORES.forEach((k, i) => {
          const x = c.x + (i - 1.5) * r * 2.6, y = c.y + larguraCarta() * 1.9;
          ctx.fillStyle = COR_HEX[k];
          ctx.beginPath(); ctx.arc(x, y, r * (i === e.selCor ? 1.25 : 1), 0, Math.PI * 2); ctx.fill();
          if (i === e.selCor) { ctx.strokeStyle = "#fafafa"; ctx.lineWidth = 3; ctx.stroke(); }
        });
      }
      // Cartas voando.
      for (let i = voos.length - 1; i >= 0; i--) {
        const v = voos[i];
        v.t += dt / 0.3;
        if (v.t >= 1) { voos.splice(i, 1); continue; }
        if (v.t < 0) continue;
        const q = 1 - (1 - v.t) ** 3;
        desenharCarta(ctx, v.carta, v.de.x + (v.para.x - v.de.x) * q - lc / 2, v.de.y + (v.para.y - v.de.y) * q - lc * 0.75, lc);
      }
      // Balões.
      const pilha = new Map<number, number>();
      for (let i = baloes.length - 1; i >= 0; i--) {
        const b = baloes[i];
        b.t += dt;
        if (b.t > 1.6) { baloes.splice(i, 1); continue; }
        // Balões do mesmo jogador empilham em vez de se sobrepor.
        const nivel = pilha.get(b.quem) ?? 0;
        pilha.set(b.quem, nivel + 1);
        const p = { x: pos[b.quem].x, y: pos[b.quem].y - nivel * Math.max(18, lc * 0.65) };
        ctx.globalAlpha = Math.min(1, (1.6 - b.t) * 3);
        ctx.font = `900 ${Math.max(16, lc * 0.6)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 5; ctx.strokeStyle = "rgba(2,6,23,.9)";
        ctx.strokeText(b.texto, p.x, p.y - lc * 2.2 - b.t * 20);
        ctx.fillStyle = b.cor;
        ctx.fillText(b.texto, p.x, p.y - lc * 2.2 - b.t * 20);
        ctx.globalAlpha = 1;
      }
      void ehCoringa;
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.max(0, Math.ceil((e.tempoVez - (e.passo - e.inicioVez)) / 60)),
        alerta: !e.jogadores[e.vez].bot && e.passo - e.inicioVez > e.tempoVez - 180,
        jogadores: e.jogadores.filter(j => !j.interno).map(j => ({
          vivo: true,
          texto: `${j.mao.length} carta${j.mao.length === 1 ? "" : "s"}${e.vez === j.id ? " · na vez" : ""}`,
        })),
      };
    },
    redimensionar,
    quadro(para: number) {
      const e = estado;
      if (!e) return null;
      // Cada um recebe só a própria mão; das outras, só quantas cartas têm. O monte vai só com o tamanho.
      const esconder = (n: number) => Array.from({ length: n }, () => "x");
      return serializar({
        ...e,
        jogadores: e.jogadores.map(j => (j.id === para || e.terminado ? j : { ...j, mao: esconder(j.mao.length) })),
        monte: esconder(e.monte.length),
        comprada: e.vez === para ? e.comprada : null,
        eventos: [],
      });
    },
    tirarEventos() {
      const l = pendentes.map(x => serializar(x));
      pendentes = [];
      return l;
    },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoCartas | null;
      if (!e || !Array.isArray(e.jogadores)) return;
      if (estado && e.passo < estado.passo) { voos.length = 0; baloes.length = 0; }
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EstadoCartas["eventos"];
      tratarEventos(e);
    },
    destruir() { canvas.remove(); },
  };
}
