import { createContext, useContext } from "react";

import type { Chamado } from "@/react-app/services/SacService";

export interface NovidadesSacContexto {
  /** Chamados da pessoa com resposta ou status novo ainda não vistos (com o avatar de quem respondeu). */
  chamados: Chamado[];
  /** Só para o ADMIN do SAC: chamados de todo mundo ainda abertos. */
  abertos: number | null;
  recarregar: () => void;
  /** Quem abriu viu: some o aviso. */
  marcarVistos: (ids: number[]) => Promise<void>;
}

export const ContextoNovidadesSac = createContext<NovidadesSacContexto>({
  chamados: [], abertos: null, recarregar: () => undefined, marcarVistos: async () => undefined,
});

export const useNovidadesSac = () => useContext(ContextoNovidadesSac);
