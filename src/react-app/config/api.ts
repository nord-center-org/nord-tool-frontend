export const API_BASE: string = (
  import.meta.env.VITE_API_BASE_URL ??
  "https://nordtoolbackend-develop.up.railway.app/api/v1/nord-tool"
).replace(/\/+$/, "");
