import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Monitor, Moon, Sun } from "lucide-react";

import { useTema } from "@/react-app/hooks/useTema";
import { ROTULO_TEMA, type Tema, type TemaGeral } from "@/react-app/utils/tema";

const ICONE = { claro: Sun, escuro: Moon, sistema: Monitor } as const;

/** Botão de tema no canto de cada tela: tema só desta tela ou o geral. */
export default function BotaoTema({ className = "" }: { className?: string }) {
  const { tema, temaDestaTela, preferencia, definirDaTela, definirGeral } = useTema();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener("pointerdown", fora); window.removeEventListener("keydown", tecla); };
  }, [aberto]);

  const Icone = tema === "escuro" ? Moon : Sun;
  const opcao = (ativo: boolean) =>
    `flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition-colors ${ativo ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`;

  return (
    <div ref={ref} className={className}>
      <button type="button" onClick={() => setAberto(v => !v)} aria-expanded={aberto} aria-haspopup="dialog"
        aria-label={`Tema: ${tema === "escuro" ? "escuro" : "claro"}. Trocar tema`} title="Tema claro ou escuro"
        className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/60 text-slate-600 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-blue-600 active:scale-95">
        <Icone key={tema} className="h-5 w-5 animate-surgir transition-transform duration-500 group-hover:rotate-45" />
      </button>
      {aberto && (
        <div role="dialog" aria-label="Tema" className="absolute right-0 top-full z-40 mt-2 w-64 animate-surgir rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nesta tela</p>
          <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Tema desta tela">
            {(["claro", "escuro"] as Tema[]).map(t => {
              const I = ICONE[t];
              return (
                <button key={t} type="button" aria-pressed={temaDestaTela === t} onClick={() => definirDaTela(t)} className={opcao(temaDestaTela === t)}>
                  <I className="h-4 w-4" /> {ROTULO_TEMA[t]}
                </button>
              );
            })}
            <button type="button" aria-pressed={temaDestaTela === null} onClick={() => definirDaTela(null)} className={opcao(temaDestaTela === null)}>
              <span className="text-sm leading-4" aria-hidden="true">⟲</span> Geral
            </button>
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Geral (todas as telas)</p>
          <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Tema geral">
            {(["claro", "escuro", "sistema"] as TemaGeral[]).map(t => {
              const I = ICONE[t];
              return (
                <button key={t} type="button" aria-pressed={preferencia.geral === t} onClick={() => definirGeral(t)} className={opcao(preferencia.geral === t)}>
                  <I className="h-4 w-4" /> {t === "sistema" ? "Aparelho" : ROTULO_TEMA[t]}
                </button>
              );
            })}
          </div>
          <Link to="/configuracoes#aparencia" onClick={() => setAberto(false)} className="mt-3 block text-center text-xs font-bold text-blue-600 hover:underline">
            Ver tudo em Configurações
          </Link>
        </div>
      )}
    </div>
  );
}
