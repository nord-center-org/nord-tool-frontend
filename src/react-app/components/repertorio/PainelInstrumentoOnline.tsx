import { lazy, Suspense, useEffect, useState } from "react";
import { AudioLines, Timer, X } from "lucide-react";

import InstrumentoOnline from "@/react-app/components/repertorio/InstrumentoOnline";
import { Sintetizador } from "@/react-app/components/repertorio/sintetizador";
import { TIMBRES, type Timbre } from "@/react-app/utils/musica/estudio";

const ReconhecerNota = lazy(() => import("@/react-app/components/repertorio/ReconhecerNota"));

/** Repertório v6: o instrumento online solto, para tocar à vontade (sem gravar). */
export default function PainelInstrumentoOnline({ onFechar }: { onFechar: () => void }) {
  // o áudio nasce no efeito (e morre na limpeza dele): no modo estrito o React monta duas vezes
  const [sint, setSint] = useState<Sintetizador | null>(null);
  useEffect(() => {
    const ctx = new AudioContext(), s = new Sintetizador(ctx);
    setSint(s);
    return () => { s.fechar(); void ctx.close(); };
  }, []);
  const [timbre, setTimbre] = useState<Timbre>("teclado");
  const [volume, setVolume] = useState(0.8);
  // v20: no baixo, reconhecer a nota pelo microfone
  const [reconhecer, setReconhecer] = useState(false);
  useEffect(() => { if (sint) sint.volume = volume; }, [sint, volume]);
  // v8: metrônomo para treinar (agenda os cliques um pouco à frente no relógio do áudio)
  const [metronomo, setMetronomo] = useState(false);
  const [bpm, setBpm] = useState(90);
  useEffect(() => {
    if (!sint || !metronomo) return;
    const ctx = sint.contexto as AudioContext;
    if (ctx.state === "suspended") void ctx.resume();
    const passo = 60 / Math.min(240, Math.max(30, bpm));
    let proximo = ctx.currentTime + 0.1, n = 0;
    const agendar = () => {
      while (proximo < ctx.currentTime + 0.15) {
        const forte = n % 4 === 0, o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = forte ? 1500 : 1000;
        g.gain.setValueAtTime(0.0001, proximo);
        g.gain.exponentialRampToValueAtTime(forte ? 0.35 : 0.2, proximo + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, proximo + 0.05);
        o.connect(g).connect(ctx.destination);
        o.start(proximo); o.stop(proximo + 0.06);
        proximo += passo; n++;
      }
    };
    agendar();
    const t = window.setInterval(agendar, 25);
    return () => window.clearInterval(t);
  }, [sint, metronomo, bpm]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-2 sm:items-center sm:p-4" role="dialog" aria-label="Instrumento online">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-3 shadow-2xl sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <b className="mr-auto text-sm text-slate-800">Instrumento online</b>
          <div className="flex flex-wrap rounded-lg border border-slate-200 p-0.5" role="radiogroup" aria-label="Instrumento">
            {TIMBRES.map(t => (
              <button key={t.id} type="button" role="radio" aria-checked={timbre === t.id} onClick={() => setTimbre(t.id)}
                className={`rounded-md px-2 py-1 text-xs font-bold ${timbre === t.id ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.nome}</button>
            ))}
          </div>
          {timbre === "baixo" && (
            <button type="button" onClick={() => setReconhecer(true)} title="Ouve o baixo pelo microfone e mostra a nota, a afinação e onde ela fica no braço"
              className="inline-flex items-center gap-1 rounded-lg border border-red-500 bg-red-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-500"><AudioLines className="h-3.5 w-3.5" />Reconhecer nota</button>
          )}
          <input type="range" min={0} max={1.5} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))} aria-label="Volume" className="w-20" />
          <button type="button" aria-pressed={metronomo} onClick={() => setMetronomo(m => !m)} title="Metrônomo"
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold ${metronomo ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            <Timer className="h-3.5 w-3.5" />Metrônomo
          </button>
          {metronomo && <input type="number" min={30} max={240} value={bpm} onChange={e => setBpm(Number(e.target.value) || 90)} aria-label="BPM do metrônomo" className="w-14 rounded-lg border border-slate-200 px-1.5 py-1 text-xs" />}
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {sint && <InstrumentoOnline sint={sint} timbre={timbre} />}
        {reconhecer && <Suspense fallback={null}><ReconhecerNota onFechar={() => setReconhecer(false)} /></Suspense>}
        <p className="mt-2 text-[11px] text-slate-500">Toque na tela (dá para várias notas ao mesmo tempo) ou use o teclado do computador. Para gravar, use a aba Criar.</p>
      </div>
    </div>
  );
}
