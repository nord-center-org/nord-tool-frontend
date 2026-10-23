import { useCallback, useState } from "react";

import CacaAoRato from "@/react-app/components/davi/CacaAoRato";
import GatoPixel from "@/react-app/components/davi/GatoPixel";
import ParkourGatos from "@/react-app/components/davi/ParkourGatos";
import TituloPixel from "@/react-app/components/davi/TituloPixel";
import { PELAGENS } from "@/react-app/utils/daviJob/sprites";

/** Davi Job: tela de amostragem (easter egg) com o parkour de gatinhos e o minigame Caça ao rato. */
export default function DaviJobPage() {
  const [jogando, setJogando] = useState<string | null>(null);
  const [ultimoGato, setUltimoGato] = useState<string | undefined>(undefined);
  const jogar = useCallback((p: string) => { setUltimoGato(p); setJogando(p); }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <header className="relative overflow-hidden rounded-3xl border-4 border-slate-900 bg-gradient-to-b from-indigo-100 to-pink-50 px-4 py-6 text-center shadow-[6px_6px_0_#0f172a] sm:py-8">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-2 opacity-90" aria-hidden="true">
          {PELAGENS.slice(0, 4).map((p, i) => <GatoPixel key={p.id} pelagem={p.id} quadro={{ pose: "parado", cauda: (i % 2) as 0 | 1 }} tamanho={34} className="nt-pula-pixel hidden sm:block" />)}
          <span className="flex-1" />
          {PELAGENS.slice(4).map((p, i) => <GatoPixel key={p.id} pelagem={p.id} virado={-1} quadro={{ pose: "parado", cauda: (i % 2) as 0 | 1 }} tamanho={34} className="nt-pula-pixel hidden sm:block" />)}
        </div>
        <TituloPixel texto="Tela de amostragem pro Davi Job" />
        <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
          <h2 className="rounded-xl border-2 border-slate-900 bg-yellow-300 px-3 py-1.5 font-['Press_Start_2P'] text-[10px] text-slate-900 shadow-[3px_3px_0_#0f172a] sm:text-xs">Parkour de gatinhos</h2>
          <p className="max-w-xl text-sm font-semibold text-slate-600">Isso foi feito pra mostrar que <b className="text-pink-600">LITERALMENTE</b> qualquer coisa pode ser criada no NordTool kkk</p>
        </div>
      </header>

      {jogando ? (
        <CacaAoRato key={jogando} pelagem={jogando} onSair={() => setJogando(null)} />
      ) : (
        <ParkourGatos onJogar={jogar} pelagemInicial={ultimoGato} />
      )}
    </div>
  );
}
