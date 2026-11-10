import { apiFetch } from "./apiClient";

export interface MeusDados {
  nmNome: string; nmEmail: string; nrCelular: string | null; idEmpresa: number | null; nmEmpresa: string | null; nmCargo: string | null;
}

export const meusDadosService = {
  ler: () => apiFetch<MeusDados>("/conta/dados"),
  salvar: (dados: { nmNome: string; nrCelular: string; idEmpresa: number | null }) =>
    apiFetch<MeusDados>("/conta/dados", { method: "PUT", body: JSON.stringify(dados) }),
};
