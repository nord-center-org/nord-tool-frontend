/** Regras puras da Caixinha (sem dependências de React, testáveis em node). */
import { dataBrParaIso } from "./casamento.ts";

export const PDF_MAX_BYTES = 5 * 1024 * 1024;

export const ROTULO_SITUACAO = {
  TODOS: "Todos",
  A_PAGAR: "A pagar",
  PAGO: "Pago",
  NAO_LANCADO: "Não lançado",
} as const;

export interface ItemCaixinha {
  dtLancamento: string;
  nmResponsavel: string;
  txInsumo: string;
  vlValor: number;
  inLancado: boolean;
  inPago: boolean;
}

export interface TotaisCaixinha {
  total: number;
  pago: number;
  aPagar: number;
  qtLancamentos: number;
  qtPagos: number;
  qtPendentes: number;
}

export interface ResumoCaixinha {
  total: number;
  pago: number;
  aPagar: number;
  qtLancamentos: number;
  qtPagos: number;
  qtPendentes: number;
}

/** Tolera campos ausentes (e o nome "apagar" que um backend antigo devolvia): a tela nunca recebe undefined. */
export function normalizarResumo(r: (Partial<ResumoCaixinha> & { apagar?: number }) | null): ResumoCaixinha {
  const total = Number(r?.total) || 0;
  const pago = Number(r?.pago) || 0;
  const aPagar = r?.aPagar ?? r?.apagar;
  const qtLancamentos = Number(r?.qtLancamentos) || 0;
  const qtPagos = Number(r?.qtPagos) || 0;
  return {
    total,
    pago,
    aPagar: typeof aPagar === "number" ? aPagar : Math.round((total - pago) * 100) / 100,
    qtLancamentos,
    qtPagos,
    qtPendentes: Number(r?.qtPendentes ?? qtLancamentos - qtPagos) || 0,
  };
}

const centavos = (valor: number) => Math.round((valor || 0) * 100);

/** Soma em centavos (sem erro de ponto flutuante). */
export function totaisCaixinha(itens: ItemCaixinha[]): TotaisCaixinha {
  let total = 0, pago = 0, qtPagos = 0;
  for (const item of itens) {
    const c = centavos(item.vlValor);
    total += c;
    if (item.inPago) { pago += c; qtPagos += 1; }
  }
  return {
    total: total / 100,
    pago: pago / 100,
    aPagar: (total - pago) / 100,
    qtLancamentos: itens.length,
    qtPagos,
    qtPendentes: itens.length - qtPagos,
  };
}

const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Busca por insumo ou responsável, sem diferenciar caixa nem acentos. */
export function filtrarPorBusca<T extends ItemCaixinha>(itens: T[], termo: string): T[] {
  const busca = semAcento(termo.trim());
  if (!busca) return itens;
  return itens.filter(i => semAcento(`${i.txInsumo} ${i.nmResponsavel}`).includes(busca));
}

/** Data de hoje (yyyy-MM-dd) no fuso de São Paulo, como no Lugia. */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/** Primeiro e último dia do mês da data informada (yyyy-MM-dd). */
export function periodoDoMes(dataIso: string): { de: string; ate: string } {
  const [ano, mes] = dataIso.split("-").map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  const mm = String(mes).padStart(2, "0");
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

/** Aceita "1234,56", "1.234,56", "R$ 12,5" e "12.50"; devolve null se inválido ou não positivo. */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/[^\d.,-]/g, "").trim();
  if (!limpo) return null;
  let normal = limpo;
  if (limpo.includes(",")) normal = limpo.replace(/\./g, "").replace(",", ".");
  const numero = Number(normal);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return Math.round(numero * 100) / 100;
}

/** Valida um PDF de comprovante: nome .pdf, até 5 MB, %PDF- no início e %%EOF nos últimos 1024 bytes. */
export function validarPdfComprovante(arquivo: { name: string; size: number }, inicio: Uint8Array, fim: Uint8Array): string | null {
  if (!/\.pdf$/i.test(arquivo.name)) return "O arquivo deve ser um PDF.";
  if (arquivo.size <= 0) return "O arquivo está vazio.";
  if (arquivo.size > PDF_MAX_BYTES) return `O PDF deve ter no máximo ${PDF_MAX_BYTES / (1024 * 1024)} MB.`;
  const assinatura = [0x25, 0x50, 0x44, 0x46, 0x2d];
  if (!assinatura.every((byte, i) => inicio[i] === byte)) return "O arquivo não é um PDF válido.";
  const cauda = new TextDecoder("latin1").decode(fim.length > 1024 ? fim.slice(fim.length - 1024) : fim);
  if (!cauda.includes("%%EOF")) return "O PDF parece incompleto (sem marca de fim de arquivo).";
  return null;
}

export const COLUNAS_PLANILHA = ["Data", "Responsável", "Insumo", "Valor", "Lançado", "Pago", "Comprovantes"] as const;

export interface ItemExportavel extends ItemCaixinha {
  qtComprovantes: number;
}

/** Linhas do XLSX exportado (data no formato ISO para ordenar no Excel; valor numérico). */
export function linhasPlanilha(itens: ItemExportavel[]): Record<(typeof COLUNAS_PLANILHA)[number], string | number>[] {
  return itens.map(i => ({
    Data: dataBrParaIso(i.dtLancamento) ?? i.dtLancamento,
    "Responsável": i.nmResponsavel,
    Insumo: i.txInsumo,
    Valor: i.vlValor,
    "Lançado": i.inLancado ? "Sim" : "Não",
    Pago: i.inPago ? "Sim" : "Não",
    Comprovantes: i.qtComprovantes,
  }));
}

/** Compara datas dd/MM/yyyy (mais recente primeiro). */
export function compararDataDesc(a: string, b: string): number {
  return (dataBrParaIso(b) ?? "").localeCompare(dataBrParaIso(a) ?? "");
}
