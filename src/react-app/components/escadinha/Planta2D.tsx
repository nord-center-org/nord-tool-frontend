import { useId, useMemo } from "react";

import { limites, pilares, type Pavimento, type Ponto, type Torre } from "@/react-app/utils/escadinha";

interface Planta2DProps {
  torre: Torre;
  pavimento: Pavimento | null;
  /** Versão miniatura (canto do visualizador): sem cotas nem textos. */
  mini?: boolean;
  /** Mostra a prancha original atrás do croqui. */
  comPrancha?: boolean;
}

const fmt = (m: number) => m.toFixed(2).replace(".", ",");

/** Planta 2D do pavimento: croqui (contorno e pilares) com cotas gerais e, se houver, a prancha do projeto ao fundo. */
export default function Planta2D({ torre, pavimento, mini = false, comPrancha = true }: Planta2DProps) {
  const id = useId().replace(/:/g, "");
  const contorno = pavimento?.contorno ?? torre.contorno;
  const lim = limites(torre.contorno);
  const colunas = useMemo(() => pilares(contorno), [contorno]);
  const margem = mini ? 2 : Math.max(lim.largura, lim.profundidade) * 0.16;
  const vb = `${lim.minX - margem} ${-lim.maxY - margem} ${lim.largura + margem * 2} ${lim.profundidade + margem * 2}`;
  const pts = (c: Ponto[]) => c.map(([x, y]) => `${x},${-y}`).join(" ");
  const traco = Math.max(lim.largura, lim.profundidade) / (mini ? 90 : 220);

  // A prancha foi analisada em pixels: põe a imagem no mesmo sistema do croqui (metros, y para baixo).
  const prancha = torre.planta;
  const transformPrancha = useMemo(() => {
    if (!prancha) return "";
    const l = limites(prancha.contornoPx);
    const s = lim.largura / (l.largura || 1);
    return `scale(${s}) translate(${-(l.minX + l.maxX) / 2} ${-(l.minY + l.maxY) / 2})`;
  }, [prancha, lim.largura]);
  const cota = lim.profundidade * 0.06;

  return (
    <svg viewBox={vb} className="h-full w-full" role="img" aria-label={`Planta ${pavimento?.nome ?? "do pavimento tipo"}`}>
      <defs>
        <pattern id={`grade-${id}`} width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0 L0 0 0 1" fill="none" stroke="#1e293b" strokeWidth={traco * 0.6} />
        </pattern>
        <clipPath id={`recorte-${id}`}>
          <rect x={lim.minX - margem * 0.6} y={-lim.maxY - margem * 0.6} width={lim.largura + margem * 1.2} height={lim.profundidade + margem * 1.2} />
        </clipPath>
      </defs>
      <rect x={lim.minX - margem} y={-lim.maxY - margem} width={lim.largura + margem * 2} height={lim.profundidade + margem * 2} fill={`url(#grade-${id})`} />
      {prancha && comPrancha && !pavimento?.contorno && (
        <g clipPath={`url(#recorte-${id})`} opacity={mini ? 0.35 : 0.55}>
          <image href={prancha.imagem} width={prancha.largura} height={prancha.altura} transform={transformPrancha}
            preserveAspectRatio="none" style={{ filter: "invert(1) hue-rotate(180deg)" }} />
        </g>
      )}
      {pavimento?.contorno && <polygon points={pts(torre.contorno)} fill="none" stroke="#475569" strokeWidth={traco} strokeDasharray={`${traco * 4} ${traco * 3}`} />}
      <polygon points={pts(contorno)} fill="rgba(251,146,60,0.12)" stroke="#fb923c" strokeWidth={traco * 2} strokeLinejoin="round" />
      {colunas.map(([x, y], i) => (
        <rect key={i} x={x - 0.25} y={-y - 0.25} width="0.5" height="0.5" fill="#e2e8f0" />
      ))}
      {!mini && (
        <g fill="#cbd5e1" fontSize={Math.max(lim.largura, lim.profundidade) * 0.028} fontWeight="700" textAnchor="middle">
          <line x1={lim.minX} x2={lim.maxX} y1={-lim.minY + margem * 0.45} y2={-lim.minY + margem * 0.45} stroke="#94a3b8" strokeWidth={traco} />
          <line x1={lim.minX} x2={lim.minX} y1={-lim.minY + margem * 0.3} y2={-lim.minY + margem * 0.6} stroke="#94a3b8" strokeWidth={traco} />
          <line x1={lim.maxX} x2={lim.maxX} y1={-lim.minY + margem * 0.3} y2={-lim.minY + margem * 0.6} stroke="#94a3b8" strokeWidth={traco} />
          <text x={(lim.minX + lim.maxX) / 2} y={-lim.minY + margem * 0.45 - cota * 0.4}>{fmt(lim.largura)} m</text>
          <line x1={lim.maxX + margem * 0.45} x2={lim.maxX + margem * 0.45} y1={-lim.maxY} y2={-lim.minY} stroke="#94a3b8" strokeWidth={traco} />
          <line x1={lim.maxX + margem * 0.3} x2={lim.maxX + margem * 0.6} y1={-lim.maxY} y2={-lim.maxY} stroke="#94a3b8" strokeWidth={traco} />
          <line x1={lim.maxX + margem * 0.3} x2={lim.maxX + margem * 0.6} y1={-lim.minY} y2={-lim.minY} stroke="#94a3b8" strokeWidth={traco} />
          <text transform={`translate(${lim.maxX + margem * 0.45 - cota * 0.4} ${-(lim.minY + lim.maxY) / 2}) rotate(-90)`}>{fmt(lim.profundidade)} m</text>
        </g>
      )}
    </svg>
  );
}
