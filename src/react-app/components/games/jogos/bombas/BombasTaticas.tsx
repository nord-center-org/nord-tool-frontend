import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Gamepad2, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { AvatarConfig } from "@/react-app/utils/avatar";
import {
  META_MOEDAS_SOLO, PASSOS_POR_SEGUNDO, novaPartida, passo, segundosRestantes, type Bioma, type Dificuldade, type Estado, type Evento, type Modo,
} from "@/react-app/utils/games/bombas";
import { iniciarLaco } from "../../motor2d/laco";
import { Particulas, Textos, Tremor, lerp, saidaVolta } from "../../motor2d/efeitos";
import { som } from "../../audio/sintetizador";
import { Controles, LeitorDaPartida, mostrarControleNaTela, vibrar } from "../../entrada/entrada";
import PainelControles from "../../entrada/PainelControles";
import ControleVirtual from "../../entrada/ControleVirtual";
import { CORES_JOGADORES, folhaDoCorpo } from "../../central/sprites";
import type { EntradasRemotas } from "@/react-app/utils/games/sala";
import Avatar from "@/react-app/components/avatar/Avatar";
import { BIOMAS, NOME_ITEM, desenharBlocos, desenharBomba, desenharChama, desenharChao, desenharItem, desenharJogador, desenharMoeda, desenharQueda } from "./desenho";

/** Uma vaga da partida: bot, quem está na tela (teclado/toque) ou um celular da sala ({@code controle} = vaga na sala). */
export interface VagaBombas { nome: string; bot: Dificuldade | null; avatar: AvatarConfig; controle?: number; gamepad?: number }

export interface ResultadoBombas { vencedor: number | null; vitorias: number[]; rodadas: number }

interface Props {
  vagas: VagaBombas[];
  modo: Modo;
  bioma: Bioma;
  vitoriasParaVencer: number;
  onSair: () => void;
  onFim?: (r: ResultadoBombas) => void;
  /** Aparece no cartão do fim da partida (recorde, conquistas novas, placar da Copa). */
  avisoFim?: ReactNode;
  /** Troca a Revanche por outra ação (na Copa: seguir para a próxima partida). */
  acaoFim?: { rotulo: string; aoClicar: () => void };
  /** Texto extra no topo (na Copa: "Copa · partida 2 de 5"). */
  subtitulo?: string;
  /** Entradas dos celulares (multiplayer). */
  remotas?: EntradasRemotas;
  /** Avisos para os celulares: mudança de fase e quem caiu. */
  onFase?: (f: FaseBombas) => void;
  onMorte?: (indice: number) => void;
}

export type FaseBombas = "contagem" | "jogando" | "fimRodada" | "fimPartida";
type Fase = FaseBombas;

interface Hud {
  tempo: number;
  jogadores: { id: number; vivo: boolean; bombas: number; fogo: number; moedas: number; escudo: boolean; maldicao: boolean }[];
  morteSubita: boolean;
}

const TITULO_MODO: Record<Modo, string> = { sobrevivencia: "Sobrevivência", times: "Times", moedas: "Caça às Moedas" };

/** Bombas Táticas: a partida na tela (canvas 2D a 60 passos por segundo) com o placar por cima. */
export default function BombasTaticas({ vagas, modo, bioma, vitoriasParaVencer, onSair, onFim, avisoFim, acaoFim, subtitulo, remotas, onFase, onMorte }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const estado = useRef<Estado | null>(null);
  const anteriores = useRef<{ x: number; y: number }[]>([]);
  const controles = useMemo(() => new Controles(), []);
  const [fase, setFase] = useState<Fase>("contagem");
  const faseRef = useRef<Fase>("contagem");
  const [contagem, setContagem] = useState(3);
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  const [mudo, setMudo] = useState(som.mudo);
  const [hud, setHud] = useState<Hud | null>(null);
  const [vitorias, setVitorias] = useState<number[]>(() => vagas.map(() => 0));
  const vitoriasRef = useRef<number[]>(vagas.map(() => 0));
  // Em ref: a tela de fora pode mandar uma função nova a cada render sem reiniciar o laço do jogo.
  const onFimRef = useRef(onFim);
  onFimRef.current = onFim;
  const onFaseRef = useRef(onFase);
  onFaseRef.current = onFase;
  const onMorteRef = useRef(onMorte);
  onMorteRef.current = onMorte;
  // Quem joga na própria tela (teclado ou toque); -1 quando a tela só mostra o jogo e todos estão nos celulares.
  const local = useMemo(() => vagas.findIndex(v => !v.bot && v.controle === undefined && v.gamepad === undefined), [vagas]);
  const [rodada, setRodada] = useState(1);
  const [ultimo, setUltimo] = useState<{ vencedor: number | null; time: number | null } | null>(null);
  const [toque, setToque] = useState(() => mostrarControleNaTela());
  const [painel, setPainel] = useState(false);
  const sprites = useMemo(() => vagas.map(v => folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`)), [vagas]);
  const efeitos = useMemo(() => ({ particulas: new Particulas(), textos: new Textos(), tremor: new Tremor(), quedas: [] as { x: number; y: number; t: number }[], caidos: [] as { jogador: number; x: number; y: number; t: number }[] }), []);

  const mudarFase = (f: Fase) => {
    faseRef.current = f;
    setFase(f);
    onFaseRef.current?.(f);
  };

  const novaRodada = useCallback(() => {
    const e = novaPartida({ modo, bioma, jogadores: vagas.map(v => ({ nome: v.nome, bot: v.bot })) });
    estado.current = e;
    anteriores.current = e.jogadores.map(j => ({ x: j.x, y: j.y }));
    efeitos.particulas.lista = [];
    efeitos.textos.lista = [];
    efeitos.quedas = [];
    efeitos.caidos = [];
    setUltimo(null);
    setContagem(3);
    mudarFase("contagem");
  }, [modo, bioma, vagas, efeitos]);

  useEffect(() => {
    novaRodada();
  }, [novaRodada]);

  // Contagem 3, 2, 1, já.
  useEffect(() => {
    if (fase !== "contagem") return;
    if (contagem <= 0) {
      som.contagem(true);
      som.tocarMusica(modo === "moedas" ? 140 : 128);
      mudarFase("jogando");
      return;
    }
    som.contagem(false);
    const t = setTimeout(() => setContagem(c => c - 1), 700);
    return () => clearTimeout(t);
  }, [fase, contagem, modo]);

  useEffect(() => () => som.pararMusica(), []);

  const tratarEventos = useCallback((e: Estado, eventos: Evento[]) => {
    const { particulas, textos, tremor } = efeitos;
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
          if (ev.jogador === local) vibrar(25);
          break;
        case "morte":
          som.morte();
          tremor.adicionar(0.5);
          particulas.emitir(30, { x: ev.x + 0.5, y: ev.y + 0.5, cor: CORES_JOGADORES[ev.jogador % 8], tamanho: 0.16, gravidade: 7, total: 1.2, atrito: 0.96 }, 6);
          textos.mostrar(ev.x + 0.5, ev.y, `P${ev.jogador + 1} caiu!`, "#fff", 1.4);
          if (ev.jogador === local) vibrar([60, 40, 120]);
          efeitos.caidos.push({ jogador: ev.jogador, x: ev.x, y: ev.y, t: 0 });
          onMorteRef.current?.(ev.jogador);
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
          efeitos.quedas.push({ x: ev.x, y: ev.y, t: 0 });
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
  }, [efeitos, local]);

  // Laço do jogo.
  useEffect(() => {
    controles.ligar();
    const leitor = new LeitorDaPartida(vagas, controles, local);
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    let ultimoHud = 0;
    let tempoTotal = 0;
    let pausaAnterior = false;

    const atualizar = () => {
      const e = estado.current;
      if (!e) return;
      const { entradas, pausa } = leitor.ler(remotas);
      if (pausa && !pausaAnterior && faseRef.current === "jogando") {
        pausadoRef.current = !pausadoRef.current;
        setPausado(pausadoRef.current);
      }
      pausaAnterior = pausa;
      if (faseRef.current !== "jogando" || pausadoRef.current) return;
      anteriores.current = e.jogadores.map(j => ({ x: j.x, y: j.y }));
      passo(e, entradas);
      tratarEventos(e, e.eventos);
      if (e.duracao - e.passo === 10 * PASSOS_POR_SEGUNDO && e.modo === "moedas") som.acelerarMusica(175);
      if (e.terminado) {
        som.pararMusica();
        const vencedor = e.vencedor;
        const time = e.timeVencedor;
        setUltimo({ vencedor, time });
        const novo = [...vitoriasRef.current];
        if (time !== null) e.jogadores.filter(j => j.time === time).forEach(j => (novo[j.id] += 1));
        else if (vencedor !== null) novo[vencedor] += 1;
        vitoriasRef.current = novo;
        setVitorias(novo);
        // Sozinho, cada rodada fecha a partida (cumpriu o desafio ou não).
        if (novo.some(n => n >= vitoriasParaVencer) || vagas.length === 1) {
          if (vencedor !== null || time !== null) som.vitoria(); else som.morte();
          mudarFase("fimPartida");
          const campeao = novo.findIndex(n => n >= vitoriasParaVencer);
          onFimRef.current?.({ vencedor: campeao >= 0 ? campeao : null, vitorias: novo, rodadas: rodada });
        } else {
          mudarFase("fimRodada");
        }
      }
    };

    const desenhar = (alfa: number, dt: number) => {
      const e = estado.current;
      if (!e) return;
      tempoTotal += dt;
      const box = caixa.current!.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      const t = Math.max(8, Math.floor(Math.min(box.width / e.largura, box.height / e.altura)));
      const w = t * e.largura, h = t * e.altura;
      if (el.width !== Math.round(w * d) || el.height !== Math.round(h * d)) {
        el.width = Math.round(w * d);
        el.height = Math.round(h * d);
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      }
      const ativo = faseRef.current === "jogando" && !pausadoRef.current;
      if (ativo) {
        efeitos.particulas.atualizar(dt);
        efeitos.textos.atualizar(dt);
        efeitos.quedas.forEach(q => (q.t += dt));
        efeitos.quedas = efeitos.quedas.filter(q => q.t < 0.35);
      }
      const [sx, sy] = efeitos.tremor.deslocamento(ativo ? dt : 0, t);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = BIOMAS[e.bioma].fundo;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(sx, sy);
      desenharChao(ctx, e, t);
      for (const c of e.chamas) desenharChama(ctx, c.x, c.y, t, c.eixo, (c.ate - e.passo) / 30, tempoTotal);
      desenharBlocos(ctx, e, t);
      for (const q of efeitos.quedas) {
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
        const ant = anteriores.current[j.id] ?? j;
        const pos = ativo ? { x: lerp(ant.x, j.x, alfa), y: lerp(ant.y, j.y, alfa) } : { x: j.x, y: j.y };
        desenharJogador(ctx, j, pos, t, sprites[j.id], tempoTotal, e.passo, faseRef.current !== "jogando" && faseRef.current !== "contagem");
      }
      efeitos.caidos = efeitos.caidos.filter(c => c.t < 0.9);
      for (const c of efeitos.caidos) {
        c.t += dt;
        desenharQueda(ctx, sprites[c.jogador], c.x, c.y, t, c.t / 0.9);
      }
      efeitos.particulas.desenhar(ctx, t);
      efeitos.textos.desenhar(ctx, t);
      ctx.restore();
      if (tempoTotal - ultimoHud > 0.12) {
        ultimoHud = tempoTotal;
        setHud({
          tempo: segundosRestantes(e), morteSubita: !!e.morteSubita,
          jogadores: e.jogadores.map(j => ({ id: j.id, vivo: j.vivo, bombas: j.bombas, fogo: j.fogo, moedas: j.moedas, escudo: j.escudo, maldicao: !!j.maldicao })),
        });
      }
    };

    const laco = iniciarLaco(atualizar, desenhar);
    return () => {
      laco.parar();
      controles.desligar();
    };
  }, [controles, efeitos, sprites, tratarEventos, vitoriasParaVencer, rodada, vagas, remotas, local]);
  const solo = vagas.length === 1;
  const tituloModo = solo ? (modo === "moedas" ? "Meta de moedas" : "Desafio") : TITULO_MODO[modo];

  const proximaRodada = () => {
    setRodada(r => r + 1);
    novaRodada();
  };
  const revanche = () => {
    vitoriasRef.current = vagas.map(() => 0);
    setVitorias(vitoriasRef.current);
    setRodada(1);
    novaRodada();
  };
  const alternarPausa = () => {
    pausadoRef.current = !pausadoRef.current;
    setPausado(pausadoRef.current);
    if (pausadoRef.current) som.pararMusica(); else som.tocarMusica(hud?.morteSubita ? 170 : 128);
  };
  const minutos = hud ? `${Math.floor(hud.tempo / 60)}:${String(hud.tempo % 60).padStart(2, "0")}` : "--:--";
  const nomeVencedor = ultimo ? (ultimo.time !== null ? `Time ${ultimo.time === 0 ? "Ímpar (P1, P3…)" : "Par (P2, P4…)"}` : ultimo.vencedor !== null ? `P${ultimo.vencedor + 1} · ${vagas[ultimo.vencedor].nome}` : "Empate") : "";
  const campeao = vitorias.findIndex(v => v >= vitoriasParaVencer);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950 text-white" onPointerDown={() => som.destravar()} onKeyDown={() => som.destravar()}>
      <header className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
        <button type="button" onClick={onSair} aria-label="Sair do jogo" className="rounded-xl bg-white/10 p-2 hover:bg-white/20"><X className="h-5 w-5" /></button>
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-black">Bombas Táticas · {tituloModo}</p>
          <p className="text-xs text-white/60">{subtitulo ? `${subtitulo} · ` : ""}{BIOMAS[bioma].nome} · {solo ? (modo === "moedas" ? `junte ${META_MOEDAS_SOLO} moedas em 2 min` : "exploda todas as caixas sem cair") : `rodada ${rodada} · vence quem fizer ${vitoriasParaVencer}`}</p>
        </div>
        <span className={`rounded-xl px-3 py-1.5 font-mono text-lg font-black tabular-nums ${hud?.morteSubita ? "animate-pulse bg-red-600" : "bg-white/10"}`} aria-label="Tempo restante">{minutos}</span>
        <button type="button" onClick={() => { som.definirMudo(!mudo); setMudo(!mudo); if (mudo && fase === "jogando") som.tocarMusica(); }} aria-label={mudo ? "Ligar som" : "Desligar som"} className="rounded-xl bg-white/10 p-2 hover:bg-white/20">
          {mudo ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button type="button" aria-label="Controles" title="Controles (teclas, toque e controle de videogame)"
          onClick={() => { if (faseRef.current === "jogando" && !pausadoRef.current) alternarPausa(); setPainel(true); }}
          className="rounded-xl bg-white/10 p-2 hover:bg-white/20"><Gamepad2 className="h-5 w-5" /></button>
        <button type="button" onClick={alternarPausa} disabled={fase !== "jogando"} aria-label={pausado ? "Continuar" : "Pausar"} className="rounded-xl bg-white/10 p-2 hover:bg-white/20 disabled:opacity-40">
          {pausado ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
      </header>

      <ul className="flex gap-1.5 overflow-x-auto px-3 pb-2 sm:px-4" aria-label="Jogadores">
        {vagas.map((v, i) => {
          const j = hud?.jogadores[i];
          return (
            <li key={i} className={`flex shrink-0 items-center gap-2 rounded-xl px-2 py-1 ${j && !j.vivo ? "opacity-40" : ""}`} style={{ background: `${CORES_JOGADORES[i]}26`, boxShadow: `inset 0 0 0 2px ${CORES_JOGADORES[i]}` }}>
              <Avatar config={v.avatar} tamanho={28} semFundo className="[image-rendering:pixelated]" />
              <div className="leading-tight">
                <p className="text-xs font-black" style={{ color: CORES_JOGADORES[i] }}>P{i + 1}{v.bot ? " 🤖" : v.controle !== undefined ? " 📱" : ""}</p>
                <p className="text-[11px] tabular-nums text-white/80">
                  {modo === "moedas" ? `🪙 ${j?.moedas ?? 0}` : `💣${j?.bombas ?? 1} 🔥${j?.fogo ?? 2}`}{j?.escudo ? " 🛡" : ""}{j?.maldicao ? " ☠" : ""} · ★{vitorias[i]}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div ref={caixa} className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <canvas ref={canvas} aria-label="Arena do Bombas Táticas" className="rounded-lg shadow-2xl ring-1 ring-white/10" />
        {fase === "contagem" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span key={contagem} className="animate-[ping_0.7s_ease-out] text-8xl font-black drop-shadow-[0_6px_0_rgba(0,0,0,.6)]">{contagem > 0 ? contagem : "JÁ!"}</span>
          </div>
        )}
        {pausado && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
            <p className="text-3xl font-black">Pausado</p>
            <button type="button" onClick={alternarPausa} className="rounded-xl bg-white px-5 py-2 font-black text-slate-900">Continuar</button>
            <button type="button" onClick={onSair} className="rounded-xl bg-white/15 px-5 py-2 font-bold">Sair para a Central</button>
          </div>
        )}
        {(fase === "fimRodada" || fase === "fimPartida") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">{fase === "fimPartida" ? "Fim da partida" : `Fim da rodada ${rodada}`}</p>
              {fase === "fimPartida" && campeao >= 0 ? (
                <>
                  <div className="mx-auto mt-3 w-24 rounded-2xl p-1" style={{ background: CORES_JOGADORES[campeao] }}>
                    <Avatar config={vagas[campeao].avatar} tamanho={88} />
                  </div>
                  <p className="mt-3 text-2xl font-black">{solo ? "🏆 Desafio cumprido!" : `🏆 P${campeao + 1} venceu!`}</p>
                  <p className="text-sm text-slate-500">{vagas[campeao].nome}</p>
                </>
              ) : (
                <p className="mt-2 text-2xl font-black">{solo ? "Não foi dessa vez!" : nomeVencedor === "Empate" ? "Empate!" : `${nomeVencedor} venceu a rodada`}</p>
              )}
              <ol className="mt-4 space-y-1 text-left text-sm">
                {vagas.map((v, i) => ({ v, i })).sort((a, b) => vitorias[b.i] - vitorias[a.i]).map(({ v, i }) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: CORES_JOGADORES[i] }} />
                    <span className="font-bold">P{i + 1}</span><span className="truncate text-slate-500">{v.nome}</span>
                    <span className="ml-auto font-black tabular-nums">{"★".repeat(vitorias[i]) || "–"}</span>
                  </li>
                ))}
              </ol>
              {fase === "fimPartida" && avisoFim}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {fase === "fimRodada" ? (
                  <button type="button" autoFocus onClick={proximaRodada} className="rounded-xl bg-orange-500 px-5 py-2.5 font-black text-white hover:bg-orange-600">Próxima rodada</button>
                ) : acaoFim ? (
                  <button type="button" autoFocus onClick={acaoFim.aoClicar} className="rounded-xl bg-orange-500 px-5 py-2.5 font-black text-white hover:bg-orange-600">{acaoFim.rotulo}</button>
                ) : (
                  <button type="button" autoFocus onClick={revanche} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 font-black text-white hover:bg-orange-600"><RotateCcw className="h-4 w-4" />Revanche</button>
                )}
                <button type="button" onClick={onSair} className="rounded-xl bg-slate-100 px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-200">Central</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {local < 0 ? (
        <p className="px-4 py-2 text-center text-xs text-white/50">Todos jogam pelos celulares · Esc pausa</p>
      ) : toque ? (
        <ControleVirtual controles={controles} rotuloA="Bomba" rotuloB="Ação" />
      ) : (
        <p className="px-4 py-2 text-center text-xs text-white/50">Setas/WASD andam · Espaço/Z solta bomba · X/Shift detona ou arremessa · Esc pausa</p>
      )}
      {painel && <PainelControles onFechar={() => { setPainel(false); setToque(mostrarControleNaTela()); }} />}
    </div>
  );
}
