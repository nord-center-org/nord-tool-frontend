import { useMemo, useState } from "react";

import { caminho, cicloDaFatura, dadosDoGrafico, type AreaGrafico, type LeituraGrafico, type PontoGrafico } from "@/react-app/utils/financeiroConta";
import { formatarMoeda } from "@/react-app/utils/casamento";

interface GraficoFaturaProps {
  leituras: LeituraGrafico[];
  competencia: string;
  diaFechamento: number;
  /** Valor esperado da fatura no fechamento (a projeção). */
  projetado: number | null;
}

const AREA: AreaGrafico = { largura: 640, altura: 240, esquerda: 56, direita: 28, superior: 16, inferior: 30 };
const COR = "#2563eb";

/** Evolução do valor da fatura no ciclo, com a projeção até o fechamento. Uma série só: sem legenda, o título nomeia. */
export default function GraficoFatura({ leituras, competencia, diaFechamento, projetado }: GraficoFaturaProps) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);
  const ciclo = useMemo(() => cicloDaFatura(competencia, diaFechamento), [competencia, diaFechamento]);
  const g = useMemo(() => dadosDoGrafico(leituras, ciclo, projetado, AREA), [leituras, ciclo, projetado]);

  const todos: PontoGrafico[] = g.projecao ? [...g.pontos, g.projecao] : g.pontos;
  const ultimo = g.pontos[g.pontos.length - 1];
  const base = AREA.altura - AREA.inferior;
  const ponto = ativo !== null ? todos[ativo] : null;

  if (g.pontos.length === 0) {
    return <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Ainda sem leituras neste ciclo. Atualize o valor da fatura para acompanhar o ritmo.</p>;
  }

  const aoMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - caixa.left) / caixa.width) * AREA.largura;
    let melhor = 0;
    todos.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(todos[melhor].x - x)) melhor = i; });
    setAtivo(melhor);
  };

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${AREA.largura} ${AREA.altura}`} className="h-auto w-full touch-pan-y" role="img"
          aria-label={`Fatura de ${diaMesRotulo(ciclo.inicio)} a ${diaMesRotulo(ciclo.fim)}: ${todos.length} pontos`}
          onPointerMove={aoMover} onPointerLeave={() => setAtivo(null)}>
          {g.yTicks.map(t => (
            <g key={t.valor}>
              <line x1={AREA.esquerda} x2={AREA.largura - AREA.direita} y1={t.y} y2={t.y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={AREA.esquerda - 8} y={t.y + 4} textAnchor="end" fontSize={11} fill="#64748b">{formatarEixo(t.valor)}</text>
            </g>
          ))}
          {g.xTicks.map((t, i) => (
            <text key={i} x={t.x} y={AREA.altura - 8} textAnchor={i === 0 ? "start" : i === g.xTicks.length - 1 ? "end" : "middle"} fontSize={11} fill="#64748b">{t.rotulo}</text>
          ))}
          <path d={`${caminho(g.pontos)} L${ultimo.x.toFixed(1)} ${base} L${g.pontos[0].x.toFixed(1)} ${base} Z`} fill={COR} opacity={0.1} />
          <path d={caminho(g.pontos)} fill="none" stroke={COR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {g.projecao && (
            <path d={caminho([ultimo, g.projecao])} fill="none" stroke={COR} strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" />
          )}
          {ponto && <line x1={ponto.x} x2={ponto.x} y1={AREA.superior} y2={base} stroke="#94a3b8" strokeWidth={1} />}
          {g.pontos.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === ativo ? 5 : 4} fill={COR} stroke="#fff" strokeWidth={2} />
          ))}
          {g.projecao && <circle cx={g.projecao.x} cy={g.projecao.y} r={ativo === todos.length - 1 ? 5 : 4} fill="#fff" stroke={COR} strokeWidth={2} />}
          {/* só as pontas levam número: o último valor lido e a projeção */}
          <text x={ultimo.x} y={ultimo.y - 10} textAnchor={ultimo.x > AREA.largura - 90 ? "end" : "middle"} fontSize={12} fontWeight={700} fill="#0f172a">{formatarMoeda(ultimo.valor)}</text>
          {g.projecao && <text x={g.projecao.x} y={g.projecao.y - 10} textAnchor="end" fontSize={12} fontWeight={700} fill="#0f172a">{formatarMoeda(g.projecao.valor)}</text>}
          {todos.map((p, i) => (
            <circle key={`alvo${i}`} cx={p.x} cy={p.y} r={14} fill="transparent" tabIndex={0}
              aria-label={`${p.tipo === "projecao" ? "Projeção" : "Leitura"} em ${p.rotulo}: ${formatarMoeda(p.valor)}`}
              onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} className="outline-none focus-visible:stroke-blue-600 focus-visible:stroke-2" />
          ))}
        </svg>
        {ponto && (
          <div className={`pointer-events-none absolute -translate-x-1/2 ${ponto.y < AREA.altura * 0.3 ? "" : "-translate-y-full"} rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg`}
            style={{ left: `${(ponto.x / AREA.largura) * 100}%`, top: `${(ponto.y / AREA.altura) * 100}%`, marginTop: ponto.y < AREA.altura * 0.3 ? 12 : -10 }}>
            <p className="font-bold">{formatarMoeda(ponto.valor)}</p>
            <p className="text-slate-300">{ponto.tipo === "projecao" ? `Projeção no fechamento (${ponto.rotulo})` : `Lido em ${ponto.rotulo}`}</p>
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{g.projecao ? "Tracejado: projeção até o fechamento" : "Sem projeção adicional"}</span>
        <button type="button" onClick={() => setTabela(v => !v)} className="font-bold text-blue-600 hover:underline">{tabela ? "Ocultar tabela" : "Ver em tabela"}</button>
      </div>
      {tabela && (
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-1">Data</th><th className="py-1">Tipo</th><th className="py-1 text-right">Valor</th></tr></thead>
          <tbody>
            {todos.map((p, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1">{p.rotulo}</td>
                <td className="py-1 text-slate-500">{p.tipo === "projecao" ? "Projeção" : "Leitura"}</td>
                <td className="py-1 text-right font-semibold tabular-nums">{formatarMoeda(p.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function diaMesRotulo(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function formatarEixo(v: number): string {
  return v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(v);
}
