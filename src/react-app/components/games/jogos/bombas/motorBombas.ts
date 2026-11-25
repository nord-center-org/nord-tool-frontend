import { novaCampanha, passoCampanha, entrarCampanha, ETAPAS_CAMPANHA } from "@/react-app/utils/games/campanhaBombas";
import { posicaoRevanche, type ModoBombas } from "@/react-app/utils/games/bombas";
import { PassadaBombas } from "@/react-app/utils/games/passadaBombas";
import {
  AVISO_MORTE_SUBITA, META_MOEDAS_SOLO, PASSOS_POR_SEGUNDO, avisosMorteSubita, largadas, novaPartida, passo, segundosRestantes, type Bioma, type Entrada, type Estado, type Evento,
} from "@/react-app/utils/games/bombas";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { Particulas, Textos, Tremor, lerp, saidaVolta } from "../../motor2d/efeitos";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, folhaDoCorpo } from "../../central/sprites";
import { BIOMAS, NOME_ITEM, desenharBlocos, desenharBomba, desenharChama, desenharChao, desenharItem, desenharJogador, desenharMoeda, desenharQueda } from "./desenho";
import { criarCenaBombas3d } from "./cenaBombas3d";
import { lerPreferencia, menosMovimentoEfetivo } from "@/react-app/utils/tema";

/**
 * Motor das Bombas Táticas (canvas 2D): arena em grade com bombas, chamas, itens, moedas e os corpos animados.
 * Também desenha no celular, a partir dos quadros da tela (espelho).
 */
export function criarMotorBombas(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoBombas, bioma: Bioma, ganchos: GanchosMotor, etapaInicial = 0): MotorJogo {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Arena do Bombas Táticas");
  canvas.className = "rounded-2xl shadow-2xl ring-4 ring-white/10";
  canvas.style.marginTop = "52px";
  caixa.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const cenario = document.createElement("canvas");
  const cenarioCtx = cenario.getContext("2d")!;
  let chaveCenario = "";
  const hud = document.createElement("div");
  hud.className = "pointer-events-none absolute inset-x-3 top-1 flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-200 sm:inset-x-6 sm:text-xs";
  const objetivo = document.createElement("span"), equipamento = document.createElement("span");
  objetivo.className = "font-bold text-amber-200";
  equipamento.className = "font-mono text-cyan-100";
  hud.append(objetivo, equipamento);
  caixa.appendChild(hud);
  const cena = criarCenaBombas3d(caixa, vagas);
  const movimento = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefereMenos = () => {
    try { return menosMovimentoEfetivo(lerPreferencia(localStorage).animacoes, movimento.matches); }
    catch { return movimento.matches; }
  };
  let reduzirMovimento = prefereMenos();
  const atualizarMovimento = () => { reduzirMovimento = prefereMenos(); };
  movimento.addEventListener("change", atualizarMovimento);
  const observadorMovimento = new MutationObserver(atualizarMovimento);
  observadorMovimento.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const local = vagas.findIndex(v => v.privada) >= 0 ? vagas.findIndex(v => v.privada) : vagas.findIndex(v => !v.bot && v.controle === undefined && v.gamepad === undefined);
  const passadas = vagas.map(() => new PassadaBombas());
  const sprites = vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`));
  const particulas = new Particulas(450), textos = new Textos();
  let tremor = new Tremor();
  let deslocamento: [number, number] = [0, 0];
  let quedas: { x: number; y: number; t: number }[] = [];
  let caidos: { jogador: number; x: number; y: number; t: number }[] = [];
  let estado: Estado | null = null;
  let anteriores: { x: number; y: number }[] = [];
  let pendentes: Evento[] = [];
  let tempoTotal = 0;

  function atualizarHud(e: Estado) {
    const caixas = e.grade.filter(c => c === "caixa").length;
    const vivos = e.jogadores.filter(j => j.vivo).length;
    objetivo.textContent = e.jogadores.length === 1
      ? e.modo === "moedas" ? `MISSÃO · ${e.jogadores[0].moedas}/${META_MOEDAS_SOLO} moedas` : `MISSÃO · ${caixas} caixas restantes`
      : e.modo === "moedas" ? "COLETE · Mais moedas até o fim do tempo" : `${e.modo === "times" ? "TIMES · Proteja seus aliados" : "ARENA · Último de pé"} · ${vivos}/${e.jogadores.length} em jogo`;
    const j = e.jogadores[local];
    equipamento.textContent = !j ? "A cor e o número identificam cada jogador" : !j.vivo
      ? e.modo === "moedas" ? `P${j.id + 1} · Retorno em ${Math.max(0, Math.ceil((j.respawnEm - e.passo) / PASSOS_POR_SEGUNDO))}s` : `P${j.id + 1} · Acompanhe a rodada`
      : `P${j.id + 1} · ${Math.max(0, j.bombas - e.bombas.filter(b => b.dono === j.id).length)}/${j.bombas} bombas · alcance ${j.fogo}${j.chute ? " · Chute" : ""}${j.detonador ? " · B: detonar" : j.luva ? " · B: arremessar" : ""}${j.escudo ? " · Escudo" : ""}${j.maldicao ? ` · Maldição ${Math.ceil((j.maldicaoAte - e.passo) / PASSOS_POR_SEGUNDO)}s` : ""}`;
    if (e.campanha) {
      const c = e.campanha, def = ETAPAS_CAMPANHA[c.etapa], vivos = c.inimigos.filter(o => o.vida > 0);
      objetivo.textContent = `${c.etapa + 1}/9 · ${def.mundo} · ${def.nome} · ${c.vidas} vidas extras · ${c.pontos} pts`;
      equipamento.textContent = c.transicaoEm ? "REGIÃO RESTAURADA · Próxima fase…" : vivos.length ? `${vivos.length} inimigos · ${vivos.find(o => o.tipo === "chefe") ? `Chefe: ${vivos[0].vida} de vida · ` : ""}Derrote todos para abrir o portal` : "PORTAL ABERTO · Siga até a saída verde";
      if (j && !j.vivo) equipamento.textContent = `START: entrar · custa 1 vida extra (${c.vidas} disponíveis)`;
    } else if (j && posicaoRevanche(e, j)) equipamento.textContent = `REVANCHE · Mova na borda · A: lançar · B: alcance ${j.revanche?.alcance} · Elimine para voltar`;
    if (j?.montaria) equipamento.textContent += ` · Montaria ${j.montaria.tipo} · B: ${j.montaria.tipo === "vento" ? "disparada" : j.montaria.tipo === "pedra" ? "proteção" : "arremesso"}${e.passo < j.montaria.recargaAte ? ` (${Math.ceil((j.montaria.recargaAte - e.passo) / 60)}s)` : ""}`;
    const aviso = e.morteSubita ? " · ARENA FECHANDO: fuja dos X" : "";
    objetivo.textContent += aviso;
  }

  function tratarEventos(e: Estado, eventos: Evento[]) {
    cena?.eventos(e, eventos);
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
        case "retorno": som.powerup(); textos.mostrar(ev.x, ev.y, "DE VOLTA!", "#67e8f9", 1.4); break;
        case "fim": break;
      }
    }
    if (explosoes) som.explosao(Math.min(3, explosoes));
  }

  return {
    iniciarRodada() {
      const e = modo === "campanha" ? novaCampanha(vagas.map(v => v.nome), vagas.flatMap((v, i) => !v.reserva && !v.bot ? [i] : []), etapaInicial) : novaPartida({ modo, bioma, jogadores: vagas.map(v => ({ nome: v.nome, bot: v.bot })) });
      estado = e;
      anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      particulas.lista = [];
      textos.lista = [];
      quedas = [];
      caidos = [];
      pendentes = [];
      chaveCenario = "";
      tempoTotal = 0;
      tremor = new Tremor();
      deslocamento = [0, 0];
      atualizarHud(e);
      cena?.reiniciar();
    },
    start(indice: number) {
      if (!estado?.campanha || estado.jogadores[indice]?.vivo) return false;
      const entrou = entrarCampanha(estado, indice);
      if (entrou) { vagas[indice].reserva = false; tratarEventos(estado, estado.eventos.slice(-1)); }
      return true; // Uma tentativa sem vidas não deve pausar a partida dos demais.
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      if (e.terminado) return { vencedor: e.vencedor, time: e.timeVencedor };
      anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      if (e.campanha) {
        const etapa = e.campanha.etapa;
        passoCampanha(e, entradas);
        if (e.campanha.etapa !== etapa) { try { localStorage.setItem("nord-bombas-checkpoint-v1", String(e.campanha.etapa)); } catch { /* sem armazenamento */ } anteriores = e.jogadores.map(j => ({ x: j.x, y: j.y })); }
      } else passo(e, entradas);
      tratarEventos(e, e.eventos);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      if (e.duracao - e.passo === 10 * PASSOS_POR_SEGUNDO && e.modo === "moedas") som.acelerarMusica(175);
      return e.terminado ? { vencedor: e.vencedor, time: e.campanha ? null : e.timeVencedor, definitiva: !!e.campanha, vencedores: e.campanha && e.vencedor !== null ? e.jogadores.filter(j => j.participando).map(j => j.id) : undefined, pontos: e.campanha ? e.jogadores.map(j => j.participando ? e.campanha!.pontos : 0) : undefined } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      const usar3d = !!cena?.disponivel();
      canvas.style.display = usar3d ? "none" : "block";
      canvas.setAttribute("aria-hidden", String(usar3d));
      if (usar3d) {
        cena!.desenhar(e, anteriores, alfa, dt, fase, vencedor, reduzirMovimento);
        return;
      }
      tempoTotal += dt;
      const box = caixa.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      const t = Math.max(1, Math.floor(Math.min((box.width - 24) / e.largura, (box.height - 76) / e.altura)));
      const w = t * e.largura, h = t * e.altura;
      if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) {
        canvas.width = Math.round(w * d);
        canvas.height = Math.round(h * d);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ativo = fase === "jogando";
      if (dt > 0) {
        particulas.atualizar(dt);
        textos.atualizar(dt);
        quedas.forEach(q => (q.t += dt));
        quedas = quedas.filter(q => q.t < 0.35);
      }
      if (dt > 0) deslocamento = reduzirMovimento ? [0, 0] : tremor.deslocamento(dt, t * 0.45);
      const [sx, sy] = deslocamento;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = BIOMAS[e.bioma].fundo;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(sx, sy);
      const chave = `${t}/${d}/${e.bioma}/${e.grade.join(",")}`;
      if (chaveCenario !== chave) {
        cenario.width = canvas.width;
        cenario.height = canvas.height;
        cenarioCtx.setTransform(d, 0, 0, d, 0, 0);
        desenharChao(cenarioCtx, e, t);
        desenharBlocos(cenarioCtx, e, t);
        chaveCenario = chave;
      }
      ctx.drawImage(cenario, 0, 0, w, h);
      const animacao = reduzirMovimento ? 0 : tempoTotal;
      // As áreas de largada continuam identificáveis por forma e número, além da cor.
      largadas(e.largura, e.altura).slice(0, vagas.length).forEach(([x, y], i) => {
        if (e.grade[y * e.largura + x] !== "chao") return;
        ctx.strokeStyle = `${CORES_JOGADORES[i % 8]}99`;
        ctx.lineWidth = Math.max(1, t * 0.045);
        ctx.beginPath(); ctx.roundRect((x + 0.15) * t, (y + 0.15) * t, t * 0.7, t * 0.7, t * 0.15); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.3)";
        ctx.font = `800 ${Math.max(6, Math.round(t * 0.25))}px system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${i + 1}`, (x + 0.5) * t, (y + 0.5) * t);
      });
      for (const aviso of avisosMorteSubita(e)) {
        const urgencia = 1 - aviso.em / AVISO_MORTE_SUBITA;
        const x = aviso.x * t, y = aviso.y * t;
        ctx.fillStyle = `rgba(251,146,60,${0.18 + urgencia * 0.35})`;
        ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
        ctx.strokeStyle = "#ffedd5";
        ctx.lineWidth = Math.max(1, t * 0.06);
        ctx.strokeRect(x + t * 0.1, y + t * 0.1, t * 0.8, t * 0.8);
        ctx.beginPath(); ctx.moveTo(x + t * 0.32, y + t * 0.32); ctx.lineTo(x + t * 0.68, y + t * 0.68);
        ctx.moveTo(x + t * 0.68, y + t * 0.32); ctx.lineTo(x + t * 0.32, y + t * 0.68); ctx.stroke();
      }
      for (const c of e.chamas) desenharChama(ctx, c.x, c.y, t, c.eixo, (c.ate - e.passo) / 30, animacao);
      for (const q of quedas) {
        const p = Math.min(1, q.t / 0.25);
        const altura = reduzirMovimento ? 0 : (1 - saidaVolta(p)) * t * 3;
        ctx.fillStyle = BIOMAS[e.bioma].pilar;
        ctx.fillRect(q.x * t, q.y * t - altura, t, t);
      }
      for (const it of e.itens) desenharItem(ctx, it.tipo, it.x * t + t / 2, it.y * t + t / 2, t, animacao);
      for (const m of e.moedas) desenharMoeda(ctx, m.x * t + t / 2, m.y * t + t / 2, t, animacao);
      for (const b of e.bombas) {
        if (b.voo > 0) {
          const p = 1 - b.voo / 24;
          const bx = lerp(b.origemX, b.destinoX, p), by = lerp(b.origemY, b.destinoY, p);
          desenharBomba(ctx, bx * t + t / 2, by * t + t / 2, t, b.pavio, b.remota, animacao, reduzirMovimento ? 0 : Math.sin(p * Math.PI) * t * 1.6, b.dono);
        } else {
          const [dx, dy] = b.deslizando ? ({ cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] } as const)[b.deslizando] : [0, 0];
          desenharBomba(ctx, (b.x + dx * b.progresso) * t + t / 2, (b.y + dy * b.progresso) * t + t / 2, t, b.pavio, b.remota, animacao, 0, b.dono);
        }
      }
      if (e.campanha) {
        const c = e.campanha;
        ctx.strokeStyle = c.inimigos.some(o => o.vida > 0) ? "#956b83" : "#5ee6ac"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc((c.saida.x + 0.5) * t, (c.saida.y + 0.5) * t, t * 0.35, 0, Math.PI * 2); ctx.stroke();
        for (const o of c.inimigos) if (o.vida > 0) {
          ctx.fillStyle = o.tipo === "chefe" ? "#b887ef" : o.tipo === "cacador" ? "#f5a95e" : "#e97379";
          ctx.beginPath(); ctx.arc((o.x + 0.5) * t, (o.y + 0.5) * t, t * (o.tipo === "chefe" ? 0.48 : 0.3), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ffffff"; ctx.font = `bold ${Math.max(10, t * 0.3)}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(String(o.vida), (o.x + 0.5) * t, (o.y + 0.6) * t);
        }
      }
      for (const j of e.jogadores) {
        const p = posicaoRevanche(e, j); if (!p) continue;
        ctx.fillStyle = CORES_JOGADORES[j.id % 8]; ctx.fillRect(p.x * t + t * 0.1, p.y * t + t * 0.3, t * 0.8, t * 0.5);
        desenharJogador(ctx, { ...j, vivo: true, direcao: p.direcao }, p, t, sprites[j.id], animacao, e.passo, false, reduzirMovimento, false);
      }
      const vivos = e.jogadores.filter(j => j.vivo).sort((a, b) => a.y - b.y);
      for (const j of vivos) {
        const ant = anteriores[j.id] ?? j;
        const pos = ativo ? { x: lerp(ant.x, j.x, alfa), y: lerp(ant.y, j.y, alfa) } : { x: j.x, y: j.y };
        const venceu = fase !== "jogando" && fase !== "contagem" && (e.timeVencedor !== null ? j.time === e.timeVencedor : j.id === vencedor);
        passadas[j.id].atualizar(pos.x, pos.y, dt, j.vivo);
        desenharJogador(ctx, j, pos, t, sprites[j.id], animacao, e.passo, venceu && !reduzirMovimento, reduzirMovimento, passadas[j.id].intensidade > 0.05);
      }
      caidos = caidos.filter(c => c.t < 0.9);
      for (const c of caidos) {
        c.t += dt;
        if (!reduzirMovimento) desenharQueda(ctx, sprites[c.jogador], c.x, c.y, t, c.t / 0.9);
      }
      if (!reduzirMovimento) particulas.desenhar(ctx, t);
      textos.desenhar(ctx, t);
      ctx.restore();
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      atualizarHud(e);
      return {
        tempo: segundosRestantes(e),
        alerta: !!e.morteSubita,
        jogadores: e.jogadores.map(j => ({
          vivo: j.vivo,
          texto: e.campanha ? (j.participando ? (j.vivo ? "Em missão" : "Retornando / Start") : "Start para entrar") : `${e.modo === "moedas" ? `🪙 ${j.moedas}` : `💣${j.bombas} 🔥${j.fogo}`}${j.escudo ? " 🛡" : ""}${j.maldicao ? " ☠" : ""}`,
        })),
      };
    },
    redimensionar() { /* o tamanho é recalculado a cada quadro */ },
    destruir() { observadorMovimento.disconnect(); movimento.removeEventListener("change", atualizarMovimento); cena?.destruir(); canvas.remove(); hud.remove(); cenario.width = cenario.height = 0; },
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
      atualizarHud(e);
    },
  };
}
