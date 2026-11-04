import { createContext, useContext } from "react";

/** Print recortado de uma tela do app, esperando para entrar no chat da Lugia. */
export interface PrintPendente {
  nome: string;
  mime: string;
  base64: string;
  /** Caminho da tela capturada, ex.: /gestao/financeiro. */
  tela: string;
  /** Tela que pediu o print e para onde ele volta (a Lugia ou o SAC). */
  destino: string;
}

/** O que a tela da Lugia precisa lembrar enquanto a pessoa vai a outra tela tirar o print. */
export interface SessaoLugia {
  idConversa: number | null;
  rascunho: string;
}

export type EstadoCaptura = "inativo" | "navegando" | "selecionando" | "capturando";

export interface CapturaLugia {
  estado: EstadoCaptura;
  /**
   * "agora": marca a área na tela atual; "escolher": deixa a pessoa navegar até a tela e depois capturar.
   * O print volta para `destino` (padrão: a Lugia).
   */
  iniciar: (modo: "agora" | "escolher", destino?: string) => void;
  cancelar: () => void;
  prints: PrintPendente[];
  /** Entrega os prints pendentes de um destino (padrão: a Lugia) e tira eles da fila. */
  consumirPrints: (destino?: string) => PrintPendente[];
  sessao: SessaoLugia;
  atualizarSessao: (parcial: Partial<SessaoLugia>) => void;
}

export const ContextoCapturaLugia = createContext<CapturaLugia | null>(null);

export function useCapturaLugia(): CapturaLugia {
  const valor = useContext(ContextoCapturaLugia);
  if (!valor) throw new Error("useCapturaLugia precisa estar dentro de <CapturaLugiaProvider>");
  return valor;
}
