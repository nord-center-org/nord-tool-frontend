import { useCallback, useRef, useState } from "react";
import { executarOtimista, type OpcoesOtimista, type ResultadoOtimista } from "@/react-app/utils/otimista";

export type EstadoSincronizacao = "ocioso" | "salvando" | "erro";

/**
 * Estado "salvando / erro" do módulo Casamento + execução otimista com rollback.
 * Conta operações em andamento, então vários salvamentos simultâneos não se atropelam.
 */
export function useSincronizacao() {
  const [estado, setEstado] = useState<EstadoSincronizacao>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const pendentes = useRef(0);

  const executar = useCallback(async <T,>(opcoes: OpcoesOtimista<T>): Promise<ResultadoOtimista<T>> => {
    pendentes.current += 1;
    setEstado("salvando");
    setErro(null);
    const resultado = await executarOtimista(opcoes);
    pendentes.current -= 1;
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setEstado("erro");
    } else if (pendentes.current === 0) {
      setEstado(atual => (atual === "erro" ? atual : "ocioso"));
    }
    return resultado;
  }, []);

  const limparErro = useCallback(() => {
    setErro(null);
    setEstado(pendentes.current > 0 ? "salvando" : "ocioso");
  }, []);

  return { estado, erro, executar, limparErro };
}

export type Sincronizacao = ReturnType<typeof useSincronizacao>;
