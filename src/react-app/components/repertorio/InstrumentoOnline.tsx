import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";

import type { Sintetizador } from "@/react-app/components/repertorio/sintetizador";
import { OITAVA_PADRAO, PECAS_BATERIA, notaDaTecla, pecaDaTecla, teclaDaNota, type Timbre } from "@/react-app/utils/musica/estudio";
import {
  ACORDES_UMA_TECLA, CORDAS_DO_BRACO, ESCALAS, VARIANTES, gravarFerramentas, lerFerramentasDe, naEscala, notaNoBraco, notasDaEscala, notasDaTecla, temBraco, variante as varianteValida,
  type FerramentasTocar,
} from "@/react-app/utils/musica/ferramentas";
import { corDaNota, ehPreta } from "@/react-app/utils/musica/instrumentos";
import { nomeDaNotaExibida } from "@/react-app/utils/musica/notacao";
import { useNotacao } from "./useNotacao";

interface Props {
  sint: Sintetizador;
  timbre: Timbre;
  /** Ganho da faixa (no estúdio), para o som sair no volume dela. */
  destino?: AudioNode;
  /** Cada nota tocada (para gravar): instantes no relógio do áudio. */
  aoTocar?: (midi: number, vel: number, inicio: number, fim: number) => void;
  /** Teclas do computador ativas (desligue quando outro campo tiver o foco). */
  teclado?: boolean;
  /** v8: timbre escolhido de fora (a faixa do estúdio); sem ele, fica a escolha guardada no aparelho. */
  variante?: string;
  onVariante?: (v: string) => void;
}

const ler = (): FerramentasTocar => lerFerramentasDe(typeof localStorage === "undefined" ? undefined : localStorage);
const seletor = "rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-bold text-slate-700";
const alternador = (ligado: boolean) => `rounded-lg border px-2 py-1 text-[11px] font-bold ${ligado ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`;

/** v21: casas com bolinha de referência no braço (a 12 tem duas). */
const MARCAS_DO_BRACO = [3, 5, 7, 9, 12, 15, 17, 19, 21];
/** Altura (0 a 1) de cada bolinha da casa: no vão entre as cordas do meio, ou duas na 12 (perto das cordas de fora). */
function posicoesDaMarca(casa: number, nCordas: number): number[] {
  if (!MARCAS_DO_BRACO.includes(casa)) return [];
  if (casa === 12 || casa === 24) return [1 / nCordas, (nCordas - 1) / nCordas];
  return [Math.floor(nCordas / 2) / nCordas];
}

interface Tocando { base: number; paradas: Array<{ midi: number; parar: () => void }>; inicio: number }

/**
 * Repertório v6/v8: o instrumento online. Melódicos: teclas de piano (1 a 3 oitavas) ou, no baixo e no violão, o
 * braço com cordas e casas; toque/mouse (várias ao mesmo tempo) e o teclado do computador (A S D F… brancas, W E T Y U
 * pretas; Z e X mudam a oitava; Shift segurado sustenta). Bateria: oito pads (A S W E R T Y U). v8: timbres,
 * sustentar, transpor, escala destacada, acorde com uma tecla e força.
 */
export default function InstrumentoOnline({ sint, timbre, destino, aoTocar, teclado = true, variante, onVariante }: Props) {
  // v15: os nomes das notas como a pessoa escolheu (sustenido ou bemol; C D E ou Dó Ré Mi)
  const notacao = useNotacao();
  const nomeDaNota = (m: number) => nomeDaNotaExibida(m, notacao);
  const NOMES_TONICA = Array.from({ length: 12 }, (_, i) => nomeDaNota(60 + i));
  const [oitava, setOitava] = useState(OITAVA_PADRAO[timbre]);
  const [acesas, setAcesas] = useState<Set<number>>(() => new Set());
  const [ferr, setFerr] = useState<FerramentasTocar>(ler);
  const [abertas, setAbertas] = useState(false);
  const [shift, setShift] = useState(false);
  const tocando = useRef(new Map<string, Tocando>());
  const sustentadas = useRef<Array<{ midi: number; parar: () => void; inicio: number }>>([]);
  useEffect(() => { setOitava(OITAVA_PADRAO[timbre]); }, [timbre]);
  useEffect(() => { gravarFerramentas(typeof localStorage === "undefined" ? undefined : localStorage, ferr); }, [ferr]);
  const mudar = (m: Partial<FerramentasTocar>) => setFerr(f => ({ ...f, ...m }));

  const v = varianteValida(timbre, variante ?? ferr.variantes[timbre]);
  const escolherVariante = (id: string) => { if (onVariante) onVariante(id); else mudar({ variantes: { ...ferr.variantes, [timbre]: id } }); };
  const escala = useMemo(() => (ferr.escala ? notasDaEscala(ferr.escala.tonica, ferr.escala.id) : null), [ferr.escala]);
  const sustento = ferr.sustentar || shift;
  const braco = ferr.layout === "braco" && temBraco(timbre);

  const ligar = (chave: string, base: number, vel = ferr.forca) => {
    if (tocando.current.has(chave)) return;
    if (sint.contexto instanceof AudioContext && sint.contexto.state === "suspended") void sint.contexto.resume();
    const notas = timbre === "bateria" ? [base] : notasDaTecla(base, ferr.acorde, escala).map(m => m + ferr.transpor);
    const agora = sint.contexto.currentTime;
    const paradas = notas.map(midi => ({ midi, parar: sint.iniciar(timbre, midi, vel, destino, v) }));
    tocando.current.set(chave, { base, paradas, inicio: agora });
    setAcesas(a => new Set(a).add(base));
    if (timbre === "bateria") {
      aoTocar?.(base, vel, agora, agora + 0.1);
      window.setTimeout(() => desligar(chave), 120);
    }
  };
  const soltarNotas = useCallback((lista: Array<{ midi: number; parar: () => void; inicio: number }>) => {
    const fim = sint.contexto.currentTime;
    for (const n of lista) { n.parar(); if (timbre !== "bateria") aoTocar?.(n.midi, ferr.forca, n.inicio, fim); }
  }, [sint, timbre, aoTocar, ferr.forca]);
  const desligar = (chave: string) => {
    const s = tocando.current.get(chave);
    if (!s) return;
    tocando.current.delete(chave);
    const notas = s.paradas.map(p => ({ ...p, inicio: s.inicio }));
    // sustentando, a nota continua até soltar o sustain (no máximo 48 notas presas)
    if (sustento && timbre !== "bateria") {
      sustentadas.current.push(...notas);
      if (sustentadas.current.length > 48) soltarNotas(sustentadas.current.splice(0, sustentadas.current.length - 48));
    } else soltarNotas(notas);
    setAcesas(a => { const n = new Set(a); if (![...tocando.current.values()].some(t => t.base === s.base)) n.delete(s.base); return n; });
  };
  // soltou o sustain: as notas presas param
  useEffect(() => { if (!sustento && sustentadas.current.length) soltarNotas(sustentadas.current.splice(0)); }, [sustento, soltarNotas]);
  useEffect(() => () => { for (const n of sustentadas.current.splice(0)) n.parar(); }, []);

  const ligarRef = useRef(ligar), desligarRef = useRef(desligar);
  ligarRef.current = ligar; desligarRef.current = desligar;

  // teclado do computador
  useEffect(() => {
    if (!teclado) return;
    const alvoDigitavel = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    };
    const desce = (e: KeyboardEvent) => {
      if (e.key === "Shift") { setShift(true); return; }
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || alvoDigitavel(e)) return;
      const k = e.key.toLowerCase();
      if (timbre !== "bateria" && (k === "z" || k === "x")) { setOitava(o => Math.max(0, Math.min(7, o + (k === "x" ? 1 : -1)))); e.preventDefault(); return; }
      const midi = timbre === "bateria" ? pecaDaTecla(k) : notaDaTecla(k, oitava);
      if (midi === null) return;
      e.preventDefault();
      ligarRef.current(`k${k}`, midi);
    };
    const sobe = (e: KeyboardEvent) => { if (e.key === "Shift") { setShift(false); return; } desligarRef.current(`k${e.key.toLowerCase()}`); };
    const sair = () => { setShift(false); for (const c of [...tocando.current.keys()]) desligarRef.current(c); };
    window.addEventListener("keydown", desce);
    window.addEventListener("keyup", sobe);
    window.addEventListener("blur", sair);
    return () => { window.removeEventListener("keydown", desce); window.removeEventListener("keyup", sobe); window.removeEventListener("blur", sair); sair(); };
  }, [teclado, timbre, oitava]);

  const tocarPonteiro = (midi: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* sem captura: nada a soltar */ } ligar(`p${e.pointerId}`, midi, e.pointerType === "pen" && e.pressure > 0 ? Math.max(0.2, ferr.forca * (0.4 + e.pressure * 0.6)) : ferr.forca); },
    onPointerUp: (e: React.PointerEvent) => desligar(`p${e.pointerId}`),
    onPointerCancel: (e: React.PointerEvent) => desligar(`p${e.pointerId}`),
    onPointerLeave: (e: React.PointerEvent) => desligar(`p${e.pointerId}`),
  });

  // ---------------------------------------------------------------- barra de ferramentas
  const barra = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
      <label className="flex items-center gap-1 font-bold">Timbre
        <select value={v} onChange={e => escolherVariante(e.target.value)} aria-label="Timbre" className={seletor}>
          {VARIANTES[timbre].map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </label>
      {timbre !== "bateria" && (<>
        <button type="button" aria-pressed={ferr.sustentar} onClick={() => mudar({ sustentar: !ferr.sustentar })} title="As notas continuam soando depois de soltar (ou segure Shift)" className={alternador(sustento)}>Sustentar</button>
        {temBraco(timbre) && (
          <div className="flex rounded-lg border border-slate-200 p-0.5" role="radiogroup" aria-label="Como tocar">
            {([["teclas", "Teclas"], ["braco", "Braço"]] as const).map(([id, r]) => (
              <button key={id} type="button" role="radio" aria-checked={ferr.layout === id} onClick={() => mudar({ layout: id })}
                className={`rounded-md px-1.5 py-0.5 font-bold ${ferr.layout === id ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{r}</button>
            ))}
          </div>
        )}
        <button type="button" aria-expanded={abertas} onClick={() => setAbertas(a => !a)} className={alternador(abertas)}>
          <SlidersHorizontal className="mr-1 inline h-3 w-3" />Mais ferramentas
        </button>
      </>)}
    </div>
  );
  const maisFerramentas = abertas && timbre !== "bateria" && (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600" role="group" aria-label="Ferramentas para tocar">
      <span className="flex items-center gap-1 font-bold">Transpor
        <button type="button" aria-label="Transpor meio tom abaixo" onClick={() => mudar({ transpor: Math.max(-12, ferr.transpor - 1) })} className="rounded-md border border-slate-200 bg-white p-1"><Minus className="h-3 w-3" /></button>
        <span className="w-7 text-center tabular-nums">{ferr.transpor > 0 ? `+${ferr.transpor}` : ferr.transpor}</span>
        <button type="button" aria-label="Transpor meio tom acima" onClick={() => mudar({ transpor: Math.min(12, ferr.transpor + 1) })} className="rounded-md border border-slate-200 bg-white p-1"><Plus className="h-3 w-3" /></button>
      </span>
      <label className="flex items-center gap-1 font-bold">Escala
        <select aria-label="Escala" className={seletor} value={ferr.escala?.id ?? ""} onChange={e => mudar({ escala: e.target.value ? { tonica: ferr.escala?.tonica ?? 0, id: e.target.value } : null })}>
          <option value="">Nenhuma</option>
          {ESCALAS.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
        {ferr.escala && (
          <select aria-label="Tônica da escala" className={seletor} value={ferr.escala.tonica} onChange={e => mudar({ escala: { ...ferr.escala!, tonica: Number(e.target.value) } })}>
            {NOMES_TONICA.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
        )}
      </label>
      <label className="flex items-center gap-1 font-bold">Acorde com 1 tecla
        <select aria-label="Acorde com uma tecla" className={seletor} value={ferr.acorde ?? ""} onChange={e => mudar({ acorde: e.target.value || null })}>
          <option value="">Desligado (só a nota)</option>
          {ACORDES_UMA_TECLA.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
          <option value="escala" disabled={!ferr.escala}>Do campo harmônico da escala</option>
        </select>
      </label>
      <label className="flex items-center gap-1 font-bold">Força
        <input type="range" min={0.2} max={1} step={0.05} value={ferr.forca} onChange={e => mudar({ forca: Number(e.target.value) })} aria-label="Força das notas" className="w-20" />
      </label>
      {!braco && (
        <label className="flex items-center gap-1 font-bold">Oitavas
          <select aria-label="Quantas oitavas" className={seletor} value={ferr.oitavas} onChange={e => mudar({ oitavas: Number(e.target.value) })}>
            {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  );

  if (timbre === "bateria") {
    return (
      <div className="select-none">
        {barra}
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Pads da bateria" style={{ touchAction: "none" }}>
          {PECAS_BATERIA.map(p => (
            <button key={p.midi} type="button" aria-label={p.nome} {...tocarPonteiro(p.midi)}
              className={`flex h-16 flex-col items-center justify-center rounded-xl border text-xs font-bold transition sm:h-20 ${acesas.has(p.midi) ? "scale-95 border-orange-500 bg-orange-500 text-white" : "border-slate-300 bg-slate-800 text-slate-100 hover:bg-slate-700"}`}>
              {p.nome}<span className="mt-1 rounded bg-white/15 px-1.5 text-[10px] font-normal uppercase">{p.tecla}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- braço (cordas e casas)
  if (braco) {
    const cordas = CORDAS_DO_BRACO[timbre]!.cordas;
    const casas = Array.from({ length: 13 }, (_, i) => i);
    return (
      <div className="select-none">
        {barra}{maisFerramentas}
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-amber-50/60" style={{ touchAction: "pan-x" }}>
          <div role="group" aria-label="Braço" className="min-w-[640px]">
            <div className="relative">
            {/* v21: bolinhas de referência (3, 5, 7, 9 e duas na 12), no vão entre as cordas, como no braço de verdade */}
            <div aria-hidden className="pointer-events-none absolute inset-0 flex">
              {casas.map(casa => (
                <span key={casa} className="relative flex-1">
                  {posicoesDaMarca(casa, cordas.length).map(t => (
                    <span key={t} className="nt-marca-braco absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm" style={{ top: `${t * 100}%`, background: "radial-gradient(circle at 35% 35%, #ffffff, #e8dcc4 55%, #b9a888)", boxShadow: "0 0 0 1px rgba(0,0,0,0.25)" }} />
                  ))}
                </span>
              ))}
            </div>
            {[...cordas].reverse().map((solta, ri) => {
              const c = cordas.length - 1 - ri;
              return (
                <div key={c} className="flex items-center border-b border-amber-200 last:border-b-0">
                  {casas.map(casa => {
                    const m = notaNoBraco(cordas, c, casa);
                    const nome = nomeDaNota(m), acesa = acesas.has(m), cor = corDaNota(nome), dentro = naEscala(m + ferr.transpor, escala);
                    return (
                      <button key={casa} type="button" aria-label={`${nome} (corda ${nomeDaNota(solta)}, casa ${casa})`} {...tocarPonteiro(m)}
                        className={`relative flex h-9 flex-1 items-center justify-center ${casa === 0 ? "border-r-4 border-slate-400 bg-amber-100" : "border-r border-slate-300"}`}>
                        <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-slate-500" style={{ height: 1 + (cordas.length - c) * 0.4 }} />
                        <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold transition ${acesa ? "scale-125 ring-2 ring-slate-900" : ""}`}
                          style={{ background: cor.fundo, color: cor.texto, opacity: acesa || dentro ? 1 : 0.25 }}>{nome}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            </div>
            <div className="flex text-center text-[9px] text-slate-400">
              {casas.map(c => (
                <span key={c} className={`flex flex-1 items-center justify-center gap-0.5 ${MARCAS_DO_BRACO.includes(c) ? "font-black text-amber-800" : ""}`}>
                  {MARCAS_DO_BRACO.includes(c) && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-700" />}
                  {c === 12 && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-700" />}
                  {c || "solta"}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- teclas de piano
  const ini = 12 * (oitava + 1), fim = ini + 12 * ferr.oitavas;
  const brancas: number[] = [];
  for (let m = ini; m <= fim; m++) if (!ehPreta(m)) brancas.push(m);
  return (
    <div className="select-none">
      {barra}{maisFerramentas}
      <div className="mb-1.5 flex items-center gap-2 text-[11px] text-slate-500">
        <span className="font-bold text-slate-700">Oitava</span>
        <button type="button" aria-label="Oitava abaixo" onClick={() => setOitava(o => Math.max(0, o - 1))} className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"><Minus className="h-3 w-3" /></button>
        <span className="w-8 text-center font-bold tabular-nums text-slate-700">C{oitava}</span>
        <button type="button" aria-label="Oitava acima" onClick={() => setOitava(o => Math.min(7, o + 1))} className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"><Plus className="h-3 w-3" /></button>
        <span className="hidden sm:inline">Teclado do computador: A S D F… (brancas), W E T Y U (pretas), Z/X mudam a oitava, Shift sustenta.</span>
      </div>
      <div className="relative h-32 sm:h-40" role="group" aria-label="Teclas" style={{ touchAction: "none" }}>
        {brancas.map((m, i) => {
          const nome = nomeDaNota(m), acesa = acesas.has(m), cor = corDaNota(nome), dentro = naEscala(m + ferr.transpor, escala);
          return (
            <button key={m} type="button" aria-label={nome} {...tocarPonteiro(m)}
              className="absolute bottom-0 top-0 flex flex-col items-center justify-end rounded-b-lg border border-slate-300 pb-1.5 text-[10px] font-bold"
              style={{ left: `${(i / brancas.length) * 100}%`, width: `${100 / brancas.length}%`, background: acesa ? cor.fundo : dentro ? "#ffffff" : "#e2e8f0", color: acesa ? cor.texto : "#475569" }}>
              <span className="hidden text-[9px] font-normal opacity-60 sm:block">{teclaDaNota(m, oitava) ?? ""}</span>
              {escala && dentro && !acesa && <span className="mb-0.5 h-1.5 w-1.5 rounded-full" style={{ background: cor.fundo }} aria-hidden="true" />}
              {nome}
            </button>
          );
        })}
        {brancas.map((m, i) => {
          const p = m + 1;
          if (!ehPreta(p) || p > fim) return null;
          const nome = nomeDaNota(p), acesa = acesas.has(p), cor = corDaNota(nome), dentro = naEscala(p + ferr.transpor, escala);
          const w = 100 / brancas.length;
          return (
            <button key={p} type="button" aria-label={nome} {...tocarPonteiro(p)}
              className="absolute top-0 z-10 flex h-[60%] flex-col items-center justify-end rounded-b-md pb-1 text-[8px] font-bold"
              style={{ left: `${(i + 1) * w - w * 0.32}%`, width: `${w * 0.64}%`, background: acesa ? cor.fundo : dentro ? "#1e293b" : "#64748b", color: acesa ? cor.texto : "#cbd5e1" }}>
              {escala && dentro && !acesa && <span className="mb-0.5 h-1.5 w-1.5 rounded-full" style={{ background: cor.fundo }} aria-hidden="true" />}
              <span className="hidden opacity-70 sm:block">{teclaDaNota(p, oitava) ?? ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
