import { useState } from "react";
import { ArrowRight, AudioLines, X } from "lucide-react";

import type { ModeloLetra } from "@/react-app/workers/letraMusica.worker";

const IDIOMAS: Array<[string, string]> = [["portuguese", "Português"], ["english", "Inglês"], ["spanish", "Espanhol"], ["", "Detectar"]];

interface Props {
  letra: string;
  onMudarLetra: (letra: string) => void;
  onIdentificarLetra: (modelo: ModeloLetra, idioma: string | null) => void;
  /** Põe a letra na cifra e vai para os acordes. */
  onUsar: () => void;
  onFechar: () => void;
  ocupado: boolean;
  vozSeparada: boolean;
  /** A música já tem cifra (avisar que a letra nova troca a cifra). */
  temCifra: boolean;
}

/**
 * Repertório v13 — o primeiro passo do "Escrever cifra": a letra (colada ou identificada no áudio). Depois ela vira a
 * cifra e os acordes são postos com o mouse em cima das sílabas; o tempo de cada linha a cifra acha sozinha.
 */
export default function LetraParaCifra({ letra, onMudarLetra, onIdentificarLetra, onUsar, onFechar, ocupado, vozSeparada, temCifra }: Props) {
  const [idioma, setIdioma] = useState("portuguese");
  const [modelo, setModelo] = useState<ModeloLetra>("rapido");
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" role="region" aria-label="Escrever cifra">
      <div className="flex items-center gap-2 border-b border-slate-100 p-2">
        <b className="mr-auto text-sm text-slate-700">Escrever cifra <span className="font-normal text-slate-400">· 1. a letra</span></b>
        <button type="button" onClick={onFechar} aria-label="Fechar o escrever cifra" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs text-slate-600">Cole a letra (uma linha por verso; linha vazia separa as estrofes) ou deixe eu ouvir a música e escrever. Depois você põe os acordes com o mouse em cima das sílabas — o tempo de cada linha eu acho sozinho.</p>
        <textarea value={letra} onChange={e => onMudarLetra(e.target.value.slice(0, 20_000))} aria-label="Letra da música" rows={10}
          placeholder="Cole a letra aqui…" className="w-full resize-y rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-500" />
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
            onClick={() => { if (!letra.trim() || window.confirm("Trocar a letra pela reconhecida no áudio?")) onIdentificarLetra(modelo, idioma || null); }}>
            <AudioLines className="h-3.5 w-3.5" />Identificar letra
          </button>
          <select aria-label="Idioma da letra" value={idioma} onChange={e => setIdioma(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs">
            {IDIOMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <select aria-label="Reconhecedor" value={modelo} onChange={e => setModelo(e.target.value as ModeloLetra)} className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs">
            <option value="rapido">Rápido (baixa ~80 MB)</option>
            <option value="preciso">Mais preciso (baixa ~250 MB)</option>
          </select>
          <span className="text-[11px] text-slate-500">No aparelho; o reconhecedor baixa uma vez.{vozSeparada ? " Uso a voz separada." : " Separar as faixas antes ajuda."}</span>
        </div>
        <button type="button" disabled={!letra.trim() || ocupado}
          onClick={() => { if (!temCifra || window.confirm("A música já tem cifra. Trocar pela letra nova (sem acordes)?")) onUsar(); }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
          Escrever os acordes<ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
