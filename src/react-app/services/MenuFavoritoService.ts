import { apiFetch } from "./apiClient";

export const menuFavoritoService = {
  listar: async () => (await apiFetch<string[]>("/menu-favoritos")) ?? [],
  salvar: (caminhos: string[]) => apiFetch<string[]>("/menu-favoritos", { method: "PUT", body: JSON.stringify({ caminhos }) }),
};
