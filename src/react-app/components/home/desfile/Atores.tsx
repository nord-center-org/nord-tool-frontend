import type { ReactNode } from "react";

import type { TipoAtor } from "@/react-app/utils/desfile";
import Pessoa, { CapaceteNaMao } from "./Pessoa";

/**
 * Desenho de cada ator do desfile, em coordenadas locais: pés/rodas em y=0, centrado em x=0, virado para a direita.
 * As máquinas reaproveitam o traço em pixel da cena; as pessoas são vetoriais (Pessoa).
 */

const PELE = { clara: "#f5d0b0", morena: "#c68863", parda: "#a8693a", negra: "#6b4226", media: "#e0ac69" };
const LARANJA = "#f97316";
const LIMA = "#a3e635";

export default function DesenhoAtor({ tipo, clip }: { tipo: TipoAtor; clip: string }): ReactNode {
  switch (tipo) {
    case "betoneira": return <g transform="translate(-57 -127)"><Betoneira clip={clip} /></g>;
    case "retro": return <g transform="translate(-31 -127)"><Retroescavadeira /></g>;
    case "bobcat": return <g transform="translate(-24 -127)"><Bobcat /></g>;
    case "empilhadeira": return <Empilhadeira />;
    case "engenharia": return <TimeEngenharia />;
    case "engenheiro": return (
      <Pessoa pele={PELE.morena} camisa="#1e3a8a" calca="#334155" capacete="#f8fafc" colete={LIMA} lider oculos naMao={<Prancheta />} pose="segurar" />
    );
    case "mestre": return (
      <Pessoa pele={PELE.parda} camisa="#334155" calca="#1e293b" capacete="#2563eb" barba lider naMao={<Prancheta />} pose="segurar" />
    );
    case "pedreiroCarrinho": return <PedreiroCarrinho />;
    case "servente": return <Servente />;
    case "serventeSemCapacete": return (
      <Pessoa pele={PELE.negra} camisa="#64748b" calca="#1e3a8a" capacete={null} capaceteDepois="#facc15" colete={LARANJA} cabelo="#111"
        naMao={<CapaceteNaMao cor="#facc15" />} pose="segurar" />
    );
    case "eletricistas": return <Eletricistas />;
    case "eletricista": return (
      <Pessoa pele={PELE.media} camisa="#0f766e" calca="#1e3a8a" capacete={LARANJA} barba lider naMao={<RoloCabo />} pose="segurar" roupa={<Raio />} />
    );
    case "encanadores": return <Encanadores />;
    case "carpinteiro": return <Carpinteiro />;
    case "pintor": return <Pintor />;
    case "topografo": return <Topografo />;
    case "seguranca": return (
      <Pessoa pele={PELE.clara} camisa="#166534" calca="#14532d" capacete="#22c55e" lider rabo cabelo="#7c2d12" naMao={<Apito />} pose="livre" roupa={<Cruz />} />
    );
    case "cachorro": return <Cachorro />;
    case "monte": return <Monte />;
  }
}

// ---------------------------------------------------------------- itens na mão (coordenadas da mão)

function Prancheta() {
  return (
    <g transform="translate(1 -2) rotate(20)">
      <rect x="-3" y="-1" width="7" height="9" rx="0.8" fill="#a16207" />
      <rect x="-2.2" y="0.4" width="5.4" height="6.8" fill="#f8fafc" />
      <rect x="-0.8" y="-1.6" width="2.6" height="1.4" fill="#94a3b8" />
    </g>
  );
}

function Apito() {
  return (
    <g className="nt-apito">
      <rect x="-1.4" y="-3.6" width="3.6" height="2.4" rx="1.1" fill="#f8fafc" stroke="#475569" strokeWidth="0.4" />
      <path d="M-1 -1.4 L-3 4" stroke="#ef4444" strokeWidth="0.5" />
    </g>
  );
}

function RoloCabo() {
  return (
    <g transform="translate(0 3)">
      <circle r="3.6" fill="none" stroke="#111827" strokeWidth="1.6" />
      <circle r="3.6" fill="none" stroke="#f97316" strokeWidth="0.6" strokeDasharray="2 1.4" />
    </g>
  );
}

function Raio() {
  return <path d="M-3 -32 L-4.6 -28.6 L-3.2 -28.6 L-4 -26 L-1.6 -29.6 L-3 -29.6 L-2 -32 Z" fill="#facc15" />;
}

function Cruz() {
  return (
    <g>
      <circle cx="-2.6" cy="-30" r="2.2" fill="#f8fafc" />
      <path d="M-3.2 -31.6 h1.2 v1 h1 v1.2 h-1 v1 h-1.2 v-1 h-1 v-1.2 h1 Z" fill="#16a34a" />
    </g>
  );
}

// ---------------------------------------------------------------- grupos e cargas (coordenadas do ator)

function TimeEngenharia() {
  return (
    <g>
      <Pessoa x={-16} pele={PELE.clara} camisa="#0284c7" calca="#334155" capacete="#e2e8f0" colete={LIMA} fase={0.17} naMao={<Prancheta />} pose="segurar" />
      <Pessoa x={-1} pele={PELE.negra} camisa="#1e3a8a" calca="#1e293b" capacete="#f8fafc" colete={LIMA} barba oculos fase={0.33} />
      <Pessoa x={14} pele={PELE.morena} camisa="#0f172a" calca="#334155" capacete="#f8fafc" colete={LIMA} rabo cabelo="#3b2416" lider
        naMao={<g className="nt-planta-rolo" transform="rotate(-10)"><rect x="-1" y="-1" width="2.4" height="10" rx="1.2" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="0.3" /></g>} pose="segurar" />
      <g className="nt-planta-aberta">
        <rect x="16" y="-19" width="13" height="9" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="0.35" transform="rotate(-6 22 -14)" />
        <path d="M18 -16.6 h8 M18 -14.4 h5 M24 -13 v-4 M18 -12.2 h9" stroke="#1d4ed8" strokeWidth="0.3" transform="rotate(-6 22 -14)" />
      </g>
    </g>
  );
}

function PedreiroCarrinho() {
  return (
    <g>
      <Pessoa x={-10} pele={PELE.parda} camisa="#64748b" calca="#1e3a8a" capacete="#facc15" colete={LARANJA} barba pose="empurrar" fase={0.1} />
      {/* Carrinho de mão com tijolos */}
      <path d="M-4 -14.6 L3 -12.6" stroke="#475569" strokeWidth="1" strokeLinecap="round" />
      <path d="M2 -13 L19 -13 L16 -6.4 L4 -6.4 Z" fill="#16a34a" stroke="#14532d" strokeWidth="0.5" />
      <g fill="#c2410c" stroke="#7c2d12" strokeWidth="0.3">
        <rect x="5" y="-15.6" width="4" height="2.4" /><rect x="9.2" y="-15.6" width="4" height="2.4" /><rect x="13.4" y="-15.6" width="4" height="2.4" />
        <rect x="7" y="-17.8" width="4" height="2.2" /><rect x="11.2" y="-17.8" width="4" height="2.2" />
      </g>
      <path d="M5 -6.4 L4 0" stroke="#475569" strokeWidth="0.9" />
      <g transform="translate(17 -3)">
        <circle r="3" fill="#111827" /><circle r="1.2" fill="#9ca3af" />
        <rect className="nt-roda" x="-2.4" y="-0.35" width="4.8" height="0.7" fill="#4b5563" />
      </g>
    </g>
  );
}

function Servente() {
  return (
    <g>
      <Pessoa pele={PELE.negra} camisa="#64748b" calca="#1e3a8a" capacete="#facc15" colete={LARANJA} cabelo="#111" pose="segurar" fase={0.2} />
      <g className="nt-pa">
        <path d="M2 -12 L13 -1.6" stroke="#a16207" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M11.6 -3.4 L16 -1.8 L14.6 1 L10.6 -0.6 Z" fill="#94a3b8" stroke="#475569" strokeWidth="0.3" />
      </g>
    </g>
  );
}

function Eletricistas() {
  return (
    <g>
      <Pessoa x={-22} pele={PELE.clara} camisa="#0f766e" calca="#1e3a8a" capacete={LARANJA} pose="ombro" fase={0.25} roupa={<Raio />} />
      {/* Cabo saindo da bobina até o ombro de quem puxa */}
      <path d="M-16 -20.4 C-10 -18 -2 -12 8 -9" stroke="#111827" strokeWidth="0.9" fill="none" />
      <Pessoa x={-4} pele={PELE.morena} camisa="#0f766e" calca="#1e3a8a" capacete={LARANJA} barba pose="empurrar" roupa={<Raio />} />
      <g transform="translate(13 -8)">
        <g className="nt-bobina">
          <circle r="8" fill="#a16207" stroke="#713f12" strokeWidth="0.6" />
          <circle r="5.6" fill="#111827" />
          <circle r="5.6" fill="none" stroke="#f97316" strokeWidth="0.5" strokeDasharray="1.6 1.2" />
          <circle r="2.2" fill="#ca8a04" stroke="#713f12" strokeWidth="0.4" />
          <rect x="-7.6" y="-0.5" width="15.2" height="1" fill="#713f12" opacity="0.6" />
          <rect x="-0.5" y="-7.6" width="1" height="15.2" fill="#713f12" opacity="0.6" />
        </g>
      </g>
    </g>
  );
}

function Encanadores() {
  return (
    <g>
      {/* O tubo vai atrás das cabeças, apoiado no ombro; as mãos seguram por cima. */}
      <rect x="-36" y="-21.6" width="74" height="2.8" rx="1.2" fill="#e5e7eb" stroke="#94a3b8" strokeWidth="0.4" />
      <rect x="35.6" y="-22.2" width="3.4" height="4" rx="0.6" fill="#94a3b8" />
      <Pessoa x={-20} pele={PELE.media} camisa="#1d4ed8" calca="#1e3a8a" capacete="#facc15" pose="ombro" fase={0.21} />
      <Pessoa x={18} pele={PELE.negra} camisa="#1d4ed8" calca="#1e3a8a" capacete="#facc15" barba pose="ombro" cabelo="#111" />
    </g>
  );
}

function Carpinteiro() {
  return (
    <g>
      <g transform="translate(0 4.6) rotate(-4 4 -24)">
        <rect x="-16" y="-25.6" width="40" height="2" fill="#d6a76c" stroke="#92400e" strokeWidth="0.3" />
        <rect x="-14" y="-23.6" width="40" height="2" fill="#c08a4f" stroke="#92400e" strokeWidth="0.3" />
        <rect x="-15" y="-27.6" width="40" height="2" fill="#e2b77f" stroke="#92400e" strokeWidth="0.3" />
      </g>
      <Pessoa pele={PELE.parda} camisa="#92400e" calca="#334155" capacete="#facc15" pose="ombro" barba
        roupa={<path d="M-5.4 -27 L5.4 -27 L6 -19.8 L-6 -19.8 Z" fill="#b45309" />} />
    </g>
  );
}

function Pintor() {
  const respingo = (
    <g>
      <circle cx="-3" cy="-30" r="0.8" fill="#3b82f6" /><circle cx="3" cy="-26" r="0.8" fill="#f43f5e" /><circle cx="-1" cy="-23" r="0.7" fill="#22c55e" />
    </g>
  );
  return (
    <g>
      <g transform="translate(0 4.4) rotate(-6 2 -24)">
        <rect x="-18" y="-27" width="36" height="1" fill="#94a3b8" />
        <rect x="-18" y="-23" width="36" height="1" fill="#94a3b8" />
        {[-16, -11, -6, -1, 4, 9, 14].map(x => <rect key={x} x={x} y="-27" width="0.8" height="5" fill="#94a3b8" />)}
      </g>
      <Pessoa pele={PELE.clara} camisa="#f1f5f9" calca="#e2e8f0" capacete="#facc15" pose="ombro" roupa={respingo} cabelo="#b5481f" />
      <g transform="translate(-6 -6)">
        <path d="M-2.4 0 L2.4 0 L2 4.6 L-2 4.6 Z" fill="#e5e7eb" stroke="#64748b" strokeWidth="0.3" />
        <rect x="-2.4" y="0" width="4.8" height="1.4" fill="#3b82f6" />
      </g>
    </g>
  );
}

function Topografo() {
  return (
    <g>
      <g className="nt-tripe-carregado">
        <path d="M-1 -22 L-16 -6 M-1 -22 L-13 -4 M-1 -22 L-10 -6" stroke="#a16207" strokeWidth="0.8" />
        <rect x="-3" y="-25.4" width="4.4" height="3.6" rx="0.6" fill="#facc15" stroke="#a16207" strokeWidth="0.3" />
      </g>
      <Pessoa pele={PELE.morena} camisa="#a16207" calca="#334155" capacete="#f8fafc" colete={LIMA} pose="ombro" oculos />
      <g className="nt-tripe-montado">
        <path d="M14 -14 L9 0 M14 -14 L14 0 M14 -14 L19 0" stroke="#a16207" strokeWidth="0.8" />
        <rect x="11.6" y="-18.4" width="5" height="4.4" rx="0.6" fill="#facc15" stroke="#a16207" strokeWidth="0.3" />
        <rect x="16.6" y="-17.2" width="2" height="1.6" fill="#1f2937" />
        <path className="nt-laser" d="M18.6 -16.4 L90 -16.4" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 1.5" />
      </g>
    </g>
  );
}

function Cachorro() {
  return (
    <g shapeRendering="geometricPrecision">
      <ellipse cx="0" cy="0" rx="7" ry="1" fill="#000" opacity="0.15" />
      <g className="nt-cao-corpo">
        <g className="nt-cao-pata nt-cao-pata-a"><rect x="-5" y="-5" width="1.6" height="5" rx="0.6" fill="#b45309" /></g>
        <g className="nt-cao-pata nt-cao-pata-b"><rect x="3" y="-5" width="1.6" height="5" rx="0.6" fill="#b45309" /></g>
        <g className="nt-cao-rabo"><path d="M-6 -7 C-9 -9 -9.4 -12 -8 -13" stroke="#d97706" strokeWidth="1.4" fill="none" strokeLinecap="round" /></g>
        <ellipse cx="0" cy="-6.6" rx="6.6" ry="3.2" fill="#d97706" />
        <ellipse cx="0.6" cy="-5.4" rx="4" ry="1.6" fill="#fcd9a8" opacity="0.7" />
        <g className="nt-cao-pata nt-cao-pata-b"><rect x="-3.6" y="-5" width="1.6" height="5" rx="0.6" fill="#d97706" /></g>
        <g className="nt-cao-pata nt-cao-pata-a"><rect x="4.4" y="-5" width="1.6" height="5" rx="0.6" fill="#d97706" /></g>
        <g className="nt-cao-cabeca">
          <circle cx="7" cy="-9.4" r="3" fill="#d97706" />
          <ellipse cx="9.6" cy="-8.6" rx="2" ry="1.3" fill="#fcd9a8" />
          <circle cx="11.3" cy="-8.9" r="0.6" fill="#111827" />
          <circle cx="7.8" cy="-10.2" r="0.5" fill="#111827" />
          <path d="M5.4 -11.6 C4.6 -10.6 4.6 -8.6 5.4 -7.8 C6 -9 6.2 -10.6 5.4 -11.6 Z" fill="#92400e" />
          <rect x="4.6" y="-8" width="3.6" height="0.9" rx="0.4" fill="#ef4444" />
        </g>
      </g>
    </g>
  );
}

function Monte() {
  return (
    <g className="nt-monte" shapeRendering="geometricPrecision">
      <path d="M-11 0 C-9 -5 -4 -8 0 -8 C5 -8 9 -5 11 0 Z" fill="#92400e" />
      <path d="M-6 -3 C-4 -5 -1 -6 1 -6" stroke="#b45309" strokeWidth="0.8" fill="none" />
      <circle cx="4" cy="-3" r="0.8" fill="#78350f" /><circle cx="-3" cy="-1.4" r="0.7" fill="#78350f" />
    </g>
  );
}

// ---------------------------------------------------------------- máquinas (coordenadas originais da cena)

function Roda({ x, y = 122, r = 5 }: { x: number; y?: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#111827" />
      <circle cx={x} cy={y} r={Math.max(2, r - 3)} fill="#9ca3af" />
      <rect className="nt-roda" x={x - r + 1} y={y - 0.5} width={(r - 1) * 2} height="1" fill="#4b5563" shapeRendering="auto" />
    </g>
  );
}

/** Operador na cabine: cabeça com capacete, em vetor. */
function Operador({ x, y, cor = "#f97316" }: { x: number; y: number; cor?: string }) {
  return (
    <g shapeRendering="geometricPrecision">
      <circle cx={x} cy={y} r="1.8" fill="#c68863" />
      <path d={`M${x - 2} ${y - 0.6} C${x - 2} ${y - 3.2} ${x + 2.2} ${y - 3.2} ${x + 2.2} ${y - 0.6} Z`} fill={cor} />
      <rect x={x - 1.6} y={y + 1.6} width="3.4" height="2.4" fill="#475569" />
    </g>
  );
}

export function Betoneira({ clip }: { clip: string }) {
  return (
    <g className="nt-motor">
      <rect x="28" y="116" width="58" height="5" fill="#1f2937" />
      <rect x="70" y="102" width="16" height="15" fill="#2563eb" />
      <rect x="70" y="102" width="16" height="2" fill="#60a5fa" />
      <rect x="77" y="105" width="7" height="6" fill="#bae6fd" />
      <Operador x={80.4} y={108.4} />
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
      {[40, 58, 78].map(x => <Roda key={x} x={x} />)}
    </g>
  );
}

function Retroescavadeira() {
  return (
    <g className="nt-motor">
      <g className="nt-braco-retro">
        <path d="M8 108 L0 92 L3 90 L12 106 Z" fill="#ca8a04" />
        <path d="M0 92 L-6 106 L-3 107 L3 93 Z" fill="#a16207" />
        <rect x="-9" y="104" width="7" height="5" fill="#713f12" />
      </g>
      <rect x="6" y="106" width="50" height="11" fill="#facc15" />
      <rect x="6" y="115" width="50" height="2" fill="#a16207" />
      <rect x="38" y="103" width="18" height="4" fill="#eab308" />
      <rect x="44" y="96" width="2" height="7" fill="#374151" />
      <rect x="10" y="88" width="22" height="3" fill="#a16207" />
      <rect x="12" y="91" width="18" height="16" fill="#eab308" />
      <rect x="15" y="93" width="12" height="9" fill="#bae6fd" />
      <Operador x={21.4} y={97.6} />
      <rect x="19" y="86" width="3" height="2" fill="#f97316" className="nt-alerta" />
      <rect x="52" y="108" width="11" height="3" fill="#ca8a04" />
      <path d="M61 109 L71 109 L71 123 L63 123 Z" fill="#a16207" />
      <Roda x={17} y={120} r={7} />
      <Roda x={48} />
    </g>
  );
}

function Bobcat() {
  return (
    <g className="nt-motor">
      <rect x="2" y="106" width="34" height="12" fill="#f1f5f9" />
      <rect x="2" y="113" width="34" height="2" fill="#ef4444" />
      <rect x="10" y="92" width="14" height="14" fill="#bae6fd" opacity="0.7" />
      <Operador x={17} y={98.4} cor="#facc15" />
      <rect x="7" y="89" width="20" height="3" fill="#1f2937" />
      <rect x="7" y="89" width="3" height="18" fill="#1f2937" />
      <rect x="24" y="89" width="3" height="18" fill="#1f2937" />
      <g className="nt-concha">
        <rect x="4" y="97" width="34" height="3" fill="#374151" />
        <rect x="36" y="97" width="3" height="14" fill="#374151" />
        <path d="M37 110 L46 110 L46 124 L38 124 Z" fill="#64748b" />
        <path d="M38.5 111.5 L44.5 111.5 L44.5 116 L39 116 Z" fill="#92400e" className="nt-terra" />
        <rect x="37" y="110" width="9" height="2" fill="#94a3b8" />
      </g>
      <Roda x={10} />
      <Roda x={28} />
    </g>
  );
}

function Empilhadeira() {
  return (
    <g transform="translate(-18 -127)">
      <g className="nt-motor">
        <rect x="0" y="106" width="28" height="12" rx="1" fill="#f97316" />
        <rect x="0" y="104" width="10" height="6" fill="#c2410c" />
        <rect x="10" y="90" width="2" height="16" fill="#1f2937" />
        <rect x="24" y="90" width="2" height="16" fill="#1f2937" />
        <rect x="9" y="88" width="18" height="2.4" fill="#1f2937" />
        <rect x="13" y="94" width="10" height="10" fill="#bae6fd" opacity="0.6" />
        <Operador x={17.6} y={98} />
        <rect x="30" y="84" width="2.6" height="38" fill="#475569" />
        <rect x="33" y="84" width="1.6" height="38" fill="#64748b" />
        <rect x="34" y="118" width="14" height="1.6" fill="#374151" />
        <rect x="34" y="113.4" width="14" height="2" fill="#a16207" />
        <g fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.3">
          <rect x="34.4" y="107" width="6.4" height="6.4" /><rect x="41" y="107" width="6.4" height="6.4" />
          <rect x="37.6" y="100.6" width="6.4" height="6.4" />
        </g>
        <Roda x={7} />
        <Roda x={24} y={123} r={4} />
      </g>
    </g>
  );
}
