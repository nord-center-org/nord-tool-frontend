import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { Monitor, Moon, Palette, Sun, X } from "lucide-react";

import { useTema } from "@/react-app/hooks/useTema";
import { tutorialDaTela } from "@/react-app/utils/tutorial";
import { ROTULO_TEMA, type TemaGeral } from "@/react-app/utils/tema";

const ICONE = { claro: Sun, escuro: Moon, sistema: Monitor } as const;
const nomeDaTela = (caminho: string) => (caminho === "/" ? "Início" : tutorialDaTela(caminho)?.titulo ?? caminho);

/** Miniatura do tema (como fica uma tela) para a escolha do geral. */
function Miniatura({ tema }: { tema: TemaGeral }) {
  const lado = (escuro: boolean) => (
    <span className={`flex h-full flex-1 flex-col gap-1 p-1.5 ${escuro ? "bg-[#0b1120]" : "bg-slate-100"}`}>
      <span className={`h-1.5 w-2/3 rounded-full ${escuro ? "bg-slate-500" : "bg-slate-400"}`} />
      <span className={`flex-1 rounded ${escuro ? "bg-[#18233a]" : "bg-white"}`} />
      <span className="h-1.5 w-1/3 rounded-full bg-blue-500" />
    </span>
  );
  return (
    <span data-tema-fixo className="flex h-14 w-full overflow-hidden rounded-lg border border-slate-300/50" aria-hidden="true">
      {tema === "sistema" ? <>{lado(false)}{lado(true)}</> : lado(tema === "escuro")}
    </span>
  );
}

/** Configurações → Aparência: tema geral e as telas com tema próprio. */
export default function AparenciaConfig() {
  const { preferencia, definirGeral, definirDaTela } = useTema();
  const { hash } = useLocation();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (hash === "#aparencia") ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [hash]);
  const telas = Object.entries(preferencia.telas).sort(([a], [b]) => nomeDaTela(a).localeCompare(nomeDaTela(b)));

  return (
    <section ref={ref} id="aparencia" className="rounded-2xl border border-slate-200 p-5 shadow-sm" aria-labelledby="config-aparencia">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700"><Palette className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 id="config-aparencia" className="text-lg font-bold text-slate-800">Aparência</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">O tema geral vale para todas as telas. Pelo botão de sol/lua no canto de cada tela, você dá um tema só para ela.</p>

          <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema geral">
            {(["claro", "escuro", "sistema"] as TemaGeral[]).map(t => {
              const I = ICONE[t];
              const ativo = preferencia.geral === t;
              return (
                <button key={t} type="button" role="radio" aria-checked={ativo} onClick={() => definirGeral(t)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-2.5 text-xs font-bold transition-all ${ativo ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <Miniatura tema={t} />
                  <span className="flex items-center gap-1.5"><I className="h-4 w-4" /> {ROTULO_TEMA[t]}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Telas com tema próprio</p>
          {telas.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">Nenhuma: todas seguem o geral.</p>
          ) : (
            <ul className="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {telas.map(([caminho, tema]) => (
                  <li key={caminho} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{nomeDaTela(caminho)}</span>
                    <div className="flex gap-1" role="group" aria-label={`Tema de ${nomeDaTela(caminho)}`}>
                      {(["claro", "escuro"] as const).map(t => {
                        const J = ICONE[t];
                        return (
                          <button key={t} type="button" aria-pressed={tema === t} onClick={() => definirDaTela(t, caminho)} title={ROTULO_TEMA[t]}
                            className={`rounded-lg border p-1.5 ${tema === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-400 hover:bg-slate-50"}`}>
                            <J className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" onClick={() => definirDaTela(null, caminho)} aria-label={`${nomeDaTela(caminho)} volta a seguir o geral`} title="Seguir o geral"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><X className="h-4 w-4" /></button>
                  </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
