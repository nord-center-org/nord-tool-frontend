/**
 * Preferências do Repertório que valem para todas as músicas deste aparelho (ex.: mostrar todas as notas no braço).
 * Guardadas no localStorage; sem acesso a ele, vale o padrão.
 */

export interface PreferenciasRepertorio {
  /** Todas as notas do braço/teclado em cinza; a que toca acende na cor. */
  todasNotas: boolean;
  /** v4: como o instrumento aparece — as notas caindo ou o mapa do braço com todas as notas coloridas. */
  vista: VistaInstrumento;
}

export type VistaInstrumento = "queda" | "mapa";

export const PREFERENCIAS_PADRAO: PreferenciasRepertorio = { todasNotas: false, vista: "queda" };
export const CHAVE_PREFERENCIAS = "@NordTool:repertorio";

export function lerPreferencias(storage: Pick<Storage, "getItem"> | undefined): PreferenciasRepertorio {
  try {
    const bruto = storage?.getItem(CHAVE_PREFERENCIAS);
    const v: unknown = bruto ? JSON.parse(bruto) : null;
    if (!v || typeof v !== "object") return { ...PREFERENCIAS_PADRAO };
    const o = v as Record<string, unknown>;
    return {
      todasNotas: typeof o.todasNotas === "boolean" ? o.todasNotas : PREFERENCIAS_PADRAO.todasNotas,
      vista: o.vista === "mapa" || o.vista === "queda" ? o.vista : PREFERENCIAS_PADRAO.vista,
    };
  } catch {
    return { ...PREFERENCIAS_PADRAO };
  }
}

export function gravarPreferencias(storage: Pick<Storage, "setItem"> | undefined, p: PreferenciasRepertorio) {
  try { storage?.setItem(CHAVE_PREFERENCIAS, JSON.stringify(p)); } catch { /* sem espaço ou bloqueado: fica só nesta visita */ }
}
