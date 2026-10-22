/** Resumo simples do mês no Financeiro: o que entrou, saiu, falta e onde mais se gastou (puro, testável). */

export interface LancamentoResumo {
  idLancamento: number;
  cdTipo: "ENTRADA" | "SAIDA";
  nmCategoria: string;
  vlLancamento: number;
  inRealizado: boolean;
  dtLancamento: string;
  dsLancamento: string | null;
}

export interface ResumoSimples {
  entrou: number;
  saiu: number;
  /** entradas − saídas do mês (previstas e realizadas). */
  sobra: number;
  faltaPagar: number;
  faltaReceber: number;
  /** % das entradas já comprometidas com saídas (0–100+; null sem entradas). */
  pctComprometido: number | null;
  maioresGastos: Array<{ categoria: string; valor: number; pct: number }>;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

export function resumirMes(lancamentos: LancamentoResumo[], topo = 5): ResumoSimples {
  let entrou = 0, saiu = 0, faltaPagar = 0, faltaReceber = 0;
  const porCategoria = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.cdTipo === "ENTRADA") {
      entrou += l.vlLancamento;
      if (!l.inRealizado) faltaReceber += l.vlLancamento;
    } else {
      saiu += l.vlLancamento;
      if (!l.inRealizado) faltaPagar += l.vlLancamento;
      porCategoria.set(l.nmCategoria, (porCategoria.get(l.nmCategoria) ?? 0) + l.vlLancamento);
    }
  }
  const maioresGastos = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, topo)
    .map(([categoria, valor]) => ({ categoria, valor: centavos(valor), pct: saiu > 0 ? Math.round((valor / saiu) * 100) : 0 }));
  return {
    entrou: centavos(entrou), saiu: centavos(saiu), sobra: centavos(entrou - saiu),
    faltaPagar: centavos(faltaPagar), faltaReceber: centavos(faltaReceber),
    pctComprometido: entrou > 0 ? Math.round((saiu / entrou) * 100) : null,
    maioresGastos,
  };
}

/** dd/MM/yyyy → número comparável (mais recente primeiro). */
const chaveData = (br: string) => { const [d, m, a] = br.split("/"); return Number(`${a}${m}${d}`) || 0; };

export function ultimos<T extends LancamentoResumo>(lancamentos: T[], n = 5): T[] {
  return [...lancamentos].sort((a, b) => chaveData(b.dtLancamento) - chaveData(a.dtLancamento) || b.idLancamento - a.idLancamento).slice(0, n);
}

/** Frase curta do mês para quem não quer ler números. */
export function fraseDoMes(r: ResumoSimples): string {
  if (r.entrou === 0 && r.saiu === 0) return "Nenhum lançamento neste mês ainda.";
  if (r.sobra < 0) return `Atenção: as saídas passam das entradas em ${Math.abs(r.sobra).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`;
  if (r.pctComprometido != null && r.pctComprometido >= 90) return "Quase tudo o que entrou já está comprometido.";
  return "As contas do mês estão no azul.";
}
