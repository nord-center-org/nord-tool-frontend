import { useEffect, useState, type ReactNode } from "react";

import Mascote, { type Humor } from "@/react-app/components/auth/Mascote";
import CenaObra from "@/react-app/components/home/CenaObra";
import { dataComemorativa } from "@/react-app/utils/avatar";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";
import { CEU, horaSaoPaulo, periodoDoDia } from "@/react-app/utils/cena";
import "./TelaPublica.css";

interface TelaPublicaProps {
  subtitulo: string;
  children: ReactNode;
  /** Expressão do mascote (o login muda conforme o campo em foco). */
  humor?: Humor;
  /** Mude o valor para o cartão tremer (ex.: a cada erro de login). */
  tremor?: number;
}

/** Moldura das telas públicas (login, criar conta, esqueci a senha): a obra animada ao fundo e o mascote no cartão. */
export default function TelaPublica({ subtitulo, children, humor = "normal", tremor = 0 }: TelaPublicaProps) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  // O tremor é só uma classe que entra e sai: o cartão não é recriado (o foco e o que foi digitado ficam).
  const [tremendo, setTremendo] = useState(false);
  useEffect(() => {
    if (!tremor) return;
    setTremendo(true);
    const t = window.setTimeout(() => setTremendo(false), 500);
    return () => window.clearTimeout(t);
  }, [tremor]);
  const periodo = periodoDoDia(horaSaoPaulo(agora));
  const tema = dataComemorativa(hojeSaoPaulo(agora));

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans" style={{ background: CEU[periodo][0] }}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58vh] min-h-[300px]">
        <CenaObra periodo={periodo} tema={tema} />
      </div>
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-4 pt-20 sm:p-6 sm:pt-24">
        <div className={`relative w-full max-w-sm ${tremendo ? "nt-tremor" : ""}`}>
          <div className="nt-cartao relative">
            <div className="nt-mascote absolute -top-[4.25rem] left-1/2 z-0" style={{ transform: "translateX(-50%)" }}>
              <Mascote humor={humor} tema={tema} />
            </div>
            <div className="relative z-10 space-y-6 rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl shadow-slate-900/20 backdrop-blur-md sm:p-8">
              <div className="text-center">
                <h1 className="nt-logo text-3xl font-black tracking-tight" aria-label="NordTool">
                  {[..."Nord"].map((l, i) => <span key={i} aria-hidden="true" className="nt-letra text-slate-800" style={{ animationDelay: `${300 + i * 60}ms` }}>{l}</span>)}
                  {[..."Tool"].map((l, i) => (
                    <span key={`t${i}`} aria-hidden="true" className="nt-letra bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
                      style={{ animationDelay: `${540 + i * 60}ms` }}>{l}</span>
                  ))}
                </h1>
                <p className="mt-2 text-sm text-slate-500">{subtitulo}</p>
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const classeCampoPublico = "mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
export const classeRotuloPublico = "text-xs font-bold text-slate-500 uppercase tracking-wider";
export const classeBotaoPublico = "w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-bold py-3 text-sm shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
