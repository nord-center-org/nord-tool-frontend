import type { Ponto } from "@/react-app/utils/escadinha";
import { areaMedida, comprimentoTotal, distancia, fmtM, fmtM2 } from "@/react-app/utils/medicao";

interface CamadaMedicaoProps {
  pontos: Ponto[];
  /** Ponto que segue o mouse (prévia do próximo trecho). */
  cursor?: Ponto | null;
  /** Fecha o polígono e mostra área e perímetro. */
  area: boolean;
  fonte: number;
  traco: number;
}

/** Desenho da medição dentro do SVG da planta (coordenadas em metros, y para cima): trechos com cota, total ou área. */
export default function CamadaMedicao({ pontos, cursor, area, fonte, traco }: CamadaMedicaoProps) {
  const ps = cursor ? [...pontos, cursor] : pontos;
  if (!ps.length) return null;
  const svg = (p: Ponto) => `${p[0]},${-p[1]}`;
  const trechos = ps.slice(1).map((p, i) => ({ a: ps[i], b: p }));
  if (area && ps.length >= 3) trechos.push({ a: ps[ps.length - 1], b: ps[0] });
  const medida = area ? areaMedida(ps) : null;
  const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length, cy = ps.reduce((s, p) => s + p[1], 0) / ps.length;
  const rotulo = (chave: string, texto: string, x: number, y: number, cor = "#0f172a") => (
    <g key={chave} transform={`translate(${x} ${-y})`}>
      <rect x={-texto.length * fonte * 0.3} y={-fonte * 0.75} width={texto.length * fonte * 0.6} height={fonte * 1.5} rx={fonte * 0.3} fill="#fde047" opacity="0.95" />
      <text textAnchor="middle" dominantBaseline="middle" fontSize={fonte} fontWeight="800" fill={cor}>{texto}</text>
    </g>
  );
  return (
    <g style={{ pointerEvents: "none" }}>
      {area && ps.length >= 3 && <polygon points={ps.map(svg).join(" ")} fill="rgba(253,224,71,0.18)" />}
      <polyline points={[...ps, ...(area && ps.length >= 3 ? [ps[0]] : [])].map(svg).join(" ")} fill="none" stroke="#fde047" strokeWidth={traco * 2.2} strokeDasharray={cursor ? `${traco * 5} ${traco * 3}` : undefined} />
      {ps.map((p, i) => <circle key={i} cx={p[0]} cy={-p[1]} r={traco * 3} fill="#fde047" stroke="#0f172a" strokeWidth={traco} />)}
      {trechos.map((t, i) => distancia(t.a, t.b) > 0.05 && rotulo(`t${i}`, fmtM(distancia(t.a, t.b)), (t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2))}
      {medida && rotulo("area", `${fmtM2(medida.area)} · perím. ${fmtM(medida.perimetro)}`, cx, cy)}
      {!area && ps.length > 2 && rotulo("total", `Total ${fmtM(comprimentoTotal(ps))}`, ps[ps.length - 1][0], ps[ps.length - 1][1] + fonte * 2)}
    </g>
  );
}
