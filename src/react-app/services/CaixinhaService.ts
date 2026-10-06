import type {
  CaixinhaComprovante,
  CaixinhaLancamento,
  CaixinhaLista,
  CaixinhaResponsavel,
  CaixinhaResumo,
  SituacaoCaixinha,
} from "@/shared/types";
import { apiBlob, apiFetch } from "./apiClient";

const BASE = "/caixinha";

/** Filtros aplicados no servidor (datas em yyyy-MM-dd). */
export interface FiltroCaixinha {
  responsavel?: string;
  situacao?: SituacaoCaixinha;
  de?: string;
  ate?: string;
}

export interface LancamentoForm {
  /** UUID gerado ao abrir "Novo": reenviar não duplica. */
  cdRequisicao?: string;
  /** yyyy-MM-dd */
  dtLancamento: string;
  idResponsavel: number;
  txInsumo: string;
  vlValor: number;
  inLancado: boolean;
  inPago: boolean;
  /** Obrigatório na edição. */
  nrVersao?: number;
}

function consulta(filtro: FiltroCaixinha): string {
  const params = new URLSearchParams();
  if (filtro.responsavel) params.set("responsavel", filtro.responsavel);
  if (filtro.situacao && filtro.situacao !== "TODOS") params.set("situacao", filtro.situacao);
  if (filtro.de) params.set("de", filtro.de);
  if (filtro.ate) params.set("ate", filtro.ate);
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

const json = (corpo: unknown): RequestInit["body"] => JSON.stringify(corpo);

export const caixinhaService = {
  listar: async (filtro: FiltroCaixinha = {}): Promise<CaixinhaLista> => {
    const lista = await apiFetch<CaixinhaLista>(`${BASE}/lancamentos${consulta(filtro)}`);
    return { lancamentos: lista?.lancamentos ?? [], responsaveis: lista?.responsaveis ?? [] };
  },
  resumo: (filtro: FiltroCaixinha = {}) => apiFetch<CaixinhaResumo>(`${BASE}/resumo${consulta(filtro)}`),

  criar: (form: LancamentoForm) => apiFetch<CaixinhaLancamento>(`${BASE}/lancamentos`, { method: "POST", body: json(form) }),
  alterar: (id: number, form: LancamentoForm) =>
    apiFetch<CaixinhaLancamento>(`${BASE}/lancamentos/${id}`, { method: "PUT", body: json(form) }),
  marcar: (id: number, marcacao: { lancado?: boolean; pago?: boolean }, nrVersao: number) =>
    apiFetch<CaixinhaLancamento>(`${BASE}/lancamentos/${id}/marcacao`, { method: "PUT", body: json({ ...marcacao, nrVersao }) }),
  excluir: async (id: number, nrVersao: number) => {
    await apiFetch(`${BASE}/lancamentos/${id}?nrVersao=${nrVersao}`, { method: "DELETE" });
  },

  listarResponsaveis: async () => (await apiFetch<CaixinhaResponsavel[]>(`${BASE}/responsaveis`)) ?? [],
  criarResponsavel: (nmResponsavel: string) =>
    apiFetch<CaixinhaResponsavel>(`${BASE}/responsaveis`, { method: "POST", body: json({ nmResponsavel }) }),
  atualizarResponsavel: (id: number, alteracao: { nmResponsavel?: string; inAtivo?: boolean }) =>
    apiFetch<CaixinhaResponsavel>(`${BASE}/responsaveis/${id}`, { method: "PUT", body: json(alteracao) }),

  listarComprovantes: async (idLancamento: number) =>
    (await apiFetch<CaixinhaComprovante[]>(`${BASE}/lancamentos/${idLancamento}/comprovantes`)) ?? [],
  anexarComprovante: (idLancamento: number, arquivo: File, cdRequisicao: string) => {
    const form = new FormData();
    form.append("arquivo", arquivo, arquivo.name);
    form.append("cdRequisicao", cdRequisicao);
    return apiFetch<CaixinhaComprovante>(`${BASE}/lancamentos/${idLancamento}/comprovantes`, { method: "POST", body: form });
  },
  baixarComprovante: (idComprovante: number) => apiBlob(`${BASE}/comprovantes/${idComprovante}/arquivo`),
  excluirComprovante: async (idComprovante: number) => {
    await apiFetch(`${BASE}/comprovantes/${idComprovante}`, { method: "DELETE" });
  },
};
