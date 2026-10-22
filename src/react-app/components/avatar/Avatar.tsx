import { useId } from "react";

import {
  CORES_CABELO, FUNCOES, FUNDOS, PELES, type AvatarConfig, type DataComemorativa,
} from "@/react-app/utils/avatar";

interface AvatarProps {
  config: AvatarConfig;
  /** Tema da data comemorativa a vestir (null = roupa normal). */
  tema?: DataComemorativa | null;
  tamanho?: number;
  /** Nome para leitores de tela; sem nome o desenho é decorativo. */
  rotulo?: string;
  className?: string;
}

const TINTA = "#1e293b";

/** Avatar em SVG (100×100): fundo, corpo com a roupa da função, rosto, cabelo, capacete e o tema da época. */
export default function Avatar({ config: c, tema = null, tamanho = 64, rotulo, className }: AvatarProps) {
  const id = useId().replace(/:/g, "");
  const pele = PELES[c.pele];
  const cabelo = CORES_CABELO[c.cabelo === "careca" ? "preto" : c.corCabelo];
  const funcao = FUNCOES[c.funcao];
  const chapeuDoTema = tema === "natal" || tema === "anoNovo" || tema === "junina" || tema === "halloween";
  const comCapacete = c.capacete && !chapeuDoTema;

  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} className={className}
      role={rotulo ? "img" : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      <defs>
        <clipPath id={`av-${id}`}><circle cx="50" cy="50" r="50" /></clipPath>
      </defs>
      <g clipPath={`url(#av-${id})`}>
        <rect width="100" height="100" fill={FUNDOS[c.fundo]} />
        {tema === "junina" && <Bandeirinhas />}
        {(tema === "anoNovo" || tema === "carnaval") && <Confete />}

        {/* Corpo */}
        <rect x="44" y="58" width="12" height="14" fill={pele} />
        <path d="M14 100 C14 78 30 70 50 70 C70 70 86 78 86 100 Z" fill={funcao.camisa} />
        <path d="M43 70 L57 70 L50 78 Z" fill={pele} />
        <RoupaExtra extra={funcao.extra} engenheiro={c.funcao === "engenheiro"} />

        {tema === "pascoa" && (
          <g>
            <g transform="rotate(-14 40 20)"><ellipse cx="40" cy="14" rx="5.5" ry="14" fill="#fff" /><ellipse cx="40" cy="15" rx="2.6" ry="10" fill="#f9a8d4" /></g>
            <g transform="rotate(14 60 20)"><ellipse cx="60" cy="14" rx="5.5" ry="14" fill="#fff" /><ellipse cx="60" cy="15" rx="2.6" ry="10" fill="#f9a8d4" /></g>
          </g>
        )}

        {/* Cabelo de trás */}
        {c.cabelo === "longo" && <path d="M31 44 C31 22 69 22 69 44 L71 72 C64 76 36 76 29 72 Z" fill={cabelo} />}

        {/* Cabeça */}
        <circle cx="33" cy="48" r="4" fill={pele} />
        <circle cx="67" cy="48" r="4" fill={pele} />
        <ellipse cx="50" cy="46" rx="17" ry="19" fill={pele} />
        {c.cabelo === "careca" && !comCapacete && <ellipse cx="44" cy="32" rx="5" ry="2.5" fill="#fff" opacity="0.35" />}
        <circle cx="39" cy="54" r="3" fill="#f472b6" opacity="0.3" />
        <circle cx="61" cy="54" r="3" fill="#f472b6" opacity="0.3" />

        <Barba barba={c.barba} cor={cabelo} />
        {tema === "carnaval" && (
          <path d="M33 44 Q42 39 50 45 Q58 39 67 44 Q67 53 58 52 Q53 51 50 48.5 Q47 51 42 52 Q33 53 33 44 Z" fill="#a21caf" stroke="#facc15" strokeWidth="0.8" />
        )}
        <Olhos olhos={c.olhos} />
        {c.cabelo !== "careca" && (
          <g stroke={cabelo} strokeWidth="1.6" strokeLinecap="round">
            <path d="M39.5 41.5 Q43 40 46 41.5" fill="none" />
            <path d="M54 41.5 Q57 40 60.5 41.5" fill="none" />
          </g>
        )}
        <Boca boca={c.boca} />

        <CabeloFrente cabelo={c.cabelo} cor={cabelo} comCapacete={comCapacete} />

        {comCapacete && (
          <g>
            <path d="M31 41 C31 24 40 18 50 18 C60 18 69 24 69 41 Z" fill={funcao.capacete} stroke={TINTA} strokeOpacity="0.18" />
            <rect x="47.5" y="19" width="5" height="21" rx="2" fill={TINTA} opacity="0.1" />
            <path d="M36 34 C37 27 41 23 46 22" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
            <rect x="27" y="39" width="46" height="5" rx="2.5" fill={funcao.capacete} stroke={TINTA} strokeOpacity="0.18" />
          </g>
        )}
        {tema === "natal" && (
          <g>
            <path d="M31 40 Q35 18 58 16 Q73 18 79 34 Q70 28 62 28 Q68 33 69 40 Z" fill="#dc2626" />
            <rect x="29" y="36" width="42" height="7" rx="3.5" fill="#fff" />
            <circle cx="79" cy="35" r="4.5" fill="#fff" />
          </g>
        )}
        {tema === "anoNovo" && (
          <g>
            <path d="M39 33 L50 6 L61 33 Z" fill="#facc15" />
            <path d="M42.5 25 L57.5 25 M45.5 17 L54.5 17" stroke="#ec4899" strokeWidth="2.5" />
            <circle cx="50" cy="6" r="3" fill="#ec4899" />
          </g>
        )}
        {tema === "junina" && (
          <g>
            <ellipse cx="50" cy="38" rx="27" ry="6" fill="#eab308" />
            <path d="M37 38 C37 23 63 23 63 38 Z" fill="#ca8a04" />
            <rect x="37" y="33" width="26" height="3.5" fill="#dc2626" />
          </g>
        )}
        {tema === "halloween" && (
          <g>
            <ellipse cx="50" cy="38" rx="26" ry="5" fill="#1e1b4b" />
            <path d="M36 38 L55 3 L64 38 Z" fill="#312e81" />
            <rect x="37.5" y="31" width="25" height="4" fill="#f97316" />
          </g>
        )}
      </g>
    </svg>
  );
}

function RoupaExtra({ extra, engenheiro }: { extra: string; engenheiro: boolean }) {
  if (extra === "colete") {
    const cor = engenheiro ? "#84cc16" : "#f97316";
    return (
      <g>
        <path d="M21 100 L25 79 L41 72 L44 100 Z" fill={cor} />
        <path d="M79 100 L75 79 L59 72 L56 100 Z" fill={cor} />
        <path d="M23 89 L43.5 89 M56.5 89 L77 89" stroke="#fef9c3" strokeWidth="3" />
      </g>
    );
  }
  if (extra === "prancheta") {
    return (
      <g transform="rotate(-8 66 90)">
        <rect x="58" y="80" width="16" height="20" rx="2" fill="#a16207" />
        <rect x="60" y="84" width="12" height="15" fill="#fff" />
        <rect x="62.5" y="78.5" width="7" height="4" rx="1" fill="#94a3b8" />
        <path d="M62 88 H70 M62 91.5 H70 M62 95 H67" stroke="#94a3b8" strokeWidth="1" />
      </g>
    );
  }
  if (extra === "raio") return <path d="M37 79 L31 89 L35.5 89 L33 97 L41 86 L36.5 86 L39 79 Z" fill="#facc15" />;
  if (extra === "cruz") {
    return (
      <g>
        <circle cx="36" cy="87" r="5.5" fill="#fff" />
        <rect x="34.6" y="83.5" width="2.8" height="7" fill="#16a34a" />
        <rect x="32.5" y="85.6" width="7" height="2.8" fill="#16a34a" />
      </g>
    );
  }
  return (
    <g>
      <path d="M45 71 L47 84 M55 71 L53 84" stroke="#ef4444" strokeWidth="1.4" />
      <rect x="44" y="84" width="12" height="9" rx="1.5" fill="#fff" />
      <rect x="46" y="86" width="4" height="5" rx="0.8" fill="#93c5fd" />
      <path d="M51.5 87 H54.5 M51.5 89.5 H54" stroke="#94a3b8" strokeWidth="1" />
    </g>
  );
}

function Olhos({ olhos }: { olhos: AvatarConfig["olhos"] }) {
  const aberto = (x: number) => (
    <g key={x}>
      <circle cx={x} cy="47" r="2.3" fill={TINTA} />
      <circle cx={x + 0.8} cy="46.2" r="0.7" fill="#fff" />
    </g>
  );
  const fechado = (x: number) => <path key={x} d={`M${x - 2.5} 47.5 Q${x} 44.5 ${x + 2.5} 47.5`} stroke={TINTA} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  if (olhos === "feliz") return <g>{fechado(43)}{fechado(57)}</g>;
  if (olhos === "piscando") return <g>{aberto(43)}{fechado(57)}</g>;
  return (
    <g>
      {aberto(43)}{aberto(57)}
      {olhos === "oculos" && (
        <g stroke={TINTA} strokeWidth="1.3" fill="#fff" fillOpacity="0.2">
          <circle cx="43" cy="47" r="5" />
          <circle cx="57" cy="47" r="5" />
          <path d="M48 47 H52 M38 46 L34 45 M62 46 L66 45" fill="none" />
        </g>
      )}
    </g>
  );
}

function Boca({ boca }: { boca: AvatarConfig["boca"] }) {
  if (boca === "aberta") return <path d="M45 56.5 Q50 63.5 55 56.5 Z" fill="#7f1d1d" />;
  if (boca === "seria") return <path d="M46 58 H54" stroke="#7f1d1d" strokeWidth="1.6" strokeLinecap="round" />;
  return <path d="M45 57 Q50 61.5 55 57" stroke="#7f1d1d" strokeWidth="1.6" fill="none" strokeLinecap="round" />;
}

function Barba({ barba, cor }: { barba: AvatarConfig["barba"]; cor: string }) {
  if (barba === "nenhuma") return null;
  const bigode = <path d="M41 56 Q45 52.5 50 54.5 Q55 52.5 59 56 Q55 55.5 50 56.5 Q45 55.5 41 56 Z" fill={cor} />;
  if (barba === "bigode") return bigode;
  if (barba === "cavanhaque") return <g>{bigode}<ellipse cx="50" cy="63.5" rx="4" ry="3" fill={cor} /></g>;
  return <g><path d="M33 48 C33 62 40 67 50 67 C60 67 67 62 67 48 C64 58 58 61.5 50 61.5 C42 61.5 36 58 33 48 Z" fill={cor} />{bigode}</g>;
}

function CabeloFrente({ cabelo, cor, comCapacete }: { cabelo: AvatarConfig["cabelo"]; cor: string; comCapacete: boolean }) {
  const topo = "M32 44 C31 28 42 24 50 24 C60 24 69 29 68 44 C64 36 58 33 50 33 C42 33 36 36 32 44 Z";
  switch (cabelo) {
    case "careca": return null;
    case "raspado": return <path d={topo} fill={cor} opacity="0.45" />;
    case "moicano": return <g><path d={topo} fill={cor} opacity="0.35" /><path d="M45 26 C46 14 54 14 55 26 L55 34 L45 34 Z" fill={cor} /></g>;
    case "cacheado":
      return (
        <g fill={cor}>
          {[[33, 40], [37, 32], [44, 27], [51, 26], [58, 27], [64, 32], [67, 40]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6" />)}
        </g>
      );
    case "coque": return <g fill={cor}><path d={topo} />{!comCapacete && <circle cx="50" cy="20" r="7" />}</g>;
    default: return <path d={topo} fill={cor} />;
  }
}

function Bandeirinhas() {
  const cores = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ec4899", "#f97316"];
  return (
    <g>
      <path d="M0 6 Q50 16 100 6" stroke="#78350f" strokeWidth="0.8" fill="none" />
      {cores.map((cor, i) => {
        const x = 8 + i * 16.5;
        const y = 6 + 10 * (1 - ((x - 50) / 50) ** 2) * 0.95;
        return <path key={cor} d={`M${x - 4} ${y - 1} L${x + 4} ${y - 1} L${x} ${y + 7} Z`} fill={cor} />;
      })}
    </g>
  );
}

function Confete() {
  const pontos: [number, number, string][] = [[12, 20, "#ec4899"], [86, 16, "#facc15"], [20, 62, "#22c55e"], [82, 58, "#3b82f6"], [10, 40, "#f97316"], [90, 38, "#a855f7"]];
  return <g>{pontos.map(([x, y, cor]) => <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3.5" rx="0.8" fill={cor} transform={`rotate(${x} ${x} ${y})`} />)}</g>;
}
