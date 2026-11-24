import { apiFetch } from "./apiClient";

export type CodigoRede = "YOUTUBE" | "INSTAGRAM" | "TIKTOK";

export interface ContaMarketing { id: number; cdRede: CodigoRede; txNome: string; txFoto: string | null; dhCriacao: string }
export interface RedeMarketing { cdRede: CodigoRede; nmRede: string; inConfigurada: boolean; contas: ContaMarketing[] }
export interface MidiaMarketing { id: string; nrTamanhoParte: number; nrPartes: number }
export type StatusPublicacao = "ENVIANDO" | "PUBLICADO" | "PRIVADO" | "ERRO";
export interface PublicacaoMarketing {
  id: number; idConta: number; cdRede: CodigoRede; txConta: string; txTitulo: string; inPublico: boolean;
  cdStatus: StatusPublicacao; txLink: string | null; txAviso: string | null; dhCriacao: string; dhAtualizacao: string;
}
export interface PostMarketing {
  id: string; txTitulo: string; txMiniatura: string | null; txLink: string | null; txData: string | null;
  nrViews: number | null; nrCurtidas: number | null; nrComentarios: number | null;
}
export interface PainelMarketing {
  idConta: number; cdRede: CodigoRede; txConta: string; txFoto: string | null; nrSeguidores: number | null;
  nrViewsTotais: number | null; posts: PostMarketing[]; txErro: string | null;
}

/** Marketing: contas das redes, envio do vídeo em partes, publicações e painel. */
export const marketingService = {
  redes: () => apiFetch<RedeMarketing[]>("/marketing/redes"),
  conexao: (rede: CodigoRede, origem: string) =>
    apiFetch<{ txUrl: string }>(`/marketing/conexao?rede=${encodeURIComponent(rede)}&origem=${encodeURIComponent(origem)}`),
  conectar: (cdRede: string, txCodigo: string, txEstado: string) =>
    apiFetch<ContaMarketing>("/marketing/contas", { method: "POST", body: JSON.stringify({ cdRede, txCodigo, txEstado }) }),
  desconectar: (id: number) => apiFetch<void>(`/marketing/contas/${id}`, { method: "DELETE" }),
  iniciarMidia: (txNome: string, nrTamanho: number, txTipo: string) =>
    apiFetch<MidiaMarketing>("/marketing/midias", { method: "POST", body: JSON.stringify({ txNome, nrTamanho, txTipo }) }),
  enviarParte: (id: string, indice: number, dados: ArrayBuffer) =>
    apiFetch<void>(`/marketing/midias/${encodeURIComponent(id)}/partes/${indice}`, {
      method: "PUT", body: dados, headers: { "Content-Type": "application/octet-stream" },
    }),
  publicar: (idMidia: string, txTitulo: string, txLegenda: string, inPublico: boolean, idsContas: number[]) =>
    apiFetch<PublicacaoMarketing[]>("/marketing/publicacoes", {
      method: "POST", body: JSON.stringify({ idMidia, txTitulo, txLegenda, inPublico, idsContas }),
    }),
  publicacoes: () => apiFetch<PublicacaoMarketing[]>("/marketing/publicacoes"),
  painel: (atualizar = false) => apiFetch<PainelMarketing[]>(`/marketing/painel${atualizar ? "?atualizar=true" : ""}`),
};
