/** Rótulos das colunas "Termo" e "Fotos" da lista de apartamentos (sem dependências, testável em node). */

export interface ApartamentoComTermo {
  inTermoAnexado?: boolean | null;
  qtTermos?: number | null;
  nrUltimoTermo?: number | null;
  nmSituacaoTermo?: string | null;
  qtFotosTermo?: number | null;
  nrPaginasTermo?: number | null;
  nrPaginasComFoto?: number | null;
}

export const SEM_TERMO = "Sem termo";

const ROTULOS_SITUACAO: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
};

/** Valor da coluna Termo: "Sem termo" ou a situação do último termo. */
export function situacaoDoTermo(apt: ApartamentoComTermo): string {
  if (!apt.inTermoAnexado) return SEM_TERMO;
  const situacao = apt.nmSituacaoTermo ?? "";
  return ROTULOS_SITUACAO[situacao] ?? (situacao || "Pendente");
}

/** "2º termo" (e "· 3 termos" quando há mais de um). Vazio sem termo. */
export function descricaoDoTermo(apt: ApartamentoComTermo): string {
  if (!apt.inTermoAnexado || apt.nrUltimoTermo == null) return "";
  const total = apt.qtTermos ?? 1;
  return total > 1 ? `${apt.nrUltimoTermo}º termo · ${total} termos` : `${apt.nrUltimoTermo}º termo`;
}

/** Valor da coluna Fotos: "3 fotos" / "1 foto" / "0 fotos"; nulo sem termo. */
export function valorFotos(apt: ApartamentoComTermo): string | null {
  if (!apt.inTermoAnexado) return null;
  const n = apt.qtFotosTermo ?? 0;
  return n === 1 ? "1 foto" : `${n} fotos`;
}

/** "2/4 págs com foto" — progresso das páginas cobertas. Nulo sem termo. */
export function progressoPaginas(apt: ApartamentoComTermo): string | null {
  if (!apt.inTermoAnexado || !apt.nrPaginasTermo) return null;
  return `${apt.nrPaginasComFoto ?? 0}/${apt.nrPaginasTermo} págs com foto`;
}

/** Valor numérico para ordenar a coluna Fotos (nulo = sem termo, vai para o fim). */
export function ordemFotos(apt: ApartamentoComTermo): number | null {
  return apt.inTermoAnexado ? (apt.qtFotosTermo ?? 0) : null;
}

/** Classes de cor da etiqueta da situação. */
export function classeSituacao(situacao: string): string {
  switch (situacao) {
    case "Concluído": return "bg-green-50 text-green-700";
    case "Em andamento": return "bg-blue-50 text-blue-700";
    case "Pendente": return "bg-yellow-50 text-yellow-700";
    default: return "bg-slate-100 text-slate-500";
  }
}

export interface ResumoTermos {
  totalApartamentosComReprova: number;
  comTermo: number;
  semTermo: number;
  concluidos: number;
  emAndamento: number;
  pendentes: number;
  percentualConcluido: number;
}

/** Quantos ainda faltam concluir (total − concluídos), nunca negativo. */
export function restantes(resumo: Pick<ResumoTermos, "totalApartamentosComReprova" | "concluidos">): number {
  return Math.max(0, resumo.totalApartamentosComReprova - resumo.concluidos);
}

/** "40,0%" em pt-BR, limitado a 0–100. */
export function formatarPercentual(valor: number): string {
  const limitado = Math.min(100, Math.max(0, valor));
  return `${limitado.toFixed(1).replace(".", ",")}%`;
}
