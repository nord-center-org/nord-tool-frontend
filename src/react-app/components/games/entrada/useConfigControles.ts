import { useEffect, useState } from "react";
import { aoMudarConfig, carregarConfig, type ConfigControles } from "@/react-app/utils/games/configControles";

/** Preferências de controle deste aparelho, atualizadas na hora quando mudam. */
export function useConfigControles(): ConfigControles {
  const [c, setC] = useState(carregarConfig);
  useEffect(() => aoMudarConfig(setC), []);
  return c;
}
