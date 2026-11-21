import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import Avatar from "@/react-app/components/avatar/Avatar";
import type { AvatarConfig } from "@/react-app/utils/avatar";
import type { Dificuldade, Entrada } from "@/react-app/utils/games/bombas";
import type { EntradasRemotas } from "@/react-app/utils/games/sala";
import { iniciarLaco } from "../motor2d/laco";
import { som } from "../audio/sintetizador";
import { Controles, telaDeToque, vibrar } from "../entrada/entrada";
import ControleVirtual from "../entrada/ControleVirtual";
import { CORES_JOGADORES } from "../central/sprites";

/** Uma vaga da partida: bot, quem está na tela (teclado/toque) ou um celular da sala ({@code controle} = vaga na sala). */
export interface VagaJogo { nome: string; bot: Dificuldade | null; avatar: AvatarConfig; controle?: number }

export type FasePartida = "contagem" | "jogando" | "fimRodada" | "fimPartida";

export interface ResultadoPartida { vencedor: number | null; vitorias: number[]; rodadas: number; /** Pontos do próprio jogo (somados nas rodadas), quando o jogo tem placar. */ pontos?: number[] }

/** O fim de uma rodada: quem venceu (ou o time) — null nos dois é empate/derrota sozinho. */
export interface FimRodada { vencedor: number | null; time?: number | null; pontos?: number[] }

/** Estado resumido para o placar (atualizado algumas vezes por segundo). */
export interface InfoPlacar { tempo: number; alerta?: boolean; jogadores: { vivo: boolean; texto?: string }[] }

/**
 * O motor de um jogo: regras + desenho. A moldura cuida de rodadas, contagem, pausa, som, placar, controles e fim.
 * {@code passo} roda 60 vezes por segundo; {@code desenhar} a cada quadro (com {@code alfa} para interpolar).
 */
export interface MotorJogo {
  iniciarRodada(): void;
  passo(entradas: Entrada[]): FimRodada | null;
  desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null): void;
  placar(): InfoPlacar;
  redimensionar(): void;
  destruir(): void;
}

export interface GanchosMotor {
  /** Avisa quem caiu (vibra o celular dessa vaga). */
  morte(indice: number): void;
  /** Vibração curta para quem está na tela (ex.: pegou item). */
  vibrarLocal(indice: number, padrao: number | number[]): void;
}

interface Props {
  titulo: string;
  modoRotulo: string;
  /** Texto do topo: cenário, regra da rodada… */
  detalhe: string;
  vagas: VagaJogo[];
  vitoriasParaVencer: number;
  /** Rótulos dos botões A e B no controle da tela. */
  botoes: { a: string; b: string };
  ajudaTeclado: string;
  /** Música da partida (bpm). */
  bpm?: number;
  criarMotor: (caixa: HTMLDivElement, ganchos: GanchosMotor) => MotorJogo;
  onSair: () => void;
  onFim?: (r: ResultadoPartida) => void;
  avisoFim?: ReactNode;
  acaoFim?: { rotulo: string; aoClicar: () => void };
  subtitulo?: string;
  remotas?: EntradasRemotas;
  onFase?: (f: FasePartida) => void;
  onMorte?: (indice: number) => void;
  /** Sozinho: rótulos do fim (cumpriu o desafio ou não). */
  textosSolo?: { venceu: string; perdeu: string };
}

const VAZIA: Entrada = { direcao: null, a: false, b: false };

/** Moldura comum das partidas: placar, contagem, rodadas, pausa, fim e controles (teclado, toque e celulares). */
export default function MolduraPartida({
  titulo, modoRotulo, detalhe, vagas, vitoriasParaVencer, botoes, ajudaTeclado, bpm = 128, criarMotor, onSair, onFim, avisoFim, acaoFim,
  subtitulo, remotas, onFase, onMorte, textosSolo = { venceu: "🏆 Desafio cumprido!", perdeu: "Não foi dessa vez!" },
}: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const motor = useRef<MotorJogo | null>(null);
  const controles = useMemo(() => new Controles(), []);
  const [fase, setFase] = useState<FasePartida>("contagem");
  const faseRef = useRef<FasePartida>("contagem");
  const [contagem, setContagem] = useState(3);
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  const [mudo, setMudo] = useState(som.mudo);
  const [placar, setPlacar] = useState<InfoPlacar | null>(null);
  const [vitorias, setVitorias] = useState<number[]>(() => vagas.map(() => 0));
  const vitoriasRef = useRef<number[]>(vagas.map(() => 0));
  const pontosRef = useRef<number[] | null>(null);
  const [rodada, setRodada] = useState(1);
  const rodadaRef = useRef(1);
  const [ultimo, setUltimo] = useState<FimRodada | null>(null);
  const ultimoRef = useRef<FimRodada | null>(null);
  const [toque] = useState(telaDeToque);
  const onFimRef = useRef(onFim);
  onFimRef.current = onFim;
  const onFaseRef = useRef(onFase);
  onFaseRef.current = onFase;
  const onMorteRef = useRef(onMorte);
  onMorteRef.current = onMorte;
  const criarRef = useRef(criarMotor);
  criarRef.current = criarMotor;
  const local = useMemo(() => vagas.findIndex(v => !v.bot && v.controle === undefined), [vagas]);
  const solo = vagas.length === 1;

  const mudarFase = useCallback((f: FasePartida) => {
    faseRef.current = f;
    setFase(f);
    onFaseRef.current?.(f);
  }, []);

  const novaRodada = useCallback(() => {
    motor.current?.iniciarRodada();
    ultimoRef.current = null;
    setUltimo(null);
    setContagem(3);
    mudarFase("contagem");
  }, [mudarFase]);

  // Monta o motor uma vez (canvas 2D ou cena 3D dentro da caixa).
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const m = criarRef.current(el, {
      morte: i => { if (i === local) vibrar([60, 40, 120]); onMorteRef.current?.(i); },
      vibrarLocal: (i, p) => { if (i === local) vibrar(p); },
    });
    motor.current = m;
    m.iniciarRodada();
    const obs = new ResizeObserver(() => m.redimensionar());
    obs.observe(el);
    return () => { obs.disconnect(); m.destruir(); motor.current = null; };
  }, [local]);

  useEffect(() => {
    if (fase !== "contagem") return;
    if (contagem <= 0) {
      som.contagem(true);
      som.tocarMusica(bpm);
      mudarFase("jogando");
      return;
    }
    som.contagem(false);
    const t = setTimeout(() => setContagem(c => c - 1), 700);
    return () => clearTimeout(t);
  }, [fase, contagem, bpm, mudarFase]);

  useEffect(() => () => som.pararMusica(), []);

  // Laço: lê os controles, avança o motor e desenha.
  useEffect(() => {
    controles.ligar();
    let pausaAnterior = false;
    let ultimoPlacar = 0;
    let tempoTotal = 0;
    const atualizar = () => {
      const m = motor.current;
      if (!m) return;
      const c = controles.ler();
      const deFora = vagas.map(v => (v.controle !== undefined && remotas ? remotas.ler(v.controle) : null));
      const pausa = c.pausa || deFora.some(r => r?.p);
      if (pausa && !pausaAnterior && faseRef.current === "jogando") {
        pausadoRef.current = !pausadoRef.current;
        setPausado(pausadoRef.current);
        if (pausadoRef.current) som.pararMusica(); else som.tocarMusica(bpm);
      }
      pausaAnterior = pausa;
      if (faseRef.current !== "jogando" || pausadoRef.current) return;
      const entradas = vagas.map((_v, i) => {
        const r = deFora[i];
        if (r) return { direcao: r.x, a: r.a, b: r.b };
        return i === local && (c.direcao || c.a || c.b) ? { direcao: c.direcao, a: c.a, b: c.b } : VAZIA;
      });
      const fim = m.passo(entradas);
      if (!fim) return;
      som.pararMusica();
      ultimoRef.current = fim;
      setUltimo(fim);
      if (fim.pontos) pontosRef.current = (pontosRef.current ?? vagas.map(() => 0)).map((p, i) => p + (fim.pontos?.[i] ?? 0));
      const novo = [...vitoriasRef.current];
      if (fim.time !== null && fim.time !== undefined) vagas.forEach((_v, i) => { if (i % 2 === fim.time) novo[i] += 1; });
      else if (fim.vencedor !== null) novo[fim.vencedor] += 1;
      vitoriasRef.current = novo;
      setVitorias(novo);
      if (novo.some(n => n >= vitoriasParaVencer) || solo) {
        if (fim.vencedor !== null || (fim.time !== null && fim.time !== undefined)) som.vitoria(); else som.morte();
        mudarFase("fimPartida");
        const campeao = novo.findIndex(n => n >= vitoriasParaVencer);
        onFimRef.current?.({ vencedor: campeao >= 0 ? campeao : null, vitorias: novo, rodadas: rodadaRef.current, pontos: pontosRef.current ?? undefined });
      } else {
        mudarFase("fimRodada");
      }
    };
    const desenhar = (alfa: number, dt: number) => {
      const m = motor.current;
      if (!m) return;
      tempoTotal += dt;
      m.desenhar(faseRef.current === "jogando" && !pausadoRef.current ? alfa : 1, dt, faseRef.current, ultimoRef.current?.vencedor ?? null);
      if (tempoTotal - ultimoPlacar > 0.15) {
        ultimoPlacar = tempoTotal;
        setPlacar(m.placar());
      }
    };
    const laco = iniciarLaco(atualizar, desenhar);
    return () => { laco.parar(); controles.desligar(); };
  }, [controles, vagas, remotas, local, vitoriasParaVencer, bpm, solo, mudarFase]);

  const proximaRodada = () => { rodadaRef.current += 1; setRodada(rodadaRef.current); novaRodada(); };
  const revanche = () => {
    vitoriasRef.current = vagas.map(() => 0);
    pontosRef.current = null;
    setVitorias(vitoriasRef.current);
    rodadaRef.current = 1;
    setRodada(1);
    novaRodada();
  };
  const alternarPausa = () => {
    pausadoRef.current = !pausadoRef.current;
    setPausado(pausadoRef.current);
    if (pausadoRef.current) som.pararMusica(); else som.tocarMusica(bpm);
  };
  const tempo = placar ? `${Math.floor(placar.tempo / 60)}:${String(placar.tempo % 60).padStart(2, "0")}` : "--:--";
  const nomeVencedor = ultimo ? (ultimo.time !== null && ultimo.time !== undefined ? `Time ${ultimo.time === 0 ? "Ímpar (P1, P3…)" : "Par (P2, P4…)"}` : ultimo.vencedor !== null ? `P${ultimo.vencedor + 1} · ${vagas[ultimo.vencedor].nome}` : "Empate") : "";
  const campeao = vitorias.findIndex(v => v >= vitoriasParaVencer);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950 text-white" onPointerDown={() => som.destravar()} onKeyDown={() => som.destravar()}>
      <header className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
        <button type="button" onClick={onSair} aria-label="Sair do jogo" className="rounded-xl bg-white/10 p-2 hover:bg-white/20"><X className="h-5 w-5" /></button>
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-black">{titulo} · {modoRotulo}</p>
          <p className="text-xs text-white/60">{subtitulo ? `${subtitulo} · ` : ""}{detalhe}{solo ? "" : ` · rodada ${rodada} · vence quem fizer ${vitoriasParaVencer}`}</p>
        </div>
        <span className={`rounded-xl px-3 py-1.5 font-mono text-lg font-black tabular-nums ${placar?.alerta ? "animate-pulse bg-red-600" : "bg-white/10"}`} aria-label="Tempo restante">{tempo}</span>
        <button type="button" onClick={() => { som.definirMudo(!mudo); setMudo(!mudo); if (mudo && fase === "jogando") som.tocarMusica(bpm); }} aria-label={mudo ? "Ligar som" : "Desligar som"} className="rounded-xl bg-white/10 p-2 hover:bg-white/20">
          {mudo ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button type="button" onClick={alternarPausa} disabled={fase !== "jogando"} aria-label={pausado ? "Continuar" : "Pausar"} className="rounded-xl bg-white/10 p-2 hover:bg-white/20 disabled:opacity-40">
          {pausado ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
      </header>

      <ul className="flex gap-1.5 overflow-x-auto px-3 pb-2 sm:px-4" aria-label="Jogadores">
        {vagas.map((v, i) => {
          const j = placar?.jogadores[i];
          return (
            <li key={i} className={`flex shrink-0 items-center gap-2 rounded-xl px-2 py-1 ${j && !j.vivo ? "opacity-40" : ""}`} style={{ background: `${CORES_JOGADORES[i]}26`, boxShadow: `inset 0 0 0 2px ${CORES_JOGADORES[i]}` }}>
              <Avatar config={v.avatar} tamanho={28} semFundo className="[image-rendering:pixelated]" />
              <div className="leading-tight">
                <p className="text-xs font-black" style={{ color: CORES_JOGADORES[i] }}>P{i + 1}{v.bot ? " 🤖" : v.controle !== undefined ? " 📱" : ""}</p>
                <p className="text-[11px] tabular-nums text-white/80">{j?.texto ?? ""}{solo ? "" : ` · ★${vitorias[i]}`}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div ref={caixa} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2">
        {fase === "contagem" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span key={contagem} className="animate-[ping_0.7s_ease-out] text-8xl font-black drop-shadow-[0_6px_0_rgba(0,0,0,.6)]">{contagem > 0 ? contagem : "JÁ!"}</span>
          </div>
        )}
        {pausado && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60">
            <p className="text-3xl font-black">Pausado</p>
            <button type="button" onClick={alternarPausa} className="rounded-xl bg-white px-5 py-2 font-black text-slate-900">Continuar</button>
            <button type="button" onClick={onSair} className="rounded-xl bg-white/15 px-5 py-2 font-bold">Sair para a Central</button>
          </div>
        )}
        {(fase === "fimRodada" || fase === "fimPartida") && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">{fase === "fimPartida" ? "Fim da partida" : `Fim da rodada ${rodada}`}</p>
              {fase === "fimPartida" && campeao >= 0 ? (
                <>
                  <div className="mx-auto mt-3 w-24 rounded-2xl p-1" style={{ background: CORES_JOGADORES[campeao] }}>
                    <Avatar config={vagas[campeao].avatar} tamanho={88} />
                  </div>
                  <p className="mt-3 text-2xl font-black">{solo ? textosSolo.venceu : `🏆 P${campeao + 1} venceu!`}</p>
                  <p className="text-sm text-slate-500">{vagas[campeao].nome}</p>
                </>
              ) : (
                <p className="mt-2 text-2xl font-black">{solo ? textosSolo.perdeu : nomeVencedor === "Empate" ? "Empate!" : `${nomeVencedor} venceu a rodada`}</p>
              )}
              {!solo && (
                <ol className="mt-4 space-y-1 text-left text-sm">
                  {vagas.map((v, i) => ({ v, i })).sort((a, b) => vitorias[b.i] - vitorias[a.i]).map(({ v, i }) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: CORES_JOGADORES[i] }} />
                      <span className="font-bold">P{i + 1}</span><span className="truncate text-slate-500">{v.nome}</span>
                      <span className="ml-auto font-black tabular-nums">{"★".repeat(vitorias[i]) || "–"}</span>
                    </li>
                  ))}
                </ol>
              )}
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
        <ControleVirtual controles={controles} rotuloA={botoes.a} rotuloB={botoes.b} />
      ) : (
        <p className="px-4 py-2 text-center text-xs text-white/50">{ajudaTeclado}</p>
      )}
    </div>
  );
}
