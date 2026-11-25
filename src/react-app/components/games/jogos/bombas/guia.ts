/** A preferência fica só neste aparelho. Armazenamento bloqueado não impede jogar. */
export function precisaGuiaBombas() {
  try { return localStorage.getItem("nord-bombas-guia-v27") !== "visto"; }
  catch { return true; }
}

export function marcarGuiaBombas() {
  try { localStorage.setItem("nord-bombas-guia-v27", "visto"); }
  catch { /* Jogar continua possível sem armazenamento no aparelho. */ }
}
