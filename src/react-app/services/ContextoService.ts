import type { ObraContexto } from "../utils/contextoObra";
import { apiFetch } from "./apiClient";

export const contextoService = {
  /** Obras e fases que o usuário logado pode escolher (o admin vê todas). */
  minhasObras: async (): Promise<ObraContexto[]> => (await apiFetch<ObraContexto[]>("/contexto/obras")) ?? [],
};
