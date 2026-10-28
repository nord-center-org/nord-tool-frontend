import type { CSSProperties, ReactNode } from "react";

import { tom } from "@/react-app/utils/avatar";

export type Pose = "livre" | "empurrar" | "ombro" | "segurar";

export interface PessoaProps {
  /** Deslocamento dentro do ator (unidades da cena). */
  x?: number;
  pele: string;
  camisa: string;
  calca?: string;
  cabelo?: string;
  /** Cor do capacete; null = sem capacete. */
  capacete?: string | null;
  /** Capacete que só aparece na cabeça depois da marca "capacete" (antes vai na mão). */
  capaceteDepois?: string;
  colete?: string;
  barba?: boolean;
  oculos?: boolean;
  /** Cabelo comprido preso (rabo de cavalo saindo do capacete). */
  rabo?: boolean;
  pose?: Pose;
  /** Quem faz a ação da cena (apontar, apertar a mão…). */
  lider?: boolean;
  /** Atraso do passo, para um grupo não andar sincronizado. */
  fase?: number;
  /** Itens desenhados na mão da frente (coordenadas do braço: ombro em 0,0, mão em 0,13.7). */
  naMao?: ReactNode;
  /** Detalhes na roupa (por cima do tronco). */
  roupa?: ReactNode;
}

/**
 * Trabalhador de perfil (virado para a direita), desenhado em vetor com pernas e braços articulados.
 * Coordenadas internas em dobro (pés em y=0, ~52 de altura) e reduzidas pela metade na cena.
 */
export default function Pessoa({
  x = 0, pele, camisa, calca = "#1e3a8a", cabelo = "#2b2118", capacete = "#facc15", capaceteDepois, colete, barba, oculos, rabo,
  pose = "livre", lider, fase = 0, naMao, roupa,
}: PessoaProps) {
  const sombra = tom(pele, -0.18);
  const linha = tom(pele, -0.45);
  const manga = camisa;
  const atraso: CSSProperties = { animationDelay: `${-fase}s` };
  return (
    <g transform={`translate(${x} 0) scale(0.5)`} shapeRendering="geometricPrecision">
      <g className={`nt-gente nt-pose-${pose} ${lider ? "nt-lider" : ""}`}>
        <ellipse cx="1" cy="0" rx="9" ry="1.8" fill="#000" opacity="0.18" />
        <g className="nt-corpo-anda" style={atraso}>
          {/* Braço de trás */}
          <g className="nt-braco nt-braco-t" style={atraso}>
            <rect x="-2.2" y="-34" width="4.4" height="13" rx="2.2" fill={tom(manga, -0.25)} />
            <circle cx="0" cy="-20.3" r="2.2" fill={sombra} />
          </g>
          {/* Pernas */}
          <g className="nt-perna nt-perna-t" style={atraso}>
            <rect x="-2.6" y="-20" width="5.2" height="17" rx="2.4" fill={tom(calca, -0.25)} />
            <path d="M-3 -4.2 L4.2 -4.2 C6.4 -4.2 7 -1.6 6.6 0 L-3 0 Z" fill="#2a1d14" />
          </g>
          <g className="nt-perna nt-perna-f" style={atraso}>
            <rect x="-2.6" y="-20" width="5.2" height="17" rx="2.4" fill={calca} />
            <path d="M-3 -4.2 L4.2 -4.2 C6.4 -4.2 7 -1.6 6.6 0 L-3 0 Z" fill="#3f2a1d" />
            <rect x="-3" y="-1.2" width="9.6" height="1.2" fill="#1c130d" />
          </g>
          {/* Tronco */}
          <path d="M-6 -34.8 Q0 -37.6 6 -34.8 L6.8 -19.4 Q0 -18 -6.8 -19.4 Z" fill={camisa} stroke={tom(camisa, -0.35)} strokeWidth="0.6" />
          <path d="M2 -36 L6 -34.8 L6.8 -19.4 Q4.6 -19 3 -18.9 Z" fill="#000" opacity="0.1" />
          {colete && (
            <g>
              <path d="M-6.2 -34.4 L-1 -35.6 L-0.6 -20 L-6.8 -20.4 Z M6.2 -34.4 L2.4 -35.6 L2.6 -20 L6.8 -20.4 Z" fill={colete} />
              <rect x="-6.6" y="-30.2" width="13.4" height="1.5" fill="#e5e7eb" opacity="0.95" />
              <rect x="-6.8" y="-25.6" width="13.6" height="1.5" fill="#e5e7eb" opacity="0.95" />
            </g>
          )}
          {roupa}
          <rect x="-6.8" y="-21.2" width="13.6" height="1.8" rx="0.6" fill="#3f3f46" />
          <rect x="1.2" y="-21.3" width="2" height="2" fill="#a1a1aa" />
          {/* Cabeça */}
          <g className="nt-cabeca">
            <rect x="-1.8" y="-38.4" width="3.6" height="4.4" fill={sombra} />
            {rabo && <path d="M-4.2 -44 C-9 -43 -9.6 -37 -7.4 -34.6 C-7 -38 -5.6 -40.4 -3.6 -41.6 Z" fill={cabelo} />}
            <ellipse cx="1" cy="-42.2" rx="5.2" ry="5.6" fill={pele} stroke={linha} strokeWidth="0.6" />
            <path d="M-4.2 -43.4 C-4.8 -39.6 -3.4 -37.6 -1.4 -37.4 L-1 -44.4 Z" fill={cabelo} />
            <ellipse cx="-0.4" cy="-41.6" rx="1.3" ry="1.8" fill={sombra} />
            <circle cx="3.9" cy="-42.5" r="0.8" fill="#111827" />
            <path d="M2.6 -44.6 L5.2 -44.9" stroke={tom(cabelo, -0.1)} strokeWidth="0.8" strokeLinecap="round" />
            <path d="M5.9 -42.6 Q7.5 -41 6 -40.2" fill={pele} stroke={linha} strokeWidth="0.6" />
            <circle cx="3.8" cy="-40" r="1" fill="#f472b6" opacity="0.3" />
            <path d="M4.2 -38.7 Q5.1 -38.3 5.9 -38.9" stroke="#7f1d1d" strokeWidth="0.6" fill="none" strokeLinecap="round" />
            {barba && <path d="M-1 -40 C0 -36.4 4.4 -36 6.2 -38.6 L6 -37.6 C4.4 -35.6 0.4 -35.6 -1.2 -38.4 Z" fill={cabelo} />}
            {oculos && <path d="M2.4 -43.4 L5.8 -43.4 L5.6 -41.6 L2.6 -41.6 Z M-0.6 -42.8 L2.4 -42.8" fill="none" stroke="#111827" strokeWidth="0.6" />}
            {capacete ? <Capacete cor={capacete} /> : (
              <path d="M-4.4 -44 C-4.6 -50.4 6.8 -50.6 6.6 -45 C4 -46.6 1 -46.2 -1 -44.4 Z" fill={cabelo} />
            )}
            {capaceteDepois && <g className="nt-cap-cabeca"><Capacete cor={capaceteDepois} /></g>}
          </g>
          {/* Braço da frente (com o que estiver na mão) */}
          <g className="nt-braco nt-braco-f" style={atraso}>
            <rect x="-2.2" y="-34" width="4.4" height="13" rx="2.2" fill={manga} stroke={tom(manga, -0.3)} strokeWidth="0.4" />
            <circle cx="0" cy="-20.3" r="2.3" fill={pele} stroke={linha} strokeWidth="0.4" />
            {naMao && <g transform="translate(0 -20.3)">{naMao}</g>}
          </g>
        </g>
      </g>
    </g>
  );
}

function Capacete({ cor }: { cor: string }) {
  return (
    <g>
      <path d="M-4.7 -44.2 C-4.7 -51.2 7.3 -51.8 7.3 -44.2 Z" fill={cor} stroke={tom(cor, -0.4)} strokeWidth="0.6" />
      <path d="M0.6 -50.6 L2.2 -50.6 L2.6 -44.4 L0.6 -44.4 Z" fill={tom(cor, 0.2)} />
      <path d="M-5.1 -44.7 L9.8 -44.7 Q10.4 -43.5 9.4 -43.2 L-5.1 -43.2 Z" fill={tom(cor, -0.18)} />
      <path d="M-2.4 -47.6 Q-0.6 -50 2.4 -50.4" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Capacete solto (na mão), em coordenadas da mão. */
export function CapaceteNaMao({ cor }: { cor: string }) {
  return (
    <g className="nt-cap-mao" transform="translate(-2 3)">
      <path d="M-4.4 0 C-4.4 -6.6 6.8 -7 6.8 0 Z" fill={cor} stroke={tom(cor, -0.4)} strokeWidth="0.6" />
      <path d="M-4.8 -0.4 L9 -0.4 L9 1 L-4.8 1 Z" fill={tom(cor, -0.18)} />
    </g>
  );
}
