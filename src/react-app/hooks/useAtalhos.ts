import { useEffect } from "react";

/** Elementos em que a digitação não pode virar atalho. */
function digitando(alvo: EventTarget | null): boolean {
  const el = alvo as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Atalhos de uma tecla (sem Ctrl/Alt/Meta), ignorados enquanto se digita num campo ou com uma janela aberta.
 * `atalhos`: tecla (minúscula, ex.: "n", "ArrowLeft") -> ação.
 */
export function useAtalhos(atalhos: Record<string, () => void>, ativo = true): void {
  useEffect(() => {
    if (!ativo) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || digitando(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const acao = atalhos[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (acao) {
        e.preventDefault();
        acao();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [atalhos, ativo]);
}
