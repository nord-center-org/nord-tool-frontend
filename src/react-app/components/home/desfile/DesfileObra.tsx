import { useEffect, useRef, useState } from "react";

import { ALTURA, MEMORIA_CENAS, duracaoCena, estadoNoTempo, sortearCena, type Cena } from "@/react-app/utils/desfile";
import DesenhoAtor, { Betoneira } from "./Atores";
import "./Desfile.css";

const CHAO = 126;
const FAIXA_FRENTE = 4;

const menosMovimento = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Diretor do desfile: sorteia uma cena, move os atores a cada quadro (posição, andando/parado, ação e fala)
 * e, quando todos saem da tela, espera um pouco e sorteia outra sem repetir as últimas.
 */
export default function DesfileObra({ clip }: { clip: string }) {
  const [parado] = useState(menosMovimento);
  const [cena, setCena] = useState<Cena>(() => sortearCena([]));
  const recentes = useRef<string[]>([]);
  const atores = useRef<(SVGGElement | null)[]>([]);
  const baloes = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    if (parado) return;
    recentes.current = [cena.id, ...recentes.current].slice(0, MEMORIA_CENAS);
    const duracao = duracaoCena(cena);
    const inicio = performance.now();
    let quadro = 0;
    let espera = 0;
    const ultimo: { andando: string; acao: string; marca: string; fala: string }[] = cena.atores.map(() => ({ andando: "", acao: "", marca: "", fala: "" }));

    const tique = (agora: number) => {
      const t = (agora - inicio) / 1000;
      cena.atores.forEach((a, i) => {
        const el = atores.current[i];
        if (!el) return;
        const e = estadoNoTempo(a, t);
        const y = CHAO + (a.faixa === 1 ? FAIXA_FRENTE : 0);
        el.setAttribute("transform", `translate(${e.x.toFixed(2)} ${y})`);
        const anterior = ultimo[i];
        const andando = e.andando ? "1" : "0";
        if (anterior.andando !== andando) { el.dataset.andando = andando; anterior.andando = andando; }
        if (anterior.acao !== (e.acao ?? "")) { el.dataset.acao = e.acao ?? ""; anterior.acao = e.acao ?? ""; }
        if (anterior.marca !== (e.marca ?? "")) { el.dataset.marca = e.marca ?? ""; anterior.marca = e.marca ?? ""; }
        const balao = baloes.current[i];
        if (balao) {
          if (anterior.fala !== (e.fala ?? "")) {
            anterior.fala = e.fala ?? "";
            const texto = balao.querySelector("text");
            const caixa = balao.querySelector("rect");
            if (texto && caixa && e.fala) {
              texto.textContent = e.fala;
              const largura = e.fala.length * 3.15 + 8;
              caixa.setAttribute("x", String(-largura / 2));
              caixa.setAttribute("width", String(largura));
            }
            balao.style.visibility = e.fala ? "visible" : "hidden";
            balao.classList.toggle("nt-balao-cena--aberto", !!e.fala);
          }
          if (e.fala) balao.setAttribute("transform", `translate(${e.x.toFixed(2)} ${y - ALTURA[a.tipo] - 4})`);
        }
      });
      if (t > duracao + 0.3) {
        espera = window.setTimeout(() => setCena(sortearCena(recentes.current)), 700 + Math.random() * 2000);
        return;
      }
      quadro = requestAnimationFrame(tique);
    };
    quadro = requestAnimationFrame(tique);
    return () => { cancelAnimationFrame(quadro); window.clearTimeout(espera); };
  }, [cena, parado]);

  if (parado) {
    // Sem movimento: a betoneira fica parada no canteiro, como na cena antiga.
    return <Betoneira clip={clip} />;
  }

  // Faixa de trás primeiro: quem está na frente passa por cima.
  const ordem = cena.atores.map((a, i) => ({ a, i })).sort((x, y) => (x.a.faixa ?? 0) - (y.a.faixa ?? 0));
  return (
    <g className="nt-desfile-cena">
      {ordem.map(({ a, i }) => (
        <g key={`${cena.id}-${i}`} ref={el => { atores.current[i] = el; }} className="nt-ator" data-andando="0" data-acao="" data-marca={a.marca ?? ""}
          transform={`translate(${a.x} ${CHAO})`}>
          <g transform={a.dir === -1 ? "scale(-1 1)" : undefined}>
            <DesenhoAtor tipo={a.tipo} clip={clip} />
          </g>
        </g>
      ))}
      {cena.atores.map((_, i) => (
        <g key={`balao-${cena.id}-${i}`} ref={el => { baloes.current[i] = el; }} className="nt-balao-cena" style={{ visibility: "hidden" }} shapeRendering="geometricPrecision">
          <g className="nt-balao-cena-pop">
            <rect x="-20" y="-10" width="40" height="10" rx="3" fill="#fff" stroke="#1e293b" strokeWidth="0.7" />
            <path d="M-2 -0.4 L0 3 L2.4 -0.4 Z" fill="#fff" stroke="#1e293b" strokeWidth="0.7" strokeLinejoin="round" />
            <rect x="-2.4" y="-1.2" width="5.2" height="1.4" fill="#fff" />
            <text x="0" y="-3.2" textAnchor="middle" fontSize="5.4" fontWeight="800" fill="#1e293b" fontFamily="inherit" />
          </g>
        </g>
      ))}
    </g>
  );
}
