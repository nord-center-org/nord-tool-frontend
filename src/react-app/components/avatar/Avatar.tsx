import { useId, useMemo } from "react";

import type { AvatarConfig, DataComemorativa } from "@/react-app/utils/avatar";
import { LADO, diferenca, emRetangulos, montarGrade } from "@/react-app/utils/avatarPixel";
import "./Avatar.css";

interface AvatarProps {
  config: AvatarConfig;
  /** Tema da data comemorativa a vestir (null = roupa normal). */
  tema?: DataComemorativa | null;
  tamanho?: number;
  /** Nome para leitores de tela; sem nome o desenho é decorativo. */
  rotulo?: string;
  className?: string;
  /** Pisca e respira (home, editor). Miniaturas ficam paradas. */
  animado?: boolean;
  /** Atraso da animação (s), para uma equipe não piscar toda junta. */
  atraso?: number;
}

/** Avatar em pixel art 32×32 desenhado em SVG (nítido em qualquer tamanho). */
export default function Avatar({ config, tema = null, tamanho = 64, rotulo, className, animado = false, atraso = 0 }: AvatarProps) {
  const id = useId().replace(/:/g, "");
  const { corpo, piscada } = useMemo(() => {
    const aberto = montarGrade(config, tema);
    return {
      corpo: emRetangulos(aberto),
      piscada: animado ? emRetangulos(diferenca(aberto, montarGrade(config, tema, true))) : [],
    };
  }, [config, tema, animado]);

  return (
    <svg viewBox={`0 0 ${LADO} ${LADO}`} width={tamanho} height={tamanho} shapeRendering="crispEdges"
      className={`${animado ? "nt-avatar-vivo" : ""} ${className ?? ""}`} style={animado ? { animationDelay: `${atraso}s` } : undefined}
      role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      <defs><clipPath id={`av-${id}`}><rect width={LADO} height={LADO} rx="7" /></clipPath></defs>
      <g clipPath={`url(#av-${id})`}>
        {corpo.map(r => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height="1" fill={r.cor} />)}
        {piscada.length > 0 && (
          <g className="nt-avatar-piscada" style={{ animationDelay: `${atraso + 1.3}s` }}>
            {piscada.map(r => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height="1" fill={r.cor} />)}
          </g>
        )}
      </g>
    </svg>
  );
}
