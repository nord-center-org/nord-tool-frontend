import type { DiaSemanaDto, StatusVistoriaDto } from "@/shared/types";
import { apiFetch } from "./apiClient";

export async function listarDiasSemana(): Promise<DiaSemanaDto[]> {
  try {
    return (await apiFetch<DiaSemanaDto[]>("/diaSemana")) || [];
  } catch (error) {
    console.error("Lugia Report - Erro em listarDiasSemana:", error);
    return [];
  }
}

export async function listarStatusVistoria(): Promise<StatusVistoriaDto[]> {
  try {
    return (await apiFetch<StatusVistoriaDto[]>("/statusVistoria")) || [];
  } catch (error) {
    console.error("Lugia Report - Erro em listarStatusVistoria:", error);
    return [];
  }
}
