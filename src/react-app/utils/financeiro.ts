/** Regras puras do Financeiro (sem dependências de React, testáveis em node). */
import { dataBrParaIso } from "./casamento.ts";

export const ROTULO_TIPO = { ENTRADA: "Entrada", SAIDA: "Saída" } as const;

export const ROTULO_SITUACAO = { TODOS: "Todos", REALIZADO: "Realizado", PREVISTO: "Previsto" } as const;

export const ROTULO_PROJECAO = {
  FIXA_MEDIA: "Fixa (média dos meses)",
  SALDO_ANTERIOR: "Saldo anterior (calculado)",
  FIXA_VALOR: "Fixa (valor cadastrado)",
  RITMO_FATURA: "Fatura (ritmo de gasto)",
  VARIAVEL_MEDIA: "Variável (média dos meses)",
  MANUAL: "Manual (só o valor digitado)",
} as const;

export const ROTULO_REGRA_DATA = { DIA_MES: "Dia do mês", DIA_UTIL: "Dia útil do mês" } as const;

export const MAX_PARCELAS = 120;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export interface ItemFinanceiro {
  /** yyyy-MM */
  competencia: string;
  /** dd/MM/yyyy */
  dtLancamento: string;
  cdTipo: string;
  nmCategoria: string;
  nmPessoa: string;
  dsLancamento: string | null;
  vlLancamento: number;
  inRealizado: boolean;
  nrParcela?: number | null;
  qtParcela?: number | null;
  nmUsuarioCriacao?: string | null;
}

export interface TotaisFinanceiro {
  entradas: number;
  saidas: number;
  saldo: number;
  entradasRealizadas: number;
  saidasRealizadas: number;
  qtLancamentos: number;
  qtRealizados: number;
}

export interface GrupoMes<T extends ItemFinanceiro> {
  competencia: string;
  rotulo: string;
  itens: T[];
  totais: TotaisFinanceiro;
}

const centavos = (valor: number) => Math.round((valor || 0) * 100);

/** Soma em centavos (sem erro de ponto flutuante). */
export function totaisFinanceiro(itens: ItemFinanceiro[]): TotaisFinanceiro {
  let entradas = 0, saidas = 0, entradasRealizadas = 0, saidasRealizadas = 0, qtRealizados = 0;
  for (const item of itens) {
    const c = centavos(item.vlLancamento);
    if (item.cdTipo === "ENTRADA") {
      entradas += c;
      if (item.inRealizado) entradasRealizadas += c;
    } else {
      saidas += c;
      if (item.inRealizado) saidasRealizadas += c;
    }
    if (item.inRealizado) qtRealizados += 1;
  }
  return {
    entradas: entradas / 100,
    saidas: saidas / 100,
    saldo: (entradas - saidas) / 100,
    entradasRealizadas: entradasRealizadas / 100,
    saidasRealizadas: saidasRealizadas / 100,
    qtLancamentos: itens.length,
    qtRealizados,
  };
}

/** Valor com sinal: entrada positiva, saída negativa. */
export function valorAssinado(item: Pick<ItemFinanceiro, "cdTipo" | "vlLancamento">): number {
  return item.cdTipo === "ENTRADA" ? item.vlLancamento : -item.vlLancamento;
}

/** "2026-10" → "outubro de 2026" (vazio se inválido). */
export function rotuloMes(competencia: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return "";
  return `${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

/** "2026-10" → "out/2026". */
export function rotuloMesCurto(competencia: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return "";
  return `${MESES[Number(m[2]) - 1].slice(0, 3)}/${m[1]}`;
}

/** Mês (yyyy-MM) de uma data yyyy-MM-dd; vazio se inválida. */
export function competenciaDaData(dataIso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dataIso) ? dataIso.slice(0, 7) : "";
}

/** Soma (ou subtrai) meses a uma competência yyyy-MM. */
export function deslocarMes(competencia: string, meses: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m) return competencia;
  const indice = Number(m[1]) * 12 + (Number(m[2]) - 1) + meses;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

/** Agrupa por competência, do mês mais recente para o mais antigo; a ordem dos itens dentro do mês é mantida. */
export function agruparPorMes<T extends ItemFinanceiro>(itens: T[]): GrupoMes<T>[] {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const lista = mapa.get(item.competencia);
    if (lista) lista.push(item);
    else mapa.set(item.competencia, [item]);
  }
  return [...mapa.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map(competencia => {
      const lista = mapa.get(competencia) as T[];
      return { competencia, rotulo: rotuloMes(competencia) || competencia, itens: lista, totais: totaisFinanceiro(lista) };
    });
}

const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Busca por descrição, categoria, pessoa ou autor, sem diferenciar caixa nem acentos. */
export function filtrarPorBusca<T extends ItemFinanceiro>(itens: T[], termo: string): T[] {
  const busca = semAcento(termo.trim());
  if (!busca) return itens;
  return itens.filter(i =>
    semAcento(`${i.dsLancamento ?? ""} ${i.nmCategoria} ${i.nmPessoa} ${i.nmUsuarioCriacao ?? ""}`).includes(busca));
}

/** O que aparece como descrição na tabela: o texto digitado ou, sem ele, a categoria. */
export function descricaoExibida(item: Pick<ItemFinanceiro, "dsLancamento" | "nmCategoria">): string {
  return item.dsLancamento?.trim() || item.nmCategoria;
}

/** "2/10" para lançamento parcelado; vazio nos demais. */
export function rotuloParcela(item: Pick<ItemFinanceiro, "nrParcela" | "qtParcela">): string {
  return item.nrParcela && item.qtParcela && item.qtParcela > 1 ? `${item.nrParcela}/${item.qtParcela}` : "";
}

/** "3 parcelas de R$ 100,00 (out/2026 a dez/2026)" para o aviso do formulário. */
export function resumoParcelamento(competenciaInicial: string, parcelas: number, valor: number, formatar: (v: number) => string): string {
  if (parcelas < 2) return "";
  const fim = deslocarMes(competenciaInicial, parcelas - 1);
  const periodo = competenciaInicial ? ` (${rotuloMesCurto(competenciaInicial)} a ${rotuloMesCurto(fim)})` : "";
  return `${parcelas} parcelas de ${formatar(valor)}${periodo}`;
}

export interface CategoriaBasica {
  idCategoria: number;
  nmCategoria: string;
  cdTipo: string;
  cdProjecao: string;
  inAtivo: boolean;
}

/** Categorias que o formulário pode oferecer: ativas e que aceitam lançamento, mais a atual do lançamento em edição. */
export function categoriasParaLancamento<T extends CategoriaBasica>(categorias: T[], idAtual?: number | null): T[] {
  return categorias.filter(c => c.idCategoria === idAtual || (c.inAtivo && c.cdProjecao !== "SALDO_ANTERIOR"));
}

/** Projeções permitidas para o tipo (o saldo anterior só vale em entrada; o ritmo de fatura, em saída). */
export function projecoesDoTipo(tipo: string): (keyof typeof ROTULO_PROJECAO)[] {
  const todas = Object.keys(ROTULO_PROJECAO) as (keyof typeof ROTULO_PROJECAO)[];
  return todas.filter(p => (p === "SALDO_ANTERIOR" ? tipo === "ENTRADA" : p === "RITMO_FATURA" ? tipo === "SAIDA" : true));
}

export const COLUNAS_PLANILHA = ["Mês", "Data", "Tipo", "Categoria", "Descrição", "Pessoa", "Autor", "Valor", "Situação"] as const;

/** Linhas do XLSX exportado (data ISO para ordenar no Excel; valor com sinal). */
export function linhasPlanilha(itens: ItemFinanceiro[]): Record<(typeof COLUNAS_PLANILHA)[number], string | number>[] {
  return itens.map(i => ({
    "Mês": i.competencia,
    Data: dataBrParaIso(i.dtLancamento) ?? i.dtLancamento,
    Tipo: i.cdTipo === "ENTRADA" ? "Entrada" : "Saída",
    Categoria: i.nmCategoria,
    "Descrição": i.dsLancamento ?? "",
    Pessoa: i.nmPessoa,
    Autor: i.nmUsuarioCriacao ?? "",
    Valor: valorAssinado(i),
    "Situação": i.inRealizado ? "Realizado" : "Previsto",
  }));
}
