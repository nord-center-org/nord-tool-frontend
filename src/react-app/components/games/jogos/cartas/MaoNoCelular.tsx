import { COR_HEX } from "./motorCartas";
import type { MaoPrivada } from "@/react-app/utils/games/sala";

const SIMBOLO: Record<string, string> = { P: "⊘", I: "⇄", "+2": "+2", C: "★", "+4": "+4" };
const NOMES = ["vermelho", "verde", "azul", "amarelo"];

function CartaMini({ c, grande, sel }: { c: string; grande?: boolean; sel?: boolean }) {
  const v = c.slice(1);
  const cor = COR_HEX[c[0] as "r"];
  return (
    <span aria-label={`carta ${c[0] === "w" ? "coringa" : NOMES["rgby".indexOf(c[0])]} ${SIMBOLO[v] ?? v}`}
      className={`grid shrink-0 place-items-center rounded-lg border-2 border-white font-black text-white shadow ${grande ? "h-20 w-14 text-2xl" : "h-16 w-11 text-lg"} ${sel ? "-translate-y-3 ring-4 ring-amber-300" : ""}`}
      style={{ background: c[0] === "w" ? "conic-gradient(#e11d48 0 25%, #2563eb 0 50%, #eab308 0 75%, #16a34a 0)" : cor, textShadow: "0 1px 2px #000" }}>
      {SIMBOLO[v] ?? v}
    </span>
  );
}

/** A própria mão no celular (só este aparelho vê): mesa, cartas com a mira e a escolha de cor. */
export default function MaoNoCelular({ mao }: { mao: MaoPrivada }) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        {mao.topo && <CartaMini c={mao.topo} grande />}
        <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: COR_HEX[mao.cor as "r"] }}>cor: {NOMES["rgby".indexOf(mao.cor)]}</span>
      </div>
      <p className={`text-sm font-bold ${mao.vez ? "text-amber-300" : "text-white/60"}`} aria-live="polite">{mao.info}</p>
      {mao.escolhendoCor !== null && mao.escolhendoCor !== undefined ? (
        <div className="flex gap-3" role="radiogroup" aria-label="Cor do coringa">
          {["r", "g", "b", "y"].map((k, i) => (
            <span key={k} role="radio" aria-checked={i === mao.escolhendoCor} aria-label={NOMES[i]}
              className={`h-12 w-12 rounded-full ${i === mao.escolhendoCor ? "ring-4 ring-white" : "opacity-60"}`} style={{ background: COR_HEX[k as "r"] }} />
          ))}
        </div>
      ) : (
        <ul className="flex max-w-full gap-1 overflow-x-auto px-2 pb-1 pt-4" aria-label="Sua mão">
          {mao.c.map((c, i) => <li key={`${c}-${i}`}><CartaMini c={c} sel={mao.vez && i === mao.sel} /></li>)}
        </ul>
      )}
    </div>
  );
}
