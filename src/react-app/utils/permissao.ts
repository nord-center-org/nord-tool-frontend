import type { PermissaoModulo } from "@/shared/types";

export type AcaoPermissao = "LEITURA" | "ESCRITA";

/**
 * Ponto de extensão da hierarquia de acessos: o módulo "*" libera tudo,
 * e ESCRITA inclui LEITURA.
 */
export function temPermissao(
  permissoes: PermissaoModulo[] | undefined,
  modulo: string,
  acao: AcaoPermissao = "LEITURA",
): boolean {
  if (!permissoes) return false;
  return permissoes.some(p => {
    const moduloOk = p.cdModulo === "*" || p.cdModulo.toUpperCase() === modulo.toUpperCase();
    const acaoOk = p.cdAcao === "ESCRITA" || acao === "LEITURA";
    return moduloOk && acaoOk;
  });
}
