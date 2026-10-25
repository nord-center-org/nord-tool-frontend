import { createContext, useContext } from "react";

/** Print recortado de uma tela do app, esperando para entrar no chat da Lugia. */
export interface PrintPendente {
  nome: string;
  mime: string;
  base64: string;
  /** Caminho da tela capturada, ex.: /gestao/financeiro. */
  tela: string;
}

/** O que a tela da Lugia precisa lembrar enquanto a pessoa vai a outra tela tirar o print. */
export interface SessaoLugia {
  idConversa: number | null;
  rascunho: string;
}

export type EstadoCaptura = "inativo" | "navegando" | "selecionando" | "capturando";

export interface CapturaLugia {
  estado: EstadoCaptura;
  /** "agora": marca a área na tela atual; "escolher": deixa a pessoa navegar até a tela e depois capturar. */
  iniciar: (modo: "agora" | "escolher") => void;
  cancelar: () => void;
  prints: PrintPendente[];
  /** Entrega os prints pendentes (e esvazia a fila). */
  consumirPrints: () => PrintPendente[];
  sessao: SessaoLugia;
  atualizarSessao: (parcial: Partial<SessaoLugia>) => void;
}

export const ContextoCapturaLugia = createContext<CapturaLugia | null>(null);

export function useCapturaLugia(): CapturaLugia {
  const valor = useContext(ContextoCapturaLugia);
  if (!valor) throw new Error("useCapturaLugia precisa estar dentro de <CapturaLugiaProvider>");
  return valor;
}
