/** Regras puras da aba Investimentos (sem React, testáveis em node). */
import { dataBrParaIso } from "./casamento.ts";

export const INTERVALO_COTACAO_MS = 60_000;

export interface ProventoParaLista {
  idProvento: number;
  dtPagamento: string;
  vlTotal: number;
  recebido: boolean;
}

export interface AtivoParaLista<P extends ProventoParaLista = ProventoParaLista> {
  idAtivo: number;
  cdTicker: string;
  nmPessoa: string;
  proventos: P[];
}

export interface ProventoFuturo<P extends ProventoParaLista> {
  ativo: { idAtivo: number; cdTicker: string; nmPessoa: string };
  provento: P;
}

/** Proventos ainda por pagar de todos os fundos, do mais próximo ao mais distante (sem valor zerado). */
export function proximosProventos<P extends ProventoParaLista>(ativos: AtivoParaLista<P>[]): ProventoFuturo<P>[] {
  const lista: ProventoFuturo<P>[] = [];
  for (const a of ativos) {
    for (const p of a.proventos) {
      if (!p.recebido && p.vlTotal > 0) lista.push({ ativo: { idAtivo: a.idAtivo, cdTicker: a.cdTicker, nmPessoa: a.nmPessoa }, provento: p });
    }
  }
  return lista.sort((a, b) => (dataBrParaIso(a.provento.dtPagamento) ?? "").localeCompare(dataBrParaIso(b.provento.dtPagamento) ?? ""));
}

export type SinalResultado = "alta" | "baixa" | "estavel";

export function sinalResultado(valor: number): SinalResultado {
  if (valor > 0.004) return "alta";
  if (valor < -0.004) return "baixa";
  return "estavel";
}

/** "+6,67%" / "-2,10%" / "0,00%" */
export function textoPercentual(pc: number): string {
  const texto = Math.abs(pc).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sinal = sinalResultado(pc);
  return `${sinal === "alta" ? "+" : sinal === "baixa" ? "-" : ""}${texto}%`;
}

/** Aviso sobre a origem da cotação mostrada. */
export function textoCotacao(dhCotacao: string | null, aoVivo: boolean): string {
  if (aoVivo) return dhCotacao ? `Cotação de ${dhCotacao.slice(11)}` : "Cotação ao vivo";
  if (dhCotacao) return `Última cotação conhecida (${dhCotacao})`;
  return "Sem cotação: patrimônio pelo valor investido";
}

/** Normaliza o que a pessoa digita ("hglg11 ", "HGLG-11") para o código do fundo; vazio se não parecer um. */
export function normalizarTicker(bruto: string): string {
  const t = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{4}[0-9]{1,2}$/.test(t) ? t : "";
}

/** Quantidade de cotas digitada: inteiro maior que zero, senão null. */
export function lerCotas(texto: string): number | null {
  const n = Number(texto.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}
