import { useState, type CSSProperties } from "react";

import Avatar from "@/react-app/components/avatar/Avatar";
import type { AvatarUsuario } from "@/react-app/services/AvatarService";
import { lerAvatar, type DataComemorativa } from "@/react-app/utils/avatar";
import { centralizar, fraseDoToque } from "@/react-app/utils/cena";

const MAX_NA_CENA = 12;

interface EquipeNaObraProps {
  equipe: AvatarUsuario[];
  /** Tema da época (quem desligou as datas no avatar veste a roupa normal). */
  tema: DataComemorativa | null;
}

/** A equipe em pé no canteiro: cada um passeia, respira e pisca; tocar faz pular e falar. */
export default function EquipeNaObra({ equipe, tema }: EquipeNaObraProps) {
  const [falando, setFalando] = useState<{ id: number; toque: number } | null>(null);
  const [toques, setToques] = useState<Record<number, number>>({});

  const indiceEu = equipe.findIndex(p => p.flProprio);
  const fila = centralizar(equipe.slice(0, MAX_NA_CENA), indiceEu < MAX_NA_CENA ? indiceEu : -1);
  const fora = equipe.length - fila.length;

  const tocar = (id: number) => {
    const n = (toques[id] ?? 0) + 1;
    setToques({ ...toques, [id]: n });
    setFalando({ id, toque: n });
    window.setTimeout(() => setFalando(f => (f && f.id === id && f.toque === n ? null : f)), 2600);
  };

  return (
    <ul className="absolute inset-x-0 bottom-1 flex items-end justify-center gap-0.5 overflow-x-auto px-3 pb-1 pt-16 sm:gap-2" aria-label="Equipe">
      {fila.map((p, i) => {
        const config = lerAvatar(p.dsConfig, p.idUsuario, p.nmCargo);
        const primeiro = p.nmNome.trim().split(/\s+/)[0];
        const fala = falando?.id === p.idUsuario ? falando : null;
        return (
          <li key={p.idUsuario} className="nt-pessoa relative shrink-0" style={{ animationDelay: `${200 + i * 90}ms` }}>
            <div className="nt-passeio" style={{ "--passeio": `${7 + (p.idUsuario % 5)}s`, "--amplitude": `${4 + (p.idUsuario % 4) * 2}px`, animationDelay: `${-(p.idUsuario % 7)}s` } as CSSProperties}>
              {fala && (
                <span role="status" className="nt-balao absolute bottom-full left-1/2 z-10 mb-1 whitespace-nowrap rounded-xl border-2 border-slate-800 bg-white px-2 py-1 text-[11px] font-black text-slate-800 shadow-md"
                  style={{ transform: "translateX(-50%)" }}>
                  {fraseDoToque(p.idUsuario, fala.toque)}
                  <span className="absolute left-1/2 top-full -ml-1 h-2 w-2 -translate-y-1 rotate-45 border-b-2 border-r-2 border-slate-800 bg-white" aria-hidden="true" />
                </span>
              )}
              <button type="button" onClick={() => tocar(p.idUsuario)} title={p.nmCargo ? `${p.nmNome} · ${p.nmCargo}` : p.nmNome}
                aria-label={`${p.flProprio ? "Você" : p.nmNome}${p.nmCargo ? `, ${p.nmCargo}` : ""}`}
                className="group flex flex-col items-center focus-visible:outline-none">
                <span key={fala?.toque ?? 0} className={`block ${fala ? "nt-pulo" : ""}`}>
                  <Avatar config={config} tema={config.datas ? tema : null} tamanho={64} animado atraso={(p.idUsuario % 9) * 0.37}
                    className={`h-12 w-12 sm:h-16 sm:w-16 transition-transform group-hover:-translate-y-1 group-focus-visible:ring-4 group-focus-visible:ring-blue-400 rounded-[22%] ${p.flProprio ? "ring-2 ring-white" : ""}`} />
                </span>
                <span className="nt-sombra -mt-1 block h-1.5 w-10 rounded-full bg-black sm:w-12" aria-hidden="true" />
                <span className={`mt-0.5 max-w-[4.5rem] truncate rounded-full px-1.5 text-[10px] font-black leading-4 shadow-sm ${p.flProprio ? "bg-blue-600 text-white" : "bg-white/85 text-slate-700"}`}>
                  {p.flProprio ? "Você" : primeiro}
                </span>
              </button>
            </div>
          </li>
        );
      })}
      {fora > 0 && (
        <li className="nt-pessoa mb-5 shrink-0 rounded-full bg-white/85 px-2 py-1 text-[11px] font-black text-slate-700 shadow-sm" style={{ animationDelay: `${200 + fila.length * 90}ms` }}>
          +{fora}
        </li>
      )}
    </ul>
  );
}
