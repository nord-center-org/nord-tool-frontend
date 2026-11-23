import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Crosshair, Minus, Pause, Play, Plus, RotateCcw, Undo2 } from "lucide-react";

import type { Cifra } from "@/react-app/utils/musica/cifra";
import { acordesEmOrdem, empurrar, moverSo, picos, temposDosAcordes } from "@/react-app/utils/musica/linhaDoTempo";
import { decodificar } from "./motorAudio";
import { acordeExibido, type Notacao } from "@/react-app/utils/musica/notacao";
import { transporAcorde } from "@/react-app/utils/musica/teoria";
import { desenhoEscuro } from "./ambiente";

const botao = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const ZOOMS = [20, 35, 60, 100, 160];

interface Props {
  cifra: Cifra;
  /** O começo de cada linha (calculado ou marcado). */
  tempos: (number | null)[];
  duracao: number;
  /** As horas já guardadas de cada acorde (null = pelas linhas). */
  guardados: number[] | null | undefined;
  /** Transposição da cifra para o tom que se ouve. */
  semitons: number;
  notacao: Notacao;
  batidas?: number[];
  /** O áudio, para desenhar a forma de onda. */
  arquivo?: Blob;
  tocando: boolean;
  tempo: () => number;
  irPara: (t: number) => void;
  onAlternar: () => void;
  onTocarAcorde: (nome: string) => void;
  onMudar: (ts: number[]) => void;
  onAutomatico: () => void;
  onFechar: () => void;
}

/**
 * Repertório v17 — a linha do tempo dos acordes: cada acorde é um bloco na hora em que entra. Arrastar leva junto os
 * que vêm depois (ou só ele); "Pôr aqui" leva o escolhido para o ponto da música. A letra aparece embaixo para guiar.
 */
export default function LinhaDoTempoAcordes(props: Props) {
  const { cifra, tempos, duracao, guardados, semitons, notacao, batidas, arquivo, tocando, tempo, irPara, onAlternar, onTocarAcorde, onMudar, onAutomatico, onFechar } = props;
  const ordem = useMemo(() => acordesEmOrdem(cifra), [cifra]);
  const ts = useMemo(() => temposDosAcordes(cifra, tempos, duracao, guardados), [cifra, tempos, duracao, guardados]);
  const [previa, setPrevia] = useState<number[] | null>(null);
  const vistos = previa ?? ts;
  const [sel, setSel] = useState<number | null>(null);
  const [modo, setModo] = useState<"empurrar" | "so">("empurrar");
  const [zoom, setZoom] = useState(2);
  const px = ZOOMS[zoom];
  const historico = useRef<number[][]>([]);
  const arrastando = useRef(false);
  const trilho = useRef<HTMLDivElement>(null);
  const agulha = useRef<HTMLDivElement>(null);
  const largura = Math.max(1, duracao) * px + 48;
  const tocado = (nome: string) => (semitons ? transporAcorde(nome, semitons) : nome);
  const visto = (nome: string) => acordeExibido(tocado(nome), notacao);

  const gravar = (novo: number[]) => {
    if (novo.every((t, i) => t === ts[i])) return;
    historico.current = [...historico.current.slice(-99), ts];
    onMudar(novo);
  };
  const desfazer = () => { const ant = historico.current.pop(); if (ant) onMudar(ant); };
  const mover = (base: number[], k: number, novo: number) => (modo === "empurrar" ? empurrar(base, k, novo, duracao) : moverSo(base, k, novo, duracao));
  /** O escolhido entra no ponto da música; os seguintes vão junto e o próximo fica escolhido. */
  const porAqui = () => {
    if (sel === null) return;
    gravar(mover(ts, sel, tempo()));
    setSel(Math.min(ordem.length - 1, sel + 1));
  };

  // a forma de onda: calculada uma vez e desenhada só na parte que aparece (o trilho pode ser muito largo)
  const [onda, setOnda] = useState<Float32Array | null>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!arquivo) return;
    let vivo = true;
    void decodificar(arquivo).then(buf => {
      const canais = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i));
      if (vivo) setOnda(picos(canais, buf.sampleRate, 100));
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [arquivo]);
  const desenharOnda = useRef(() => {});
  desenharOnda.current = () => {
    const c = tela.current, t = trilho.current;
    if (!c || !t) return;
    const w = t.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1;
    c.style.left = `${t.scrollLeft}px`;
    c.style.width = `${w}px`;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!onda) return;
    ctx.fillStyle = desenhoEscuro() ? "#475569" : "#cbd5e1";
    const meio = h / 2;
    for (let x = 0; x < w; x++) {
      const s0 = (t.scrollLeft + x) / px, s1 = (t.scrollLeft + x + 1) / px;
      let v = 0;
      for (let k = Math.floor(s0 * 100); k < Math.min(onda.length, Math.ceil(s1 * 100)); k++) if (onda[k] > v) v = onda[k];
      const a = Math.max(0.5, v * (meio - 2));
      ctx.fillRect(x, meio - a, 1, a * 2);
    }
  };
  useEffect(() => {
    desenharOnda.current();
    const t = trilho.current;
    if (!t) return;
    const f = () => desenharOnda.current();
    t.addEventListener("scroll", f, { passive: true });
    window.addEventListener("resize", f);
    return () => { t.removeEventListener("scroll", f); window.removeEventListener("resize", f); };
  }, [onda, px]);

  // a agulha anda com a música (e a tela acompanha enquanto toca)
  useEffect(() => {
    let id = 0;
    const passo = () => {
      const t = tempo(), el = agulha.current, c = trilho.current;
      if (el) el.style.transform = `translateX(${t * px}px)`;
      if (c && tocando && !arrastando.current) {
        const x = t * px;
        if (x < c.scrollLeft + 40 || x > c.scrollLeft + c.clientWidth - 80) c.scrollLeft = Math.max(0, x - c.clientWidth / 3);
      }
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [tempo, px, tocando]);

  // arrastar um bloco: segue o ponteiro na janela toda
  const pegar = (e: React.PointerEvent, k: number) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const x0 = e.clientX, base = ts;
    let moveu = false, ultimo = base;
    arrastando.current = true;
    const andar = (ev: PointerEvent) => {
      moveu = moveu || Math.abs(ev.clientX - x0) > 3;
      if (!moveu) return;
      ultimo = mover(base, k, base[k] + (ev.clientX - x0) / px);
      setPrevia(ultimo);
    };
    const soltar = () => {
      window.removeEventListener("pointermove", andar);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      arrastando.current = false;
      setPrevia(null);
      setSel(k);
      if (moveu) gravar(ultimo);
      else { irPara(base[k]); onTocarAcorde(tocado(ordem[k].nome)); }
    };
    window.addEventListener("pointermove", andar);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  };

  // teclas (antes das do player): ←/→ ajustam o escolhido, Enter põe aqui, Ctrl+Z desfaz
  const vivo = useRef({ sel, ts, porAqui, desfazer, mover, gravar });
  vivo.current = { sel, ts, porAqui, desfazer, mover, gravar };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      const v = vivo.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopPropagation(); v.desfazer(); return; }
      if (v.sel === null) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault(); e.stopPropagation();
        const passo = (e.shiftKey ? 0.5 : 0.05) * (e.key === "ArrowLeft" ? -1 : 1);
        v.gravar(v.mover(v.ts, v.sel, v.ts[v.sel] + passo));
      } else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); v.porAqui(); }
      else if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, []);

  const linhas = useMemo(() => cifra.blocos.map((b, i) => ({ texto: b.tipo === "letra" ? b.texto.trim() : b.tipo === "secao" ? `[${b.texto}]` : "", t: tempos[i] }))
    .filter((l): l is { texto: string; t: number } => !!l.texto && typeof l.t === "number" && Number.isFinite(l.t)), [cifra, tempos]);
  const marcas = useMemo(() => {
    const passo = px >= 100 ? 1 : px >= 35 ? 5 : 10;
    return Array.from({ length: Math.floor(duracao / passo) + 1 }, (_, i) => i * passo);
  }, [duracao, px]);
  const relogio = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" role="region" aria-label="Linha do tempo dos acordes">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 p-2">
        <b className="mr-auto text-sm text-slate-700">Linha do tempo <span className="font-normal text-slate-400">· arraste os acordes</span></b>
        <button type="button" className={botao} onClick={desfazer} disabled={!historico.current.length} title="Desfazer (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" />Desfazer</button>
        <button type="button" className={botao} onClick={() => { historico.current = [...historico.current, ts]; onAutomatico(); }} disabled={!guardados} title="Volta às horas calculadas pelas linhas"><RotateCcw className="h-3.5 w-3.5" />Automático</button>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700" onClick={onFechar}><Check className="h-3.5 w-3.5" />Pronto</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <button type="button" aria-label={tocando ? "Pausar" : "Tocar"} onClick={onAlternar}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700">{tocando ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}</button>
        <button type="button" className={botao} disabled={sel === null} onClick={porAqui} title="O acorde escolhido entra no ponto da música (Enter); os seguintes vão junto">
          <Crosshair className="h-3.5 w-3.5" />Pôr aqui
        </button>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5" role="radiogroup" aria-label="Ao arrastar">
          {([["empurrar", "Empurra os seguintes"], ["so", "Só este"]] as const).map(([v, r]) => (
            <button key={v} type="button" role="radio" aria-checked={modo === v} onClick={() => setModo(v)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${modo === v ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{r}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-0.5" role="group" aria-label="Zoom">
          <button type="button" className={`${botao} px-1.5`} aria-label="Afastar" disabled={zoom === 0} onClick={() => setZoom(z => Math.max(0, z - 1))}><Minus className="h-3.5 w-3.5" /></button>
          <button type="button" className={`${botao} px-1.5`} aria-label="Aproximar" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(z => Math.min(ZOOMS.length - 1, z + 1))}><Plus className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div ref={trilho} className="relative min-h-[12rem] flex-1 select-none overflow-x-auto overflow-y-hidden" aria-label="Linha do tempo">
        <div className="relative h-full" style={{ width: largura }}>
          {/* régua: clicar leva a música para lá */}
          <div className="absolute inset-x-0 top-0 h-6 cursor-pointer border-b border-slate-200 bg-white" aria-label="Régua do tempo"
            onPointerDown={e => { const r = e.currentTarget.getBoundingClientRect(); irPara(Math.max(0, Math.min(duracao, (e.clientX - r.left) / px))); }}>
            {marcas.map(s => (
              <span key={s} className="absolute top-0 h-full border-l border-slate-300 pl-1 text-[10px] tabular-nums text-slate-400" style={{ left: s * px }}>{relogio(s)}</span>
            ))}
          </div>
          {/* batidas */}
          {px >= 35 && batidas?.map((b, i) => <span key={i} aria-hidden="true" className="absolute bottom-0 top-6 w-px bg-slate-100" style={{ left: b * px }} />)}
          {/* os acordes */}
          <div className="absolute inset-x-0 top-9 h-12" role="list" aria-label="Acordes no tempo">
            {ordem.map((a, k) => {
              const t = vistos[k], fim = k + 1 < vistos.length ? vistos[k + 1] : duracao;
              const escolhido = sel === k;
              return (
                <button key={k} type="button" role="listitem" aria-label={`${visto(a.nome)} em ${relogio(t)}`} title={`${visto(a.nome)} · ${t.toFixed(2)} s`}
                  style={{ left: t * px, width: Math.max(26, (fim - t) * px - 2), touchAction: "none" }} onPointerDown={e => pegar(e, k)}
                  className={`absolute top-0 flex h-full cursor-grab items-center overflow-hidden rounded-lg border-l-4 px-1.5 text-left text-sm font-bold shadow-sm active:cursor-grabbing ${escolhido ? "border-orange-700 bg-orange-500 text-white" : "border-orange-500 bg-orange-100 text-orange-800 hover:bg-orange-200"}`}>
                  <span className="truncate">{visto(a.nome)}</span>
                </button>
              );
            })}
          </div>
          {/* a letra, para guiar */}
          <div className="absolute inset-x-0 top-[5.75rem] h-6" aria-label="Letra no tempo">
            {linhas.map((l, i) => {
              const fim = i + 1 < linhas.length ? linhas[i + 1].t : duracao;
              return <span key={i} className="absolute truncate border-l border-slate-300 pl-1 text-[11px] text-slate-500" style={{ left: l.t * px, width: Math.max(20, (fim - l.t) * px - 4) }}>{l.texto}</span>;
            })}
          </div>
          {/* forma de onda, embaixo de tudo */}
          <canvas ref={tela} aria-hidden="true" className="pointer-events-none absolute bottom-0 top-[7.75rem]" />
          {/* agulha */}
          <div ref={agulha} aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5 bg-red-500" />
        </div>
      </div>
      <p className="border-t border-slate-100 px-2 py-1.5 text-[11px] text-slate-500">
        Arraste um acorde: {modo === "empurrar" ? "os que vêm depois vão junto" : "só ele anda, entre os vizinhos"}. Clique num acorde para ouvir e ir até ele; com a música tocando, “Pôr aqui” (Enter) leva o escolhido para aquele ponto e passa para o próximo. ←/→ ajustam o escolhido (Shift: mais).
      </p>
    </div>
  );
}
