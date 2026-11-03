/**
 * A tela deve se mexer menos? Vale a escolha de Configurações → Aparência (ou o aparelho), aplicada como a classe
 * nt-menos-movimento no <html> pelo TemaProvider e pelo script do index.html.
 */
export const menosMovimento = (): boolean =>
  typeof document !== "undefined" && document.documentElement.classList.contains("nt-menos-movimento");
