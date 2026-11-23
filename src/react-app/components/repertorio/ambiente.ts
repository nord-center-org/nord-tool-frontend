/**
 * Drumcam v4: o Estúdio (antigo Repertório) é sempre escuro, com o tema claro ou escuro do NordTool. Os desenhos em
 * canvas (instrumento, grade do Criar, linha do tempo) usam as cores escuras dentro dele ou com o tema escuro ligado.
 */
export function desenhoEscuro(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("nt-escuro") || document.querySelector(".nt-estudio") !== null;
}
