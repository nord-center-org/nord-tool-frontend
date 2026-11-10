import { apiBlob, apiFetch } from "./apiClient";

export type TipoImagemPlaca = "fundo" | "logo";

export interface ModeloPlaca {
  id: number;
  nmModelo: string;
  config: unknown;
  inFundo: boolean;
  inLogo: boolean;
  versaoFundo: number | null;
  versaoLogo: number | null;
  inAtivo: boolean;
  dhAtualizacao: string;
}

export interface Placa {
  id: number;
  idModelo: number;
  nmTitulo: string;
  valores: unknown;
  nmUsuario: string | null;
  dhAtualizacao: string;
}

const BASE = "/placas";
const json = (c: unknown) => JSON.stringify(c);

export const placaService = {
  modelos: async () => (await apiFetch<ModeloPlaca[]>(`${BASE}/modelos`)) ?? [],
  criarModelo: (f: { nmModelo: string; config: unknown; inAtivo?: boolean }) => apiFetch<ModeloPlaca>(`${BASE}/modelos`, { method: "POST", body: json(f) }),
  alterarModelo: (id: number, f: { nmModelo: string; config: unknown; inAtivo?: boolean }) =>
    apiFetch<ModeloPlaca>(`${BASE}/modelos/${id}`, { method: "PUT", body: json(f) }),
  excluirModelo: (id: number) => apiFetch<void>(`${BASE}/modelos/${id}`, { method: "DELETE" }),
  imagem: (id: number, tipo: TipoImagemPlaca, versao: number | null) => apiBlob(`${BASE}/modelos/${id}/imagens/${tipo}?v=${versao ?? 0}`),
  enviarImagem: (id: number, tipo: TipoImagemPlaca, imagem: Blob, nome: string) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, nome);
    return apiFetch<ModeloPlaca>(`${BASE}/modelos/${id}/imagens/${tipo}`, { method: "POST", body: corpo });
  },
  removerImagem: (id: number, tipo: TipoImagemPlaca) => apiFetch<ModeloPlaca>(`${BASE}/modelos/${id}/imagens/${tipo}`, { method: "DELETE" }),

  /** v2: imagem solta para pôr na folha; devolve o id que o modelo/a placa guarda. */
  enviarImagemSolta: async (imagem: Blob, nome: string) => {
    const corpo = new FormData();
    corpo.append("arquivo", imagem, nome);
    return (await apiFetch<number>(`${BASE}/imagens`, { method: "POST", body: corpo })) ?? 0;
  },
  imagemSolta: (id: number) => apiBlob(`${BASE}/imagens/${id}`),

  listar: async () => (await apiFetch<Placa[]>(BASE)) ?? [],
  criar: (f: { idModelo: number; nmTitulo: string; valores: unknown }) => apiFetch<Placa>(BASE, { method: "POST", body: json(f) }),
  alterar: (id: number, f: { idModelo: number; nmTitulo: string; valores: unknown }) => apiFetch<Placa>(`${BASE}/${id}`, { method: "PUT", body: json(f) }),
  excluir: (id: number) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};
