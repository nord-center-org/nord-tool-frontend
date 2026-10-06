import type {
  CasamentoAnexo,
  CasamentoConfig,
  CasamentoConvidado,
  CasamentoDashboard,
  CasamentoFornecedor,
  CasamentoMarco,
  ImportacaoConvidados,
  StatusConvidado,
  StatusFornecedor,
} from "@/shared/types";
import { apiBlob, apiFetch } from "./apiClient";

const BASE = "/casamento";

export interface FornecedorForm {
  nmFornecedor: string;
  nmCategoria: string;
  txContato?: string;
  nmStatus?: StatusFornecedor;
  vlValor?: number;
  txObservacao?: string;
}

export interface ConvidadoForm {
  nmConvidado: string;
  nmGrupo?: string;
  nrTelefone?: string;
  nmRelacao?: string;
  nmStatus?: StatusConvidado;
  nrAcompanhantes?: number;
  nmMesa?: string;
}

export interface MarcoForm {
  nmTitulo: string;
  /** yyyy-MM-dd */
  dtPrazo?: string | null;
  txObservacao?: string;
}

const json = (corpo: unknown): RequestInit["body"] => JSON.stringify(corpo);

export const casamentoService = {
  // configuração e dashboard
  buscarConfiguracao: () => apiFetch<CasamentoConfig>(`${BASE}/configuracao`),
  salvarConfiguracao: (casal: string, dataCasamento: string) =>
    apiFetch<CasamentoConfig>(`${BASE}/configuracao`, { method: "PUT", body: json({ casal, dataCasamento }) }),
  dashboard: () => apiFetch<CasamentoDashboard>(`${BASE}/dashboard`),

  // fornecedores
  listarFornecedores: async () => (await apiFetch<CasamentoFornecedor[]>(`${BASE}/fornecedores`)) ?? [],
  criarFornecedor: (form: FornecedorForm) =>
    apiFetch<CasamentoFornecedor>(`${BASE}/fornecedores`, { method: "POST", body: json(form) }),
  alterarFornecedor: (id: number, form: FornecedorForm) =>
    apiFetch<CasamentoFornecedor>(`${BASE}/fornecedores/${id}`, { method: "PUT", body: json(form) }),
  excluirFornecedor: async (id: number) => { await apiFetch(`${BASE}/fornecedores/${id}`, { method: "DELETE" }); },

  // anexos de fornecedor
  listarAnexos: async (idFornecedor: number) => (await apiFetch<CasamentoAnexo[]>(`${BASE}/fornecedores/${idFornecedor}/anexos`)) ?? [],
  anexar: (idFornecedor: number, arquivo: File, descricao?: string) => {
    const form = new FormData();
    form.append("arquivo", arquivo, arquivo.name);
    if (descricao) form.append("descricao", descricao);
    return apiFetch<CasamentoAnexo>(`${BASE}/fornecedores/${idFornecedor}/anexos`, { method: "POST", body: form });
  },
  baixarAnexo: (idAnexo: number) => apiBlob(`${BASE}/fornecedores/anexos/${idAnexo}/arquivo`),
  excluirAnexo: async (idAnexo: number) => { await apiFetch(`${BASE}/fornecedores/anexos/${idAnexo}`, { method: "DELETE" }); },

  // convidados
  listarConvidados: async () => (await apiFetch<CasamentoConvidado[]>(`${BASE}/convidados`)) ?? [],
  criarConvidado: (form: ConvidadoForm) =>
    apiFetch<CasamentoConvidado>(`${BASE}/convidados`, { method: "POST", body: json(form) }),
  alterarConvidado: (id: number, form: ConvidadoForm) =>
    apiFetch<CasamentoConvidado>(`${BASE}/convidados/${id}`, { method: "PUT", body: json(form) }),
  excluirConvidado: async (id: number) => { await apiFetch(`${BASE}/convidados/${id}`, { method: "DELETE" }); },
  importarConvidados: (planilha: File) => {
    const form = new FormData();
    form.append("planilha", planilha, planilha.name);
    return apiFetch<ImportacaoConvidados>(`${BASE}/convidados/importar`, { method: "POST", body: form });
  },

  // marcos
  listarMarcos: async () => (await apiFetch<CasamentoMarco[]>(`${BASE}/marcos`)) ?? [],
  criarMarco: (form: MarcoForm) => apiFetch<CasamentoMarco>(`${BASE}/marcos`, { method: "POST", body: json(form) }),
  alterarMarco: (id: number, form: MarcoForm) =>
    apiFetch<CasamentoMarco>(`${BASE}/marcos/${id}`, { method: "PUT", body: json(form) }),
  concluirMarco: (id: number, concluido: boolean) =>
    apiFetch<CasamentoMarco>(`${BASE}/marcos/${id}/concluido`, { method: "PUT", body: json({ concluido }) }),
  excluirMarco: async (id: number) => { await apiFetch(`${BASE}/marcos/${id}`, { method: "DELETE" }); },
  criarMarcosPadrao: async () => (await apiFetch<CasamentoMarco[]>(`${BASE}/marcos/padrao`, { method: "POST" })) ?? [],
};
