import { useEffect, useState } from "react";
import { calcularContagem, type Contagem } from "@/react-app/utils/casamento";

/**
 * Contagem regressiva até o casamento (meio-dia, fuso -03:00), atualizada a cada segundo.
 * Pausa com a aba oculta e recalcula na hora ao voltar, para não gastar bateria à toa.
 */
export function useContagemRegressiva(dataIso: string | null | undefined): Contagem | null {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let timer: number | undefined;
    const parar = () => {
      if (timer !== undefined) { window.clearInterval(timer); timer = undefined; }
    };
    const iniciar = () => {
      parar();
      setAgora(Date.now());
      timer = window.setInterval(() => setAgora(Date.now()), 1000);
    };
    const aoMudarVisibilidade = () => (document.hidden ? parar() : iniciar());

    if (!document.hidden) iniciar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      parar();
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  return calcularContagem(dataIso, agora);
}
