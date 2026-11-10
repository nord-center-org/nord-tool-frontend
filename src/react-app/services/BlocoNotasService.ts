import { apiBlob, apiFetch } from "./apiClient";
import type { Conteudo, Fundo } from "../utils/blocoNotas";

export interface PaginaBloco {
  id: number; idCaderno: number; nrOrdem: number; cdFundo: Fundo; nrLargura: number; nrAltura: number;
  inFundo: boolean; nrVersao: number; dhAlteracao: string;
  /** v2: 0, 90, 180 ou 270. */
  nrRotacao?: number;
  /** v2: PDF original e a página dele (a tela desenha do PDF, nítido em qualquer zoom). */
  idPdf?: number | null;
  nrPaginaPdf?: number | null;
  /** Só quando a página é aberta. */
  conteudo?: unknown;
}
export interface Caderno {
  id: number; nmTitulo: string; cdCor: string; nrVersao: number; dhCriacao: string; dhAlteracao: string;
  qtPaginas: number; idCapa: number | null;
  /** Só com o caderno aberto (sem o desenho). */
  paginas?: PaginaBloco[];
}

const BASE = "/blocos-notas";
const json = (c: unknown) => JSON.stringify(c);

export const blocoNotasService = {
  cadernos: async () => (await apiFetch<Caderno[]>(BASE)) ?? [],
  abrir: (id: number) => apiFetch<Caderno>(`${BASE}/${id}`),
  criar: (nmTitulo: string, cdCor: string, cdFundo: Exclude<Fundo, "PDF">) => apiFetch<Caderno>(BASE, { method: "POST", body: json({ nmTitulo, cdCor, cdFundo }) }),
  alterar: (id: number, nmTitulo: string, cdCor: string, nrVersao: number) =>
    apiFetch<Caderno>(`${BASE}/${id}`, { method: "PUT", body: json({ nmTitulo, cdCor, nrVersao }) }),
  excluir: async (id: number) => { await apiFetch(`${BASE}/${id}`, { method: "DELETE" }); },

  pagina: (id: number) => apiFetch<PaginaBloco>(`${BASE}/paginas/${id}`),
  novaPagina: (idCaderno: number, dados: { nrPosicao?: number; cdFundo?: Fundo; nrLargura?: number; nrAltura?: number; idCopiarDe?: number }) =>
    apiFetch<PaginaBloco>(`${BASE}/${idCaderno}/paginas`, { method: "POST", body: json(dados) }),
  paginaDePdf: (idCaderno: number, imagem: Blob, largura: number, altura: number, nrPosicao?: number, pdf?: { idPdf: number; nrPagina: number }) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, "pagina.jpg");
    corpo.append("nrLargura", String(largura));
    corpo.append("nrAltura", String(altura));
    if (nrPosicao) corpo.append("nrPosicao", String(nrPosicao));
    if (pdf) { corpo.append("idPdf", String(pdf.idPdf)); corpo.append("nrPaginaPdf", String(pdf.nrPagina)); }
    return apiFetch<PaginaBloco>(`${BASE}/${idCaderno}/paginas/pdf`, { method: "POST", body: corpo });
  },
  salvar: (id: number, conteudo: Conteudo, cdFundo: Fundo, nrVersao: number, nrRotacao?: number) =>
    apiFetch<PaginaBloco>(`${BASE}/paginas/${id}`, { method: "PUT", body: json({ conteudo, cdFundo, nrVersao, nrRotacao }) }),
  /** v2: documento de texto do caderno (estilo Word). */
  documento: async (idCaderno: number) => (await apiFetch<{ html: string; nrVersao: number }>(`${BASE}/${idCaderno}/documento`)) ?? { html: "", nrVersao: 1 },
  salvarDocumento: (idCaderno: number, html: string, nrVersao: number) =>
    apiFetch<{ html: string; nrVersao: number }>(`${BASE}/${idCaderno}/documento`, { method: "PUT", body: json({ html, nrVersao }) }),
  reordenar: (idCaderno: number, ids: number[]) => apiFetch<Caderno>(`${BASE}/${idCaderno}/paginas/ordem`, { method: "PUT", body: json({ ids }) }),
  excluirPagina: (id: number) => apiFetch<Caderno>(`${BASE}/paginas/${id}`, { method: "DELETE" }),

  /** v2: guarda o PDF original (até 15 MB) e devolve o id. */
  enviarPdf: async (idCaderno: number, arquivo: Blob, nome: string) => {
    const corpo = new FormData();
    corpo.append("arquivo", arquivo, nome);
    return (await apiFetch<number>(`${BASE}/${idCaderno}/pdfs`, { method: "POST", body: corpo })) ?? 0;
  },
  pdf: (idPdf: number) => apiBlob(`${BASE}/pdfs/${idPdf}`),
  enviarImagem: async (idCaderno: number, imagem: Blob, nome: string) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, nome);
    return (await apiFetch<number>(`${BASE}/${idCaderno}/imagens`, { method: "POST", body: corpo })) ?? 0;
  },
  imagem: (id: number) => apiBlob(`${BASE}/imagens/${id}`),
  fundo: (idPagina: number) => apiBlob(`${BASE}/paginas/${idPagina}/fundo`),
};

/** v3: planilhas e documentos avulsos do bloco de notas. */
export type TipoArquivoBloco = "PLANILHA" | "DOCUMENTO";
export interface ArquivoBloco {
  id: number; cdTipo: TipoArquivoBloco; nmTitulo: string; cdCor: string; nrVersao: number; dhCriacao: string; dhAlteracao: string;
  /** Só com o arquivo aberto: JSON das abas (planilha) ou HTML (documento). */
  conteudo?: string;
}

const ARQ = "/blocos-notas/arquivos";
export const arquivosBlocoService = {
  listar: async () => (await apiFetch<ArquivoBloco[]>(ARQ)) ?? [],
  abrir: (id: number) => apiFetch<ArquivoBloco>(`${ARQ}/${id}`),
  criar: (cdTipo: TipoArquivoBloco, nmTitulo: string, conteudo?: string) =>
    apiFetch<ArquivoBloco>(ARQ, { method: "POST", body: JSON.stringify({ cdTipo, nmTitulo, conteudo }) }),
  salvar: (id: number, nrVersao: number, dados: { nmTitulo?: string; cdCor?: string; conteudo?: string }) =>
    apiFetch<ArquivoBloco>(`${ARQ}/${id}`, { method: "PUT", body: JSON.stringify({ ...dados, nrVersao }) }),
  excluir: async (id: number) => { await apiFetch(`${ARQ}/${id}`, { method: "DELETE" }); },
};
