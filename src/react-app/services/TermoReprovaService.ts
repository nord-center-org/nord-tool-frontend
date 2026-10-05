import type {
  OrdemFoto,
  SituacaoTermo,
  TermoFotoDto,
  TermoReprovaDto,
  TermoReprovaResumo,
} from "@/shared/types";
import { apiBlob, apiFetch } from "./apiClient";

const BASE = "/apartamentoVistoria";
const TERMOS = `${BASE}/termos-reprova`;

export interface NovaFoto {
  imagem: Blob;
  miniatura: Blob;
  /** Nome do arquivo da imagem (a miniatura é nomeada pelo servidor). */
  nome: string;
  nrPagina: number;
  legenda?: string;
}

export interface EdicaoFoto {
  /** Imagem e miniatura devem vir juntas. */
  imagem?: Blob;
  miniatura?: Blob;
  nome?: string;
  legenda?: string;
  nrPagina?: number;
}

function formArquivo(arquivo: Blob, nome: string, nrPaginas: number): FormData {
  const form = new FormData();
  form.append("arquivo", arquivo, nome);
  form.append("nrPaginas", String(nrPaginas));
  return form;
}

export const termoReprovaService = {
  async listar(idApartamento: number): Promise<TermoReprovaResumo[]> {
    return (await apiFetch<TermoReprovaResumo[]>(`${BASE}/${idApartamento}/termos-reprova`)) ?? [];
  },

  buscar(idTermo: number): Promise<TermoReprovaDto> {
    return apiFetch<TermoReprovaDto>(`${TERMOS}/${idTermo}`);
  },

  /** Novo termo; o servidor numera como max + 1. */
  criar(idApartamento: number, arquivo: Blob, nome: string, nrPaginas: number): Promise<TermoReprovaDto> {
    return apiFetch<TermoReprovaDto>(`${BASE}/${idApartamento}/termos-reprova`, {
      method: "POST",
      body: formArquivo(arquivo, nome, nrPaginas),
    });
  },

  /** Troca o PDF; `avisos` informa fotos removidas por páginas que deixaram de existir. */
  trocarArquivo(idTermo: number, arquivo: Blob, nome: string, nrPaginas: number): Promise<TermoReprovaDto> {
    return apiFetch<TermoReprovaDto>(`${TERMOS}/${idTermo}/arquivo`, {
      method: "PUT",
      body: formArquivo(arquivo, nome, nrPaginas),
    });
  },

  atualizarSituacao(idTermo: number, situacao: SituacaoTermo, observacao: string): Promise<TermoReprovaDto> {
    return apiFetch<TermoReprovaDto>(`${TERMOS}/${idTermo}/situacao`, {
      method: "PUT",
      body: JSON.stringify({ situacao, observacao }),
    });
  },

  async excluir(idTermo: number): Promise<void> {
    await apiFetch(`${TERMOS}/${idTermo}`, { method: "DELETE" });
  },

  baixarPdf(idTermo: number, versao?: number): Promise<Blob> {
    return apiBlob(`${TERMOS}/${idTermo}/arquivo${versao ? `?v=${versao}` : ""}`);
  },

  adicionarFoto(idTermo: number, foto: NovaFoto): Promise<TermoFotoDto> {
    const form = new FormData();
    form.append("imagem", foto.imagem, foto.nome);
    form.append("miniatura", foto.miniatura, `miniatura-${foto.nome}`);
    form.append("nrPagina", String(foto.nrPagina));
    if (foto.legenda) form.append("legenda", foto.legenda);
    return apiFetch<TermoFotoDto>(`${TERMOS}/${idTermo}/fotos`, { method: "POST", body: form });
  },

  editarFoto(idFoto: number, edicao: EdicaoFoto): Promise<TermoFotoDto> {
    const form = new FormData();
    if (edicao.imagem && edicao.miniatura) {
      const nome = edicao.nome ?? "foto.jpg";
      form.append("imagem", edicao.imagem, nome);
      form.append("miniatura", edicao.miniatura, `miniatura-${nome}`);
    }
    if (edicao.legenda !== undefined) form.append("legenda", edicao.legenda);
    if (edicao.nrPagina !== undefined) form.append("nrPagina", String(edicao.nrPagina));
    return apiFetch<TermoFotoDto>(`${TERMOS}/fotos/${idFoto}`, { method: "PUT", body: form });
  },

  async excluirFoto(idFoto: number): Promise<void> {
    await apiFetch(`${TERMOS}/fotos/${idFoto}`, { method: "DELETE" });
  },

  ordenarFotos(idTermo: number, ordem: OrdemFoto[]): Promise<TermoFotoDto[]> {
    return apiFetch<TermoFotoDto[]>(`${TERMOS}/${idTermo}/fotos/ordem`, {
      method: "PUT",
      body: JSON.stringify(ordem),
    });
  },

  /** `versao` (nrVersao do DTO) separa as versões no cache do navegador. */
  baixarImagem(idFoto: number, versao?: number): Promise<Blob> {
    return apiBlob(`${TERMOS}/fotos/${idFoto}/imagem${versao ? `?v=${versao}` : ""}`);
  },

  baixarMiniatura(idFoto: number, versao?: number): Promise<Blob> {
    return apiBlob(`${TERMOS}/fotos/${idFoto}/miniatura${versao ? `?v=${versao}` : ""}`);
  },
};
