import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import type { Sintetizador } from "@/react-app/components/repertorio/sintetizador";
import { OITAVA_PADRAO, PECAS_BATERIA, notaDaTecla, pecaDaTecla, teclaDaNota, type Timbre } from "@/react-app/utils/musica/estudio";
import { corDaNota, ehPreta } from "@/react-app/utils/musica/instrumentos";
import { nomeDaNota } from "@/react-app/utils/musica/teoria";

interface Props {
  sint: Sintetizador;
  timbre: Timbre;
  /** Ganho da faixa (no estúdio), para o som sair no volume dela. */
  destino?: AudioNode;
  /** Cada nota tocada (para gravar): instantes no relógio do áudio. */
  aoTocar?: (midi: number, vel: number, inicio: number, fim: number) => void;
  /** Teclas do computador ativas (desligue quando outro campo tiver o foco). */
  teclado?: boolean;
}

/**
 * Repertório v6: o instrumento online. Melódicos (baixo, teclado, violão, sintetizador): duas oitavas de teclas na
 * tela, com toque/mouse (várias ao mesmo tempo) e o teclado do computador (A S D F… brancas, W E T Y U… pretas; Z e X
 * mudam a oitava). Bateria: oito pads, também nas teclas A S W E R T Y U.
 */
export default function InstrumentoOnline({ sint, timbre, destino, aoTocar, teclado = true }: Props) {
  const [oitava, setOitava] = useState(OITAVA_PADRAO[timbre]);
  const [acesas, setAcesas] = useState<Set<number>>(() => new Set());
  const soltar = useRef(new Map<string, { midi: number; parar: () => void; inicio: number }>());
  useEffect(() => { setOitava(OITAVA_PADRAO[timbre]); }, [timbre]);

  const ligar = (chave: string, midi: number, vel = 0.85) => {
    if (soltar.current.has(chave)) return;
    if (sint.contexto instanceof AudioContext && sint.contexto.state === "suspended") void sint.contexto.resume();
    const parar = sint.iniciar(timbre, midi, vel, destino);
    soltar.current.set(chave, { midi, parar, inicio: sint.contexto.currentTime });
    setAcesas(a => new Set(a).add(midi));
    if (timbre === "bateria") {
      aoTocar?.(midi, vel, sint.contexto.currentTime, sint.contexto.currentTime + 0.1);
      window.setTimeout(() => desligar(chave), 120);
    }
  };
  const desligar = (chave: string) => {
    const s = soltar.current.get(chave);
    if (!s) return;
    soltar.current.delete(chave);
    s.parar();
    if (timbre !== "bateria") aoTocar?.(s.midi, 0.85, s.inicio, sint.contexto.currentTime);
    setAcesas(a => { const n = new Set(a); if (![...soltar.current.values()].some(v => v.midi === s.midi)) n.delete(s.midi); return n; });
  };
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
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || alvoDigitavel(e)) return;
      const k = e.key.toLowerCase();
      if (timbre !== "bateria" && (k === "z" || k === "x")) { setOitava(o => Math.max(0, Math.min(7, o + (k === "x" ? 1 : -1)))); e.preventDefault(); return; }
      const midi = timbre === "bateria" ? pecaDaTecla(k) : notaDaTecla(k, oitava);
      if (midi === null) return;
      e.preventDefault();
      ligarRef.current(`k${k}`, midi);
    };
    const sobe = (e: KeyboardEvent) => desligarRef.current(`k${e.key.toLowerCase()}`);
    const sair = () => { for (const c of [...soltar.current.keys()]) desligarRef.current(c); };
    window.addEventListener("keydown", desce);
    window.addEventListener("keyup", sobe);
    window.addEventListener("blur", sair);
    return () => { window.removeEventListener("keydown", desce); window.removeEventListener("keyup", sobe); window.removeEventListener("blur", sair); sair(); };
  }, [teclado, timbre, oitava]);

  const tocarPonteiro = (midi: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* sem captura: nada a soltar */ } ligar(`p${e.pointerId}`, midi, e.pointerType === "pen" && e.pressure > 0 ? 0.4 + e.pressure * 0.6 : 0.85); },
    onPointerUp: (e: React.PointerEvent) => desligar(`p${e.pointerId}`),
    onPointerCancel: (e: React.PointerEvent) => desligar(`p${e.pointerId}`),
    onPointerLeave: (e: React.PointerEvent) => desligar(`p${e.pointerId}`),
  });

  if (timbre === "bateria") {
    return (
      <div className="grid grid-cols-4 gap-2 select-none" role="group" aria-label="Pads da bateria" style={{ touchAction: "none" }}>
        {PECAS_BATERIA.map(p => (
          <button key={p.midi} type="button" aria-label={p.nome} {...tocarPonteiro(p.midi)}
            className={`flex h-16 flex-col items-center justify-center rounded-xl border text-xs font-bold transition sm:h-20 ${acesas.has(p.midi) ? "scale-95 border-orange-500 bg-orange-500 text-white" : "border-slate-300 bg-slate-800 text-slate-100 hover:bg-slate-700"}`}>
            {p.nome}<span className="mt-1 rounded bg-white/15 px-1.5 text-[10px] font-normal uppercase">{p.tecla}</span>
          </button>
        ))}
      </div>
    );
  }

  const ini = 12 * (oitava + 1), fim = ini + 24;
  const brancas: number[] = [];
  for (let m = ini; m <= fim; m++) if (!ehPreta(m)) brancas.push(m);
  return (
    <div className="select-none">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] text-slate-500">
        <span className="font-bold text-slate-700">Oitava</span>
        <button type="button" aria-label="Oitava abaixo" onClick={() => setOitava(o => Math.max(0, o - 1))} className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"><Minus className="h-3 w-3" /></button>
        <span className="w-8 text-center font-bold tabular-nums text-slate-700">C{oitava}</span>
        <button type="button" aria-label="Oitava acima" onClick={() => setOitava(o => Math.min(7, o + 1))} className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"><Plus className="h-3 w-3" /></button>
        <span className="hidden sm:inline">Teclado do computador: A S D F… (brancas), W E T Y U (pretas), Z/X mudam a oitava.</span>
      </div>
      <div className="relative h-32 sm:h-40" role="group" aria-label="Teclas" style={{ touchAction: "none" }}>
        {brancas.map((m, i) => {
          const nome = nomeDaNota(m), acesa = acesas.has(m), cor = corDaNota(nome);
          return (
            <button key={m} type="button" aria-label={nome} {...tocarPonteiro(m)}
              className="absolute bottom-0 top-0 flex flex-col items-center justify-end rounded-b-lg border border-slate-300 pb-1.5 text-[10px] font-bold"
              style={{ left: `${(i / brancas.length) * 100}%`, width: `${100 / brancas.length}%`, background: acesa ? cor.fundo : "#ffffff", color: acesa ? cor.texto : "#475569" }}>
              <span className="hidden text-[9px] font-normal opacity-60 sm:block">{teclaDaNota(m, oitava) ?? ""}</span>
              {nome}
            </button>
          );
        })}
        {brancas.map((m, i) => {
          const p = m + 1;
          if (!ehPreta(p) || p > fim) return null;
          const nome = nomeDaNota(p), acesa = acesas.has(p), cor = corDaNota(nome);
          const w = 100 / brancas.length;
          return (
            <button key={p} type="button" aria-label={nome} {...tocarPonteiro(p)}
              className="absolute top-0 z-10 flex h-[60%] flex-col items-center justify-end rounded-b-md pb-1 text-[8px] font-bold"
              style={{ left: `${(i + 1) * w - w * 0.32}%`, width: `${w * 0.64}%`, background: acesa ? cor.fundo : "#1e293b", color: acesa ? cor.texto : "#cbd5e1" }}>
              <span className="hidden opacity-70 sm:block">{teclaDaNota(p, oitava) ?? ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
