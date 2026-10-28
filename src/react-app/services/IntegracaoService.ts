import { apiFetch } from "./apiClient";
import type { IntegracaoToken } from "../utils/integracao";

const BASE = "/integracoes/tokens";

export const integracaoService = {
  listar: async () => (await apiFetch<IntegracaoToken[]>(BASE)) ?? [],
  criar: (nmRotulo: string) => apiFetch<IntegracaoToken>(BASE, { method: "POST", body: JSON.stringify({ nmRotulo }) }),
  revogar: (idToken: number) => apiFetch<void>(`${BASE}/${idToken}`, { method: "DELETE" }),
};
