import { apiFetch } from "./apiClient";

export interface BilheteDrumcam { bilhete: string; papel: string }

/** Relé do Drumcam: bilhete de uso único para abrir o WebSocket (o painel é o "controle"). */
export const drumcamService = {
  bilhete: (papel: "camera" | "controle", nome?: string) =>
    apiFetch<BilheteDrumcam>("/drumcam/bilhete", { method: "POST", body: JSON.stringify({ papel, nome }) }),
};
