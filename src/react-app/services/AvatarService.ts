import { apiFetch } from "./apiClient";

export interface AvatarUsuario {
  idUsuario: number; nmNome: string; nmCargo: string | null; dsConfig: string | null; dhAlteracao: string | null; flProprio: boolean;
}

const BASE = "/avatares";

export const avatarService = {
  meu: () => apiFetch<AvatarUsuario>(`${BASE}/meu`),
  salvar: (dsConfig: string) => apiFetch<AvatarUsuario>(`${BASE}/meu`, { method: "PUT", body: JSON.stringify({ dsConfig }) }),
  equipe: async () => (await apiFetch<AvatarUsuario[]>(`${BASE}/equipe`)) ?? [],
};
