import { useAuth } from "@/react-app/contexts/AuthContext";
import { temPermissao, type AcaoPermissao } from "@/react-app/utils/permissao";

/** Ponto de extensão da hierarquia de acessos. Quem tem "*" passa em tudo; o menu ainda não é filtrado. */
export function usePermissao(modulo: string, acao: AcaoPermissao = "LEITURA"): boolean {
  const { permissoes } = useAuth();
  return temPermissao(permissoes, modulo, acao);
}
