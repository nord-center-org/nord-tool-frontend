/**
 * Preferências do Repertório que valem para todas as músicas deste aparelho (ex.: mostrar todas as notas no braço).
 * Guardadas no localStorage; sem acesso a ele, vale o padrão.
 */

export interface PreferenciasRepertorio {
  /** Todas as notas do braço/teclado em cinza; a que toca acende na cor. */
  todasNotas: boolean;
  /** v4: como o instrumento aparece — as notas caindo ou o mapa do braço com todas as notas coloridas. */
  vista: VistaInstrumento;
  /** v5: o sintetizador toca as notas do instrumento junto com a música. */
  sintetizador: boolean;
  /** v5: volume do sintetizador (0 a 1,5). */
  volumeSintetizador: number;
  /** v10: o que o player mostra — a cifra e o instrumento, só a cifra ou só o instrumento. */
  exibir: "ambos" | "cifra" | "instrumento";
}

export type VistaInstrumento = "queda" | "mapa";

export const PREFERENCIAS_PADRAO: PreferenciasRepertorio = { todasNotas: false, vista: "queda", sintetizador: false, volumeSintetizador: 0.7, exibir: "ambos" };
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
      sintetizador: typeof o.sintetizador === "boolean" ? o.sintetizador : PREFERENCIAS_PADRAO.sintetizador,
      volumeSintetizador: typeof o.volumeSintetizador === "number" && Number.isFinite(o.volumeSintetizador)
        ? Math.max(0, Math.min(1.5, o.volumeSintetizador)) : PREFERENCIAS_PADRAO.volumeSintetizador,
      exibir: o.exibir === "cifra" || o.exibir === "instrumento" || o.exibir === "ambos" ? o.exibir : PREFERENCIAS_PADRAO.exibir,
    };
  } catch {
    return { ...PREFERENCIAS_PADRAO };
  }
}

export function gravarPreferencias(storage: Pick<Storage, "setItem"> | undefined, p: PreferenciasRepertorio) {
  try { storage?.setItem(CHAVE_PREFERENCIAS, JSON.stringify(p)); } catch { /* sem espaço ou bloqueado: fica só nesta visita */ }
}
