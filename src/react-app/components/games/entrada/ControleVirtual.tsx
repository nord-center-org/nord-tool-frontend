import { useRef, type PointerEvent as PE } from "react";
import type { Direcao } from "@/react-app/utils/games/bombas";
import { vibrar, type Controles } from "./entrada";

/**
 * Controle virtual de toque (direcional + A + B), na base da tela no modo portátil. O direcional entende o arrasto
 * (como um analógico de 4 direções), e os botões vibram de leve.
 */
export default function ControleVirtual({ controles, rotuloA = "Bomba", rotuloB = "Ação" }: { controles: Controles; rotuloA?: string; rotuloB?: string }) {
  const area = useRef<HTMLDivElement>(null);
  const ponteiro = useRef<number | null>(null);

  const direcaoDe = (e: PE<HTMLDivElement>): Direcao | null => {
    const r = area.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "direita" : "esquerda") : (dy > 0 ? "baixo" : "cima");
  };
  const mover = (e: PE<HTMLDivElement>) => {
    if (ponteiro.current !== e.pointerId) return;
    const d = direcaoDe(e);
    if (d !== controles.virtual.direcao && d) { vibrar(8); controles.tocarDirecao(d); }
    controles.virtual.direcao = d;
  };
  const botao = (chave: "a" | "b", rotulo: string, cor: string) => (
    <button type="button" aria-label={rotulo}
      onPointerDown={e => { e.preventDefault(); controles.virtual[chave] = true; controles.tocar(chave); vibrar(15); }}
      onPointerUp={() => { controles.virtual[chave] = false; }} onPointerCancel={() => { controles.virtual[chave] = false; }}
      onPointerLeave={() => { controles.virtual[chave] = false; }}
      className="flex h-20 w-20 select-none items-center justify-center rounded-full text-sm font-black uppercase text-white shadow-lg active:scale-95"
      style={{ background: cor, touchAction: "none" }}>
      {rotulo}
    </button>
  );
  const seta = (cls: string, simbolo: string) => (
    <span className={`absolute flex h-11 w-11 items-center justify-center text-xl font-black text-white/80 ${cls}`} aria-hidden="true">{simbolo}</span>
  );

  return (
    <div className="pointer-events-auto flex w-full items-end justify-between gap-4 px-4 pb-4 pt-2" style={{ touchAction: "none" }}>
      <div ref={area} role="group" aria-label="Direcional"
        onPointerDown={e => { ponteiro.current = e.pointerId; area.current?.setPointerCapture(e.pointerId); mover(e); }}
        onPointerMove={mover}
        onPointerUp={() => { ponteiro.current = null; controles.virtual.direcao = null; }}
        onPointerCancel={() => { ponteiro.current = null; controles.virtual.direcao = null; }}
        className="relative h-40 w-40 select-none rounded-full bg-white/10 ring-2 ring-white/20" style={{ touchAction: "none" }}>
        {seta("left-1/2 top-1 -translate-x-1/2", "▲")}
        {seta("bottom-1 left-1/2 -translate-x-1/2", "▼")}
        {seta("left-1 top-1/2 -translate-y-1/2", "◀")}
        {seta("right-1 top-1/2 -translate-y-1/2", "▶")}
        <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25" />
      </div>
      <div className="flex items-end gap-3">
        <div className="mb-10">{botao("b", rotuloB, "#7c3aed")}</div>
        {botao("a", rotuloA, "#e11d48")}
      </div>
    </div>
  );
}
