import type {
  FinanceiroCategoria,
  FinanceiroLancamento,
  FinanceiroLista,
  FinanceiroPessoa,
  FinanceiroResumo,
  RegraData,
  SituacaoFinanceiro,
  TipoFluxo,
  TipoProjecao,
} from "@/shared/types";
import { apiFetch } from "./apiClient";

const BASE = "/financeiro";

/** Filtros aplicados no servidor (datas em yyyy-MM-dd; competência em yyyy-MM). */
export interface FiltroFinanceiro {
  competencia?: string;
  de?: string;
  ate?: string;
  idPessoa?: number;
  idCategoria?: number;
  tipo?: TipoFluxo;
  situacao?: SituacaoFinanceiro;
  texto?: string;
}

export interface LancamentoFinanceiroForm {
  /** UUID gerado ao abrir "Novo": reenviar não duplica. */
  cdRequisicao?: string;
  /** yyyy-MM-dd */
  dtLancamento: string;
  /** yyyy-MM-dd (só o mês vale); sem ele vale o mês de dtLancamento. */
  dtCompetencia?: string;
  idCategoria: number;
  idPessoa: number;
  dsLancamento?: string;
  vlLancamento: number;
  inRealizado: boolean;
  /** Só na criação: N lançamentos mensais (1 a 120). */
  qtParcelas?: number;
  /** Obrigatório na edição. */
  nrVersao?: number;
}

export interface PessoaForm {
  nmPessoa?: string;
  inCompartilhado?: boolean;
  inAtivo?: boolean;
  nrOrdem?: number;
}

export interface CategoriaForm {
  nmCategoria?: string;
  cdTipo?: TipoFluxo;
  cdProjecao?: TipoProjecao;
  inFixa?: boolean;
  cdRegraData?: RegraData | "";
  nrDia?: number | null;
  nrOrdem?: number;
  inAtivo?: boolean;
}

function consulta(filtro: FiltroFinanceiro): string {
  const params = new URLSearchParams();
  if (filtro.competencia) params.set("competencia", filtro.competencia);
  if (filtro.de) params.set("de", filtro.de);
  if (filtro.ate) params.set("ate", filtro.ate);
  if (filtro.idPessoa) params.set("idPessoa", String(filtro.idPessoa));
  if (filtro.idCategoria) params.set("idCategoria", String(filtro.idCategoria));
  if (filtro.tipo) params.set("tipo", filtro.tipo);
  if (filtro.situacao && filtro.situacao !== "TODOS") params.set("situacao", filtro.situacao);
  if (filtro.texto?.trim()) params.set("texto", filtro.texto.trim());
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

const json = (corpo: unknown): RequestInit["body"] => JSON.stringify(corpo);

const ZERO: FinanceiroResumo = {
  entradas: 0, saidas: 0, saldo: 0, entradasRealizadas: 0, saidasRealizadas: 0, qtLancamentos: 0, qtRealizados: 0,
};

export const financeiroService = {
  listar: async (filtro: FiltroFinanceiro = {}): Promise<FinanceiroLista> => {
    const lista = await apiFetch<FinanceiroLista>(`${BASE}/lancamentos${consulta(filtro)}`);
    return {
      lancamentos: lista?.lancamentos ?? [],
      resumo: lista?.resumo ?? null,
      pessoas: lista?.pessoas ?? [],
      categorias: lista?.categorias ?? [],
    };
  },
  resumo: async (filtro: FiltroFinanceiro = {}): Promise<FinanceiroResumo> =>
    (await apiFetch<FinanceiroResumo>(`${BASE}/resumo${consulta(filtro)}`)) ?? ZERO,

  criar: async (form: LancamentoFinanceiroForm): Promise<FinanceiroLancamento[]> =>
    (await apiFetch<FinanceiroLancamento[]>(`${BASE}/lancamentos`, { method: "POST", body: json(form) })) ?? [],
  alterar: (id: number, form: LancamentoFinanceiroForm) =>
    apiFetch<FinanceiroLancamento>(`${BASE}/lancamentos/${id}`, { method: "PUT", body: json(form) }),
  marcarRealizado: (id: number, inRealizado: boolean, nrVersao: number) =>
    apiFetch<FinanceiroLancamento>(`${BASE}/lancamentos/${id}/realizado`, { method: "PUT", body: json({ inRealizado, nrVersao }) }),
  excluir: async (id: number, nrVersao: number) => {
    await apiFetch(`${BASE}/lancamentos/${id}?nrVersao=${nrVersao}`, { method: "DELETE" });
  },

  pessoas: async (): Promise<FinanceiroPessoa[]> => (await apiFetch<FinanceiroPessoa[]>(`${BASE}/pessoas`)) ?? [],
  criarPessoa: (form: PessoaForm) => apiFetch<FinanceiroPessoa>(`${BASE}/pessoas`, { method: "POST", body: json(form) }),
  atualizarPessoa: (id: number, form: PessoaForm) =>
    apiFetch<FinanceiroPessoa>(`${BASE}/pessoas/${id}`, { method: "PUT", body: json(form) }),

  categorias: async (): Promise<FinanceiroCategoria[]> => (await apiFetch<FinanceiroCategoria[]>(`${BASE}/categorias`)) ?? [],
  criarCategoria: (form: CategoriaForm) => apiFetch<FinanceiroCategoria>(`${BASE}/categorias`, { method: "POST", body: json(form) }),
  atualizarCategoria: (id: number, form: CategoriaForm) =>
    apiFetch<FinanceiroCategoria>(`${BASE}/categorias/${id}`, { method: "PUT", body: json(form) }),
};
