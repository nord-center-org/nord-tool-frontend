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
        <Acessorio c={c} tema={tema} />
        <g clipPath={cobreCabeca ? `url(#sob-chapeu-${id})` : undefined}>
          <CabeloFrente c={c} cores={cores} />
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
  const contorno = LINHA;
  const colete = extra === "colete";
  const corColete = c.funcao === "engenheiro" || c.funcao === "topografo" ? "#a3e635" : "#f97316";
  return (
    <g>
      {/* Pescoço com sombra do queixo */}
      <path d="M45 60 L45.2 77 L54.8 77 L55 60 Z" fill={cores.pele} stroke={LINHA} strokeWidth={TRACO} />
      <path d="M45.1 62 C47 66.6 53 66.6 54.9 62 L54.9 68.4 C52 70.4 48 70.4 45.1 68.4 Z" fill={cores.sombra} />
      {/* Tronco */}
      <path d="M10 102 C10 87 20 79 35 76.2 L44.4 74.6 L50 80 L55.6 74.6 L65 76.2 C80 79 90 87 90 102 Z" fill={camisa} stroke={contorno} strokeWidth={TRACO} strokeLinejoin="round" />
      <path d="M26 84 Q28 92 27 102 M74 84 Q72 92 73 102" stroke={contorno} strokeWidth="0.6" opacity="0.5" fill="none" />
      <path d="M71 77.5 C83 81 91 88 92 102 L76 102 C76 92 74 84 71 77.5 Z" fill="#000" opacity="0.12" />
      <path d="M12 96 C14 88 20 83 28 80" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Gola */}
      <path d="M44.4 74.6 L50 82 L46 86 L40 76 Z" fill={tom(camisa, 0.2)} stroke={contorno} strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M55.6 74.6 L50 82 L54 86 L60 76 Z" fill={tom(camisa, 0.12)} stroke={contorno} strokeWidth="0.8" strokeLinejoin="round" />
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

/** Traço de ilustração (marrom bem escuro, como nanquim). */
const LINHA = "#3b2416";
const TRACO = 0.9;

const ROSTO = "M34 40 C34 27 41 20 50 20 C59 20 66 27 66 40 C66 50 64.4 56.6 61 61.6 C57.6 66.4 53.6 69.4 50 69.4 C46.4 69.4 42.4 66.4 39 61.6 C35.6 56.6 34 50 34 40 Z";

/** Contorno "de nuvem": arcos entre pontos consecutivos (cachos, black power). */
function ondulado(pontos: [number, number][], raio: number, fechar = true): string {
  const [x0, y0] = pontos[0];
  let d = `M${x0} ${y0}`;
  const lista = fechar ? [...pontos.slice(1), pontos[0]] : pontos.slice(1);
  for (const [x, y] of lista) d += ` A${raio} ${raio} 0 0 1 ${x} ${y}`;
  return fechar ? `${d} Z` : d;
}

const circulo = (cx: number, cy: number, r: number, n: number, inicio = 0, fim = 360): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = ((inicio + ((fim - inicio) * i) / (n - (fim - inicio === 360 ? 0 : 1))) * Math.PI) / 180;
    return [Math.round((cx + r * Math.cos(a)) * 10) / 10, Math.round((cy + r * Math.sin(a)) * 10) / 10];
  });

function Cabeca({ cores }: { cores: Cores }) {
  const t = { stroke: LINHA, strokeWidth: TRACO, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <g>
      {/* Orelhas */}
      <path d="M34.6 43.6 C31.4 41.8 29.8 44.6 30.6 48 C31.4 51.8 33.4 54 35.6 53.4 Z" fill={cores.pele} {...t} />
      <path d="M65.4 43.6 C68.6 41.8 70.2 44.6 69.4 48 C68.6 51.8 66.6 54 64.4 53.4 Z" fill={cores.pele} {...t} />
      <path d="M33.4 46 C32.4 47.4 32.8 49.6 34.2 50.8 M66.6 46 C67.6 47.4 67.2 49.6 65.8 50.8" fill="none" stroke={LINHA} strokeWidth="0.6" opacity="0.7" />
      <path d={ROSTO} fill={cores.pele} {...t} />
      {/* Sombra da franja na testa e do lado do rosto */}
      <path d="M34.3 39 C38 44 44 43.4 50 41.8 C56 43.4 62 44 65.7 39 L66 34 L34 34 Z" fill={cores.sombra} opacity="0.55" />
      <path d="M62.6 50 C62.4 56 60 61 55.6 65.4 C59.4 63.6 62.4 59.6 64 55.2 C65 52.4 65.6 48 65.8 45 Z" fill={cores.sombra} opacity="0.5" />
    </g>
  );
}

// ---------------------------------------------------------------- rosto

const OLHO_X = 42.4;
const OLHO_Y = 48.2;

/** Olho esquerdo de mangá; o direito é o mesmo espelhado. */
function Olho({ cores, tipo, corOlhos }: { cores: Cores; tipo: "aberto" | "feliz" | "sereno" | "surpreso"; corOlhos: string }) {
  const x = OLHO_X, y = OLHO_Y;
  if (tipo === "feliz") {
    return <path d={`M${x - 4.8} ${y + 1} Q${x} ${y - 4.2} ${x + 4.8} ${y + 1}`} stroke={LINHA} strokeWidth="1.7" fill="none" strokeLinecap="round" />;
  }
  const surpreso = tipo === "surpreso";
  const rx = surpreso ? 2.2 : 2.8, ry = surpreso ? 2.7 : 3.5;
  const topo = surpreso ? y - 5 : y - 4.2;
  return (
    <g>
      <path d={`M${x - 4.8} ${y} C${x - 4.4} ${topo + 1} ${x - 2} ${topo} ${x + 0.2} ${topo} C${x + 2.6} ${topo} ${x + 4.4} ${topo + 1.4} ${x + 4.8} ${y - 0.4} C${x + 4.2} ${y + 2.6} ${x + 2.2} ${y + 3.8} ${x} ${y + 3.8} C${x - 2.2} ${y + 3.8} ${x - 4.2} ${y + 2.6} ${x - 4.8} ${y} Z`} fill="#fff" />
      <ellipse cx={x + 0.3} cy={y + 0.4} rx={rx} ry={ry} fill={corOlhos} />
      <path d={`M${x + 0.3 - rx} ${y + 0.4} A${rx} ${ry} 0 0 1 ${x + 0.3 + rx} ${y + 0.4} Z`} fill="#000" opacity="0.3" />
      <ellipse cx={x + 0.3} cy={y + 0.8} rx={rx * 0.44} ry={ry * 0.5} fill="#1b1110" />
      <ellipse cx={x + 1.4} cy={y - 1} rx="1.1" ry="1.3" fill="#fff" />
      <circle cx={x - 0.9} cy={y + 2.2} r="0.5" fill="#fff" opacity="0.9" />
      {tipo === "sereno" && <path d={`M${x - 5} ${y - 0.6} C${x - 4} ${topo - 0.4} ${x + 4} ${topo - 0.4} ${x + 5} ${y - 0.8} L${x + 5} ${y + 0.2} L${x - 5} ${y + 0.4} Z`} fill={cores.pele} />}
      {/* Pálpebra de cima (traço grosso) com o cantinho dos cílios; a de baixo bem fina */}
      <path d={tipo === "sereno"
        ? `M${x - 5} ${y + 0.2} Q${x} ${y - 0.8} ${x + 5} ${y}`
        : `M${x - 5} ${y - 0.2} C${x - 4.2} ${topo + 0.4} ${x - 1.8} ${topo - 0.6} ${x + 0.4} ${topo - 0.6} C${x + 2.8} ${topo - 0.6} ${x + 4.6} ${topo + 0.8} ${x + 5.2} ${y - 0.8}`}
        stroke={LINHA} strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d={`M${x - 5} ${y - 0.2} L${x - 6.6} ${y - 1.2}`} stroke={LINHA} strokeWidth="1.1" strokeLinecap="round" />
      <path d={`M${x - 2.6} ${y + 3.6} Q${x} ${y + 4.6} ${x + 2.8} ${y + 3.4}`} stroke={LINHA} strokeWidth="0.6" fill="none" opacity="0.7" strokeLinecap="round" />
    </g>
  );
}

/** Os dois olhos: o esquerdo desenhado e o direito espelhado. */
function Olhos({ cores, esquerdo, direito, corOlhos }: { cores: Cores; esquerdo: Parameters<typeof Olho>[0]["tipo"]; direito: Parameters<typeof Olho>[0]["tipo"]; corOlhos: string }) {
  return (
    <g>
      <Olho cores={cores} tipo={esquerdo} corOlhos={corOlhos} />
      <g transform="translate(100 0) scale(-1 1)"><Olho cores={cores} tipo={direito} corOlhos={corOlhos} /></g>
    </g>
  );
}

function OlhosFechados({ cores }: { cores: Cores }) {
  const um = (
    <g>
      <ellipse cx={OLHO_X} cy={OLHO_Y - 0.2} rx="6.2" ry="5.2" fill={cores.pele} />
      <path d={`M${OLHO_X - 4.8} ${OLHO_Y + 0.4} Q${OLHO_X} ${OLHO_Y + 3} ${OLHO_X + 4.8} ${OLHO_Y + 0.4}`} stroke={LINHA} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d={`M${OLHO_X - 4.8} ${OLHO_Y + 0.4} L${OLHO_X - 6.4} ${OLHO_Y + 1.2}`} stroke={LINHA} strokeWidth="1" strokeLinecap="round" />
    </g>
  );
  return <g>{um}<g transform="translate(100 0) scale(-1 1)">{um}</g></g>;
}

function Sobrancelhas({ c, cores }: { c: AvatarConfig; cores: Cores }) {
  const sobe = c.olhos === "surpreso" ? -1.8 : 0;
  const esp = { normal: 1.1, grossa: 1.9, fina: 0.6, arqueada: 1 }[c.sobrancelha];
  const arco = c.sobrancelha === "arqueada" ? 3.6 : 2.2;
  const y = 41.4 + sobe;
  const uma = <path d={`M37.4 ${y} Q42 ${y - arco - esp} 47 ${y - 1.4} Q42 ${y - arco + esp * 0.6} 37.4 ${y + esp * 0.8} Z`} fill={cores.sobrancelha} stroke={cores.sobrancelha} strokeWidth="0.4" strokeLinejoin="round" />;
  return <g>{uma}<g transform="translate(100 0) scale(-1 1)">{uma}</g></g>;
}

function Rosto({ c, cores, tema }: { c: AvatarConfig; cores: Cores; tema: DataComemorativa | null }) {
  const corOlhos = CORES_OLHOS[c.corOlhos];
  const forte = c.detalhe === "bochechas";
  const rubor = (x: number) => (
    <g key={x}>
      <ellipse cx={x} cy="55.6" rx="3.8" ry="2.2" fill="#fb7185" opacity={forte ? 0.4 : 0.22} />
      <path d={`M${x - 2.4} 56.6 L${x - 1.4} 54.6 M${x - 0.5} 56.6 L${x + 0.5} 54.6 M${x + 1.4} 56.6 L${x + 2.4} 54.6`} stroke="#e11d48" strokeWidth="0.55" opacity={forte ? 0.75 : 0.45} strokeLinecap="round" />
    </g>
  );
  const esquerdo = c.olhos === "sereno" ? "sereno" : c.olhos === "surpreso" ? "surpreso" : c.olhos === "feliz" ? "feliz" : "aberto";
  const direito = c.olhos === "piscando" ? "feliz" : esquerdo;
  return (
    <g>
      {rubor(38.6)}{rubor(61.4)}
      <path d="M50.8 52.4 Q50.2 54.8 49.2 55.6 Q50.2 56.1 51.2 55.7" stroke={LINHA} strokeWidth="0.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {c.detalhe === "sardas" && (
        <g fill={tom(cores.pele, -0.35)} opacity="0.75">
          {[[39.6, 53.4], [41.6, 54.4], [38, 54.6], [60.4, 53.4], [58.4, 54.4], [62, 54.6], [47.4, 53], [52.6, 53]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.5" />)}
        </g>
      )}
      {c.detalhe === "pinta" && <circle cx="57.4" cy="59" r="0.7" fill={LINHA} />}
      {tema === "junina" && (
        <g fill={tom(cores.pele, -0.5)}><circle cx="36.6" cy="54" r="0.7" /><circle cx="38.4" cy="56.4" r="0.7" /><circle cx="63.4" cy="54" r="0.7" /><circle cx="61.6" cy="56.4" r="0.7" /></g>
      )}
      {c.barba !== "nenhuma" && <Barba tipo={c.barba} cores={cores} />}
      <Boca tipo={c.boca} />
      {(c.barba === "bigode" || c.barba === "cavanhaque" || c.barba === "cheia") && (
        <path d="M45.4 58.4 C46.8 56.6 49 56.8 50 57.8 C51 56.8 53.2 56.6 54.6 58.4 C52.8 59.2 51.2 59 50 58.7 C48.8 59 47.2 59.2 45.4 58.4 Z" fill={cores.cabelo} stroke={LINHA} strokeWidth="0.6" />
      )}
      <Sobrancelhas c={c} cores={cores} />
      <Olhos cores={cores} esquerdo={esquerdo} direito={direito} corOlhos={corOlhos} />
      {tema === "carnaval" && (
        <g>
          <path d="M33 45 C38 40 46 42 50 45.6 C54 42 62 40 67 45 C66 52 60 54 55 52.4 C53 51.6 51 50.6 50 50.6 C49 50.6 47 51.6 45 52.4 C40 54 34 52 33 45 Z" fill="#a21caf" stroke="#facc15" strokeWidth="1" />
          <ellipse cx="42.4" cy="48" rx="3.6" ry="2.6" fill="#fff" opacity="0.25" /><ellipse cx="57.6" cy="48" rx="3.6" ry="2.6" fill="#fff" opacity="0.25" />
          <path d="M66 44 C70 37 72 31 70 25 C74 31 74 39 68 46 Z" fill="#facc15" />
        </g>
      )}
    </g>
  );
}

function Boca({ tipo }: { tipo: AvatarConfig["boca"] }) {
  const t = { stroke: LINHA, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (tipo) {
    case "aberta":
      return (
        <g>
          <path d="M46.4 59.4 Q50 60 53.6 59.4 Q52.8 63.8 50 63.8 Q47.2 63.8 46.4 59.4 Z" fill="#9f2d2d" {...t} strokeWidth="0.8" />
          <path d="M46.9 59.7 Q50 60.3 53.1 59.7 L52.9 60.7 Q50 61.1 47.1 60.7 Z" fill="#fff" />
          <path d="M47.9 62.8 Q50 61.4 52.1 62.8 Q50 63.8 47.9 62.8 Z" fill="#f87171" />
        </g>
      );
    case "risada":
      return (
        <g>
          <path d="M45 58.6 Q50 59.6 55 58.6 Q54 65.6 50 65.6 Q46 65.6 45 58.6 Z" fill="#9f2d2d" {...t} strokeWidth="0.8" />
          <path d="M45.6 58.9 Q50 59.8 54.4 58.9 L54.2 60.3 Q50 60.9 45.8 60.3 Z" fill="#fff" />
          <path d="M47.2 63.8 Q50 61.8 52.8 63.8 Q50 65.6 47.2 63.8 Z" fill="#f87171" />
        </g>
      );
    case "canto":
      return <path d="M46.6 60.4 Q50.6 61.6 53.8 58.8" fill="none" {...t} strokeWidth="0.95" />;
    case "seria":
      return <path d="M47.2 60.6 L52.8 60.6" {...t} strokeWidth="0.95" />;
    default:
      return (
        <g>
          <path d="M46.4 59.6 Q50 62.6 53.6 59.6" fill="none" {...t} strokeWidth="0.95" />
          <path d="M48.6 61.6 Q50 62 51.4 61.6" stroke="#e11d48" strokeWidth="0.5" fill="none" opacity="0.6" strokeLinecap="round" />
        </g>
      );
  }
}

function Barba({ tipo, cores }: { tipo: AvatarConfig["barba"]; cores: Cores }) {
  const t = { fill: cores.cabelo, stroke: LINHA, strokeWidth: 0.6, strokeLinejoin: "round" as const };
  if (tipo === "rala") {
    return (
      <g>
        <path d="M35 50 C36.4 58 41.4 65.6 50 69.2 C58.6 65.6 63.6 58 65 50 C63 56 60 59 56 59.6 L44 59.6 C40 59 37 56 35 50 Z" fill={cores.cabelo} opacity="0.22" />
        <g fill={cores.cabeloEsc} opacity="0.5">{[[40, 62], [43, 64.6], [47, 66.6], [53, 66.6], [57, 64.6], [60, 62], [50, 67.4]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.35" />)}</g>
      </g>
    );
  }
  if (tipo === "costeleta") return <path d="M34.3 37 L37.6 37 L37.2 50 C36.2 51.6 34.8 50.6 34.5 48 Z M65.7 37 L62.4 37 L62.8 50 C63.8 51.6 65.2 50.6 65.5 48 Z" {...t} />;
  if (tipo === "cavanhaque") return <path d="M47.4 63.6 C47.8 67.6 52.2 67.6 52.6 63.6 C51.4 64.5 48.6 64.5 47.4 63.6 Z" {...t} />;
  if (tipo === "cheia") {
    return (
      <g>
        <path d="M34.3 45 C34.6 55 38 63 43 66.8 C46 69 48 70.8 50 71 C52 70.8 54 69 57 66.8 C62 63 65.4 55 65.7 45 C64 52 62 56 59 57.8 C56.4 56.2 53 56 50 56.6 C47 56 43.6 56.2 41 57.8 C38 56 36 52 34.3 45 Z" {...t} />
        <path d="M40 60 L41 63.4 M44 62.4 L44.6 66 M50 64 L50 68.4 M56 62.4 L55.4 66 M60 60 L59 63.4" stroke={cores.cabeloEsc} strokeWidth="0.6" strokeLinecap="round" />
      </g>
    );
  }
  return null;
}

// ---------------------------------------------------------------- cabelo (mechas com ponta, traço de ilustração)

/** Topo da cabeça, de têmpora a têmpora; a franja fecha o caminho de volta. */
const COPA = "M31.6 47 C29.6 30 37.6 15.6 50 15.6 C62.4 15.6 70.4 30 68.4 47";
const COPA_ARREPIADA = "M31.6 47 C30 36 31.6 27 36 22 L35 17.4 L39.8 19.4 L42 14.6 L46.2 17.8 L50 13 L53.8 17.6 L58.4 14.4 L60.4 19.4 L65 17.6 L64 22.4 C68.4 27 70 36 68.4 47";
/** Franja bagunçada (pontas desencontradas). */
const FRANJA_PONTAS = " L66.6 41 Q64.6 37.6 62.4 33.2 Q61.6 38.4 60.4 42.8 Q58 37 56 31.4 Q55 37.6 53.8 43 Q51.4 36.6 49.2 31.6 Q48 37.4 46.6 43.2 Q44.6 37.6 42.2 32.4 Q41.4 38.6 39.6 42.6 Q37.8 38.4 36.4 34.2 Q35.4 39.8 33.4 44.2 Z";
/** Franja reta (chanel / franjinha). */
const FRANJA_RETA = " L67 43.6 L62.4 42.6 L61.2 44 L56.4 42.8 L55.2 44.2 L50.4 43 L49.2 44.2 L44.4 43 L43.2 44.2 L38.4 42.8 L37.2 44 L33 43.6 Z";
/** Franja repartida no meio (cortina), deixando a testa aparecer. */
const FRANJA_CORTINA = " L67.6 52 Q65 40.6 59 31.6 Q55 26.6 50.4 23.6 Q50 27 50 27 Q50 27 49.6 23.6 Q45 26.6 41 31.6 Q35 40.6 32.4 52 Z";
/** Penteado para trás (sem franja). */
const FRANJA_PRA_TRAS = " L66.4 40 Q60 30.6 50 29.4 Q40 30.6 33.6 40 Z";
/** Franja de lado (varrida para a esquerda). */
const FRANJA_LADO = " L67.4 44 Q66 37 62 31 Q60.6 36 58.6 39.4 Q56.4 33.4 53 29.6 Q52 35.4 49.6 39 Q46.6 34 42.6 31.4 Q42 37.2 39.4 41.6 Q37.6 37.4 35.4 35.6 Q35 41.2 32.6 45.4 Z";

function Mechas({ d, cores, linhas, brilho = true }: { d: string; cores: Cores; linhas?: string; brilho?: boolean }) {
  return (
    <g>
      <path d={d} fill={cores.cabelo} stroke={LINHA} strokeWidth={TRACO} strokeLinejoin="round" />
      {linhas && <path d={linhas} fill="none" stroke={LINHA} strokeWidth="0.55" opacity="0.5" strokeLinecap="round" />}
      {brilho && <path d="M38.4 26.4 Q44 22 49 21.4 M52.6 21.4 Q57 22 61.6 26" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.32" strokeLinecap="round" />}
    </g>
  );
}

const LINHAS_FRANJA = "M50 17 Q48 26 47 40 M42 20 Q39 28 37.4 38 M58 19 Q61 27 61.2 39 M54 17.6 Q55 26 54.6 40";

function CabeloTras({ c, cores }: { c: AvatarConfig; cores: Cores }) {
  const p = { fill: cores.cabelo, stroke: LINHA, strokeWidth: TRACO, strokeLinejoin: "round" as const };
  const fio = (d: string) => <path d={d} fill="none" stroke={LINHA} strokeWidth="0.55" opacity="0.5" strokeLinecap="round" />;
  switch (c.cabelo) {
    case "longo": return (
      <g>
        <path d="M30 48 C27 28 37 13 50 13 C63 13 73 28 70 48 L73.4 86 L69.4 82 L66.4 90 L63.4 84 L63 52 L37 52 L36.6 84 L33.6 90 L30.6 82 L26.6 86 Z" {...p} />
        {fio("M31 56 L29.6 80 M69 56 L70.4 80 M34 60 L33 84 M66 60 L67 84")}
      </g>
    );
    case "ondulado": return (
      <g>
        <path d="M30 48 C26 30 36 13 50 13 C64 13 74 30 70 48 C72.6 53 69 57.6 71.6 62 C68.6 64.6 64.6 63.6 63.4 60.4 L63 46 L37 46 L36.6 60.4 C35.4 63.6 31.4 64.6 28.4 62 C31 57.6 27.4 53 30 48 Z" {...p} />
        {fio("M31 52 Q29.6 56 31 60 M69 52 Q70.4 56 69 60")}
      </g>
    );
    case "chanel": return <path d="M28.4 61 C24 30 34.6 13 50 13 C65.4 13 76 30 71.6 61 L66 61.6 L64.6 60.4 L62.6 61.4 L63 44 L37 44 L37.4 61.4 L35.4 60.4 L34 61.6 Z" {...p} />;
    case "afro": return <path d={ondulado(circulo(50, 36, 26, 18), 4.6)} {...p} />;
    case "cacheado": return <path d={ondulado([[29, 58], ...circulo(50, 37, 22, 13, 160, 380), [71, 58], [64, 60], [36, 60]], 3.8)} {...p} />;
    case "rabo": return (
      <g>
        <path d="M63 30 C78.4 29 83.4 47 78 66 L74.6 60.6 L73.6 68.6 L70.2 58 C72.4 48 70.4 40 63.4 36.4 Z" {...p} />
        {fio("M66 33 C74 36 76 46 75 58")}
        <path d="M63.4 28.6 C65.6 27.6 67.4 29 67 31.6 C66.6 34 64 34.8 62.6 33 Z" fill="#ec4899" stroke={LINHA} strokeWidth="0.6" />
      </g>
    );
    case "trancas": return (
      <g>
        {[33, 67].map(x => (
          <g key={x}>
            {[0, 1, 2, 3, 4].map(i => (
              <path key={i} d={`M${x - 3.6} ${50 + i * 7} Q${x} ${46.4 + i * 7} ${x + 3.6} ${50 + i * 7} Q${x + 2.4} ${56.6 + i * 7} ${x} ${57 + i * 7} Q${x - 2.4} ${56.6 + i * 7} ${x - 3.6} ${50 + i * 7} Z`} {...p} strokeWidth="0.7" />
            ))}
            <path d={`M${x - 1.6} 85 L${x + 1.6} 85 L${x + 2.6} 90 L${x - 2.6} 90 Z`} {...p} strokeWidth="0.6" />
            <rect x={x - 2} y="83.6" width="4" height="1.8" rx="0.8" fill="#ec4899" />
          </g>
        ))}
      </g>
    );
    case "dreads": return (
      <g>
        {[28.4, 32.6, 36.8, 63.2, 67.4, 71.6].map((x, i) => <rect key={x} x={x - 2.2} y="28" width="4.4" height={44 + (i % 3) * 5} rx="2.2" {...p} strokeWidth="0.7" />)}
      </g>
    );
    case "coque": return (
      <g>
        <circle cx="50" cy="11.6" r="7.6" {...p} />
        {fio("M45 10 Q50 6 55 10 M46 14 Q50 11 54 14")}
      </g>
    );
    default: return null;
  }
}

function CabeloFrente({ c, cores }: { c: AvatarConfig; cores: Cores }) {
  switch (c.cabelo) {
    case "careca": return <ellipse cx="44" cy="25" rx="5.4" ry="2.4" fill="#fff" opacity="0.4" />;
    case "raspado": return (
      <g>
        <path d="M33 39 C33 26 40.6 18.6 50 18.6 C59.4 18.6 67 26 67 39 C63 33.6 57 30.6 50 30.6 C43 30.6 37 33.6 33 39 Z" fill={cores.cabelo} opacity="0.9" stroke={LINHA} strokeWidth="0.6" />
        <g fill={cores.cabeloEsc} opacity="0.6">{circulo(50, 30, 12, 14, 200, 340).map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y - 2} r="0.4" />)}</g>
      </g>
    );
    case "moicano": return (
      <g>
        <path d="M33 39 C33 26 40.6 18.6 50 18.6 C59.4 18.6 67 26 67 39 C63 33.6 57 30.6 50 30.6 C43 30.6 37 33.6 33 39 Z" fill={cores.cabelo} opacity="0.5" />
        <Mechas d="M44.4 31 L43.4 21 L46.4 23 L45.6 11 L49 15.6 L50.4 5.4 L52.4 15.4 L55.6 10.6 L55 22.6 L57.4 20.6 L56 31 Z" cores={cores} linhas="M50 8 L50 28 M47 16 L47.6 28 M53.4 15 L53 28" brilho={false} />
      </g>
    );
    case "topete": return (
      <g>
        <Mechas d={COPA + " L66.8 40 Q66 35.4 63.4 32.4 Q63 37 61.4 40.4 L38 40 Q36.6 37 36.6 33.4 Q35 37 33.4 41 Z"} cores={cores} brilho={false} />
        <Mechas d="M35.4 33 C34 19.6 45.6 10.6 60.6 12.6 C67.6 13.6 71 19 70 25.6 C66 21.4 60.6 21.2 56.4 24.4 C52 27.6 45.6 29.6 40 34.4 Z" cores={cores} linhas="M42 26 Q50 17 62 16 M45 29 Q54 21 64 20" />
      </g>
    );
    case "franja": return <Mechas d={COPA + FRANJA_RETA} cores={cores} linhas="M44 22 L43.6 42 M50 18 L50 42 M56 22 L56.4 42 M38.6 27 L38.4 42 M61.6 27 L61.8 42" />;
    case "chanel": return <Mechas d={COPA + FRANJA_RETA} cores={cores} linhas="M44 22 L43.6 42 M50 18 L50 42 M56 22 L56.4 42" />;
    case "longo": return (
      <g>
        <Mechas d={COPA + FRANJA_CORTINA} cores={cores} linhas="M46 22 Q40 30 36 44 M54 22 Q60 30 64 44" />
        <path d="M33.2 44 Q31.8 56 34 66.6 L36.6 60.6 Q35.8 52 36.8 44 Z M66.8 44 Q68.2 56 66 66.6 L63.4 60.6 Q64.2 52 63.2 44 Z" fill={cores.cabelo} stroke={LINHA} strokeWidth={TRACO} strokeLinejoin="round" />
      </g>
    );
    case "ondulado": return <Mechas d={COPA + FRANJA_LADO} cores={cores} linhas="M58 17 Q55 26 53 39 M50 16 Q46 24 42.6 31 M64 24 Q63 30 62 36" />;
    case "afro": return <Mechas d={ondulado([[33, 41], ...circulo(50, 41, 17, 9, 200, 340), [67, 41], [60, 36], [50, 34.6], [40, 36]], 3.2)} cores={cores} brilho={false} />;
    case "cacheado": return <Mechas d={ondulado([[33, 44], [34, 36], [39, 30], [45, 27], [51, 26.4], [57, 27.4], [62, 31], [66, 37], [67, 44], [63, 38.4], [57, 35], [50, 34], [43, 35], [37, 38.6]], 3.2)} cores={cores} brilho={false} />;
    case "coque": return <Mechas d={COPA + FRANJA_PRA_TRAS} cores={cores} linhas="M50 16 Q48 22 47 29.6 M42 19 Q40 25 38.6 33 M58 19 Q60 25 61.4 33" />;
    case "trancas": return <Mechas d={COPA + " L66.4 40 Q60 30.6 51 29.4 L50 22 L49 29.4 Q40 30.6 33.6 40 Z"} cores={cores} linhas="M44 20 Q40 26 38 34 M56 20 Q60 26 62 34" />;
    case "dreads": return (
      <g>
        <Mechas d={COPA + " L66.4 40 Q60 31 50 30 Q40 31 33.6 40 Z"} cores={cores} brilho={false} />
        {[38, 43, 48, 53, 58, 62].map((x, i) => <rect key={x} x={x - 1.8} y="28" width="3.6" height={11 + (i % 2) * 3} rx="1.8" fill={cores.cabelo} stroke={LINHA} strokeWidth="0.6" />)}
      </g>
    );
    case "rabo": return <Mechas d={COPA + FRANJA_LADO} cores={cores} linhas={LINHAS_FRANJA} />;
    default: return <Mechas d={COPA_ARREPIADA + FRANJA_PONTAS} cores={cores} linhas={LINHAS_FRANJA} />;
  }
}

// ---------------------------------------------------------------- capacete, acessórios e chapéus

function Capacete({ cor, brilho }: { cor: string; brilho: string }) {
  const escuro = tom(cor, -0.22);
  return (
    <g>
      <path d="M27 39 C27 20 38 9.5 50 9.5 C62 9.5 73 20 73 39 Z" fill={cor} stroke={LINHA} strokeWidth={TRACO} />
      <path d="M27 39 C27 20 38 9.5 50 9.5 C62 9.5 73 20 73 39 Z" fill={brilho} />
      <path d="M46.5 10 C48 9.6 52 9.6 53.5 10 L54.5 38.5 L45.5 38.5 Z" fill={tom(cor, 0.18)} stroke={escuro} strokeWidth="0.6" />
      <path d="M33 31 C34 22 39 16 45 13.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M62 14 C68 18 71 26 72 37 L66 37 C66 28 64 20 62 14 Z" fill="#000" opacity="0.1" />
      <path d="M22.5 40.5 C22.5 36.8 77.5 36.8 77.5 40.5 C77.5 43.6 22.5 43.6 22.5 40.5 Z" fill={escuro} stroke={LINHA} strokeWidth={TRACO} />
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
          <rect x={x - 4.5} y="42" width="9" height="13" rx="4" fill="#ef4444" stroke={LINHA} strokeWidth="0.9" />
          <rect x={x - 2.5} y="44.5" width="5" height="8" rx="2.5" fill="#fca5a5" opacity="0.5" />
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

function Acessorio({ c, tema }: { c: AvatarConfig; tema: DataComemorativa | null }) {
  if (tema === "carnaval" && c.acessorio.startsWith("oculos")) return null;
  switch (c.acessorio) {
    case "oculos": case "oculosSol": {
      const lente = c.acessorio === "oculosSol" ? "#111827" : "#e0f2fe";
      const op = c.acessorio === "oculosSol" ? 0.92 : 0.3;
      return (
        <g>
          <path d="M36.6 47 L31.6 45.6" stroke={LINHA} strokeWidth="1.1" /><path d="M63.4 47 L68.4 45.6" stroke={LINHA} strokeWidth="1.1" />
          {[42.4, 57.6].map(x => <rect key={x} x={x - 6} y="43.4" width="12" height="9" rx="3.4" fill={lente} fillOpacity={op} stroke={LINHA} strokeWidth="1.1" />)}
          <path d="M48.4 47 Q50 45.8 51.6 47" stroke={LINHA} strokeWidth="1.1" fill="none" />
          {c.acessorio === "oculosSol" && <path d="M38 45.6 L41 45 M53.4 45.6 L56.4 45" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" />}
        </g>
      );
    }
    case "oculosSeguranca":
      return (
        <g>
          <path d="M31.6 46 L35 45.4 M68.4 46 L65 45.4" stroke="#475569" strokeWidth="1.2" />
          <path d="M34.6 43.6 C40 42 60 42 65.4 43.6 L64.8 51.6 C60 53.6 54 53.2 50 51 C46 53.2 40 53.6 35.2 51.6 Z" fill="#bae6fd" fillOpacity="0.4" stroke="#64748b" strokeWidth="1" />
          <path d="M37.4 45 L44 44.2" stroke="#fff" strokeOpacity="0.8" strokeWidth="1" />
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
      return <g fill="#facc15" stroke="#a16207" strokeWidth="0.5"><circle cx="32.4" cy="54.6" r="1.3" /><circle cx="67.6" cy="54.6" r="1.3" /></g>;
    case "mascara":
      return (
        <g>
          <path d="M32 48 L39.4 53 M68 48 L60.6 53" stroke="#e2e8f0" strokeWidth="1" />
          <path d="M39 53.6 C39 50.4 61 50.4 61 53.6 L60.2 62.4 C56.4 68.6 43.6 68.6 39.8 62.4 Z" fill="#f8fafc" stroke={LINHA} strokeWidth="0.8" strokeLinejoin="round" />
          <circle cx="55" cy="61" r="2.2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
          <path d="M42.6 56 Q50 53.6 57.4 56" stroke="#cbd5e1" strokeWidth="0.7" fill="none" />
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
