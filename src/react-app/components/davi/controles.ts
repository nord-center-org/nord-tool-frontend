import { useEffect, useRef } from "react";

/** Estado dos controles (teclado + joystick), lido a cada quadro pelo jogo. */
export interface Controles {
  teclas: Set<string>;
  joystick: { x: number; y: number };
  pularToque: boolean;
  /** Incrementa a cada E/Enter (ação "jogar" na porta). */
  interagir: number;
}

const ehCampo = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

const MAPA: Record<string, string> = {
  a: "esq", arrowleft: "esq", d: "dir", arrowright: "dir", w: "pular", arrowup: "pular", " ": "pular", s: "descer", arrowdown: "descer",
};

/** Teclado: A/D (ou setas) andam, W/espaço pulam, S desce do puleiro, E/Enter interage. */
export function useControles(ativo: boolean) {
  const ref = useRef<Controles>({ teclas: new Set(), joystick: { x: 0, y: 0 }, pularToque: false, interagir: 0 });
  useEffect(() => {
    if (!ativo) return;
    const baixo = (e: KeyboardEvent) => {
      if (ehCampo(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (MAPA[k]) { ref.current.teclas.add(MAPA[k]); e.preventDefault(); }
      if ((k === "e" || k === "enter") && !e.repeat) ref.current.interagir++;
    };
    const cima = (e: KeyboardEvent) => { const k = MAPA[e.key.toLowerCase()]; if (k) ref.current.teclas.delete(k); };
    const limpar = () => ref.current.teclas.clear();
    window.addEventListener("keydown", baixo);
    window.addEventListener("keyup", cima);
    window.addEventListener("blur", limpar);
    return () => { window.removeEventListener("keydown", baixo); window.removeEventListener("keyup", cima); window.removeEventListener("blur", limpar); };
  }, [ativo]);
  return ref;
}

/** Entrada do jogador neste quadro. */
export function lerEntrada(c: Controles) {
  const t = c.teclas;
  const dirTeclado = (t.has("dir") ? 1 : 0) - (t.has("esq") ? 1 : 0);
  const dir = dirTeclado !== 0 ? dirTeclado : Math.abs(c.joystick.x) > 0.25 ? c.joystick.x : 0;
  return {
    dir,
    pular: t.has("pular") || c.pularToque || c.joystick.y < -0.65,
    descer: t.has("descer") || c.joystick.y > 0.65,
  };
}
