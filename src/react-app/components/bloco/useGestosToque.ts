import { useEffect, useRef } from "react";

import { escalaDaPinca } from "@/react-app/utils/blocoNotas";

interface Opcoes {
  /** Um dedo arrasta a tela a partir deste ponto? (Não quando ele está desenhando na folha.) */
  podeArrastar: (alvo: EventTarget | null) => boolean;
  zoomAtual: () => number;
  /** Novo zoom com o ponto (cx, cy) da janela parado embaixo dos dedos. */
  aoZoom: (zoom: number, cx: number, cy: number) => void;
}

/**
 * Correção (zoom como no Xodo): pinça dá zoom no ponto entre os dedos, dois dedos arrastam, um dedo arrasta quando
 * não está desenhando (com embalo ao soltar). O navegador não faz nada disso sozinho (`touch-action: none`), para não
 * dar zoom na página inteira nem brigar com o desenho.
 */
export function useGestosToque(alvo: React.RefObject<HTMLElement | null>, opcoes: Opcoes, ativo = true) {
  const op = useRef(opcoes);
  op.current = opcoes;
  useEffect(() => {
    const el = alvo.current;
    if (!el || !ativo) return;
    let modo: "nada" | "arrastar" | "pinca" = "nada";
    let ultimo = { x: 0, y: 0, t: 0 }, vel = { x: 0, y: 0 };
    let pinca = { d0: 1, z0: 1, mx: 0, my: 0 };
    let embalo = 0;
    const parar = () => { cancelAnimationFrame(embalo); embalo = 0; };
    const meio = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const inicio = (e: TouchEvent) => {
      parar();
      if (e.touches.length >= 2) {
        const m = meio(e.touches);
        pinca = { d0: Math.max(1, dist(e.touches)), z0: op.current.zoomAtual(), mx: m.x, my: m.y };
        modo = "pinca";
      } else if (e.touches.length === 1 && op.current.podeArrastar(e.target)) {
        ultimo = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
        vel = { x: 0, y: 0 };
        modo = "arrastar";
      } else modo = "nada";
    };
    const mover = (e: TouchEvent) => {
      if (modo === "pinca" && e.touches.length >= 2) {
        e.preventDefault();
        const m = meio(e.touches);
        // dois dedos andando arrastam; abrindo e fechando, zoom no ponto entre eles
        el.scrollLeft -= m.x - pinca.mx;
        el.scrollTop -= m.y - pinca.my;
        pinca.mx = m.x; pinca.my = m.y;
        op.current.aoZoom(escalaDaPinca(pinca.z0, pinca.d0, dist(e.touches)), m.x, m.y);
      } else if (modo === "arrastar" && e.touches.length === 1) {
        e.preventDefault();
        const x = e.touches[0].clientX, y = e.touches[0].clientY, t = performance.now();
        el.scrollLeft -= x - ultimo.x;
        el.scrollTop -= y - ultimo.y;
        const dt = Math.max(1, t - ultimo.t);
        vel = { x: 0.8 * ((x - ultimo.x) / dt) + 0.2 * vel.x, y: 0.8 * ((y - ultimo.y) / dt) + 0.2 * vel.y };
        ultimo = { x, y, t };
      }
    };
    const fim = (e: TouchEvent) => {
      if (modo === "arrastar" && !e.touches.length && performance.now() - ultimo.t < 80) {
        // embalo: continua andando e vai parando
        let { x: vx, y: vy } = vel, antes = performance.now();
        const passo = (agora: number) => {
          const dt = agora - antes; antes = agora;
          el.scrollLeft -= vx * dt; el.scrollTop -= vy * dt;
          const f = Math.pow(0.995, dt);
          vx *= f; vy *= f;
          embalo = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(passo) : 0;
        };
        embalo = requestAnimationFrame(passo);
      }
      // ao tirar um dos dois dedos, o que ficou não arrasta (evita o pulo)
      if (e.touches.length < 2) modo = "nada";
    };
    el.addEventListener("touchstart", inicio, { passive: true });
    el.addEventListener("touchmove", mover, { passive: false });
    el.addEventListener("touchend", fim);
    el.addEventListener("touchcancel", fim);
    return () => {
      parar();
      el.removeEventListener("touchstart", inicio);
      el.removeEventListener("touchmove", mover);
      el.removeEventListener("touchend", fim);
      el.removeEventListener("touchcancel", fim);
    };
  }, [alvo, ativo]);
}
