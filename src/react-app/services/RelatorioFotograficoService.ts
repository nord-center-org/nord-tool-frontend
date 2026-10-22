import { apiBlob, apiFetch } from "./apiClient";
import type { FotoRelatorio, ItemRelatorio, StatusRelatorio } from "../utils/relatorioFotografico";

export type FonteRelatorio = "HELVETICA" | "TIMES" | "COURIER";
export type TipoImagemModelo = "fundo" | "icone";

export interface ModeloItem { id?: number; nrOrdem?: number; nmItem: string; txOrientacao: string | null }
export interface ModeloRelatorio {
  id: number; nmModelo: string; txDescricao: string | null; nrFotosPagina: number; cdLayout: string; inAtivo: boolean; nrVersao: number; itens: ModeloItem[];
  cdFonte: FonteRelatorio; inCabecalho: boolean; nrOpacidadeFundo: number; inFundo: boolean; inIcone: boolean;
}
export interface ModeloForm {
  nmModelo: string; txDescricao: string | null; cdLayout: string; inAtivo: boolean; nrVersao?: number;
  cdFonte: FonteRelatorio; inCabecalho: boolean; nrOpacidadeFundo: number;
  itens: Array<{ nmItem: string; txOrientacao: string | null }>;
}

export interface RelatorioFotografico {
  id: number; nmTitulo: string; nmLocal: string | null; dtRelatorio: string; nrFotosPagina: number; cdLayout: string; cdStatus: StatusRelatorio;
  idModelo: number | null; nmModelo: string | null; idFase: number | null; nmFase: string | null;
  idAutor: number; nmAutor: string | null; qtFotos: number; nrVersao: number;
  /** Só no detalhe. */
  itens?: ItemRelatorio[];
}

export interface ItemForm { id?: number; nmItem: string; txOrientacao: string | null; txResposta: string | null }
export interface RelatorioForm {
  nmTitulo: string; nmLocal: string | null; dtRelatorio: string; cdLayout?: string; idModelo?: number | null;
  nrVersao?: number; itens?: ItemForm[];
}

const BASE = "/relatorios-fotograficos";
const json = (c: unknown) => JSON.stringify(c);

export const relatorioFotograficoService = {
  modelos: async () => (await apiFetch<ModeloRelatorio[]>(`${BASE}/modelos`)) ?? [],
  criarModelo: (f: ModeloForm) => apiFetch<ModeloRelatorio>(`${BASE}/modelos`, { method: "POST", body: json(f) }),
  alterarModelo: (id: number, f: ModeloForm) => apiFetch<ModeloRelatorio>(`${BASE}/modelos/${id}`, { method: "PUT", body: json(f) }),

  listar: async () => (await apiFetch<RelatorioFotografico[]>(BASE)) ?? [],
  detalhar: (id: number) => apiFetch<RelatorioFotografico>(`${BASE}/${id}`),
  /** idFase vai no cabeçalho X-Fase quando a pessoa participa de mais de uma fase. */
  criar: (f: RelatorioForm, idFase?: number | null) =>
    apiFetch<RelatorioFotografico>(BASE, { method: "POST", body: json(f), headers: idFase ? { "X-Fase": String(idFase) } : undefined }),
  alterar: (id: number, f: RelatorioForm) => apiFetch<RelatorioFotografico>(`${BASE}/${id}`, { method: "PUT", body: json(f) }),
  alterarStatus: (id: number, cdStatus: StatusRelatorio, nrVersao: number) =>
    apiFetch<RelatorioFotografico>(`${BASE}/${id}/status`, { method: "PUT", body: json({ cdStatus, nrVersao }) }),
  excluir: async (id: number, nrVersao: number) => { await apiFetch(`${BASE}/${id}?nrVersao=${nrVersao}`, { method: "DELETE" }); },

  adicionarFoto: (idItem: number, imagem: Blob, nome: string, txLegenda: string | null) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, nome);
    if (txLegenda) corpo.append("txLegenda", txLegenda);
    return apiFetch<FotoRelatorio>(`${BASE}/itens/${idItem}/fotos`, { method: "POST", body: corpo });
  },
  alterarFoto: (id: number, txLegenda: string | null, nrOrdem?: number) =>
    apiFetch<FotoRelatorio>(`${BASE}/fotos/${id}`, { method: "PUT", body: json({ txLegenda, nrOrdem }) }),
  excluirFoto: async (id: number) => { await apiFetch(`${BASE}/fotos/${id}`, { method: "DELETE" }); },
  imagem: (id: number) => apiBlob(`${BASE}/fotos/${id}/imagem`),
  /** Troca a imagem (depois de cortar, girar ou marcar); legenda e ordem ficam. */
  trocarImagem: (id: number, imagem: Blob) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, `foto-${id}.jpg`);
    return apiFetch<FotoRelatorio>(`${BASE}/fotos/${id}/imagem`, { method: "PUT", body: corpo });
  },

  imagemModelo: (id: number, tipo: TipoImagemModelo) => apiBlob(`${BASE}/modelos/${id}/imagens/${tipo}`),
  enviarImagemModelo: (id: number, tipo: TipoImagemModelo, imagem: Blob, nome: string) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, nome);
    return apiFetch<ModeloRelatorio>(`${BASE}/modelos/${id}/imagens/${tipo}`, { method: "POST", body: corpo });
  },
  removerImagemModelo: (id: number, tipo: TipoImagemModelo) =>
    apiFetch<ModeloRelatorio>(`${BASE}/modelos/${id}/imagens/${tipo}`, { method: "DELETE" }),
};
