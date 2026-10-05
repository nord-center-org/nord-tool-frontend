import type {
  ApartamentoVistoriaDto,
  ApartamentoVistoriaForm,
} from "@/shared/types";
import { apiFetch } from "./apiClient";

const BASE_PATH = "/apartamentoVistoria";

export const apartamentoVistoriaService = {
  async listar(): Promise<ApartamentoVistoriaDto[]> {
    return (await apiFetch<ApartamentoVistoriaDto[]>(BASE_PATH)) || [];
  },

  async getById(id: number): Promise<ApartamentoVistoriaDto> {
    return apiFetch<ApartamentoVistoriaDto>(`${BASE_PATH}/${id}`);
  },

  async criar(data: ApartamentoVistoriaForm) {
    return apiFetch(BASE_PATH, { method: "POST", body: JSON.stringify(data) });
  },

  async editar(data: ApartamentoVistoriaForm) {
    return apiFetch(BASE_PATH, { method: "PUT", body: JSON.stringify(data) });
  },

  async deletar(id: number) {
    await apiFetch(`${BASE_PATH}/${id}`, { method: "DELETE" });
  },

  async importar(file: File) {
    // O backend espera o campo "planilha" (@RequestParam("planilha")).
    const formData = new FormData();
    formData.append("planilha", file);
    return apiFetch(`${BASE_PATH}/importar`, { method: "POST", body: formData });
  },

  // Atenção: a rota ainda não existe no backend.
  async atualizarAgendaEmMassa(payload: unknown) {
    return apiFetch(`${BASE_PATH}/atualizar-agenda-massa`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
