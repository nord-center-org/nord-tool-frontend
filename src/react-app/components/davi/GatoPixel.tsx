import { useMemo } from "react";

import {
  GATO_H, GATO_W, RATO_H, RATO_W, emRetangulos, montarGato, montarRato, pelagemPorId, type QuadroGato,
} from "@/react-app/utils/daviJob/sprites";

interface GatoPixelProps {
  pelagem: string;
  quadro?: QuadroGato;
  /** Largura em px (a altura segue a proporção do sprite). */
  tamanho?: number;
  virado?: -1 | 1;
  className?: string;
  rotulo?: string;
}

/** Gatinho em pixel art como SVG (nítido em qualquer tamanho), para usos fora do canvas. */
export default function GatoPixel({ pelagem, quadro = { pose: "parado", cauda: 0 }, tamanho = 60, virado = 1, className, rotulo }: GatoPixelProps) {
  const rets = useMemo(() => emRetangulos(montarGato(pelagemPorId(pelagem), quadro)), [pelagem, quadro]);
  return (
    <svg viewBox={`0 0 ${GATO_W} ${GATO_H}`} width={tamanho} height={(tamanho * GATO_H) / GATO_W} shapeRendering="crispEdges" className={className}
      style={virado < 0 ? { transform: "scaleX(-1)" } : undefined} role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      {rets.map(r => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.cor} />)}
    </svg>
  );
}

export function RatoPixel({ quadro = 0, tamanho = 40, virado = 1, className }: { quadro?: 0 | 1; tamanho?: number; virado?: -1 | 1; className?: string }) {
  const rets = useMemo(() => emRetangulos(montarRato(quadro, "#7c8594")), [quadro]);
  return (
    <svg viewBox={`0 0 ${RATO_W} ${RATO_H}`} width={tamanho} height={(tamanho * RATO_H) / RATO_W} shapeRendering="crispEdges" className={className}
      style={virado < 0 ? { transform: "scaleX(-1)" } : undefined} aria-hidden="true">
      {rets.map(r => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.cor} />)}
    </svg>
  );
}
