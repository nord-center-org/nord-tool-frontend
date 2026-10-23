import { useRef, useState, type PointerEvent as EventoPonteiro, type MutableRefObject } from "react";
import { ArrowBigUp } from "lucide-react";

import type { Controles } from "./controles";

/** Joystick na tela (celular): direcional à esquerda e botão de pulo à direita. */
export default function Joystick({ controles }: { controles: MutableRefObject<Controles> }) {
  const base = useRef<HTMLDivElement>(null);
  const [pino, setPino] = useState({ x: 0, y: 0 });
  const [pulando, setPulando] = useState(false);

  const mover = (e: EventoPonteiro<HTMLDivElement>) => {
    const r = base.current!.getBoundingClientRect();
    const raio = r.width / 2;
    let x = (e.clientX - (r.left + raio)) / raio, y = (e.clientY - (r.top + raio)) / raio;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    controles.current.joystick = { x, y };
    setPino({ x, y });
  };
  const soltar = () => { controles.current.joystick = { x: 0, y: 0 }; setPino({ x: 0, y: 0 }); };

  return (
    <>
      <div ref={base} role="presentation" aria-label="Joystick"
        className="pointer-events-auto absolute bottom-3 left-3 h-24 w-24 touch-none select-none rounded-full border-4 border-white/70 bg-slate-900/25 shadow-lg backdrop-blur-sm"
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); mover(e); }} onPointerMove={e => { if (e.buttons || e.pointerType === "touch") mover(e); }}
        onPointerUp={soltar} onPointerCancel={soltar}>
        <div className="absolute left-1/2 top-1/2 h-11 w-11 rounded-full border-4 border-white bg-indigo-500 shadow-md transition-transform duration-75"
          style={{ transform: `translate(calc(-50% + ${pino.x * 26}px), calc(-50% + ${pino.y * 26}px))` }} />
      </div>
      <button type="button" aria-label="Pular" data-tour="pular"
        className={`pointer-events-auto absolute bottom-5 right-4 flex h-16 w-16 touch-none select-none items-center justify-center rounded-full border-4 border-white text-white shadow-lg transition-transform ${pulando ? "scale-90 bg-pink-600" : "bg-pink-500"}`}
        onPointerDown={e => { e.preventDefault(); controles.current.pularToque = true; setPulando(true); }}
        onPointerUp={() => { controles.current.pularToque = false; setPulando(false); }}
        onPointerCancel={() => { controles.current.pularToque = false; setPulando(false); }}>
        <ArrowBigUp className="h-8 w-8" />
      </button>
    </>
  );
}
