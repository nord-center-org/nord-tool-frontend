/** Detectores puros dos segredos do Davi Job (testáveis em node). */

/** Guarda as últimas teclas e diz quando a palavra secreta foi digitada (sem diferenciar maiúsculas). */
export function criarDetectorPalavra(palavra: string) {
  const alvo = palavra.toLowerCase();
  let buffer = "";
  return (tecla: string): boolean => {
    if (tecla.length !== 1) return false;
    buffer = (buffer + tecla.toLowerCase()).slice(-alvo.length);
    if (buffer === alvo) { buffer = ""; return true; }
    return false;
  };
}

/** Conta toques rápidos: dispara quando houver `vezes` toques dentro de `janelaMs`. */
export function criarContadorToques(vezes: number, janelaMs: number) {
  let toques: number[] = [];
  return (agora: number): boolean => {
    toques = [...toques.filter(t => agora - t <= janelaMs), agora];
    if (toques.length >= vezes) { toques = []; return true; }
    return false;
  };
}

/** Teclas digitadas em campos de texto não contam (para não disparar ao escrever "Davi" num formulário). */
export function ehCampoDeTexto(el: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!el) return false;
  const tag = (el.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el.isContentEditable);
}

export const EVENTO_DAVI = "nordtool:davi";
