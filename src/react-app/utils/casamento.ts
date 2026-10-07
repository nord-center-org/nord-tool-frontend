/** Regras puras do módulo Casamento (sem dependências, testáveis em node). */

export interface Contagem {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
  /** true quando a data já passou (todos os campos ficam em 0). */
  passou: boolean;
}

/** Cerimônia ao meio-dia, fuso de Brasília (-03:00), como no Lugia. */
export function instanteDoCasamento(dataIso: string): number {
  return new Date(`${dataIso}T12:00:00-03:00`).getTime();
}

export function calcularContagem(dataIso: string | null | undefined, agora: number): Contagem | null {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return null;
  const alvo = instanteDoCasamento(dataIso);
  if (Number.isNaN(alvo)) return null;
  const restante = Math.max(0, alvo - agora);
  return {
    dias: Math.floor(restante / 86_400_000),
    horas: Math.floor((restante % 86_400_000) / 3_600_000),
    minutos: Math.floor((restante % 3_600_000) / 60_000),
    segundos: Math.floor((restante % 60_000) / 1000),
    passou: alvo <= agora,
  };
}

export function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatarMoeda(valor: number | null | undefined): string {
  // Campo ausente/inválido na resposta da API não pode derrubar a tela.
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** dd/MM/yyyy → yyyy-MM-dd (nulo se inválida). */
export function dataBrParaIso(data: string | null | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** yyyy-MM-dd → dd/MM/yyyy (vazio se inválida). */
export function dataIsoParaBr(data: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Data de hoje em yyyy-MM-dd, no fuso local. */
export function hojeIso(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

/** Prazo (dd/MM/yyyy) já vencido e marco ainda não concluído. */
export function estaAtrasado(prazoBr: string | null | undefined, concluido: boolean, hoje: string = hojeIso()): boolean {
  const prazo = dataBrParaIso(prazoBr);
  return !concluido && prazo !== null && prazo < hoje;
}

/** Progresso em % (inteiro), 0 quando não há itens. */
export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export function dataExtensa(dataIso: string | null | undefined): string {
  const br = dataIsoParaBr(dataIso);
  if (!br) return "";
  const [dia, mes, ano] = br.split("/").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export const ROTULO_STATUS_FORNECEDOR = {
  PESQUISANDO: "Pesquisando",
  ORCAMENTO: "Orçamento",
  CONTRATADO: "Contratado",
} as const;

export interface TotaisFornecedores {
  qtTotal: number;
  qtContratados: number;
  vlContratado: number;
  /** Soma de todos os valores cadastrados, em qualquer status. */
  vlEstimado: number;
}

/** Totais da aba Fornecedores; valor "contratado" só soma quem está CONTRATADO. */
export function totaisFornecedores(itens: { nmStatus: string; vlValor: number }[]): TotaisFornecedores {
  let qtContratados = 0, vlContratado = 0, vlEstimado = 0;
  for (const f of itens) {
    vlEstimado += f.vlValor || 0;
    if (f.nmStatus === "CONTRATADO") { qtContratados += 1; vlContratado += f.vlValor || 0; }
  }
  return { qtTotal: itens.length, qtContratados, vlContratado, vlEstimado };
}

/** Marcos por prazo crescente; sem prazo vão para o fim (empate: ordem original). */
export function ordenarMarcos<T extends { dtPrazo: string | null }>(marcos: T[]): T[] {
  return marcos
    .map((marco, indice) => ({ marco, indice, chave: dataBrParaIso(marco.dtPrazo) ?? "9999-99-99" }))
    .sort((a, b) => a.chave.localeCompare(b.chave) || a.indice - b.indice)
    .map(x => x.marco);
}
