import { CORES, type CelulaMapa } from "@/react-app/utils/loteCeramica";

const numero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Barras horizontais com o valor ao lado (m² por torre, por fornecedor). */
export function BarrasHorizontais({ dados, cor, unidade }: { dados: { nome: string; valor: number }[]; cor: string; unidade: string }) {
  const maior = Math.max(1, ...dados.map(d => d.valor));
  if (!dados.length) return <p className="py-6 text-center text-sm text-slate-400">Sem dados com os filtros atuais.</p>;
  return (
    <ul className="space-y-3">
      {dados.map(d => (
        <li key={d.nome}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-slate-700" title={d.nome}>{d.nome}</span>
            <span className="shrink-0 font-bold tabular-nums text-slate-800">{numero(d.valor, 1)} {unidade}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.valor / maior) * 100}%`, background: cor }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const COR_STATUS: Record<string, string> = {
  "Em estoque": CORES.cinza, "Em aplicação": CORES.azul, "Aplicado": CORES.agua, "Reprovado": CORES.alerta,
};

/** Rosca da distribuição por status, com a legenda ao lado. */
export function RoscaStatus({ dados }: { dados: { nome: string; valor: number }[] }) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const raio = 52;
  const circ = 2 * Math.PI * raio;
  let acumulado = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-label={`Distribuição por status: ${dados.map(d => `${d.nome} ${d.valor}`).join(", ")}`}>
        <circle cx="70" cy="70" r={raio} fill="none" stroke="#E2E8F0" strokeWidth="18" />
        {total > 0 && dados.filter(d => d.valor > 0).map(d => {
          const fatia = (d.valor / total) * circ;
          const el = (
            <circle key={d.nome} cx="70" cy="70" r={raio} fill="none" stroke={COR_STATUS[d.nome] ?? CORES.cinza} strokeWidth="18"
              strokeDasharray={`${fatia} ${circ - fatia}`} strokeDashoffset={-acumulado} transform="rotate(-90 70 70)" />
          );
          acumulado += fatia;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="fill-slate-800" style={{ fontSize: 26, fontWeight: 900 }}>{total}</text>
        <text x="70" y="86" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 11, fontWeight: 600 }}>lançamentos</text>
      </svg>
      <ul className="space-y-2 text-sm">
        {dados.map(d => (
          <li key={d.nome} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COR_STATUS[d.nome] ?? CORES.cinza }} />
            <span className="font-semibold text-slate-700">{d.nome}</span>
            <span className="ml-auto pl-4 font-bold tabular-nums text-slate-800">{d.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mapa de calor torre × pavimento: verde-água = um lote só; vermelho = mistura de lote, tom ou calibre. */
export function MapaDeCalor({ torres, pavimentos, celulas }: { torres: string[]; pavimentos: string[]; celulas: CelulaMapa[] }) {
  if (!torres.length) return <p className="py-6 text-center text-sm text-slate-400">Sem dados com os filtros atuais.</p>;
  const celula = (t: string, p: string) => celulas.find(c => c.torre === t && c.pavimento === p);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1.5 text-sm">
        <thead>
          <tr>
            <th className="w-36 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Pavimento</th>
            {torres.map(t => <th key={t} className="text-center text-xs font-bold uppercase tracking-wider text-slate-500">{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {[...pavimentos].reverse().map(p => (
            <tr key={p}>
              <th scope="row" className="whitespace-nowrap text-left text-xs font-semibold text-slate-600">{p}</th>
              {torres.map(t => {
                const c = celula(t, p);
                const vazio = !c || c.lotes === 0;
                const fundo = vazio ? "#F1F5F9" : c.misturado ? CORES.alerta : CORES.agua;
                const texto = vazio ? "sem aplicação" : c.misturado ? `${c.lotes} lote(s) · mistura` : `${c.lotes} lote · ok`;
                return (
                  <td key={t} title={`${t} · ${p}: ${texto}${c && !vazio ? ` · ${numero(c.aplicado, 1)} m² aplicados` : ""}`}
                    className="h-11 min-w-[7rem] rounded-lg text-center text-xs font-bold"
                    style={{ background: fundo, color: vazio ? "#94A3B8" : "#fff", opacity: vazio ? 1 : c.misturado ? 1 : 0.55 + Math.min(0.45, c.aplicado / 250) }}>
                    {vazio ? "—" : c.misturado ? "⚠ Mistura" : `${numero(c.aplicado, 0)} m²`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: CORES.agua }} />Um lote só (cor mais forte = mais m²)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: CORES.alerta }} />Mistura de lote, tonalidade ou calibre</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-100" />Sem aplicação</span>
      </div>
    </div>
  );
}
