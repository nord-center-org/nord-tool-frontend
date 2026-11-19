/**
 * Controle de Lote de Cerâmica: regras puras (sem React, testáveis em node). Indicadores, saldo por lote e o alerta
 * de mistura (lotes, tonalidades ou calibres diferentes aplicados no mesmo pavimento ou apartamento).
 */

/** Cores da Cury usadas na aba (azul-marinho, azul e verde-água) e as de alerta. */
export const CORES = { marinho: "#082078", azul: "#1A35E6", agua: "#2FC7B2", alerta: "#E5484D", aviso: "#F59E0B", cinza: "#94A3B8" };

export const STATUS_LOTE = ["Em estoque", "Em aplicação", "Aplicado", "Reprovado"] as const;
export type StatusLote = (typeof STATUS_LOTE)[number];

export interface LoteCeramica {
  id: string;
  torre: string;
  pavimento: string;
  ambiente: string;
  fornecedor: string;
  produto: string;
  lote: string;
  tonalidade: string;
  calibre: string;
  dataFabricacao: string;
  dataRecebimento: string;
  qtdRecebida: number;
  qtdAplicada: number;
  notaFiscal: string;
  status: StatusLote;
  observacoes: string;
}

export type LoteCeramicaForm = Omit<LoteCeramica, "id">;

export const LOTE_VAZIO: LoteCeramicaForm = {
  torre: "", pavimento: "", ambiente: "", fornecedor: "", produto: "", lote: "", tonalidade: "", calibre: "",
  dataFabricacao: "", dataRecebimento: "", qtdRecebida: 0, qtdAplicada: 0, notaFiscal: "", status: "Em estoque", observacoes: "",
};

/** Saldo abaixo deste percentual do recebido (ou até 5 m²) é saldo baixo. */
export const PERCENTUAL_SALDO_BAIXO = 0.1;
export const SALDO_BAIXO_M2 = 5;

export const saldo = (l: Pick<LoteCeramica, "qtdRecebida" | "qtdAplicada">) => round2((l.qtdRecebida || 0) - (l.qtdAplicada || 0));

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function saldoBaixo(recebido: number, aplicado: number): boolean {
  if (recebido <= 0) return false;
  const s = recebido - aplicado;
  return s <= Math.max(SALDO_BAIXO_M2, recebido * PERCENTUAL_SALDO_BAIXO);
}

/** Valida o formulário; devolve a mensagem do primeiro problema (ou null). */
export function validar(f: LoteCeramicaForm): string | null {
  if (!f.torre.trim()) return "Informe a torre.";
  if (!f.pavimento.trim()) return "Informe o pavimento.";
  if (!f.fornecedor.trim()) return "Informe o fornecedor.";
  if (!f.lote.trim()) return "Informe o número do lote.";
  if (!(f.qtdRecebida >= 0) || !(f.qtdAplicada >= 0)) return "As quantidades não podem ser negativas.";
  if (f.qtdAplicada > f.qtdRecebida) return "A quantidade aplicada não pode passar da recebida.";
  if (f.dataFabricacao && f.dataRecebimento && f.dataRecebimento < f.dataFabricacao) return "O recebimento não pode ser antes da fabricação.";
  return null;
}

/** Só conta para mistura o que foi (ou está sendo) aplicado: estoque e reprovado ainda não estão na parede. */
const naObra = (l: LoteCeramica) => l.status === "Aplicado" || l.status === "Em aplicação";

const chave = (...p: string[]) => p.map(s => s.trim().toUpperCase()).join("|");

export interface AlertaMistura {
  local: string;
  torre: string;
  pavimento: string;
  ambiente?: string;
  /** O que difere: lote, tonalidade e/ou calibre. */
  motivos: ("lote" | "tonalidade" | "calibre")[];
  lotes: string[];
  tonalidades: string[];
  calibres: string[];
  ids: string[];
}

function conferir(grupo: LoteCeramica[]): AlertaMistura["motivos"] {
  const distintos = (f: (l: LoteCeramica) => string) => new Set(grupo.map(f).map(s => s.trim().toUpperCase()).filter(Boolean)).size > 1;
  const m: AlertaMistura["motivos"] = [];
  if (distintos(l => l.lote)) m.push("lote");
  if (distintos(l => l.tonalidade)) m.push("tonalidade");
  if (distintos(l => l.calibre)) m.push("calibre");
  return m;
}

const unicos = (v: string[]) => [...new Set(v.map(s => s.trim()).filter(Boolean))];

/**
 * Mistura no mesmo pavimento (torre + pavimento) ou no mesmo apartamento/ambiente (torre + pavimento + ambiente).
 * Um apartamento com mistura não gera um segundo alerta se o pavimento dele já tem a mesma mistura.
 */
export function alertasDeMistura(lista: LoteCeramica[]): AlertaMistura[] {
  const aplicados = lista.filter(naObra);
  const porPavimento = new Map<string, LoteCeramica[]>();
  for (const l of aplicados) {
    const k = chave(l.torre, l.pavimento);
    porPavimento.set(k, [...(porPavimento.get(k) ?? []), l]);
  }
  const alertas: AlertaMistura[] = [];
  for (const grupo of porPavimento.values()) {
    const motivos = conferir(grupo);
    if (motivos.length) {
      alertas.push({
        local: `${grupo[0].torre} · ${grupo[0].pavimento}`, torre: grupo[0].torre, pavimento: grupo[0].pavimento, motivos,
        lotes: unicos(grupo.map(l => l.lote)), tonalidades: unicos(grupo.map(l => l.tonalidade)), calibres: unicos(grupo.map(l => l.calibre)),
        ids: grupo.map(l => l.id),
      });
      continue;
    }
    // Pavimento sem mistura: confere cada apartamento/ambiente (pode haver mistura dentro dele com o mesmo lote em outro ambiente).
    const porAmbiente = new Map<string, LoteCeramica[]>();
    for (const l of grupo) {
      if (!l.ambiente.trim()) continue;
      const k = chave(l.ambiente);
      porAmbiente.set(k, [...(porAmbiente.get(k) ?? []), l]);
    }
    for (const g of porAmbiente.values()) {
      const m = conferir(g);
      if (m.length) alertas.push({
        local: `${g[0].torre} · ${g[0].pavimento} · ${g[0].ambiente}`, torre: g[0].torre, pavimento: g[0].pavimento, ambiente: g[0].ambiente, motivos: m,
        lotes: unicos(g.map(l => l.lote)), tonalidades: unicos(g.map(l => l.tonalidade)), calibres: unicos(g.map(l => l.calibre)), ids: g.map(l => l.id),
      });
    }
  }
  return alertas.sort((a, b) => a.local.localeCompare(b.local, "pt-BR", { numeric: true }));
}

export interface Indicadores {
  totalLotes: number;
  recebido: number;
  aplicado: number;
  saldo: number;
  alertas: number;
}

export function indicadores(lista: LoteCeramica[]): Indicadores {
  const recebido = round2(lista.filter(l => l.status !== "Reprovado").reduce((s, l) => s + (l.qtdRecebida || 0), 0));
  const aplicado = round2(lista.reduce((s, l) => s + (l.qtdAplicada || 0), 0));
  return {
    totalLotes: new Set(lista.map(l => chave(l.fornecedor, l.lote))).size,
    recebido, aplicado, saldo: round2(recebido - aplicado),
    alertas: alertasDeMistura(lista).length,
  };
}

export interface SaldoDoLote { lote: string; fornecedor: string; produto: string; recebido: number; aplicado: number; saldo: number; baixo: boolean }

/** Saldo de cada lote (fornecedor + número), somando todos os lançamentos dele. Reprovados ficam de fora. */
export function saldoPorLote(lista: LoteCeramica[]): SaldoDoLote[] {
  const mapa = new Map<string, SaldoDoLote>();
  for (const l of lista) {
    if (l.status === "Reprovado") continue;
    const k = chave(l.fornecedor, l.lote);
    const s = mapa.get(k) ?? { lote: l.lote, fornecedor: l.fornecedor, produto: l.produto, recebido: 0, aplicado: 0, saldo: 0, baixo: false };
    s.recebido = round2(s.recebido + (l.qtdRecebida || 0));
    s.aplicado = round2(s.aplicado + (l.qtdAplicada || 0));
    mapa.set(k, s);
  }
  return [...mapa.values()]
    .map(s => ({ ...s, saldo: round2(s.recebido - s.aplicado), baixo: saldoBaixo(s.recebido, s.aplicado) }))
    .sort((a, b) => a.saldo - b.saldo);
}

/** Soma por uma chave (ex.: m² aplicados por torre), em ordem natural da chave. */
export function somarPor(lista: LoteCeramica[], chaveDe: (l: LoteCeramica) => string, valor: (l: LoteCeramica) => number): { nome: string; valor: number }[] {
  const m = new Map<string, number>();
  for (const l of lista) {
    const k = chaveDe(l).trim() || "—";
    m.set(k, round2((m.get(k) ?? 0) + valor(l)));
  }
  return [...m.entries()].map(([nome, v]) => ({ nome, valor: v })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
}

export const contarPorStatus = (lista: LoteCeramica[]) =>
  STATUS_LOTE.map(s => ({ nome: s, valor: lista.filter(l => l.status === s).length }));

export interface CelulaMapa { torre: string; pavimento: string; lotes: number; misturado: boolean; aplicado: number }

/** Mapa de calor torre × pavimento: quantos lotes diferentes foram aplicados e se há mistura. */
export function mapaDeCalor(lista: LoteCeramica[]): { torres: string[]; pavimentos: string[]; celulas: CelulaMapa[] } {
  const ordem = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });
  const torres = unicos(lista.map(l => l.torre)).sort(ordem);
  const pavimentos = unicos(lista.map(l => l.pavimento)).sort(ordem);
  const alertas = alertasDeMistura(lista);
  const celulas: CelulaMapa[] = [];
  for (const t of torres) for (const p of pavimentos) {
    const doLocal = lista.filter(l => naObra(l) && chave(l.torre) === chave(t) && chave(l.pavimento) === chave(p));
    celulas.push({
      torre: t, pavimento: p,
      lotes: new Set(doLocal.map(l => chave(l.lote))).size,
      misturado: alertas.some(a => chave(a.torre) === chave(t) && chave(a.pavimento) === chave(p)),
      aplicado: round2(doLocal.reduce((s, l) => s + (l.qtdAplicada || 0), 0)),
    });
  }
  return { torres, pavimentos, celulas };
}

export interface FiltrosLote { busca: string; torre: string; pavimento: string; fornecedor: string; lote: string; status: string }

export const FILTROS_VAZIOS: FiltrosLote = { busca: "", torre: "", pavimento: "", fornecedor: "", lote: "", status: "" };

export function filtrar(lista: LoteCeramica[], f: FiltrosLote): LoteCeramica[] {
  const t = f.busca.trim().toLowerCase();
  return lista.filter(l =>
    (!f.torre || l.torre === f.torre) && (!f.pavimento || l.pavimento === f.pavimento) && (!f.fornecedor || l.fornecedor === f.fornecedor)
    && (!f.lote || l.lote === f.lote) && (!f.status || l.status === f.status)
    && (!t || [l.torre, l.pavimento, l.ambiente, l.fornecedor, l.produto, l.lote, l.tonalidade, l.calibre, l.notaFiscal, l.observacoes]
      .some(v => v.toLowerCase().includes(t))));
}

/** Os valores distintos de um campo, para os filtros. */
export const opcoes = (lista: LoteCeramica[], campo: keyof LoteCeramica) =>
  unicos(lista.map(l => String(l[campo] ?? ""))).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

/** Registros de exemplo (fictícios, sem nenhum dado de cliente) para a tela abrir com dados. */
export function exemplos(): LoteCeramica[] {
  const F1 = "Cerâmica Exemplo Alfa (fictício)";
  const F2 = "Revestimentos Demo Beta (fictício)";
  const F3 = "Porcelanato Teste Gama (fictício)";
  const P1 = "Porcelanato 60x60 Cinza Acetinado (exemplo)";
  const P2 = "Piso 45x45 Bege Rústico (exemplo)";
  const P3 = "Revestimento 30x60 Branco Brilho (exemplo)";
  const r = (id: number, torre: string, pavimento: string, ambiente: string, fornecedor: string, produto: string, lote: string, tonalidade: string,
    calibre: string, fab: string, rec: string, recebida: number, aplicada: number, nf: string, status: StatusLote, obs = ""): LoteCeramica => ({
    id: `ex-${id}`, torre, pavimento, ambiente, fornecedor, produto, lote, tonalidade, calibre, dataFabricacao: fab, dataRecebimento: rec,
    qtdRecebida: recebida, qtdAplicada: aplicada, notaFiscal: nf, status, observacoes: obs,
  });
  return [
    r(1, "Torre A", "1º pavimento", "Apto 11 · Sala", F1, P1, "LT-1001", "T1", "C1", "2026-08-04", "2026-09-02", 120, 118, "NF-0001 (exemplo)", "Aplicado"),
    r(2, "Torre A", "2º pavimento", "Apto 21 · Cozinha", F1, P1, "LT-1001", "T1", "C1", "2026-08-04", "2026-09-02", 110, 105, "NF-0001 (exemplo)", "Aplicado"),
    r(3, "Torre A", "3º pavimento", "Apto 31 · Sala", F1, P1, "LT-1001", "T1", "C1", "2026-08-04", "2026-09-02", 100, 96, "NF-0001 (exemplo)", "Aplicado"),
    r(4, "Torre A", "3º pavimento", "Apto 32 · Sala", F1, P1, "LT-1007", "T2", "C1", "2026-09-10", "2026-10-01", 100, 64, "NF-0014 (exemplo)", "Em aplicação",
      "Lote novo entrou no mesmo pavimento: conferir a tonalidade antes de seguir."),
    r(5, "Torre A", "4º pavimento", "Apto 41 · Banheiro", F3, P3, "LT-3002", "B1", "C2", "2026-08-20", "2026-09-15", 80, 30, "NF-0021 (exemplo)", "Em aplicação"),
    r(6, "Torre A", "5º pavimento", "Estoque do canteiro", F1, P1, "LT-1007", "T2", "C1", "2026-09-10", "2026-10-01", 150, 0, "NF-0014 (exemplo)", "Em estoque"),
    r(7, "Torre B", "1º pavimento", "Apto 11 · Área de serviço", F2, P2, "LT-2005", "B3", "C1", "2026-07-28", "2026-08-25", 90, 88, "NF-0032 (exemplo)", "Aplicado"),
    r(8, "Torre B", "2º pavimento", "Apto 22 · Sala", F2, P2, "LT-2005", "B3", "C1", "2026-07-28", "2026-08-25", 95, 91, "NF-0032 (exemplo)", "Aplicado"),
    r(9, "Torre B", "3º pavimento", "Apto 31 · Sala", F2, P2, "LT-2005", "B3", "C1", "2026-07-28", "2026-08-25", 85, 60, "NF-0032 (exemplo)", "Em aplicação"),
    r(10, "Torre B", "3º pavimento", "Apto 33 · Sala", F2, P2, "LT-2005", "B4", "C1", "2026-07-28", "2026-09-30", 85, 42, "NF-0040 (exemplo)", "Em aplicação",
      "Mesmo lote, mas a caixa veio marcada com outra tonalidade."),
    r(11, "Torre B", "4º pavimento", "Apto 42 · Cozinha", F3, P3, "LT-3002", "B1", "C2", "2026-08-20", "2026-09-15", 70, 0, "NF-0021 (exemplo)", "Reprovado",
      "Peças com empeno na inspeção de recebimento (exemplo)."),
    r(12, "Torre C", "1º pavimento", "Apto 12 · Sala", F3, P1, "LT-3010", "T1", "C1", "2026-09-01", "2026-09-28", 130, 124, "NF-0055 (exemplo)", "Aplicado"),
    r(13, "Torre C", "2º pavimento", "Apto 21 · Sala", F3, P1, "LT-3010", "T1", "C1", "2026-09-01", "2026-09-28", 60, 58, "NF-0055 (exemplo)", "Aplicado"),
    r(14, "Torre C", "2º pavimento", "Apto 21 · Sala", F3, P1, "LT-3010", "T1", "C2", "2026-09-01", "2026-10-05", 60, 20, "NF-0061 (exemplo)", "Em aplicação",
      "Calibre diferente no mesmo ambiente: risco de junta irregular."),
    r(15, "Torre C", "3º pavimento", "Estoque do canteiro", F1, P3, "LT-1012", "B2", "C1", "2026-10-02", "2026-10-20", 200, 0, "NF-0070 (exemplo)", "Em estoque"),
  ];
}
