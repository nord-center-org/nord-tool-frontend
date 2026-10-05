import { apiFetch } from './apiClient';

export type TipoItemControleChaves = 'APARTAMENTO' | 'FERRAMENTA';
export interface ApartamentoControleChaves { idApartamentoVistoria: number; nmApartamentoVistoria: string }
export interface FerramentaControleChaves { idFerramenta: number; nmFerramenta: string }
export interface ObraControleChaves { idObra: string; nmObra: string }
export interface RetiranteControleChaves {
  idUserRetirada: number; nmPessoaRetirante: string; nmPermissaoRetirante?: string;
}
export interface LiberadorControleChaves {
  idUserLiberacao: number; nmPessoaLiberador: string; nmPermissaoLiberador?: string;
}
export interface RecebedorControleChaves {
  idUserRecebimento: number; nmPessoaRecebedor: string; nmPermissaoRecebedor?: string;
}
export interface RetiradaControleChaves {
  idRequisicao: number; cdCodigoRetirada: string; nmTipoItem: TipoItemControleChaves;
  apartamentoControleChavesDto?: ApartamentoControleChaves | null;
  ferramentaControleChavesDto?: FerramentaControleChaves | null;
  retiranteControleChavesDto: RetiranteControleChaves;
  liberadorControleChavesDto: LiberadorControleChaves;
  recebedorControleChavesDto?: RecebedorControleChaves | null;
  dtRetirada: string; dtRecebimento?: string | null; nmStatusRetiradaControle: 'ABERTO' | 'RECEBIDO';
}
export interface DashboardControleChaves {
  qtChavesEmCampo: number; qtChavesNoQuadro: number; qtChavesEntregues: number;
  retiradasRecentes: RetiradaControleChaves[];
}
export interface NovaRetiradaControleChaves {
  nmTipoItem: TipoItemControleChaves;
  idApartamentoVistoria?: number;
  idFerramenta?: number;
  idUserRetirada: number;
  idUserLiberacao: number;
}
export interface RecebimentoControleChaves { idUserRecebimento: number }

const CHAVES_LISTA_OBRAS = ['obras', 'items', 'content', 'data'] as const;
const BASE_PATH = '/controleChaves';

const normalizarListaObras = (conteudo: unknown): ObraControleChaves[] => {
  if (Array.isArray(conteudo)) return conteudo as ObraControleChaves[];

  if (conteudo && typeof conteudo === 'object') {
    const objeto = conteudo as Record<string, unknown>;
    for (const chave of CHAVES_LISTA_OBRAS) {
      if (Array.isArray(objeto[chave])) return objeto[chave] as ObraControleChaves[];
    }
  }

  const chaves = conteudo && typeof conteudo === 'object'
    ? Object.keys(conteudo).sort().join(', ') || 'nenhuma'
    : 'nenhuma';
  throw new Error(`Formato invÃ¡lido ao carregar obras. Chaves recebidas: ${chaves}.`);
};

export const ControleChavesService = {
  async listarObras(options: { signal?: AbortSignal } = {}) {
    const conteudo = await apiFetch<unknown>(`${BASE_PATH}/obras`, { signal: options.signal });
    return normalizarListaObras(conteudo);
  },
  listarApartamentos(busca: string, options: { limite?: number; pagina?: number; signal?: AbortSignal } = {}) {
    const params = new URLSearchParams({ busca, limite: String(options.limite ?? 20), pagina: String(options.pagina ?? 0) });
    return apiFetch<ApartamentoControleChaves[]>(`${BASE_PATH}/apartamentos?${params}`, { signal: options.signal });
  },
  listarFerramentas(busca: string, options: { limite?: number; pagina?: number; signal?: AbortSignal } = {}) {
    const params = new URLSearchParams({ busca, limite: String(options.limite ?? 20), pagina: String(options.pagina ?? 0) });
    return apiFetch<FerramentaControleChaves[]>(`${BASE_PATH}/ferramentas?${params}`, { signal: options.signal });
  },
  buscarDashboard(limiteRecentes = 5, idObra?: string) {
    const params = new URLSearchParams({ limiteRecentes: String(limiteRecentes) });
    if (idObra) params.set('idObra', idObra);
    return apiFetch<DashboardControleChaves>(`${BASE_PATH}/dashboard?${params}`);
  },
  listarHistorico(options: { busca?: string; status?: string; idObra?: string; limite?: number; pagina?: number; signal?: AbortSignal } = {}) {
    const params = new URLSearchParams({ busca: options.busca ?? '', status: options.status ?? '', limite: String(options.limite ?? 20), pagina: String(options.pagina ?? 0) });
    if (options.idObra) params.set('idObra', options.idObra);
    return apiFetch<RetiradaControleChaves[]>(`${BASE_PATH}/historico?${params}`, { signal: options.signal });
  },
  criarRetirada(payload: NovaRetiradaControleChaves) {
    return apiFetch<RetiradaControleChaves>(`${BASE_PATH}/retiradas`, { method: 'POST', body: JSON.stringify(payload) });
  },
  receberRetirada(id: number, payload: RecebimentoControleChaves) {
    return apiFetch<RetiradaControleChaves>(`${BASE_PATH}/retiradas/${id}/recebimento`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
};
