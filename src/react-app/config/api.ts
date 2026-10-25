/**
 * URL base da API. Em produção vem obrigatoriamente de VITE_API_BASE_URL (o build falha sem ela, ver
 * vite.config.ts); em desenvolvimento, sem a variável, usa o proxy do Vite para o backend local.
 */
export const API_BASE: string = (
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "/api/v1/nord-tool" : "")
).replace(/\/+$/, "");

/**
 * URL base da Lugia (chat multi-IA, serviço lugia-center). Opcional: sem VITE_LUGIA_BASE_URL no build a tela some do menu;
 * em desenvolvimento usa o proxy do Vite (`/api/v1/lugia` → localhost:8787).
 */
export const LUGIA_BASE: string = (
  import.meta.env.VITE_LUGIA_BASE_URL ?? (import.meta.env.DEV ? "/api/v1/lugia" : "")
).replace(/\/+$/, "");
