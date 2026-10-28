import { useId, type ReactNode } from "react";

import {
  CORES_CABELO, CORES_OLHOS, FUNCOES, FUNDOS, PELES, corDoCapacete, tom, type AvatarConfig, type DataComemorativa,
} from "@/react-app/utils/avatar";
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
  /** Sem o quadro de fundo (o boneco "solto", como o mascote do login). */
  semFundo?: boolean;
}

const ESCURO = "#2b2230";
const BOCA = "#7f1d1d";

/** Avatar ilustrado em vetor (busto 100×100): nítido em qualquer tamanho, com sombra, contorno suave e acessórios. */
export default function Avatar({ config, tema = null, tamanho = 64, rotulo, className, animado = false, atraso = 0, semFundo = false }: AvatarProps) {
  // Quem passa altura/largura pela classe (ex.: h-12 sm:h-16) manda no tamanho.
  const temMedida = /(^|\s)(sm:|md:)?h-/.test(className ?? "");
  return (
    <span className={`relative inline-block shrink-0 align-middle ${animado ? "nt-avatar-vivo" : ""} ${className ?? ""}`}
      style={{ ...(temMedida ? {} : { width: tamanho, height: tamanho }), ...(animado ? { animationDelay: `${atraso}s` } : {}) }}
      role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      <AvatarVetor config={config} tema={tema} semFundo={semFundo} tamanho={tamanho} className="block h-full w-full" />
      {animado && (
        <span className="nt-avatar-piscada absolute inset-0" style={{ animationDelay: `${atraso + 1.3}s` }}>
          <AvatarVetor config={config} tema={tema} semFundo={semFundo} tamanho={tamanho} olhosFechados soOlhos className="block h-full w-full" />
        </span>
      )}
    </span>
  );
}

interface VetorProps {
  config: AvatarConfig;
  tema: DataComemorativa | null;
  semFundo: boolean;
  tamanho: number;
  olhosFechados?: boolean;
  /** Só a camada das pálpebras (a piscada vai por cima do desenho). */
  soOlhos?: boolean;
  className?: string;
}

function AvatarVetor({ config: c, tema, semFundo, tamanho, olhosFechados = false, soOlhos = false, className }: VetorProps) {
  const id = useId().replace(/:/g, "");
  const pele = PELES[c.pele];
  const cabelo = CORES_CABELO[c.corCabelo];
  const funcao = FUNCOES[c.funcao];
  const chapeuDoTema = tema === "natal" || tema === "anoNovo" || tema === "junina" || tema === "halloween";
  const comCapacete = c.capacete && !chapeuDoTema;
  const cobreCabeca = comCapacete || chapeuDoTema;
  const cores = {
    pele, sombra: tom(pele, -0.14), linha: tom(pele, -0.36), luz: tom(pele, 0.25),
    cabelo, cabeloEsc: tom(cabelo, -0.3), cabeloLuz: tom(cabelo, 0.3),
    sobrancelha: c.corCabelo === "branco" || c.corCabelo === "platinado" || c.cabelo === "careca" ? tom(cabelo, -0.45) : tom(cabelo, -0.12),
  };

  if (soOlhos) {
    return (
      <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} className={className} aria-hidden="true">
        <g transform="translate(50 103) scale(1.03) translate(-50 -100)"><OlhosFechados cores={cores} /></g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`luz-${id}`} cx="0.3" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`casco-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`quadro-${id}`}><rect width="100" height="100" rx="22" /></clipPath>
        {/* Com chapéu, o cabelo só aparece da aba para baixo. */}
        <clipPath id={`sob-chapeu-${id}`}><rect x="0" y="34" width="100" height="66" /></clipPath>
        <linearGradient id={`ceu-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" /><stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
        <linearGradient id={`noite-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f172a" /><stop offset="1" stopColor="#3b2f7a" />
        </linearGradient>
      </defs>
      <g clipPath={semFundo ? undefined : `url(#quadro-${id})`}>
        {!semFundo && <Fundo fundo={c.fundo} tema={tema} id={id} />}
        {!semFundo && !["ceu", "noite", "obra"].includes(c.fundo) && <rect width="100" height="100" fill={`url(#luz-${id})`} />}
        {/* O boneco um pouco maior que o quadro, apoiado na borda de baixo. */}
        <g transform="translate(50 103) scale(1.03) translate(-50 -100)">
        <g clipPath={cobreCabeca ? `url(#sob-chapeu-${id})` : undefined}>
          <CabeloTras c={c} cores={cores} />
        </g>
        <Corpo c={c} cores={cores} camisa={funcao.camisa} extra={funcao.extra} id={id} />
        <Cabeca cores={cores} />
        <Rosto c={c} cores={cores} tema={tema} />
        {olhosFechados && <OlhosFechados cores={cores} />}
        <Acessorio c={c} cores={cores} tema={tema} />
        <g clipPath={cobreCabeca ? `url(#sob-chapeu-${id})` : undefined}>
          <CabeloFrente c={c} cores={cores} cobreCabeca={cobreCabeca} />
        </g>
        {tema === "pascoa" && <ChapeuDoTema tema={tema} id={id} />}
        {comCapacete && <g transform="translate(0 -4)"><Capacete cor={corDoCapacete(c)} brilho={`url(#casco-${id})`} /></g>}
        {c.acessorio === "protetorAuricular" && <Abafador comCapacete={comCapacete} />}
        {c.acessorio === "radio" && <Fone />}
        {tema !== "pascoa" && <g transform="translate(0 -3.5)"><ChapeuDoTema tema={tema} id={id} /></g>}
        </g>
      </g>
    </svg>
  );
}

type Cores = {
  pele: string; sombra: string; linha: string; luz: string; cabelo: string; cabeloEsc: string; cabeloLuz: string; sobrancelha: string;
};

// ---------------------------------------------------------------- fundo

function Fundo({ fundo, tema, id }: { fundo: AvatarConfig["fundo"]; tema: DataComemorativa | null; id: string }) {
  const cor = FUNDOS[fundo];
  let cena: ReactNode = null;
  if (fundo === "ceu") {
    cena = (
      <>
        <rect width="100" height="100" fill={`url(#ceu-${id})`} />
        <g fill="#fff" opacity="0.9">
          <ellipse cx="18" cy="24" rx="12" ry="5" /><ellipse cx="26" cy="21" rx="8" ry="5" />
          <ellipse cx="80" cy="14" rx="10" ry="4" /><ellipse cx="86" cy="12" rx="6" ry="4" />
        </g>
      </>
    );
  } else if (fundo === "noite") {
    cena = (
      <>
        <rect width="100" height="100" fill={`url(#noite-${id})`} />
        <circle cx="80" cy="18" r="8" fill="#f1f5f9" /><circle cx="83" cy="16" r="7" fill="#1e1b4b" opacity="0.9" />
        {[[12, 14], [24, 30], [8, 46], [90, 40], [70, 8], [40, 8], [92, 60]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="#fff" />)}
      </>
    );
  } else if (fundo === "obra") {
    cena = (
      <>
        <rect width="100" height="100" fill="#fde68a" />
        <circle cx="78" cy="20" r="10" fill="#fef3c7" />
        <g fill="#f59e0b" opacity="0.55">
          <rect x="6" y="18" width="3" height="64" /><rect x="6" y="16" width="44" height="3" /><rect x="40" y="19" width="1" height="16" />
          <rect x="37" y="35" width="7" height="4" />
        </g>
        <g fill="#d97706" opacity="0.35"><rect x="62" y="44" width="30" height="56" /><rect x="70" y="36" width="14" height="10" /></g>
      </>
    );
  } else {
    cena = (
      <>
        <rect width="100" height="100" fill={cor} />
        {[[14, 16], [86, 22], [10, 70], [90, 64], [24, 40], [78, 44]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 1.6 : 2.4} fill="#fff" opacity="0.45" />
        ))}
      </>
    );
  }
  return (
    <g>
      {cena}
      {tema === "junina" && <Bandeirinhas />}
      {(tema === "anoNovo" || tema === "carnaval") && <Confete />}
    </g>
  );
}

function Bandeirinhas() {
  const cores = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ec4899", "#f97316"];
  return (
    <g>
      <path d="M-2 6 Q50 16 102 6" stroke="#92400e" strokeWidth="1" fill="none" />
      {cores.map((cor, i) => {
        const x = 4 + i * 17;
        const y = 6 + Math.sin((i / 5) * Math.PI) * 4.5;
        return <path key={cor} d={`M${x} ${y} L${x + 10} ${y} L${x + 10} ${y + 9} L${x + 5} ${y + 6} L${x} ${y + 9} Z`} fill={cor} />;
      })}
    </g>
  );
}

function Confete() {
  const pts: [number, number, string, number][] = [
    [8, 30, "#ec4899", 20], [90, 12, "#facc15", -30], [12, 70, "#22c55e", 45], [88, 64, "#3b82f6", 10], [6, 50, "#f97316", -15], [94, 36, "#a855f7", 60], [20, 8, "#22c55e", 0],
  ];
  return <g>{pts.map(([x, y, cor, r]) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="2" rx="0.6" fill={cor} transform={`rotate(${r} ${x + 2} ${y + 1})`} />)}</g>;
}

// ---------------------------------------------------------------- corpo e cabeça

function Corpo({ c, cores, camisa, extra, id }: { c: AvatarConfig; cores: Cores; camisa: string; extra: string; id: string }) {
  const contorno = tom(camisa, -0.35);
  const colete = extra === "colete";
  const corColete = c.funcao === "engenheiro" || c.funcao === "topografo" ? "#a3e635" : "#f97316";
  return (
    <g>
      {/* Pescoço com sombra do queixo */}
      <path d="M42 58 L58 58 L58 77 L42 77 Z" fill={cores.pele} />
      <path d="M42 60 L58 60 L58 66 C54 69 46 69 42 66 Z" fill={cores.sombra} />
      {/* Tronco */}
      <path d="M8 102 C8 86 19 78 35 75.5 L43 74 L50 80 L57 74 L65 75.5 C81 78 92 86 92 102 Z" fill={camisa} stroke={contorno} strokeWidth="1.2" />
      <path d="M71 77.5 C83 81 91 88 92 102 L76 102 C76 92 74 84 71 77.5 Z" fill="#000" opacity="0.12" />
      <path d="M12 96 C14 88 20 83 28 80" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Gola */}
      <path d="M43 74 L50 82 L46 86 L39 76 Z" fill={tom(camisa, 0.2)} stroke={contorno} strokeWidth="0.8" />
      <path d="M57 74 L50 82 L54 86 L61 76 Z" fill={tom(camisa, 0.12)} stroke={contorno} strokeWidth="0.8" />
      {colete && (
        <g>
          <defs>
            <clipPath id={`colete-${id}`}>
              <path d="M13 102 C13 89 21 81 33 77.5 L41 75.5 L45.5 87 L44 102 Z M87 102 C87 89 79 81 67 77.5 L59 75.5 L54.5 87 L56 102 Z" />
            </clipPath>
          </defs>
          <path d="M13 102 C13 89 21 81 33 77.5 L41 75.5 L45.5 87 L44 102 Z M87 102 C87 89 79 81 67 77.5 L59 75.5 L54.5 87 L56 102 Z"
            fill={corColete} stroke={tom(corColete, -0.35)} strokeWidth="1" />
          <g clipPath={`url(#colete-${id})`} fill="#e5e7eb">
            <rect x="0" y="88" width="100" height="3" /><rect x="0" y="95" width="100" height="3" />
          </g>
        </g>
      )}
      {extra === "macacao" && (
        <g>
          <path d="M36 85 L64 85 L66 102 L34 102 Z" fill={tom(camisa, -0.3)} stroke={tom(camisa, -0.5)} strokeWidth="1" />
          <path d="M33 77 L38 76 L40 86 L36 86 Z M67 77 L62 76 L60 86 L64 86 Z" fill={tom(camisa, -0.3)} />
          <circle cx="39" cy="87" r="1.4" fill="#facc15" /><circle cx="61" cy="87" r="1.4" fill="#facc15" />
          <rect x="45" y="90" width="10" height="7" rx="1" fill={tom(camisa, -0.42)} />
        </g>
      )}
      {extra === "avental" && (
        <g>
          <path d="M44 76 L37 84 M56 76 L63 84" stroke="#78350f" strokeWidth="1.6" />
          <path d="M36 84 L64 84 L67 102 L33 102 Z" fill="#b45309" stroke="#78350f" strokeWidth="1" />
          <rect x="39" y="89" width="9" height="8" rx="1" fill="#92400e" /><rect x="52" y="89" width="9" height="8" rx="1" fill="#92400e" />
          <rect x="41" y="84" width="2" height="7" fill="#facc15" /><rect x="41" y="83" width="2" height="1.6" fill="#f472b6" />
        </g>
      )}
      {extra === "respingos" && (
        <g>
          {[[24, 88, "#3b82f6"], [70, 84, "#f43f5e"], [60, 95, "#22c55e"], [34, 96, "#f59e0b"], [78, 93, "#3b82f6"], [44, 86, "#a855f7"]].map(([x, y, cor]) => (
            <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="1.5" fill={cor as string} />
          ))}
          <path d="M36 85 L64 85 L66 102 L34 102 Z" fill="#e2e8f0" opacity="0.7" />
        </g>
      )}
      {extra === "raio" && <path d="M30 83 L25 91 L29 91 L27 97 L33 88 L29 88 L31 83 Z" fill="#facc15" stroke="#a16207" strokeWidth="0.6" />}
      {extra === "cruz" && (
        <g><circle cx="29" cy="89" r="5" fill="#f8fafc" /><path d="M27.6 85.6 h2.8 v2.2 h2.2 v2.8 h-2.2 v2.2 h-2.8 v-2.2 h-2.2 v-2.8 h2.2 Z" fill="#16a34a" /></g>
      )}
      {extra === "cracha" && (
        <g>
          <path d="M44 76 L48 90 M56 76 L52 90" stroke="#ef4444" strokeWidth="1.4" />
          <rect x="44" y="89" width="12" height="13" rx="1.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.8" />
          <rect x="44" y="89" width="12" height="3" rx="1" fill="#3b82f6" />
          <circle cx="50" cy="96" r="2" fill="#94a3b8" />
        </g>
      )}
      {extra === "prancheta" && (
        <g transform="rotate(-8 72 92)">
          <rect x="63" y="82" width="18" height="22" rx="2" fill="#a16207" stroke="#713f12" strokeWidth="0.8" />
          <rect x="65" y="86" width="14" height="16" fill="#f8fafc" />
          <rect x="68" y="80.5" width="8" height="3.5" rx="1" fill="#94a3b8" />
          <path d="M67 89 h10 M67 92 h7 M67 95 h10 M67 98 h6" stroke="#94a3b8" strokeWidth="0.9" />
        </g>
      )}
      {extra === "planta" && (
        <g transform="rotate(-35 72 88)">
          <rect x="58" y="85" width="30" height="7" rx="3.5" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="0.8" />
          <ellipse cx="88" cy="88.5" rx="2" ry="3.5" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="0.8" />
          <path d="M66 86 v5 M74 86 v5" stroke="#1d4ed8" strokeWidth="0.6" />
        </g>
      )}
      {extra === "trena" && (
        <g><rect x="60" y="86" width="11" height="10" rx="2.5" fill="#facc15" stroke="#a16207" strokeWidth="0.8" /><circle cx="65.5" cy="91" r="2.4" fill="#475569" /><rect x="70" y="93" width="4" height="1.4" fill="#e5e7eb" /></g>
      )}
      {extra === "chave" && (
        <g>
          <rect x="60" y="86" width="12" height="9" rx="1" fill={tom(camisa, -0.2)} />
          <path d="M63 86 L63 79 M62 80 a2.2 2.2 0 1 1 3 0" stroke="#94a3b8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <rect x="67" y="80" width="1.6" height="7" fill="#f59e0b" /><rect x="66.6" y="78.5" width="2.4" height="2" fill="#475569" />
        </g>
      )}
    </g>
  );
}

const CABECA = "M31 41 C31 25 39 17 50 17 C61 17 69 25 69 41 L69 47 C69 59 60 67 50 67 C40 67 31 59 31 47 Z";

function Cabeca({ cores }: { cores: Cores }) {
  return (
    <g>
      {[31.5, 68.5].map(x => (
        <g key={x}>
          <ellipse cx={x} cy="46" rx="4.6" ry="6.2" fill={cores.pele} stroke={cores.linha} strokeWidth="1" />
          <ellipse cx={x + (x < 50 ? 0.6 : -0.6)} cy="46.3" rx="2.2" ry="3.6" fill={cores.sombra} />
        </g>
      ))}
      <path d={CABECA} fill={cores.pele} stroke={cores.linha} strokeWidth="1.1" />
      <path d="M60 20 C66 24 69 32 69 41 L69 47 C69 59 60 67 50 67 C58 63 63.5 56 63.5 46 C63.5 34 62.5 26 60 20 Z" fill={cores.sombra} opacity="0.55" />
      <ellipse cx="41" cy="30" rx="6" ry="3.5" fill={cores.luz} opacity="0.35" />
    </g>
  );
}

// ---------------------------------------------------------------- rosto

const OLHO_X = [41.5, 58.5] as const;
const OLHO_Y = 46;

function Olho({ x, cores, tipo, corOlhos }: { x: number; cores: Cores; tipo: "aberto" | "feliz" | "sereno" | "surpreso"; corOlhos: string }) {
  const y = OLHO_Y;
  if (tipo === "feliz") return <path d={`M${x - 4} ${y + 1} Q${x} ${y - 4} ${x + 4} ${y + 1}`} stroke={ESCURO} strokeWidth="2.1" fill="none" strokeLinecap="round" />;
  const grande = tipo === "surpreso";
  const rx = grande ? 4.4 : 4.1;
  const ry = grande ? 5 : 4.6;
  const ri = grande ? 2.6 : 3.1;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#fff" />
      <circle cx={x + 0.2} cy={y + 0.6} r={ri} fill={corOlhos} />
      <circle cx={x + 0.2} cy={y + 1.4} r={ri * 0.7} fill={tom(corOlhos, -0.25)} opacity="0.6" />
      <circle cx={x + 0.2} cy={y + 0.6} r={ri * 0.48} fill="#111827" />
      <circle cx={x + 1.4} cy={y - 0.9} r="1.15" fill="#fff" />
      <circle cx={x - 1} cy={y + 2} r="0.55" fill="#fff" opacity="0.9" />
      {tipo === "sereno"
        ? <path d={`M${x - 4.5} ${y - 0.4} Q${x} ${y - 5.6} ${x + 4.5} ${y - 0.4} L${x + 4.5} ${y + 0.4} L${x - 4.5} ${y + 0.4} Z`} fill={cores.pele} stroke={ESCURO} strokeWidth="1.3" strokeLinejoin="round" />
        : <path d={`M${x - 4.4} ${y - 1.4} Q${x} ${y - ry - 1.2} ${x + 4.4} ${y - 1.4} L${x + 5.4} ${y - 2.6}`} stroke={ESCURO} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  );
}

function OlhosFechados({ cores }: { cores: Cores }) {
  return (
    <g>
      {OLHO_X.map(x => (
        <g key={x}>
          <ellipse cx={x} cy={OLHO_Y} rx="5" ry="5.6" fill={cores.pele} />
          <path d={`M${x - 4.2} ${OLHO_Y + 0.4} Q${x} ${OLHO_Y + 3} ${x + 4.2} ${OLHO_Y + 0.4}`} stroke={ESCURO} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

function Sobrancelhas({ c, cores }: { c: AvatarConfig; cores: Cores }) {
  const sobe = (c.olhos === "surpreso" ? -2.2 : 0) - 1.6;
  const largura = { normal: 2.2, grossa: 3.4, fina: 1.3, arqueada: 2 }[c.sobrancelha];
  const curva = c.sobrancelha === "arqueada" ? 4 : 2.4;
  return (
    <g stroke={cores.sobrancelha} strokeWidth={largura} strokeLinecap="round" fill="none">
      <path d={`M37 ${37.5 + sobe} Q42 ${37.5 - curva + sobe} 47 ${36.6 + sobe}`} />
      <path d={`M53 ${36.6 + sobe} Q58 ${37.5 - curva + sobe} 63 ${37.5 + sobe}`} />
    </g>
  );
}

function Rosto({ c, cores, tema }: { c: AvatarConfig; cores: Cores; tema: DataComemorativa | null }) {
  const corOlhos = CORES_OLHOS[c.corOlhos];
  const bochecha = c.detalhe === "bochechas" ? 0.55 : 0.32;
  return (
    <g>
      {/* Bochechas e nariz */}
      <ellipse cx="36.6" cy="54.6" rx="4.4" ry="2.8" fill="#fb7185" opacity={bochecha} />
      <ellipse cx="63.4" cy="54.6" rx="4.4" ry="2.8" fill="#fb7185" opacity={bochecha} />
      <path d="M48.6 52.4 Q50 54 51.6 52.4" stroke={tom(cores.pele, -0.3)} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="51.4" rx="1.4" ry="0.8" fill={cores.luz} opacity="0.6" />
      {c.detalhe === "sardas" && (
        <g fill={tom(cores.pele, -0.35)} opacity="0.7">
          {[[40, 51], [42.5, 52.5], [38, 52.8], [60, 51], [57.5, 52.5], [62, 52.8], [47, 50.5], [53, 50.5]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.6" />)}
        </g>
      )}
      {c.detalhe === "pinta" && <circle cx="59" cy="56" r="0.9" fill={tom(cores.pele, -0.55)} />}
      {tema === "junina" && (
        <g fill={tom(cores.pele, -0.45)}><circle cx="36" cy="52" r="0.8" /><circle cx="38" cy="54.5" r="0.8" /><circle cx="64" cy="52" r="0.8" /><circle cx="62" cy="54.5" r="0.8" /></g>
      )}
      {c.barba !== "nenhuma" && <Barba tipo={c.barba} cores={cores} />}
      <Boca tipo={c.boca} />
      {(c.barba === "bigode" || c.barba === "cavanhaque" || c.barba === "cheia") && (
        <path d="M43 55.2 C45 52.6 48.5 53 50 54.3 C51.5 53 55 52.6 57 55.2 C55 56.2 52 55.8 50 55.6 C48 55.8 45 56.2 43 55.2 Z" fill={cores.cabelo} stroke={cores.cabeloEsc} strokeWidth="0.6" />
      )}
      <Sobrancelhas c={c} cores={cores} />
      {c.olhos === "feliz" ? OLHO_X.map(x => <Olho key={x} x={x} cores={cores} tipo="feliz" corOlhos={corOlhos} />) : (
        <>
          <Olho x={42} cores={cores} tipo={c.olhos === "sereno" ? "sereno" : c.olhos === "surpreso" ? "surpreso" : "aberto"} corOlhos={corOlhos} />
          <Olho x={58} cores={cores} tipo={c.olhos === "piscando" ? "feliz" : c.olhos === "sereno" ? "sereno" : c.olhos === "surpreso" ? "surpreso" : "aberto"} corOlhos={corOlhos} />
        </>
      )}
      {tema === "carnaval" && (
        <g>
          <path d="M33 42 C38 38 46 40 50 43 C54 40 62 38 67 42 C66 49 60 51 55 49 C53 48 51 47 50 47 C49 47 47 48 45 49 C40 51 34 49 33 42 Z" fill="#a21caf" stroke="#facc15" strokeWidth="1" />
          <ellipse cx="42" cy="45" rx="3.4" ry="2.6" fill="#1f2937" opacity="0.15" /><ellipse cx="58" cy="45" rx="3.4" ry="2.6" fill="#1f2937" opacity="0.15" />
          <path d="M66 41 C70 34 72 28 70 22 C74 28 74 36 68 43 Z" fill="#facc15" />
        </g>
      )}
    </g>
  );
}

function Boca({ tipo }: { tipo: AvatarConfig["boca"] }) {
  switch (tipo) {
    case "aberta":
      return (
        <g>
          <path d="M43.5 56.6 Q50 65.5 56.5 56.6 Z" fill={BOCA} />
          <path d="M44.6 57 L55.4 57 L54.6 58.7 L45.4 58.7 Z" fill="#fff" />
          <ellipse cx="50" cy="61.2" rx="3" ry="1.5" fill="#f87171" />
        </g>
      );
    case "risada":
      return (
        <g>
          <path d="M41.5 55.6 Q50 68 58.5 55.6 Z" fill={BOCA} />
          <path d="M42.8 56 L57.2 56 L56.2 58.2 L43.8 58.2 Z" fill="#fff" />
          <ellipse cx="50" cy="62.6" rx="4" ry="2" fill="#f87171" />
        </g>
      );
    case "canto":
      return <path d="M45 58.4 Q51 59.8 56.4 55.6" stroke={BOCA} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
    case "seria":
      return <path d="M45.5 58.6 L54.5 58.6" stroke={BOCA} strokeWidth="1.8" strokeLinecap="round" />;
    default:
      return (
        <g>
          <path d="M45 57.6 Q50 63.4 55 57.6 Q50 59.4 45 57.6 Z" fill={BOCA} stroke={BOCA} strokeWidth="1" strokeLinejoin="round" />
          <path d="M47.6 60.6 Q50 61.8 52.4 60.6" stroke="#fb7185" strokeWidth="1" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

function Barba({ tipo, cores }: { tipo: AvatarConfig["barba"]; cores: Cores }) {
  if (tipo === "rala") {
    return <path d="M32 47 C32 58 40 67 50 67 C60 67 68 58 68 47 C66 54 62 57 57 57.5 L43 57.5 C38 57 34 54 32 47 Z" fill={cores.cabelo} opacity="0.28" />;
  }
  if (tipo === "costeleta") {
    return <path d="M31.8 37 L35.5 37 L35.5 51 C34.5 52.5 32.5 52.5 31.8 50 Z M68.2 37 L64.5 37 L64.5 51 C65.5 52.5 67.5 52.5 68.2 50 Z" fill={cores.cabelo} stroke={cores.cabeloEsc} strokeWidth="0.6" />;
  }
  if (tipo === "cavanhaque") {
    return <path d="M45.5 61 C46.5 66.5 53.5 66.5 54.5 61 C53 62.3 51.5 62.4 50 62.4 C48.5 62.4 47 62.3 45.5 61 Z" fill={cores.cabelo} stroke={cores.cabeloEsc} strokeWidth="0.6" />;
  }
  if (tipo === "cheia") {
    return (
      <path d="M31 43 C31 57 37 67.5 50 69.5 C63 67.5 69 57 69 43 C67 50 64.5 54 60.5 55.4 C57 53.4 53 53 50 53.4 C47 53 43 53.4 39.5 55.4 C35.5 54 33 50 31 43 Z"
        fill={cores.cabelo} stroke={cores.cabeloEsc} strokeWidth="0.8" />
    );
  }
  return null;
}

// ---------------------------------------------------------------- cabelo

function CabeloTras({ c, cores }: { c: AvatarConfig; cores: Cores }) {
  const p = { fill: cores.cabelo, stroke: cores.cabeloEsc, strokeWidth: 1.1 };
  switch (c.cabelo) {
    case "longo": return <path d="M28 44 C25 22 37 12.5 50 12.5 C63 12.5 75 22 72 44 L74.5 82 C70 86 64 86 61.5 81 L62 52 L38 52 L38.5 81 C36 86 30 86 25.5 82 Z" {...p} />;
    case "ondulado": return <path d="M27 54 C23 30 34 12.5 50 12.5 C66 12.5 77 30 73 54 C71.5 58 68 58 67 54 C68 50 66 48 66 46 L34 46 C34 48 32 50 33 54 C32 58 28.5 58 27 54 Z" {...p} />;
    case "chanel": return <path d="M27.5 60 C23 30 34 12.5 50 12.5 C66 12.5 77 30 72.5 60 C69 61.5 65 61.5 62 60 L62 44 L38 44 L38 60 C35 61.5 31 61.5 27.5 60 Z" {...p} />;
    case "afro": return <circle cx="50" cy="35" r="27" {...p} />;
    case "cacheado": return (
      <g {...p}>
        {[[30, 32], [34, 22], [42, 15], [50, 13], [58, 15], [66, 22], [70, 32], [29, 44], [71, 44]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="8" />)}
      </g>
    );
    case "rabo": return (
      <g>
        <path d="M64 28 C80 30 84 50 77 70 C76 60 73 50 67 42 Z" {...p} />
        <ellipse cx="66.5" cy="31" rx="2.6" ry="3.4" fill="#ec4899" />
      </g>
    );
    case "trancas": return (
      <g {...p}>
        {[32, 68].map(x => [0, 1, 2, 3, 4].map(i => <ellipse key={`${x}-${i}`} cx={x} cy={52 + i * 7} rx="3.6" ry="4.2" />))}
      </g>
    );
    case "dreads": return (
      <g {...p}>
        {[29, 34, 66, 71].map((x, i) => <rect key={x} x={x - 2.4} y="30" width="4.8" height={40 + (i % 2) * 6} rx="2.4" />)}
      </g>
    );
    case "coque": return <circle cx="50" cy="11" r="8" {...p} />;
    default: return null;
  }
}

function CabeloFrente({ c, cores, cobreCabeca }: { c: AvatarConfig; cores: Cores; cobreCabeca: boolean }) {
  const p = { fill: cores.cabelo, stroke: cores.cabeloEsc, strokeWidth: 1.1, strokeLinejoin: "round" as const };
  const brilho = (d: string) => <path d={d} stroke={cores.cabeloLuz} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />;
  // Debaixo do capacete só aparece a lateral (costeleta de cabelo).
  if (cobreCabeca && !["longo", "ondulado", "chanel", "afro", "cacheado", "trancas", "dreads"].includes(c.cabelo)) {
    if (c.cabelo === "careca" || c.cabelo === "raspado") return null;
    // Só uma mecha fina na têmpora, rente à orelha.
    return <path d="M31.6 34 L35 34 C34.4 37 34.2 39.6 34.6 41.6 C33.2 41 32 38.4 31.6 34 Z M68.4 34 L65 34 C65.6 37 65.8 39.6 65.4 41.6 C66.8 41 68 38.4 68.4 34 Z" {...p} />;
  }
  switch (c.cabelo) {
    case "careca": return <ellipse cx="44" cy="23" rx="6" ry="2.6" fill="#fff" opacity="0.35" />;
    case "raspado": return <path d="M31 39 C31 24 39 17 50 17 C61 17 69 24 69 39 C66 31 60 26.5 50 26.5 C40 26.5 34 31 31 39 Z" fill={cores.cabelo} opacity="0.8" />;
    case "moicano": return (
      <g>
        <path d="M31 39 C31 24 39 17 50 17 C61 17 69 24 69 39 C66 31 60 26.5 50 26.5 C40 26.5 34 31 31 39 Z" fill={cores.cabelo} opacity="0.55" />
        <path d="M44.5 29 C44 18 46 9 50 5 C54 9 56 18 55.5 29 Z" {...p} />
        {brilho("M49 9 C48 14 48 20 48.5 26")}
      </g>
    );
    case "topete": return (
      <g>
        <path d="M30 41 C29 24 38 15 50 15 C62 15 71 23 70 41 C68 33 66 29 62 27 C56 30 46 30 38 27 C34 30 32 34 30 41 Z" {...p} />
        <path d="M37 27 C38 13 55 7 66 16 C61 16 59 20 57 26 Z" {...p} />
        {brilho("M42 19 C47 13 56 12 61 15")}
      </g>
    );
    case "franja": return (
      <g>
        <path d="M30 43 C28 24 38 14 50 14 C63 14 72 24 70 43 C67 37 65 33 64 31 C58 36 47 37 39 33 C36 36 33 39 30 43 Z" {...p} />
        <path d="M44 34 L46 27 M52 35 L53 28 M59 33 L58 27" stroke={cores.cabeloEsc} strokeWidth="0.8" />
        {brilho("M38 22 C43 17 52 16 59 18")}
      </g>
    );
    case "ondulado": case "chanel": case "longo": return (
      <g>
        <path d="M30 44 C28 24 38 14 50 14 C63 14 72 24 70 44 C69 36 66 30 61 26 C58 31 50 33 43 32 C38 33 33 37 30 44 Z" {...p} />
        {brilho("M38 22 C43 17 52 16 59 18")}
      </g>
    );
    case "afro": return <path d="M31 38 C33 28 40 24 50 24 C60 24 67 28 69 38 C66 32 59 30 50 30 C41 30 34 32 31 38 Z" {...p} />;
    case "cacheado": return (
      <g {...p}>
        {[[36, 28], [43, 25], [50, 24], [57, 25], [64, 28]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />)}
      </g>
    );
    case "trancas": case "dreads": return (
      <g>
        <path d="M30 42 C28 24 38 14 50 14 C62 14 72 24 70 42 C67 34 61 29 50 28.5 C39 29 33 34 30 42 Z" {...p} />
        <path d="M40 18 L42 29 M50 15 L50 28 M60 18 L58 29" stroke={cores.cabeloEsc} strokeWidth="0.9" />
      </g>
    );
    default: return (
      <g>
        <path d="M30 41 C29 24 38 15 50 15 C62 15 71 23 70 41 C68 33 66 29 62 27 C56 30 46 30 38 27 C34 30 32 34 30 41 Z" {...p} />
        {brilho("M39 21 C44 17 52 16.5 58 18.5")}
      </g>
    );
  }
}

// ---------------------------------------------------------------- capacete, acessórios e chapéus

function Capacete({ cor, brilho }: { cor: string; brilho: string }) {
  const escuro = tom(cor, -0.22);
  return (
    <g>
      <path d="M27 39 C27 20 38 9.5 50 9.5 C62 9.5 73 20 73 39 Z" fill={cor} stroke={tom(cor, -0.42)} strokeWidth="1.2" />
      <path d="M27 39 C27 20 38 9.5 50 9.5 C62 9.5 73 20 73 39 Z" fill={brilho} />
      <path d="M46.5 10 C48 9.6 52 9.6 53.5 10 L54.5 38.5 L45.5 38.5 Z" fill={tom(cor, 0.18)} stroke={escuro} strokeWidth="0.6" />
      <path d="M33 31 C34 22 39 16 45 13.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M62 14 C68 18 71 26 72 37 L66 37 C66 28 64 20 62 14 Z" fill="#000" opacity="0.1" />
      <path d="M22.5 40.5 C22.5 36.8 77.5 36.8 77.5 40.5 C77.5 43.6 22.5 43.6 22.5 40.5 Z" fill={escuro} stroke={tom(cor, -0.45)} strokeWidth="1" />
    </g>
  );
}

function Abafador({ comCapacete }: { comCapacete: boolean }) {
  return (
    <g>
      {!comCapacete && <path d="M29 44 C27 18 73 18 71 44" stroke="#374151" strokeWidth="3" fill="none" />}
      {[27.5, 72.5].map(x => (
        <g key={x}>
          {comCapacete && <path d={`M${x} 41 L${x} 44`} stroke="#374151" strokeWidth="2.4" />}
          <rect x={x - 4.5} y="40" width="9" height="13" rx="4" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
          <rect x={x - 2.5} y="42.5" width="5" height="8" rx="2.5" fill="#fca5a5" opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

function Fone() {
  return (
    <g>
      <rect x="25" y="41" width="8" height="11" rx="3.5" fill="#1f2937" />
      <path d="M29 52 Q31 60 41 60" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="42" cy="60" r="1.8" fill="#1f2937" />
      <rect x="26" y="34" width="2" height="8" fill="#1f2937" />
      <rect x="25.5" y="25" width="1.6" height="10" rx="0.8" fill="#64748b" />
    </g>
  );
}

function Acessorio({ c, cores, tema }: { c: AvatarConfig; cores: Cores; tema: DataComemorativa | null }) {
  if (tema === "carnaval" && c.acessorio.startsWith("oculos")) return null;
  switch (c.acessorio) {
    case "oculos": case "oculosSol": {
      const lente = c.acessorio === "oculosSol" ? "#111827" : "#e0f2fe";
      const op = c.acessorio === "oculosSol" ? 0.92 : 0.3;
      return (
        <g>
          <path d="M36 44 L31.5 43" stroke="#1f2937" strokeWidth="1.3" /><path d="M64 44 L68.5 43" stroke="#1f2937" strokeWidth="1.3" />
          {OLHO_X.map(x => <rect key={x} x={x - 5.6} y="41" width="11.2" height="8" rx="3.2" fill={lente} fillOpacity={op} stroke="#1f2937" strokeWidth="1.5" />)}
          <path d="M47.6 44 Q50 42.6 52.4 44" stroke="#1f2937" strokeWidth="1.3" fill="none" />
          {c.acessorio === "oculosSol" && <path d="M38 43 L41 42.5 M54 43 L57 42.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" />}
        </g>
      );
    }
    case "oculosSeguranca":
      return (
        <g>
          <path d="M31.5 43.5 L35 42.5 M68.5 43.5 L65 42.5" stroke="#475569" strokeWidth="1.4" />
          <path d="M34 41 C40 39.4 60 39.4 66 41 L65.4 48.4 C60 50.4 54 50 50 47.8 C46 50 40 50.4 34.6 48.4 Z" fill="#bae6fd" fillOpacity="0.45" stroke="#64748b" strokeWidth="1.2" />
          <path d="M37 42.5 L44 41.6" stroke="#fff" strokeOpacity="0.8" strokeWidth="1" />
        </g>
      );
    case "lapis":
      return (
        <g transform="rotate(-28 70 37)">
          <rect x="64" y="35.5" width="13" height="3" fill="#facc15" stroke="#a16207" strokeWidth="0.6" />
          <rect x="77" y="35.5" width="2" height="3" fill="#f472b6" />
          <path d="M64 35.5 L61 37 L64 38.5 Z" fill="#fde68a" />
        </g>
      );
    case "brinco":
      return <g fill="#facc15" stroke="#a16207" strokeWidth="0.5"><circle cx="31" cy="53.5" r="1.5" /><circle cx="69" cy="53.5" r="1.5" /></g>;
    case "mascara":
      return (
        <g>
          <path d="M32.5 47 L39 50 M67.5 47 L61 50" stroke="#e2e8f0" strokeWidth="1" />
          <path d="M38 50 C38 47 62 47 62 50 L61 60 C57 66.5 43 66.5 39 60 Z" fill="#f8fafc" stroke={cores.linha} strokeOpacity="0.4" strokeWidth="1" />
          <circle cx="55" cy="58" r="2.4" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.6" />
          <path d="M42 53 Q50 50.5 58 53" stroke="#cbd5e1" strokeWidth="0.7" fill="none" />
        </g>
      );
    default:
      return null;
  }
}

function ChapeuDoTema({ tema, id }: { tema: DataComemorativa | null; id: string }) {
  switch (tema) {
    case "natal":
      return (
        <g>
          <path d="M28.5 37 C28.5 20 40 11 52 11.5 C62 12 71 20 72 37 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.1" />
          <path d="M62 14 C73 15 81 25 84 39 L79.5 39.5 C77.5 30 71.5 22 63 19.5 Z" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="1" />
          <rect x="25" y="33" width="50" height="9" rx="4.5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="83" cy="41" r="4.6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
        </g>
      );
    case "anoNovo":
      return (
        <g>
          <defs><clipPath id={`cone-${id}`}><path d="M50 0 L63 33 L37 33 Z" /></clipPath></defs>
          <path d="M50 0 L63 33 L37 33 Z" fill="#facc15" stroke="#a16207" strokeWidth="1" />
          <g clipPath={`url(#cone-${id})`} fill="#ec4899">
            {[4, 12, 20, 28].map(y => <rect key={y} x="30" y={y} width="40" height="3.5" transform={`rotate(-18 50 ${y})`} />)}
          </g>
          <circle cx="50" cy="1.5" r="3" fill="#ec4899" />
          <path d="M39 33 L34 50 M61 33 L66 50" stroke="#94a3b8" strokeWidth="0.6" />
        </g>
      );
    case "junina":
      return (
        <g>
          <ellipse cx="50" cy="34.5" rx="31" ry="6.5" fill="#eab308" stroke="#a16207" strokeWidth="1.1" />
          <path d="M34 33 C34 17 66 17 66 33 Z" fill="#facc15" stroke="#a16207" strokeWidth="1.1" />
          <rect x="34" y="28.5" width="32" height="3.6" fill="#dc2626" />
          <path d="M24 34 L28 35.5 M33 37 L37 38 M63 38 L67 37 M72 35.5 L76 34 M40 21 L43 23 M56 21 L53 23" stroke="#a16207" strokeWidth="0.7" />
        </g>
      );
    case "halloween":
      return (
        <g>
          <ellipse cx="50" cy="35" rx="33" ry="5.5" fill="#312e81" stroke="#1e1b4b" strokeWidth="1" />
          <path d="M37 33 C39 20 45 8 61 1 C56 10 58 20 63 33 Z" fill="#3730a3" stroke="#1e1b4b" strokeWidth="1" />
          <path d="M37.6 28.5 C46 30 55 30 62 28.5 L63 33 L37 33 Z" fill="#f97316" />
          <rect x="47" y="28.8" width="5" height="4" fill="none" stroke="#facc15" strokeWidth="0.9" />
        </g>
      );
    case "pascoa":
      return (
        <g>
          {[[40, -12], [60, 12]].map(([x, r]) => (
            <g key={x} transform={`rotate(${r} ${x} 24)`}>
              <ellipse cx={x} cy="10" rx="6" ry="15" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
              <ellipse cx={x} cy="11" rx="3" ry="11" fill="#f9a8d4" />
            </g>
          ))}
          <path d="M31 30 C34 18 66 18 69 30" stroke="#f9a8d4" strokeWidth="2.4" fill="none" />
        </g>
      );
    default:
      return null;
  }
}
