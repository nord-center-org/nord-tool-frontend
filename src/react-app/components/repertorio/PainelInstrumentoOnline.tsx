import { useEffect, useState } from "react";
import { X } from "lucide-react";

import InstrumentoOnline from "@/react-app/components/repertorio/InstrumentoOnline";
import { Sintetizador } from "@/react-app/components/repertorio/sintetizador";
import { TIMBRES, type Timbre } from "@/react-app/utils/musica/estudio";

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
  useEffect(() => { if (sint) sint.volume = volume; }, [sint, volume]);
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
          <input type="range" min={0} max={1.5} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))} aria-label="Volume" className="w-20" />
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {sint && <InstrumentoOnline sint={sint} timbre={timbre} />}
        <p className="mt-2 text-[11px] text-slate-500">Toque na tela (dá para várias notas ao mesmo tempo) ou use o teclado do computador. Para gravar, use a aba Criar.</p>
      </div>
    </div>
  );
}
