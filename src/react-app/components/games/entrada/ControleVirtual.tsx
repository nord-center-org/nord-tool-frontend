import { useEffect, useRef, useState } from "react";
import type { Direcao } from "@/react-app/utils/games/bombas";
import { useConfigControles } from "./useConfigControles";
import { vibrar, type Controles } from "./entrada";

const TAM = { p: { pad: 128, botao: 64 }, m: { pad: 160, botao: 80 }, g: { pad: 200, botao: 96 } } as const;
const SETAS: { d: Direcao; s: string; cls: string }[] = [
  { d: "cima", s: "▲", cls: "left-1/2 top-1 -translate-x-1/2" },
  { d: "baixo", s: "▼", cls: "bottom-1 left-1/2 -translate-x-1/2" },
  { d: "esquerda", s: "◀", cls: "left-1 top-1/2 -translate-y-1/2" },
  { d: "direita", s: "▶", cls: "right-1 top-1/2 -translate-y-1/2" },
];

/**
 * Controle virtual de toque (direcional + A + B). O direcional usa eventos de toque nativos com preventDefault, para o
 * navegador não confundir o arrasto com rolar a página (o que cancelava o toque em alguns celulares). Cada dedo é
 * acompanhado pelo seu identificador: dá para segurar a direção e apertar os botões ao mesmo tempo.
 */
export default function ControleVirtual({ controles, rotuloA = "Bomba", rotuloB = "Ação" }: { controles: Controles; rotuloA?: string; rotuloB?: string }) {
  const cfg = useConfigControles();
  const area = useRef<HTMLDivElement>(null);
  const pino = useRef<HTMLSpanElement>(null);
  const botaoA = useRef<HTMLButtonElement>(null);
  const botaoB = useRef<HTMLButtonElement>(null);
  const [ativa, setAtiva] = useState<Direcao | null>(null);
  const tam = TAM[cfg.tamanho];

  // Direcional: toque (nativo, não passivo) e mouse/caneta (pointer).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    let dedo: number | null = null;
    const aplicar = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      const raio = r.width / 2;
      let dx = x - (r.left + raio), dy = y - (r.top + raio);
      const dist = Math.hypot(dx, dy);
      const d: Direcao | null = dist < raio * 0.18 ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "direita" : "esquerda") : (dy > 0 ? "baixo" : "cima");
      if (dist > raio * 0.6) { dx *= (raio * 0.6) / dist; dy *= (raio * 0.6) / dist; }
      if (pino.current) pino.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      if (d !== controles.virtual.direcao) {
        if (d) { vibrar(8); controles.tocarDirecao(d); }
        controles.virtual.direcao = d;
        setAtiva(d);
      }
    };
    const soltar = () => {
      dedo = null;
      controles.virtual.direcao = null;
      setAtiva(null);
      if (pino.current) pino.current.style.transform = "translate(-50%, -50%)";
    };
    const inicio = (e: TouchEvent) => {
      e.preventDefault();
      if (dedo !== null) return;
      const t = e.changedTouches[0];
      dedo = t.identifier;
      aplicar(t.clientX, t.clientY);
    };
    const mover = (e: TouchEvent) => {
      e.preventDefault();
      const t = Array.from(e.changedTouches).find(x => x.identifier === dedo);
      if (t) aplicar(t.clientX, t.clientY);
    };
    const fim = (e: TouchEvent) => {
      if (Array.from(e.changedTouches).some(x => x.identifier === dedo)) soltar();
    };
    let mouse = false;
    const pDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      mouse = true;
      el.setPointerCapture(e.pointerId);
      aplicar(e.clientX, e.clientY);
    };
    const pMove = (e: PointerEvent) => { if (mouse && e.pointerType !== "touch") aplicar(e.clientX, e.clientY); };
    const pUp = (e: PointerEvent) => { if (e.pointerType !== "touch" && mouse) { mouse = false; soltar(); } };
    const opc = { passive: false } as AddEventListenerOptions;
    el.addEventListener("touchstart", inicio, opc);
    el.addEventListener("touchmove", mover, opc);
    el.addEventListener("touchend", fim);
    el.addEventListener("touchcancel", fim);
    el.addEventListener("pointerdown", pDown);
    el.addEventListener("pointermove", pMove);
    el.addEventListener("pointerup", pUp);
    el.addEventListener("pointercancel", pUp);
    return () => {
      el.removeEventListener("touchstart", inicio);
      el.removeEventListener("touchmove", mover);
      el.removeEventListener("touchend", fim);
      el.removeEventListener("touchcancel", fim);
      el.removeEventListener("pointerdown", pDown);
      el.removeEventListener("pointermove", pMove);
      el.removeEventListener("pointerup", pUp);
      el.removeEventListener("pointercancel", pUp);
      soltar();
    };
  }, [controles, cfg.estilo]);

  // Botões A e B: o mesmo cuidado (toque nativo e mouse).
  useEffect(() => {
    const pares: [HTMLButtonElement | null, "a" | "b"][] = [[botaoA.current, "a"], [botaoB.current, "b"]];
    const limpar: (() => void)[] = [];
    for (const [el, k] of pares) {
      if (!el) continue;
      const apertar = (e: Event) => { e.preventDefault(); controles.virtual[k] = true; controles.tocar(k); vibrar(15); el.dataset.apertado = "1"; };
      const largar = () => { controles.virtual[k] = false; delete el.dataset.apertado; };
      const pDown = (e: PointerEvent) => { if (e.pointerType !== "touch") apertar(e); };
      const pUp = (e: PointerEvent) => { if (e.pointerType !== "touch") largar(); };
      const opc = { passive: false } as AddEventListenerOptions;
      el.addEventListener("touchstart", apertar, opc);
      el.addEventListener("touchend", largar);
      el.addEventListener("touchcancel", largar);
      el.addEventListener("pointerdown", pDown);
      el.addEventListener("pointerup", pUp);
      el.addEventListener("pointerleave", pUp);
      limpar.push(() => {
        el.removeEventListener("touchstart", apertar);
        el.removeEventListener("touchend", largar);
        el.removeEventListener("touchcancel", largar);
        el.removeEventListener("pointerdown", pDown);
        el.removeEventListener("pointerup", pUp);
        el.removeEventListener("pointerleave", pUp);
        largar();
      });
    }
    return () => limpar.forEach(f => f());
  }, [controles, cfg.tamanho, cfg.canhoto]);

  const botao = (ref: React.RefObject<HTMLButtonElement | null>, rotulo: string, cor: string) => (
    <button ref={ref} type="button" aria-label={rotulo}
      className="flex select-none items-center justify-center rounded-full text-sm font-black uppercase text-white shadow-lg ring-white/70 data-[apertado]:scale-95 data-[apertado]:ring-4"
      style={{ background: cor, touchAction: "none", width: tam.botao, height: tam.botao }}>
      {rotulo}
    </button>
  );

  const direcional = (
    <div ref={area} role="group" aria-label="Direcional"
      className="relative shrink-0 select-none rounded-full bg-white/10 ring-2 ring-white/20" style={{ touchAction: "none", width: tam.pad, height: tam.pad }}>
      {SETAS.map(s => (
        <span key={s.d} aria-hidden="true"
          className={`absolute flex h-11 w-11 items-center justify-center rounded-full text-xl font-black ${s.cls} ${ativa === s.d ? "bg-white/40 text-white" : "text-white/70"}`}>{s.s}</span>
      ))}
      {cfg.estilo === "analogico" && (
        <span ref={pino} aria-hidden="true" className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/30 shadow-[0_0_12px_rgba(255,255,255,.35)] ring-2 ring-white/50"
          style={{ transform: "translate(-50%, -50%)" }} />
      )}
    </div>
  );
  const botoes = (
    <div className={`flex items-end gap-3 ${cfg.canhoto ? "flex-row-reverse" : ""}`}>
      <div className="mb-10">{botao(botaoB, rotuloB, "#7c3aed")}</div>
      {botao(botaoA, rotuloA, "#e11d48")}
    </div>
  );

  return (
    <div className={`pointer-events-auto flex w-full items-end justify-between gap-4 px-4 pb-4 pt-2 ${cfg.canhoto ? "flex-row-reverse" : ""}`} style={{ touchAction: "none" }}>
      {direcional}
      {botoes}
    </div>
  );
}
