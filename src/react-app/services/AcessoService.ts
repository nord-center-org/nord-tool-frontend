import { apiFetch } from "./apiClient";

export type NivelAcesso = "NENHUM" | "LEITURA" | "ESCRITA" | "ADMIN";

export interface AcessoUsuario {
  id: number;
  nmNome: string;
  nmEmail: string;
  cdPerfil: string;
  inAtivo: boolean;
  dhUltimoLogin: string | null;
  nrCelular?: string | null;
  idEmpresa?: number | null;
  nmEmpresa?: string | null;
  idCargo?: number | null;
  nmCargo?: string | null;
  /** PENDENTE (aguardando aprovação), APROVADO ou RECUSADO. */
  cdSituacaoCadastro?: "PENDENTE" | "APROVADO" | "RECUSADO";
  idObraSolicitada?: number | null;
  nmObraSolicitada?: string | null;
  /** Nível efetivo por módulo; módulo ausente = sem acesso. */
  acessos: Record<string, NivelAcesso>;
}

export interface AcessoPerfil {
  cdPerfil: string;
  nmPerfil: string;
  acessos: Record<string, NivelAcesso>;
}

export interface Acessos {
  usuarios: AcessoUsuario[];
  perfis: AcessoPerfil[];
  modulos: string[];
}

export interface AcessoUsuarioForm {
  cdPerfil: string;
  inAtivo: boolean;
  acessos: Record<string, NivelAcesso>;
}

export interface DadosUsuarioForm { nmNome: string; nrCelular: string; idEmpresa: number | null; idCargo: number | null }

/** Colaborador da base antiga e o usuário a que está vinculado. */
export interface ColaboradorLegado {
  idUser: number;
  nmColaborador: string;
  nmEmpresa: string | null;
  nmCargo: string | null;
  nrCelular: string | null;
  idUsuario: number | null;
  nmUsuario: string | null;
  qtRetiradas: number;
}

const BASE = "/administracao/acessos";

export const acessoService = {
  listar: async (): Promise<Acessos> => {
    const r = await apiFetch<Acessos>(BASE);
    return { usuarios: r?.usuarios ?? [], perfis: r?.perfis ?? [], modulos: r?.modulos ?? [] };
  },
  decidirCadastro: (id: number, aprovar: boolean, idsFases: number[]) =>
    apiFetch<AcessoUsuario>(`${BASE}/${id}/cadastro`, { method: "PUT", body: JSON.stringify({ aprovar, idsFases }) }),
  salvarDados: (id: number, form: DadosUsuarioForm) =>
    apiFetch<AcessoUsuario>(`${BASE}/${id}/dados`, { method: "PUT", body: JSON.stringify(form) }),
  listarLegados: async () => (await apiFetch<ColaboradorLegado[]>(`${BASE}/colaboradores-legados`)) ?? [],
  vincular: (idUser: number, idUsuario: number | null) =>
    apiFetch<ColaboradorLegado>(`${BASE}/colaboradores-legados/${idUser}`, { method: "PUT", body: JSON.stringify({ idUsuario }) }),
  salvar: (id: number, form: AcessoUsuarioForm) =>
    apiFetch<AcessoUsuario>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(form) }),
};
