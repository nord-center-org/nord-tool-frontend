import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, Loader2, Minus, Music2, Pause, PencilLine, Play, Plus, RotateCcw, Rewind, FastForward, Scissors, Timer, Volume2, VolumeX, Wand2,
} from "lucide-react";

import { desenhar } from "@/react-app/components/repertorio/desenhoInstrumento";
import CifraRolando, { type ControleCifra } from "@/react-app/components/repertorio/CifraRolando";
import { MotorAudio, decodificar, reamostrar, type FaixaAudio } from "@/react-app/components/repertorio/motorAudio";
import type { ResultadoAnalise } from "@/react-app/utils/musica/analise";
import { blocosComTempo, cifraDosAcordes, lerCifra } from "@/react-app/utils/musica/cifra";
import { INSTRUMENTOS, eventosParaTocar, instrumento, type IdInstrumento } from "@/react-app/utils/musica/instrumentos";
import type { Musica } from "@/react-app/utils/musica/repertorioDb";
import { FAIXAS, NOME_FAIXA } from "@/react-app/utils/musica/separacao";
import { blocoNoTempo, sincronizar } from "@/react-app/utils/musica/sincronia";
import { mod12, nomeDoTom, transporAcorde, transporTom, usaBemol } from "@/react-app/utils/musica/teoria";

const botao = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const quadrado = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const rotulo = "text-[10px] font-bold uppercase tracking-wide text-slate-400";

const relogio = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

/** Análise no worker (o áudio vai mono a 11025 Hz). */
async function analisarNoWorker(arquivo: Blob, aoProgresso: (p: number, etapa: string) => void): Promise<ResultadoAnalise> {
  aoProgresso(0, "Abrindo o áudio");
  const buf = await decodificar(arquivo);
  const mono = await reamostrar(buf, 11025, 1);
  const sinal = mono.getChannelData(0).slice();
  return new Promise((ok, erro) => {
    const w = new Worker(new URL("../../workers/analiseMusica.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ tipo: string; p?: number; etapa?: string; resultado?: ResultadoAnalise; mensagem?: string }>) => {
      if (e.data.tipo === "progresso") aoProgresso(e.data.p ?? 0, e.data.etapa ?? "");
      else { w.terminate(); if (e.data.tipo === "pronto" && e.data.resultado) ok(e.data.resultado); else erro(new Error(e.data.mensagem ?? "Não deu para analisar o áudio.")); }
    };
    w.onerror = () => { w.terminate(); erro(new Error("Não deu para analisar o áudio.")); };
    w.postMessage({ sinal, sr: 11025 }, [sinal.buffer]);
  });
}

/** Separação no worker (o áudio vai estéreo a 22050 Hz); devolve um WAV por faixa. */
async function separarNoWorker(arquivo: Blob, aoProgresso: (p: number) => void): Promise<Blob[]> {
  const buf = await decodificar(arquivo);
  const est = await reamostrar(buf, 22050, 2);
  const L = est.getChannelData(0).slice(), R = est.getChannelData(1).slice();
  return new Promise((ok, erro) => {
    const w = new Worker(new URL("../../workers/separacaoMusica.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ tipo: string; p?: number; wavs?: ArrayBuffer[]; mensagem?: string }>) => {
      if (e.data.tipo === "progresso") aoProgresso(e.data.p ?? 0);
      else { w.terminate(); if (e.data.tipo === "pronto" && e.data.wavs) ok(e.data.wavs.map(b => new Blob([b], { type: "audio/wav" }))); else erro(new Error(e.data.mensagem ?? "Não deu para separar as faixas.")); }
    };
    w.onerror = () => { w.terminate(); erro(new Error("Não deu para separar as faixas.")); };
    w.postMessage({ L, R, sr: 22050 }, [L.buffer, R.buffer]);
  });
}

interface Props {
  musica: Musica;
  arquivo: Blob;
  onVoltar: () => void;
  onSalvar: (m: Musica) => Promise<void>;
}

/**
 * Player do Repertório: tom e andamento, faixas separadas, a cifra rolando com a linha atual em destaque e, ao
 * lado, o instrumento escolhido com as notas descendo até onde se toca.
 */
export default function PlayerRepertorio({ musica: inicial, arquivo, onVoltar, onSalvar }: Props) {
  const [musica, setMusica] = useState(inicial);
  const motor = useRef<MotorAudio | null>(null);
  const [pronto, setPronto] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [ocupado, setOcupado] = useState<{ texto: string; p: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [faixas, setFaixas] = useState<FaixaAudio[]>([]);
  const [atual, setAtual] = useState(-1);
  const [seguir, setSeguir] = useState(true);
  const [fonte, setFonte] = useState(15);
  const [janela, setJanela] = useState(3);
  const [editandoCifra, setEditandoCifra] = useState(false);
  const [marcando, setMarcando] = useState<number | null>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const caixaTela = useRef<HTMLDivElement>(null);
  const cifraRef = useRef<ControleCifra>(null);
  const tempoTxt = useRef<HTMLSpanElement>(null);
  const barra = useRef<HTMLInputElement>(null);
  const arrastando = useRef(false);

  const { semitons, andamento, instrumento: idIns, semitonsCifra } = musica.ajustes;
  const analise = musica.analise;
  const ins = instrumento(idIns);
  // notas e acordes escritos como na cifra do tom que está tocando (bemol em F, Bb, Eb, Dm, Gm…)
  const bemol = analise ? usaBemol(mod12(analise.tom.tonica + semitons), analise.tom.menor) : false;

  const atualizar = useCallback((parcial: Partial<Musica> | ((m: Musica) => Partial<Musica>)) => {
    setMusica(m => {
      const novo = { ...m, ...(typeof parcial === "function" ? parcial(m) : parcial) };
      void onSalvar(novo);
      return novo;
    });
  }, [onSalvar]);
  const ajustar = (p: Partial<Musica["ajustes"]>) => atualizar(m => ({ ajustes: { ...m.ajustes, ...p } }));

  // ---------- abrir: analisar (se preciso) e preparar o áudio ----------
  useEffect(() => {
    const m = new MotorAudio();
    motor.current = m;
    m.aoMudar = () => setTocando(m.estaTocando);
    let vivo = true;
    (async () => {
      try {
        let a = inicial.analise;
        if (!a) {
          a = await analisarNoWorker(arquivo, (p, etapa) => vivo && setOcupado({ texto: etapa, p }));
          if (!vivo) return;
          const r = a;
          atualizar({ analise: r, duracao: r.duracao });
        }
        setOcupado({ texto: inicial.ajustes.semitons ? "Mudando o tom" : "Preparando o áudio", p: 1 });
        const lista: FaixaAudio[] = [{ id: "musica", nome: "Música", original: arquivo, volume: 1, mudo: false, solo: false }];
        m.setAndamento(inicial.ajustes.andamento);
        await m.setTom(inicial.ajustes.semitons);
        await m.definirFaixas(lista);
        if (!vivo) return;
        setFaixas(lista);
        setPronto(true);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Não deu para abrir a música.");
      } finally {
        if (vivo) setOcupado(null);
      }
    })();
    return () => { vivo = false; m.fechar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- cifra e tempos ----------
  const cifra = useMemo(() => lerCifra(musica.cifra), [musica.cifra]);
  const auto = useMemo(() => (analise ? sincronizar(cifra, analise.acordes, analise.duracao) : null), [cifra, analise]);
  const tempos = useMemo(() => {
    const manual = musica.tempos;
    if (manual && manual.length === cifra.blocos.length) return manual;
    return auto?.tempos ?? cifra.blocos.map(() => null);
  }, [musica.tempos, auto, cifra]);
  const temposRef = useRef(tempos);
  temposRef.current = tempos;
  const ordemComTempo = useMemo(() => blocosComTempo(cifra), [cifra]);

  // ---------- instrumento ----------
  const [larguraTela, setLarguraTela] = useState(800);
  const casas = ins.id === "teclado" ? 0 : larguraTela < 560 ? 12 : ins.casas;
  const eventos = useMemo(() => (analise ? eventosParaTocar(ins, analise.notasBaixo, analise.acordes, semitons, casas || ins.casas) : []), [analise, ins, semitons, casas]);
  const acordes = useMemo(() => (analise?.acordes ?? []).filter(a => a.acorde !== "N").map(a => ({ ...a, nome: transporAcorde(a.acorde, semitons, bemol) })), [analise, semitons, bemol]);

  // ---------- quadro a quadro ----------
  const estado = useRef({ eventos, acordes, ins, casas, janela, atual, bemol });
  estado.current = { eventos, acordes, ins, casas, janela, atual, bemol };
  useEffect(() => {
    let id = 0, quadro = 0;
    const loop = () => {
      id = requestAnimationFrame(loop);
      const m = motor.current, c = tela.current;
      if (!m) return;
      const t = m.tempo();
      if (++quadro % 15 === 0 && m.estaTocando) m.sincronizar();
      const s = estado.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const i = s.acordes.findIndex(a => t >= a.inicio && t < a.fim);
          const prox = s.acordes.find(a => a.inicio > t);
          desenhar(ctx, c.width / dpr, c.height / dpr, {
            instrumento: s.ins, eventos: s.eventos, casas: s.casas, janela: s.janela, escuro: document.documentElement.classList.contains("nt-escuro"), bemol: s.bemol,
            acordeAtual: i >= 0 ? s.acordes[i].nome : null, proximoAcorde: prox?.nome ?? null,
          }, t);
        }
      }
      const tp = temposRef.current;
      const a = blocoNoTempo(tp, t);
      if (a !== s.atual) setAtual(a);
      if (a >= 0) {
        const ini = tp[a] as number;
        const prox = tp.slice(a + 1).find((x): x is number => x !== null) ?? ini + 4;
        cifraRef.current?.progresso((t - ini) / Math.max(0.5, prox - ini));
      }
      if (tempoTxt.current) tempoTxt.current.textContent = relogio(t);
      if (barra.current && !arrastando.current) barra.current.value = String(t);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  // tamanho do canvas acompanha a caixa
  useEffect(() => {
    const caixa = caixaTela.current, c = tela.current;
    if (!caixa || !c) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(caixa.clientWidth * dpr);
      c.height = Math.round(caixa.clientHeight * dpr);
      setLarguraTela(caixa.clientWidth);
    });
    ro.observe(caixa);
    return () => ro.disconnect();
  }, [pronto]);

  // ---------- comandos ----------
  const alternar = async () => { const m = motor.current; if (!m) return; if (m.estaTocando) m.pausar(); else await m.tocar(); };
  const pular = (d: number) => { const m = motor.current; if (m) m.irPara(Math.max(0, Math.min(musica.duracao, m.tempo() + d))); };
  const mudarTom = async (s: number) => {
    const m = motor.current;
    if (!m) return;
    const alvo = Math.max(-12, Math.min(12, s));
    ajustar({ semitons: alvo });
    setOcupado({ texto: "Mudando o tom", p: 1 });
    try { await m.setTom(alvo); } finally { setOcupado(null); }
  };
  const mudarAndamento = (a: number) => { const v = Math.round(a * 100) / 100; motor.current?.setAndamento(v); ajustar({ andamento: v }); };

  const separarFaixas = async () => {
    const m = motor.current;
    if (!m) return;
    setErro(null);
    setOcupado({ texto: "Separando as faixas", p: 0 });
    try {
      const wavs = await separarNoWorker(arquivo, p => setOcupado({ texto: "Separando as faixas", p }));
      const lista: FaixaAudio[] = FAIXAS.map((f, i) => ({ id: f, nome: NOME_FAIXA[f], original: wavs[i], volume: 1, mudo: false, solo: false }));
      setOcupado({ texto: semitons ? "Mudando o tom das faixas" : "Preparando as faixas", p: 1 });
      await m.definirFaixas(lista);
      setFaixas(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para separar as faixas.");
    } finally {
      setOcupado(null);
    }
  };
  const ajustarFaixa = (id: string, p: Partial<Pick<FaixaAudio, "volume" | "mudo" | "solo">>) => {
    motor.current?.ajustarFaixa(id, p);
    setFaixas(l => l.map(f => (f.id === id ? { ...f, ...p } : f)));
  };

  // marcar as linhas na mão: cada toque marca o início da linha seguinte
  const comecarMarcar = async () => {
    setMarcando(ordemComTempo[0] ?? null);
    atualizar({ tempos: cifra.blocos.map(() => null) });
    motor.current?.irPara(0);
    await motor.current?.tocar();
  };
  const marcar = useCallback(() => {
    const m = motor.current;
    if (marcando === null || !m) return;
    const t = Math.round(m.tempo() * 100) / 100;
    atualizar(mu => {
      const base = mu.tempos && mu.tempos.length === cifra.blocos.length ? [...mu.tempos] : cifra.blocos.map(() => null);
      base[marcando] = t;
      return { tempos: base };
    });
    const k = ordemComTempo.indexOf(marcando);
    setMarcando(ordemComTempo[k + 1] ?? null);
  }, [marcando, ordemComTempo, cifra.blocos, atualizar]);

  // teclado: espaço toca/pausa, setas pulam, Enter marca a linha
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === " ") { e.preventDefault(); void alternar(); }
      else if (e.key === "ArrowLeft") pular(-5);
      else if (e.key === "ArrowRight") pular(5);
      else if (e.key === "Enter" && marcando !== null) { e.preventDefault(); marcar(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const tomOriginal = analise ? nomeDoTom(analise.tom) : null;
  const tomAtual = analise ? nomeDoTom(transporTom(analise.tom, semitons)) : null;
  const sugestaoCifra = auto && musica.cifra.trim() && auto.acerto >= 0.25 && auto.deslocamento !== 0 && semitonsCifra !== auto.deslocamento ? auto.deslocamento : null;

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-2 md:h-[calc(100dvh-4rem)]">
      {/* topo */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Músicas</button>
        <div className="min-w-0 flex-1">
          <input value={musica.titulo} onChange={e => atualizar({ titulo: e.target.value.slice(0, 120) })} aria-label="Nome da música"
            className="w-full truncate rounded-lg border border-transparent bg-transparent px-1 text-base font-bold text-slate-800 hover:border-slate-200 focus:border-blue-500 focus:outline-none" />
          <input value={musica.artista} onChange={e => atualizar({ artista: e.target.value.slice(0, 120) })} aria-label="Artista" placeholder="Artista"
            className="w-full truncate rounded-lg border border-transparent bg-transparent px-1 text-xs text-slate-500 hover:border-slate-200 focus:border-blue-500 focus:outline-none" />
        </div>
        {analise && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-lg bg-orange-50 px-2 py-1 font-bold text-orange-700" title={`Tom reconhecido: ${tomOriginal?.extenso}`}>Tom: {tomAtual?.cifra} <span className="font-normal">({tomAtual?.extenso})</span></span>
            <span className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-700">{Math.round(analise.bpm * andamento)} BPM</span>
          </div>
        )}
      </div>

      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{erro}</p>}

      {/* controles */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-2">
        <div className="flex items-center gap-1.5">
          <button type="button" className={quadrado} aria-label="Voltar 5 segundos" title="Voltar 5 s (←)" onClick={() => pular(-5)} disabled={!pronto}><Rewind className="h-4 w-4" /></button>
          <button type="button" aria-label={tocando ? "Pausar" : "Tocar"} title="Tocar/pausar (espaço)" onClick={() => void alternar()} disabled={!pronto}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
            {tocando ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
          </button>
          <button type="button" className={quadrado} aria-label="Avançar 5 segundos" title="Avançar 5 s (→)" onClick={() => pular(5)} disabled={!pronto}><FastForward className="h-4 w-4" /></button>
          <span ref={tempoTxt} className="w-10 text-right text-xs tabular-nums text-slate-600">0:00</span>
        </div>
        <input ref={barra} type="range" min={0} max={Math.max(1, musica.duracao)} step={0.1} defaultValue={0} aria-label="Posição na música" disabled={!pronto}
          onPointerDown={() => { arrastando.current = true; }} onPointerUp={() => { arrastando.current = false; }}
          onChange={e => motor.current?.irPara(Number(e.target.value))} className="min-w-[8rem] flex-1" />
        <span className="text-xs tabular-nums text-slate-400">{relogio(musica.duracao)}</span>
        <div className="flex items-center gap-1" role="group" aria-label="Tom">
          <span className={rotulo}>Tom</span>
          <button type="button" className={quadrado} aria-label="Descer meio tom" onClick={() => void mudarTom(semitons - 1)} disabled={!pronto || semitons <= -12}><Minus className="h-3.5 w-3.5" /></button>
          <span className="w-8 text-center text-xs font-bold tabular-nums text-slate-700">{semitons > 0 ? `+${semitons}` : semitons}</span>
          <button type="button" className={quadrado} aria-label="Subir meio tom" onClick={() => void mudarTom(semitons + 1)} disabled={!pronto || semitons >= 12}><Plus className="h-3.5 w-3.5" /></button>
          {semitons !== 0 && <button type="button" className={quadrado} aria-label="Voltar ao tom original" title="Tom original" onClick={() => void mudarTom(0)}><RotateCcw className="h-3.5 w-3.5" /></button>}
        </div>
        <label className="flex items-center gap-1.5">
          <Timer className="h-4 w-4 text-slate-400" aria-hidden="true" /><span className={rotulo}>Andamento</span>
          <input type="range" min={0.5} max={1.5} step={0.05} value={andamento} onChange={e => mudarAndamento(Number(e.target.value))} aria-label="Andamento" className="w-24" />
          <span className="w-10 text-xs font-bold tabular-nums text-slate-700">{Math.round(andamento * 100)}%</span>
        </label>
        <label className="flex items-center gap-1.5">
          <Music2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <select value={idIns} onChange={e => ajustar({ instrumento: e.target.value as IdInstrumento })} aria-label="Instrumento" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700">
            {INSTRUMENTOS.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </label>
      </div>

      {/* faixas */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2" aria-label="Faixas">
        {faixas.length <= 1 ? (
          <>
            <button type="button" className={`${botao} shrink-0`} onClick={() => void separarFaixas()} disabled={!pronto || !!ocupado}><Scissors className="h-3.5 w-3.5" />Separar faixas</button>
            <span className="hidden text-[11px] leading-tight text-slate-500 sm:inline">Voz, baixo, bateria e outros, separados no aparelho (aproximado).</span>
          </>
        ) : faixas.map(f => (
          <div key={f.id} className={`flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 ${f.solo ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
            <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={f.mudo ? `Ligar ${f.nome}` : `Silenciar ${f.nome}`} onClick={() => ajustarFaixa(f.id, { mudo: !f.mudo })}>
              {f.mudo ? <VolumeX className="h-3.5 w-3.5 text-red-500" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <span className="w-12 text-xs font-bold text-slate-700">{f.nome}</span>
            <input type="range" min={0} max={1.5} step={0.05} value={f.volume} aria-label={`Volume de ${f.nome}`} onChange={e => ajustarFaixa(f.id, { volume: Number(e.target.value) })} className="w-16 sm:w-20" />
            <button type="button" aria-pressed={f.solo} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${f.solo ? "bg-amber-400 text-white" : "text-slate-500 hover:bg-slate-100"}`} onClick={() => ajustarFaixa(f.id, { solo: !f.solo })} title={`Ouvir só ${f.nome}`}>S</button>
          </div>
        ))}
      </div>

      {/* cifra + instrumento */}
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-2 md:flex-row">
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 p-2">
            <b className="mr-auto text-sm text-slate-700">Letra e cifra</b>
            {marcando !== null ? (
              <>
                <button type="button" className={`${botao} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} onClick={marcar}><Check className="h-3.5 w-3.5" />Marcar linha (Enter)</button>
                <button type="button" className={botao} onClick={() => setMarcando(null)}>Parar</button>
              </>
            ) : (
              <>
                <button type="button" className={botao} onClick={() => setEditandoCifra(true)}><PencilLine className="h-3.5 w-3.5" />{musica.cifra.trim() ? "Editar cifra" : "Colar cifra"}</button>
                {musica.cifra.trim() && <button type="button" className={botao} onClick={() => void comecarMarcar()} disabled={!pronto} title="Toque em Marcar quando cada linha começar">Marcar linhas</button>}
                {musica.tempos && <button type="button" className={botao} onClick={() => atualizar({ tempos: null })} title="Voltar aos tempos calculados pelos acordes">Automático</button>}
              </>
            )}
            <div className="flex items-center gap-0.5" role="group" aria-label="Tamanho da letra">
              <button type="button" className={quadrado} aria-label="Letra menor" onClick={() => setFonte(f => Math.max(11, f - 1))}>A-</button>
              <button type="button" className={quadrado} aria-label="Letra maior" onClick={() => setFonte(f => Math.min(26, f + 1))}>A+</button>
            </div>
            <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={seguir} onChange={e => setSeguir(e.target.checked)} />Rolar sozinha</label>
          </div>
          {sugestaoCifra !== null && (
            <p className="flex flex-wrap items-center gap-2 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
              A cifra parece estar em outro tom que o áudio ({sugestaoCifra > 0 ? "+" : ""}{sugestaoCifra} semitons).
              <button type="button" className="font-bold underline" onClick={() => ajustar({ semitonsCifra: sugestaoCifra })}>Ajustar a cifra ao áudio</button>
            </p>
          )}
          {semitonsCifra !== 0 && (
            <p className="flex items-center gap-2 px-3 pt-1.5 text-[11px] text-slate-500">Cifra transposta {semitonsCifra > 0 ? "+" : ""}{semitonsCifra} para casar com o áudio.
              <button type="button" className="font-bold underline" onClick={() => ajustar({ semitonsCifra: 0 })}>Como escrita</button></p>
          )}
          <div className="min-h-0 flex-1">
            {musica.cifra.trim() ? (
              <CifraRolando ref={cifraRef} cifra={cifra} tempos={tempos} atual={atual} semitons={semitons + semitonsCifra} seguir={seguir} marcando={marcando} tamanhoFonte={fonte}
                onTocarLinha={i => { if (marcando !== null) return; const t = tempos[i]; if (t !== null && t !== undefined) motor.current?.irPara(t); }} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="max-w-sm text-sm text-slate-500">Cole a cifra (do Cifra Club, por exemplo) para a letra rolar com a música. Ou gere uma cifra com os acordes que reconheci no áudio.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className={botao} onClick={() => setEditandoCifra(true)}><PencilLine className="h-3.5 w-3.5" />Colar cifra</button>
                  {analise && <button type="button" className={botao} onClick={() => atualizar({ cifra: cifraDosAcordes(analise.acordes, (4 * 60) / analise.bpm), tempos: null })}><Wand2 className="h-3.5 w-3.5" />Gerar do áudio</button>}
                </div>
              </div>
            )}
          </div>
        </section>
        <section className="flex h-[36vh] min-h-[220px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white md:h-auto md:w-[46%]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
            <b className="mr-auto text-sm text-slate-700">{ins.nome}</b>
            <span className="hidden text-[11px] text-slate-500 sm:inline">{ins.fonte === "baixo" ? "linha do baixo" : "acordes"}</span>
            <label className="flex items-center gap-1 text-[11px] text-slate-500" title="Quanto tempo as notas levam para descer">
              Queda<input type="range" min={1.5} max={6} step={0.5} value={janela} onChange={e => setJanela(Number(e.target.value))} aria-label="Velocidade da queda" className="w-16" />
            </label>
          </div>
          <div ref={caixaTela} className="relative min-h-0 flex-1">
            <canvas ref={tela} className="absolute inset-0 h-full w-full" aria-label={`Animação do ${ins.nome} com as notas`} role="img" />
          </div>
        </section>
      </div>

      {ocupado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="status" aria-live="polite">
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 text-center shadow-2xl">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
            <p className="mt-2 text-sm font-bold text-slate-800">{ocupado.texto}…</p>
            {ocupado.p < 1 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600 transition-[width]" style={{ width: `${Math.round(ocupado.p * 100)}%` }} /></div>}
            <p className="mt-2 text-[11px] text-slate-500">Tudo é feito no aparelho; pode levar alguns segundos.</p>
          </div>
        </div>
      )}

      {editandoCifra && (
        <EditorCifra texto={musica.cifra} onFechar={() => setEditandoCifra(false)}
          onSalvar={texto => { atualizar({ cifra: texto, tempos: null }); setEditandoCifra(false); }} />
      )}
    </div>
  );
}

function EditorCifra({ texto, onSalvar, onFechar }: { texto: string; onSalvar: (t: string) => void; onFechar: () => void }) {
  const [valor, setValor] = useState(texto);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3" role="dialog" aria-label="Cifra">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl bg-white p-4 shadow-2xl">
        <p className="text-sm font-bold text-slate-800">Cifra</p>
        <p className="mb-2 text-xs text-slate-500">Cole a cifra como no Cifra Club: acordes numa linha e a letra embaixo, seções como [Refrão] e, se quiser, a linha "Tom: Em".</p>
        <textarea autoFocus value={valor} onChange={e => setValor(e.target.value)} aria-label="Texto da cifra" spellCheck={false}
          className="min-h-[50vh] w-full flex-1 resize-none rounded-xl border border-slate-200 p-3 font-mono text-sm leading-snug outline-none focus:border-blue-500"
          placeholder={"Tom: G\n\n[Intro] G  D  Em  C\n\n[Primeira Parte]\nG              D\n  Escreva aqui a letra\nEm             C\n  com os acordes em cima"} />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className={botao} onClick={onFechar}>Cancelar</button>
          <button type="button" className={`${botao} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} onClick={() => onSalvar(valor.slice(0, 50_000))}>Salvar cifra</button>
        </div>
      </div>
    </div>
  );
}
