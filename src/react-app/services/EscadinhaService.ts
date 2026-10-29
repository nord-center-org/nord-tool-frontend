import { apiFetch } from "./apiClient";
import type { Ciclo, Torre } from "../utils/escadinha";

const BASE = "/escadinha";

/** Torre como o servidor guarda: config = croqui/pavimentos/apartamentos/lados (sem a imagem da prancha). */
export interface TorreServidor {
  idTorre: number;
  nmTorre: string;
  nrOrdem: number;
  config: Torre;
  ciclos: Ciclo[];
  /** Status das células da escadinha ("idPavimento|lado|idAtividade"). */
  grade?: unknown;
  temPlanta: boolean;
  nrVersao: number;
  dhAtualizacao?: string;
}

/** Tipologia de apartamento da torre (a imagem vem à parte). */
export interface TipologiaServidor {
  id: number;
  idTorre: number;
  nmTipologia: string;
  temImagem: boolean;
}

export interface EscadinhaServidor {
  torres: TorreServidor[];
  modelo: unknown;
}

export interface TorreForm {
  nmTorre: string;
  nrOrdem?: number;
  config: Torre;
  ciclos: Ciclo[];
  /** null = manter a imagem; "" = remover; data URL = trocar. */
  planta?: string | null;
  nrVersao?: number;
}

const json = (corpo: unknown): RequestInit["body"] => JSON.stringify(corpo);

/** Tira a imagem da prancha da config (ela vai no campo planta, à parte). */
export function semImagem(torre: Torre): Torre {
  if (!torre.planta?.imagem) return torre;
  const { imagem: _imagem, ...resto } = torre.planta;
  void _imagem;
  return { ...torre, planta: resto };
}

export const escadinhaService = {
  carregar: async (): Promise<EscadinhaServidor> => {
    const r = await apiFetch<EscadinhaServidor>(BASE);
    return { torres: r?.torres ?? [], modelo: r?.modelo ?? null };
  },
  planta: async (idTorre: number) => (await apiFetch<{ planta: string | null }>(`${BASE}/torres/${idTorre}/planta`))?.planta ?? null,
  criarTorre: (form: TorreForm) => apiFetch<TorreServidor>(`${BASE}/torres`, { method: "POST", body: json(form) }),
  alterarTorre: (idTorre: number, form: TorreForm) => apiFetch<TorreServidor>(`${BASE}/torres/${idTorre}`, { method: "PUT", body: json(form) }),
  excluirTorre: (idTorre: number) => apiFetch<void>(`${BASE}/torres/${idTorre}`, { method: "DELETE" }),
  salvarModelo: (modelo: unknown) => apiFetch<EscadinhaServidor>(`${BASE}/modelo`, { method: "PUT", body: json({ modelo }) }),
  /** Marca células (E executado, X em execução, N não se aplica, "" limpa); devolve a grade com as mudanças de todos. */
  marcarCelulas: async (idTorre: number, alteracoes: { chave: string; status: string; data?: string }[]) =>
    (await apiFetch<{ grade: unknown }>(`${BASE}/torres/${idTorre}/celulas`, { method: "PUT", body: json({ alteracoes }) }))?.grade ?? {},
  tipologias: async (idTorre: number) => (await apiFetch<TipologiaServidor[]>(`${BASE}/torres/${idTorre}/tipologias`)) ?? [],
  imagemTipologia: async (id: number) => (await apiFetch<{ planta: string | null }>(`${BASE}/tipologias/${id}/imagem`))?.planta ?? null,
  salvarTipologia: (idTorre: number, form: { nmTipologia: string; imagem?: string | null }, id?: number) =>
    apiFetch<TipologiaServidor>(id ? `${BASE}/tipologias/${id}` : `${BASE}/torres/${idTorre}/tipologias`, { method: id ? "PUT" : "POST", body: json(form) }),
  excluirTipologia: (id: number) => apiFetch<void>(`${BASE}/tipologias/${id}`, { method: "DELETE" }),
};
