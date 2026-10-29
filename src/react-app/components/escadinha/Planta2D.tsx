import { useId, useMemo, useRef, type PointerEvent } from "react";

import { limites, pilares, type Apartamento, type Lado, type Pavimento, type Ponto, type Torre } from "@/react-app/utils/escadinha";
import CamadaMedicao from "./CamadaMedicao";
import { centroide, metades, COR_LADO } from "@/react-app/utils/escadinhaApto";


interface Planta2DProps {
  torre: Torre;
  pavimento: Pavimento | null;
  /** Versão miniatura (canto do visualizador): sem cotas, nomes nem interação. */
  mini?: boolean;
  /** Mostra a prancha original atrás do croqui. */
  comPrancha?: boolean;
  /** Imagem da prancha (data URL), quando já carregada. */
  imagem?: string | null;
  selecionados?: string[];
  onClicarApto?: (id: string, somar: boolean) => void;
  /** Duplo clique no apartamento: abre a vista dele. */
  onAbrirApto?: (id: string) => void;
  /** Medição em andamento (distância ou área). */
  medicao?: { pontos: Ponto[]; cursor?: Ponto | null; area: boolean } | null;
  /** Ponteiro na planta, em metros (para desenhar apartamento ou divisão). */
  onPonteiro?: (tipo: "inicio" | "movimento" | "fim", p: Ponto) => void;
  /** Rascunho sendo desenhado: retângulo ou linha. */
  rascunho?: { tipo: "retangulo" | "linha"; a: Ponto; b: Ponto } | null;
  cursor?: string;
}

const fmt = (m: number) => m.toFixed(2).replace(".", ",");

/**
 * Planta 2D do pavimento: croqui (contorno e pilares), apartamentos pintados pelo lado (A/B), divisão dos lados,
 * cotas gerais e, se houver, a prancha do projeto ao fundo. Coordenadas em metros, y para cima (no SVG, -y).
 */
export default function Planta2D({
  torre, pavimento, mini = false, comPrancha = true, imagem, selecionados = [], onClicarApto, onAbrirApto, medicao, onPonteiro, rascunho, cursor,
}: Planta2DProps) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const contorno = pavimento?.contorno ?? torre.contorno;
  const lim = limites(torre.contorno);
  const tipicoComParedes = !pavimento?.contorno && !!torre.paredes?.length;
  // Alvenaria estrutural não tem pilares: com as paredes do projeto, os pilares de croqui somem.
  const colunas = useMemo(() => (tipicoComParedes ? [] : pilares(contorno)), [contorno, tipicoComParedes]);
  const margem = mini ? 2 : Math.max(lim.largura, lim.profundidade) * 0.16;
  const vb = `${lim.minX - margem} ${-lim.maxY - margem} ${lim.largura + margem * 2} ${lim.profundidade + margem * 2}`;
  const pts = (c: Ponto[]) => c.map(([x, y]) => `${x},${-y}`).join(" ");
  const escala = Math.max(lim.largura, lim.profundidade);
  const traco = escala / (mini ? 90 : 220);
  const tipico = !pavimento?.contorno;
  const apartamentos: Apartamento[] = tipico ? torre.apartamentos ?? [] : [];
  const lados = tipico && torre.lados ? metades(torre.contorno, torre.lados) : null;

  // A prancha foi analisada em pixels: põe a imagem no mesmo sistema do croqui (metros, y para baixo).
  const prancha = torre.planta;
  const transformPrancha = useMemo(() => {
    if (!prancha) return "";
    const l = limites(prancha.contornoPx);
    const s = lim.largura / (l.largura || 1);
    return `scale(${s}) translate(${-(l.minX + l.maxX) / 2} ${-(l.minY + l.maxY) / 2})`;
  }, [prancha, lim.largura]);
  const cota = lim.profundidade * 0.06;
  const fonte = escala * 0.028;

  const paraMetros = (e: PointerEvent<SVGSVGElement>): Ponto | null => {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [Math.round(p.x * 10) / 10, Math.round(-p.y * 10) / 10];
  };
  const ponteiro = (tipo: "inicio" | "movimento" | "fim") => (e: PointerEvent<SVGSVGElement>) => {
    if (!onPonteiro) return;
    const p = paraMetros(e);
    if (!p) return;
    if (tipo === "inicio") e.currentTarget.setPointerCapture(e.pointerId);
    onPonteiro(tipo, p);
  };

  return (
    <svg ref={svg} viewBox={vb} className="h-full w-full touch-none select-none" role="img" aria-label={`Planta ${pavimento?.nome ?? "do pavimento tipo"}`}
      style={{ cursor }} onPointerDown={ponteiro("inicio")} onPointerMove={ponteiro("movimento")} onPointerUp={ponteiro("fim")}>
      <defs>
        <pattern id={`grade-${id}`} width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0 L0 0 0 1" fill="none" stroke="#1e293b" strokeWidth={traco * 0.6} />
        </pattern>
        <clipPath id={`recorte-${id}`}>
          <rect x={lim.minX - margem * 0.6} y={-lim.maxY - margem * 0.6} width={lim.largura + margem * 1.2} height={lim.profundidade + margem * 1.2} />
        </clipPath>
      </defs>
      <rect x={lim.minX - margem} y={-lim.maxY - margem} width={lim.largura + margem * 2} height={lim.profundidade + margem * 2} fill={`url(#grade-${id})`} />
      {prancha && imagem && comPrancha && tipico && (
        <g clipPath={`url(#recorte-${id})`} opacity={mini ? 0.35 : 0.45}>
          <image href={imagem} width={prancha.largura} height={prancha.altura} transform={transformPrancha}
            preserveAspectRatio="none" style={{ filter: "invert(1) hue-rotate(180deg)" }} />
        </g>
      )}
      {pavimento?.contorno && <polygon points={pts(torre.contorno)} fill="none" stroke="#475569" strokeWidth={traco} strokeDasharray={`${traco * 4} ${traco * 3}`} />}
      {lados && (Object.keys(lados) as Lado[]).map(l => (
        <polygon key={l} points={pts(lados[l])} fill={COR_LADO[l]} opacity={mini ? 0.12 : 0.08} />
      ))}
      <polygon points={pts(contorno)} fill={lados ? "none" : "rgba(251,146,60,0.12)"} stroke="#fb923c" strokeWidth={traco * 2} strokeLinejoin="round" />
      {apartamentos.map(ap => {
        const sel = selecionados.includes(ap.id);
        const [cx, cy] = centroide(ap.contorno);
        return (
          <g key={ap.id} onPointerDown={e => { if (!onClicarApto) return; e.stopPropagation(); onClicarApto(ap.id, e.shiftKey || e.ctrlKey || e.metaKey); }}
            onDoubleClick={e => { if (!onAbrirApto) return; e.stopPropagation(); onAbrirApto(ap.id); }}
            style={{ cursor: onClicarApto ? "pointer" : undefined }}>
            <polygon points={pts(ap.contorno)} fill={COR_LADO[ap.lado]} fillOpacity={sel ? 0.55 : mini ? 0.3 : 0.22}
              stroke={sel ? "#fff" : COR_LADO[ap.lado]} strokeWidth={traco * (sel ? 2.4 : 1)} strokeLinejoin="round" />
            {!mini && (
              <text x={cx} y={-cy} textAnchor="middle" dominantBaseline="middle" fontSize={fonte} fontWeight="800" fill="#f8fafc" style={{ pointerEvents: "none" }}>
                {ap.nome.replace(/^Apto\s*/, "")}
                <tspan x={cx} dy={fonte * 1.1} fontSize={fonte * 0.7} fill={COR_LADO[ap.lado]}>{ap.lado}</tspan>
              </text>
            )}
          </g>
        );
      })}
      {tipicoComParedes && (
        <g style={{ pointerEvents: "none" }} opacity={mini ? 0.7 : 0.95}>
          {torre.paredes!.map((p, i) => (
            <line key={i} x1={p.a[0]} y1={-p.a[1]} x2={p.b[0]} y2={-p.b[1]} stroke={p.esp <= 0.09 ? "#facc15" : "#e2e8f0"} strokeWidth={Math.max(p.esp, traco)} />
          ))}
        </g>
      )}
      {colunas.map(([x, y], i) => (
        <rect key={i} x={x - 0.25} y={-y - 0.25} width="0.5" height="0.5" fill="#e2e8f0" style={{ pointerEvents: "none" }} />
      ))}
      {lados && torre.lados && !mini && (
        <g style={{ pointerEvents: "none" }}>
          <line x1={torre.lados.a[0]} y1={-torre.lados.a[1]} x2={torre.lados.b[0]} y2={-torre.lados.b[1]} stroke="#f8fafc" strokeWidth={traco * 1.4}
            strokeDasharray={`${traco * 6} ${traco * 4}`} />
          {(Object.keys(lados) as Lado[]).map(l => {
            if (lados[l].length < 3) return null;
            // Rótulo logo acima da metade (fora dos apartamentos), centrado nela.
            const [x] = centroide(lados[l]);
            const topo = Math.max(...lados[l].map(p => p[1]));
            return (
              <g key={l} transform={`translate(${x} ${-(topo + fonte * 1.4)})`}>
                <rect x={-fonte * 2.6} y={-fonte * 0.9} width={fonte * 5.2} height={fonte * 1.8} rx={fonte * 0.5} fill={COR_LADO[l]} opacity="0.9" />
                <text textAnchor="middle" dominantBaseline="middle" fontSize={fonte} fontWeight="900" fill="#0f172a">Lado {l}</text>
              </g>
            );
          })}
        </g>
      )}
      {rascunho?.tipo === "retangulo" && (
        <rect x={Math.min(rascunho.a[0], rascunho.b[0])} y={-Math.max(rascunho.a[1], rascunho.b[1])}
          width={Math.abs(rascunho.b[0] - rascunho.a[0])} height={Math.abs(rascunho.b[1] - rascunho.a[1])}
          fill="rgba(255,255,255,0.12)" stroke="#fff" strokeWidth={traco * 1.5} strokeDasharray={`${traco * 4} ${traco * 3}`} />
      )}
      {rascunho?.tipo === "linha" && (
        <line x1={rascunho.a[0]} y1={-rascunho.a[1]} x2={rascunho.b[0]} y2={-rascunho.b[1]} stroke="#fff" strokeWidth={traco * 2} strokeDasharray={`${traco * 5} ${traco * 3}`} />
      )}
      {medicao && <CamadaMedicao pontos={medicao.pontos} cursor={medicao.cursor} area={medicao.area} fonte={fonte * 0.8} traco={traco} />}
      {!mini && (
        <g fill="#cbd5e1" fontSize={fonte} fontWeight="700" textAnchor="middle" style={{ pointerEvents: "none" }}>
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
