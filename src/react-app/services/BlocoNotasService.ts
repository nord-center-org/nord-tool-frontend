import { apiBlob, apiFetch } from "./apiClient";
import type { Conteudo, Fundo } from "../utils/blocoNotas";

export interface PaginaBloco {
  id: number; idCaderno: number; nrOrdem: number; cdFundo: Fundo; nrLargura: number; nrAltura: number;
  inFundo: boolean; nrVersao: number; dhAlteracao: string;
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
  paginaDePdf: (idCaderno: number, imagem: Blob, largura: number, altura: number, nrPosicao?: number) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, "pagina.jpg");
    corpo.append("nrLargura", String(largura));
    corpo.append("nrAltura", String(altura));
    if (nrPosicao) corpo.append("nrPosicao", String(nrPosicao));
    return apiFetch<PaginaBloco>(`${BASE}/${idCaderno}/paginas/pdf`, { method: "POST", body: corpo });
  },
  salvar: (id: number, conteudo: Conteudo, cdFundo: Fundo, nrVersao: number) =>
    apiFetch<PaginaBloco>(`${BASE}/paginas/${id}`, { method: "PUT", body: json({ conteudo, cdFundo, nrVersao }) }),
  reordenar: (idCaderno: number, ids: number[]) => apiFetch<Caderno>(`${BASE}/${idCaderno}/paginas/ordem`, { method: "PUT", body: json({ ids }) }),
  excluirPagina: (id: number) => apiFetch<Caderno>(`${BASE}/paginas/${id}`, { method: "DELETE" }),

  enviarImagem: async (idCaderno: number, imagem: Blob, nome: string) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, nome);
    return (await apiFetch<number>(`${BASE}/${idCaderno}/imagens`, { method: "POST", body: corpo })) ?? 0;
  },
  imagem: (id: number) => apiBlob(`${BASE}/imagens/${id}`),
  fundo: (idPagina: number) => apiBlob(`${BASE}/paginas/${idPagina}/fundo`),
};
