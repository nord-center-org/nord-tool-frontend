import { useId, type CSSProperties, type ReactNode } from "react";

import type { DataComemorativa } from "@/react-app/utils/avatar";
import type { Periodo } from "@/react-app/utils/cena";
import "./CenaObra.css";

interface CenaObraProps {
  periodo: Periodo;
  tema: DataComemorativa | null;
}

const CEU: Record<Periodo, [string, string]> = {
  manha: ["#60a5fa", "#e0f2fe"],
  tarde: ["#f97316", "#fde68a"],
  noite: ["#0b1026", "#3b2f7a"],
};

/** Gerador pseudoaleatório fixo: a cena é sempre igual (sem "pular" a cada render). */
function sorteador(semente: number) {
  let s = semente;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const atraso = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/** Cena da obra em pixel art (SVG 400×150, x de -40 a 360): céu do horário, cidade, prédio subindo, guindaste, betoneira e chão. */
export default function CenaObra({ periodo, tema }: CenaObraProps) {
  const id = useId().replace(/:/g, "");
  const noite = periodo === "noite";
  return (
    <svg className={`nt-cena absolute inset-0 h-full w-full ${noite ? "nt-cena--noite" : ""}`} viewBox="-40 0 400 150"
      preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" aria-hidden="true">
      <defs>
        <linearGradient id={`ceu-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CEU[periodo][0]} />
          <stop offset="1" stopColor={CEU[periodo][1]} />
        </linearGradient>
        <clipPath id={`tambor-${id}`}><rect x="32" y="100" width="34" height="17" rx="7" /></clipPath>
      </defs>
      <rect x="-40" width="400" height="150" fill={`url(#ceu-${id})`} />
      {noite && <Estrelas />}
      <Astro periodo={periodo} />
      <Nuvens noite={noite} />
      {tema === "anoNovo" && <Fogos />}
      {!noite && tema !== "halloween" && <Passaros cor="#1e293b" />}
      {tema === "halloween" && <Passaros cor="#111827" morcego />}
      <Cidade noite={noite} />
      <Predio noite={noite} />
      <Guindaste natal={tema === "natal"} />
      <Chao noite={noite} />
      <Betoneira clip={`tambor-${id}`} />
      <Cone x={104} />
      <Cone x={156} />
      <Cone x={316} />
      {tema === "junina" && <Junina />}
      {tema === "halloween" && <><Abobora x={110} /><Abobora x={276} /></>}
      {tema === "pascoa" && <Ovos />}
      {tema === "natal" && <Arvore x={284} />}
      {tema === "carnaval" && <Confete />}
    </svg>
  );
}

function Estrelas() {
  const r = sorteador(7);
  return (
    <g>
      {Array.from({ length: 44 }, (_, i) => (
        <rect key={i} className="nt-estrela" style={atraso(r() * 4)} x={Math.floor(r() * 400) - 40} y={Math.floor(r() * 70)}
          width={r() > 0.85 ? 2 : 1} height={1} fill="#fff" />
      ))}
    </g>
  );
}

function Astro({ periodo }: { periodo: Periodo }) {
  if (periodo === "noite") {
    return (
      <g className="nt-astro">
        <circle cx="318" cy="30" r="15" fill="#e0e7ff" opacity="0.12" className="nt-brilho" />
        <circle cx="318" cy="30" r="9" fill="#f1f5f9" />
        <rect x="314" y="26" width="3" height="3" fill="#cbd5e1" />
        <rect x="320" y="32" width="2" height="2" fill="#cbd5e1" />
        <rect x="319" y="25" width="1" height="1" fill="#cbd5e1" />
      </g>
    );
  }
  const tarde = periodo === "tarde";
  const [cx, cy] = tarde ? [306, 54] : [318, 30];
  return (
    <g className="nt-astro">
      <circle cx={cx} cy={cy} r="18" fill={tarde ? "#fdba74" : "#fef08a"} opacity="0.35" className="nt-brilho" />
      <circle cx={cx} cy={cy} r="11" fill={tarde ? "#fb923c" : "#fde047"} />
      <rect x={cx - 6} y={cy - 6} width="4" height="3" fill="#fff" opacity="0.5" />
    </g>
  );
}

function Nuvem({ y, escala = 1, opacidade }: { y: number; escala?: number; opacidade: number }) {
  return (
    <g transform={`translate(0 ${y}) scale(${escala})`} fill="#fff" opacity={opacidade}>
      <rect x="0" y="6" width="30" height="6" />
      <rect x="5" y="2" width="12" height="5" />
      <rect x="14" y="0" width="10" height="7" />
      <rect x="24" y="4" width="6" height="3" />
      <rect x="2" y="12" width="26" height="1" fill="#000" opacity="0.06" />
    </g>
  );
}

function Nuvens({ noite }: { noite: boolean }) {
  const o = noite ? 0.12 : 0.9;
  return (
    <g>
      <g className="nt-nuvem nt-nuvem--lenta" style={atraso(-30)}><Nuvem y={14} escala={1.3} opacidade={o} /></g>
      <g className="nt-nuvem" style={atraso(-8)}><Nuvem y={38} opacidade={o * 0.85} /></g>
      <g className="nt-nuvem nt-nuvem--rapida" style={atraso(-20)}><Nuvem y={24} escala={0.8} opacidade={o * 0.7} /></g>
    </g>
  );
}

function Passaros({ cor, morcego = false }: { cor: string; morcego?: boolean }) {
  const asa = morcego ? "M0 1 L2 0 L3 2 L4 1 L5 2 L6 0 L8 1 L6 3 L2 3 Z" : "M0 0 L2 2 L4 1 L6 2 L8 0";
  return (
    <g>
      {[[0, 30, 0], [-9, 36, 1.4], [-14, 26, 0.7]].map(([d, y, f]) => (
        <g key={`${d}-${y}`} className="nt-passaro" style={atraso(d)}>
          <g transform={`translate(0 ${y})`}>
            <g className="nt-asa" style={atraso(f)}>
              <path d={asa} fill={morcego ? cor : "none"} stroke={morcego ? "none" : cor} strokeWidth="1" shapeRendering="auto" />
            </g>
          </g>
        </g>
      ))}
    </g>
  );
}

function Fogos() {
  const cores = ["#f472b6", "#facc15", "#60a5fa", "#4ade80"];
  return (
    <g>
      {[[40, 34, 0], [230, 30, 1.1], [150, 40, 2.2], [310, 48, 0.6], [-10, 50, 1.7]].map(([x, y, d], k) => (
        <g key={k} transform={`translate(${x} ${y})`}>
          <g className="nt-fogo" style={atraso(d)}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return <rect key={i} x={Math.round(Math.cos(a) * 12)} y={Math.round(Math.sin(a) * 12)} width="2" height="2" fill={cores[(i + k) % cores.length]} />;
            })}
            <rect x="-1" y="-1" width="2" height="2" fill="#fff" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Cidade({ noite }: { noite: boolean }) {
  const r = sorteador(3);
  const cor = noite ? "#1e1b4b" : "#93c5fd";
  const predios = [[-40, 22, 34], [-16, 14, 20], [0, 30, 26], [28, 22, 40], [52, 26, 22], [80, 18, 34], [100, 30, 18], [132, 24, 30], [158, 16, 44], [248, 22, 30], [272, 18, 48], [292, 28, 24], [322, 16, 36], [340, 20, 22]];
  return (
    <g opacity={noite ? 1 : 0.55}>
      {predios.map(([x, w, h]) => (
        <g key={x}>
          <rect x={x} y={126 - h} width={w} height={h} fill={cor} />
          {noite && Array.from({ length: Math.floor(h / 8) * Math.floor(w / 7) }, (_, i) => {
            const cols = Math.floor(w / 7);
            const acesa = r() > 0.55;
            return acesa ? <rect key={i} x={x + 3 + (i % cols) * 7} y={126 - h + 4 + Math.floor(i / cols) * 8} width="2" height="3" fill="#fde68a" opacity="0.7" /> : null;
          })}
        </g>
      ))}
    </g>
  );
}

function Predio({ noite }: { noite: boolean }) {
  const r = sorteador(11);
  const x0 = 170, largura = 78, andar = 15, chao = 126;
  const andares: ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const topo = chao - andar * (i + 1);
    const pronto = i < 4;
    andares.push(
      <g key={i}>
        {pronto && <rect x={x0} y={topo} width={largura} height={andar} fill="#cbd5e1" />}
        {pronto && [0, 1, 2, 3].map(j => {
          const acesa = noite && r() > 0.35;
          return (
            <g key={j}>
              <rect x={x0 + 6 + j * 18} y={topo + 5} width="10" height="7" fill={acesa ? "#fde68a" : noite ? "#1e293b" : "#7dd3fc"}
                className={acesa && r() > 0.7 ? "nt-janela" : undefined} style={atraso(r() * 6)} />
              <rect x={x0 + 6 + j * 18} y={topo + 5} width="10" height="1" fill="#fff" opacity={noite ? 0.1 : 0.6} />
            </g>
          );
        })}
        {i < 5 && [0, 1, 2, 3].map(j => <rect key={`c${j}`} x={x0 + j * 25} y={topo} width="4" height={andar} fill="#94a3b8" />)}
        {i < 5 && <rect x={x0 - 2} y={topo} width={largura + 4} height="3" fill="#64748b" />}
        {i === 5 && [0, 1, 3].map(j => (
          <g key={`f${j}`}>
            <rect x={x0 + j * 25} y={topo + 6} width="4" height={andar - 6} fill="#94a3b8" />
            <path d={`M${x0 + j * 25 + 1} ${topo + 6} V${topo + 1} M${x0 + j * 25 + 3} ${topo + 6} V${topo + 2}`} stroke="#ea580c" strokeWidth="1" />
          </g>
        ))}
      </g>,
    );
  }
  const topoObra = chao - andar * 6;
  return (
    <g>
      {andares}
      {/* Andaime */}
      <g stroke="#f59e0b" strokeWidth="1">
        {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M250 ${chao - i * 18} L260 ${chao - i * 18 - 18} M250 ${chao - i * 18 - 18} H260`} shapeRendering="auto" />)}
        <path d={`M250 ${chao} V${chao - 90} M260 ${chao} V${chao - 90}`} />
      </g>
      {/* Solda no último andar */}
      <g transform={`translate(${x0 + 52} ${topoObra + 9})`}>
        <rect x="-1" y="-1" width="3" height="3" fill="#fff" className="nt-solda" />
        {[[-3, -3], [3, -4], [-4, 1], [4, 2], [0, -5]].map(([dx, dy], i) => (
          <rect key={i} x={dx} y={dy} width="1" height="1" fill="#facc15" className="nt-faisca"
            style={{ ...atraso(i * 0.13), "--dx": `${dx}px` } as CSSProperties} />
        ))}
      </g>
    </g>
  );
}

function Guindaste({ natal }: { natal: boolean }) {
  const amarelo = "#facc15", sombra = "#ca8a04";
  const trelica: string[] = [];
  for (let y = 22; y < 124; y += 6) trelica.push(`M118 ${y} L126 ${y + 6} M126 ${y} L118 ${y + 6}`);
  const lanca: string[] = [];
  for (let x = 80; x < 262; x += 6) lanca.push(`M${x} 16 L${x + 6} 22`);
  return (
    <g>
      <rect x="117" y="20" width="2" height="106" fill={amarelo} />
      <rect x="125" y="20" width="2" height="106" fill={sombra} />
      <path d={trelica.join(" ")} stroke={amarelo} strokeWidth="1" shapeRendering="auto" />
      <rect x="112" y="122" width="20" height="4" fill="#475569" />
      {/* Lança e contralança */}
      <rect x="78" y="15" width="186" height="2" fill={amarelo} />
      <rect x="78" y="21" width="186" height="2" fill={sombra} />
      <path d={lanca.join(" ")} stroke={amarelo} strokeWidth="1" shapeRendering="auto" />
      <path d="M122 4 L80 15 M122 4 L240 15" stroke="#e5e7eb" strokeWidth="0.6" shapeRendering="auto" />
      <path d="M118 15 L122 4 L126 15" fill="none" stroke={amarelo} strokeWidth="1.2" shapeRendering="auto" />
      <rect x="82" y="23" width="16" height="9" fill="#64748b" />
      <rect x="82" y="23" width="16" height="2" fill="#94a3b8" />
      <rect x="127" y="23" width="11" height="9" fill="#f8fafc" />
      <rect x="129" y="25" width="7" height="4" fill="#38bdf8" />
      <rect x="121" y="2" width="3" height="2" fill="#ef4444" className="nt-alerta" />
      <rect x="262" y="14" width="2" height="2" fill="#ef4444" className="nt-alerta" style={atraso(0.6)} />
      {natal && (
        <g>
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={82 + i * 8} y="24" width="2" height="2" fill={["#ef4444", "#22c55e", "#facc15", "#3b82f6"][i % 4]}
              className="nt-pisca" style={atraso((i % 4) * 0.35)} />
          ))}
          <path transform="translate(0 3)" d="M122 -3 L123.5 0.5 L127 0.5 L124.2 2.6 L125.3 6 L122 4 L118.7 6 L119.8 2.6 L117 0.5 L120.5 0.5 Z" fill="#fde047" shapeRendering="auto" className="nt-brilho" />
        </g>
      )}
      {/* Carrinho, cabo e viga balançando */}
      <g transform="translate(150 22)">
        <g className="nt-carrinho">
          <rect x="-5" y="0" width="10" height="3" fill="#334155" />
          <g className="nt-pendulo">
            <rect x="-0.5" y="3" width="1" height="44" fill="#334155" />
            <rect x="-2" y="47" width="4" height="3" fill="#0f172a" />
            <path d="M0 50 L-12 54 M0 50 L12 54" stroke="#334155" strokeWidth="0.7" shapeRendering="auto" />
            <rect x="-15" y="54" width="30" height="4" fill="#dc2626" />
            <rect x="-15" y="54" width="30" height="1" fill="#f87171" />
            {[-11, -3, 5].map(x => <rect key={x} x={x} y="55" width="3" height="3" fill="#991b1b" />)}
          </g>
        </g>
      </g>
    </g>
  );
}

function Chao({ noite }: { noite: boolean }) {
  const r = sorteador(5);
  return (
    <g>
      <rect x="-40" y="126" width="400" height="24" fill={noite ? "#57391c" : "#a16207"} />
      <rect x="-40" y="126" width="400" height="2" fill={noite ? "#3f2a14" : "#854d0e"} />
      {Array.from({ length: 75 }, (_, i) => (
        <rect key={i} x={Math.floor(r() * 400) - 40} y={130 + Math.floor(r() * 18)} width={r() > 0.7 ? 2 : 1} height="1" fill={noite ? "#2f1f0f" : "#713f12"} />
      ))}
    </g>
  );
}

function Betoneira({ clip }: { clip: string }) {
  return (
    <g className="nt-motor">
      <rect x="28" y="116" width="58" height="5" fill="#1f2937" />
      <rect x="70" y="102" width="16" height="15" fill="#2563eb" />
      <rect x="70" y="102" width="16" height="2" fill="#60a5fa" />
      <rect x="77" y="105" width="7" height="6" fill="#bae6fd" />
      <rect x="85" y="112" width="2" height="2" fill="#fde047" className="nt-alerta" />
      <rect x="31" y="99" width="36" height="19" rx="8" fill="#ea580c" />
      <g clipPath={`url(#${clip})`}>
        <g className="nt-tambor">
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${20 + i * 9} 118 L${28 + i * 9} 100 L${32 + i * 9} 100 L${24 + i * 9} 118 Z`} fill="#fff" opacity="0.45" />
          ))}
        </g>
      </g>
      <rect x="64" y="104" width="6" height="4" fill="#64748b" />
      {[40, 58, 78].map(x => (
        <g key={x}>
          <circle cx={x} cy="122" r="5" fill="#111827" />
          <circle cx={x} cy="122" r="2" fill="#9ca3af" />
        </g>
      ))}
    </g>
  );
}

function Cone({ x }: { x: number }) {
  return (
    <g>
      <path d={`M${x} 126 L${x + 3} 116 L${x + 5} 116 L${x + 8} 126 Z`} fill="#f97316" shapeRendering="auto" />
      <rect x={x + 2} y="120" width="4" height="2" fill="#fff" />
      <rect x={x - 1} y="125" width="10" height="2" fill="#c2410c" />
    </g>
  );
}

function Junina() {
  const cores = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ec4899", "#f97316"];
  return (
    <g>
      <g className="nt-balanco">
        <path d="M-40 40 Q160 66 360 40" stroke="#78350f" strokeWidth="0.8" fill="none" shapeRendering="auto" />
        {Array.from({ length: 25 }, (_, i) => {
          const x = -32 + i * 16;
          const t = (x + 40) / 400;
          const y = 40 + 4 * 13 * t * (1 - t);
          return <path key={i} d={`M${x - 4} ${y} L${x + 4} ${y} L${x} ${y + 7} Z`} fill={cores[i % cores.length]} shapeRendering="auto" />;
        })}
      </g>
      <g transform="translate(298 126)">
        <rect x="-8" y="-2" width="16" height="2" fill="#78350f" />
        <path d="M-5 -2 L0 -14 L5 -2 Z" fill="#f97316" className="nt-chama" shapeRendering="auto" />
        <path d="M-3 -2 L0 -9 L3 -2 Z" fill="#fde047" className="nt-chama" style={atraso(0.2)} shapeRendering="auto" />
      </g>
    </g>
  );
}

function Abobora({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y="117" width="12" height="9" rx="3" fill="#f97316" />
      <rect x={x + 5} y="114" width="2" height="3" fill="#15803d" />
      <rect x={x + 2} y="119" width="2" height="2" fill="#fde047" className="nt-brilho" />
      <rect x={x + 8} y="119" width="2" height="2" fill="#fde047" className="nt-brilho" />
      <rect x={x + 3} y="123" width="6" height="1" fill="#fde047" className="nt-brilho" />
    </g>
  );
}

function Ovos() {
  return (
    <g>
      {[[96, "#f472b6"], [140, "#60a5fa"], [262, "#facc15"], [300, "#a78bfa"]].map(([x, cor]) => (
        <g key={x as number} className="nt-ovo" style={atraso((x as number) / 100)}>
          <ellipse cx={x as number} cy="122" rx="3.5" ry="4.5" fill={cor as string} shapeRendering="auto" />
          <rect x={(x as number) - 3} y="121" width="6" height="1" fill="#fff" opacity="0.8" />
        </g>
      ))}
    </g>
  );
}

function Arvore({ x }: { x: number }) {
  return (
    <g>
      <path d={`M${x} 122 L${x + 9} 100 L${x + 18} 122 Z`} fill="#15803d" shapeRendering="auto" />
      <rect x={x + 7} y="122" width="4" height="4" fill="#78350f" />
      {[[x + 6, 116, "#ef4444"], [x + 11, 110, "#facc15"], [x + 9, 118, "#3b82f6"], [x + 13, 117, "#f472b6"]].map(([a, b, c], i) => (
        <rect key={i} x={a as number} y={b as number} width="2" height="2" fill={c as string} className="nt-pisca" style={atraso(i * 0.3)} />
      ))}
      <rect x={x + 8} y="97" width="3" height="3" fill="#fde047" />
    </g>
  );
}

function Confete() {
  const r = sorteador(13);
  const cores = ["#f472b6", "#facc15", "#60a5fa", "#4ade80", "#a855f7", "#f97316"];
  return (
    <g>
      {Array.from({ length: 38 }, (_, i) => (
        <rect key={i} className="nt-confete" style={{ animationDelay: `${-r() * 6}s`, animationDuration: `${4 + r() * 4}s` }}
          x={Math.floor(r() * 400) - 40} y="-6" width="2" height="2" fill={cores[i % cores.length]} />
      ))}
    </g>
  );
}
