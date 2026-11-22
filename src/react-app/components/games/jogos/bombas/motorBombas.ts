import {
  PASSOS_POR_SEGUNDO, novaPartida, passo, segundosRestantes, type Bioma, type Entrada, type Estado, type Evento, type Modo,
} from "@/react-app/utils/games/bombas";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { Particulas, Textos, Tremor, lerp, saidaVolta } from "../../motor2d/efeitos";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, folhaDoCorpo } from "../../central/sprites";
import { BIOMAS, NOME_ITEM, desenharBlocos, desenharBomba, desenharChama, desenharChao, desenharItem, desenharJogador, desenharMoeda, desenharQueda } from "./desenho";

/**
 * Motor das Bombas Táticas (canvas 2D): arena em grade com bombas, chamas, itens, moedas e os corpos animados.
 * Também desenha no celular, a partir dos quadros da tela (espelho).
 */
export function criarMotorBombas(caixa: HTMLDivElement, vagas: VagaJogo[], modo: Modo, bioma: Bioma, ganchos: GanchosMotor): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Arena do Bombas Táticas");
  canvas.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const sprites = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  const particulas = new Particulas(), textos = new Textos(), tremor = new Tremor();
  let quedas: { x: number; y: number; t: number }[] = [];
  let caidos: { jogador: number; x: number; y: number; t: number }[] = [];
  let estado: Estado | null = null;
  let anteriores: { x: number; y: number }[] = [];
  let pendentes: Evento[] = [];
  let tempoTotal = 0;

  function tratarEventos(e: Estado, eventos: Evento[]) {
    let explosoes = 0;
    for (const ev of eventos) {
      switch (ev.tipo) {
        case "bomba": som.colocar(); break;
        case "explosao":
          explosoes++;
          tremor.adicionar(0.28 + ev.tamanho * 0.03);
          particulas.emitir(14, { x: ev.x + 0.5, y: ev.y + 0.5, cor: "#fb923c", tamanho: 0.35, forma: "circulo", total: 0.5, atrito: 0.86 }, 4);
          particulas.emitir(8, { x: ev.x + 0.5, y: ev.y + 0.5, cor: "#6b7280", tamanho: 0.6, forma: "fumaca", total: 1.1, gravidade: -1.2, atrito: 0.9 }, 1.2);
          particulas.emitir(10, { x: ev.x + 0.5, y: ev.y + 0.5, cor: "#fde047", tamanho: 0.18, forma: "faisca", total: 0.4, atrito: 0.9 }, 7);
          break;
        case "caixa":
          particulas.emitir(10, { x: ev.x + 0.5, y: ev.y + 0.5, cor: BIOMAS[e.bioma].caixa, tamanho: 0.18, gravidade: 9, total: 0.7, atrito: 0.95 }, 4);
          break;
        case "powerup":
          if (ev.item === "caveira") som.maldicao(); else som.powerup();
          particulas.emitir(12, { x: ev.x + 0.5, y: ev.y + 0.5, cor: ev.item === "caveira" ? "#9ca3af" : "#fde047", tamanho: 0.14, forma: "faisca", total: 0.5 }, 3);
          textos.mostrar(ev.x + 0.5, ev.y, NOME_ITEM[ev.item], ev.item === "caveira" ? "#d1d5db" : CORES_JOGADORES[ev.jogador % 8], 1.1);
          ganchos.vibrarLocal(ev.jogador, 25);
          break;
        case "morte":
          som.morte();
          tremor.adicionar(0.5);
          particulas.emitir(30, { x: ev.x + 0.5, y: ev.y + 0.5, cor: CORES_JOGADORES[ev.jogador % 8], tamanho: 0.16, gravidade: 7, total: 1.2, atrito: 0.96 }, 6);
          textos.mostrar(ev.x + 0.5, ev.y, `P${ev.jogador + 1} caiu!`, "#fff", 1.4);
          caidos.push({ jogador: ev.jogador, x: ev.x, y: ev.y, t: 0 });
          ganchos.morte(ev.jogador);
          break;
        case "escudo":
          som.escudo();
          particulas.emitir(16, { x: ev.x + 0.5, y: ev.y + 0.5, cor: "#c084fc", tamanho: 0.15, forma: "circulo", total: 0.6 }, 4);
          textos.mostrar(ev.x + 0.5, ev.y, "Escudo!", "#e9d5ff");
          break;
        case "chute": som.chute(); break;
        case "arremesso": som.arremesso(); break;
        case "moeda":
          som.moeda();
          particulas.emitir(8, { x: ev.x + 0.5, y: ev.y + 0.5, cor: "#fde047", tamanho: 0.12, forma: "faisca", total: 0.4 }, 3);
          break;
        case "bloco":
          som.bloco();
          quedas.push({ x: ev.x, y: ev.y, t: 0 });
          tremor.adicionar(0.08);
          break;
        case "morteSubita":
          som.alerta();
          som.acelerarMusica(170);
          textos.mostrar(e.largura / 2, e.altura / 2, "MORTE SÚBITA!", "#f87171", 2.2);
          break;
        case "fim": break;
      }
    }
    if (explosoes) som.explosao(Math.min(3, explosoes));
  }

  return {
    iniciarRodada() {
      const e = novaPartida({ modo, bioma, jogadores: vagas.map(v => ({ nome: v.nome, bot: v.bot })) });
      estado = e;
      anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      particulas.lista = [];
      textos.lista = [];
      quedas = [];
      caidos = [];
      pendentes = [];
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      if (e.terminado) return { vencedor: e.vencedor, time: e.timeVencedor };
      anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      passo(e, entradas);
      tratarEventos(e, e.eventos);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      if (e.duracao - e.passo === 10 * PASSOS_POR_SEGUNDO && e.modo === "moedas") som.acelerarMusica(175);
      return e.terminado ? { vencedor: e.vencedor, time: e.timeVencedor } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida) {
      const e = estado;
      if (!e) return;
      tempoTotal += dt;
      const box = caixa.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      const t = Math.max(6, Math.floor(Math.min((box.width - 8) / e.largura, (box.height - 8) / e.altura)));
      const w = t * e.largura, h = t * e.altura;
      if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) {
        canvas.width = Math.round(w * d);
        canvas.height = Math.round(h * d);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ativo = fase === "jogando";
      if (ativo) {
        particulas.atualizar(dt);
        textos.atualizar(dt);
        quedas.forEach(q => (q.t += dt));
        quedas = quedas.filter(q => q.t < 0.35);
      }
      const [sx, sy] = tremor.deslocamento(ativo ? dt : 0, t);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = BIOMAS[e.bioma].fundo;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(sx, sy);
      desenharChao(ctx, e, t);
      for (const c of e.chamas) desenharChama(ctx, c.x, c.y, t, c.eixo, (c.ate - e.passo) / 30, tempoTotal);
      desenharBlocos(ctx, e, t);
      for (const q of quedas) {
        const p = Math.min(1, q.t / 0.25);
        const altura = (1 - saidaVolta(p)) * t * 3;
        ctx.fillStyle = BIOMAS[e.bioma].pilar;
        ctx.fillRect(q.x * t, q.y * t - altura, t, t);
      }
      for (const it of e.itens) desenharItem(ctx, it.tipo, it.x * t + t / 2, it.y * t + t / 2, t, tempoTotal);
      for (const m of e.moedas) desenharMoeda(ctx, m.x * t + t / 2, m.y * t + t / 2, t, tempoTotal);
      for (const b of e.bombas) {
        if (b.voo > 0) {
          const p = 1 - b.voo / 24;
          const bx = lerp(b.origemX, b.destinoX, p), by = lerp(b.origemY, b.destinoY, p);
          desenharBomba(ctx, bx * t + t / 2, by * t + t / 2, t, b.pavio, b.remota, tempoTotal, Math.sin(p * Math.PI) * t * 1.6);
        } else {
          const [dx, dy] = b.deslizando ? ({ cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] } as const)[b.deslizando] : [0, 0];
          desenharBomba(ctx, (b.x + dx * b.progresso) * t + t / 2, (b.y + dy * b.progresso) * t + t / 2, t, b.pavio, b.remota, tempoTotal);
        }
      }
      const vivos = e.jogadores.filter(j => j.vivo).sort((a, b) => a.y - b.y);
      for (const j of vivos) {
        const ant = anteriores[j.id] ?? j;
        const pos = ativo ? { x: lerp(ant.x, j.x, alfa), y: lerp(ant.y, j.y, alfa) } : { x: j.x, y: j.y };
        desenharJogador(ctx, j, pos, t, sprites[j.id], tempoTotal, e.passo, fase !== "jogando" && fase !== "contagem");
      }
      caidos = caidos.filter(c => c.t < 0.9);
      for (const c of caidos) {
        c.t += dt;
        desenharQueda(ctx, sprites[c.jogador], c.x, c.y, t, c.t / 0.9);
      }
      particulas.desenhar(ctx, t);
      textos.desenhar(ctx, t);
      ctx.restore();
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: segundosRestantes(e),
        alerta: !!e.morteSubita,
        jogadores: e.jogadores.map(j => ({
          vivo: j.vivo,
          texto: `${e.modo === "moedas" ? `🪙 ${j.moedas}` : `💣${j.bombas} 🔥${j.fogo}`}${j.escudo ? " 🛡" : ""}${j.maldicao ? " ☠" : ""}`,
        })),
      };
    },
    redimensionar() { /* o tamanho é recalculado a cada quadro */ },
    destruir() { canvas.remove(); },
    quadro() {
      if (!estado) return null;
      // O que está escondido nas caixas fica só na tela.
      return serializar({ ...estado, escondidos: new Map(), eventos: [] });
    },
    tirarEventos() {
      const l = pendentes.map(ev => serializar(ev));
      pendentes = [];
      return l;
    },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as Estado | null;
      if (!e || !Array.isArray(e.jogadores)) return;
      anteriores = (estado ?? e).jogadores.map(j => ({ x: j.x, y: j.y }));
      estado = e;
      tratarEventos(e, eventos.map(x => desserializar(x)) as Evento[]);
    },
  };
}
