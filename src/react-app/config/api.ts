/**
 * URL base da API. Em produção vem obrigatoriamente de VITE_API_BASE_URL (o build falha sem ela, ver
 * vite.config.ts); em desenvolvimento, sem a variável, usa o proxy do Vite para o backend local.
 */
export const API_BASE: string = (
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "/api/v1/nord-tool" : "")
).replace(/\/+$/, "");
