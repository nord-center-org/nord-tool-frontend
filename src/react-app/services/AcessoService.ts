import { apiFetch } from "./apiClient";

export type NivelAcesso = "NENHUM" | "LEITURA" | "ESCRITA" | "ADMIN";

export interface AcessoUsuario {
  id: number;
  nmNome: string;
  nmEmail: string;
  cdPerfil: string;
  inAtivo: boolean;
  dhUltimoLogin: string | null;
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

const BASE = "/administracao/acessos";

export const acessoService = {
  listar: async (): Promise<Acessos> => {
    const r = await apiFetch<Acessos>(BASE);
    return { usuarios: r?.usuarios ?? [], perfis: r?.perfis ?? [], modulos: r?.modulos ?? [] };
  },
  salvar: (id: number, form: AcessoUsuarioForm) =>
    apiFetch<AcessoUsuario>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(form) }),
};
