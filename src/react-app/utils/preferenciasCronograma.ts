/**
 * Filtros e visão do Cronograma semanal guardados por pessoa neste aparelho:
 * ao voltar à tela, ela abre do jeito que foi deixada.
 */

export type VisaoCronograma = "kanban" | "lista" | "rotina";
export type ColunaListaCronograma = "status" | "dtPrazo" | "nmCronogramaSemanal" | "nmCategoria" | "nmTag";
export type FiltroPessoasSalvo =
  | { tipo: "todos" }
  | { tipo: "meus" }
  | { tipo: "outros" }
  | { tipo: "pessoas"; ids: number[]; rotulo?: string };

export interface PreferenciasCronograma {
  visao: VisaoCronograma;
  busca: string;
  categoria: string;
  pessoas: FiltroPessoasSalvo;
  filtrosColuna: Partial<Record<ColunaListaCronograma, string[]>>;
  ordenacao: { coluna: ColunaListaCronograma; direcao: "asc" | "desc" } | null;
  calendario: "semana" | "mes";
  categoriasRotina: string[];
}

export const PREFERENCIAS_PADRAO: PreferenciasCronograma = {
  visao: "kanban", busca: "", categoria: "Todas", pessoas: { tipo: "todos" },
  filtrosColuna: {}, ordenacao: null, calendario: "semana", categoriasRotina: [],
};

const COLUNAS: ColunaListaCronograma[] = ["status", "dtPrazo", "nmCronogramaSemanal", "nmCategoria", "nmTag"];
const PREFIXO = "@NordTool:cronograma_filtros:";
export const chavePreferenciasCronograma = (idUsuario: number | string) => `${PREFIXO}${idUsuario}`;

const listaDeTextos = (v: unknown, max = 200): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : [];

function pessoasValidas(v: unknown): FiltroPessoasSalvo {
  const p = v as Partial<{ tipo: string; ids: unknown; rotulo: unknown }> | null;
  if (!p || typeof p !== "object") return { tipo: "todos" };
  if (p.tipo === "meus" || p.tipo === "outros") return { tipo: p.tipo };
  if (p.tipo === "pessoas" && Array.isArray(p.ids)) {
    const ids = p.ids.filter((x): x is number => Number.isInteger(x));
    if (ids.length) return { tipo: "pessoas", ids, ...(typeof p.rotulo === "string" ? { rotulo: p.rotulo } : {}) };
  }
  return { tipo: "todos" };
}

/** Lê o que foi guardado; o que estiver estragado ou de uma versão antiga volta ao padrão, campo a campo. */
export function lerPreferenciasCronograma(storage: Pick<Storage, "getItem"> | undefined, idUsuario: number | string): PreferenciasCronograma {
  let bruto: Record<string, unknown>;
  try {
    const texto = storage?.getItem(chavePreferenciasCronograma(idUsuario));
    bruto = texto ? JSON.parse(texto) : {};
    if (!bruto || typeof bruto !== "object") return PREFERENCIAS_PADRAO;
  } catch {
    return PREFERENCIAS_PADRAO;
  }
  const filtrosColuna: PreferenciasCronograma["filtrosColuna"] = {};
  const fc = bruto.filtrosColuna as Record<string, unknown> | undefined;
  if (fc && typeof fc === "object") for (const c of COLUNAS) if (Array.isArray(fc[c])) filtrosColuna[c] = listaDeTextos(fc[c]);
  const ord = bruto.ordenacao as { coluna?: unknown; direcao?: unknown } | null | undefined;
  return {
    visao: bruto.visao === "lista" || bruto.visao === "rotina" ? bruto.visao : "kanban",
    busca: typeof bruto.busca === "string" ? bruto.busca.slice(0, 200) : "",
    categoria: typeof bruto.categoria === "string" && bruto.categoria ? bruto.categoria : "Todas",
    pessoas: pessoasValidas(bruto.pessoas),
    filtrosColuna,
    ordenacao: ord && COLUNAS.includes(ord.coluna as ColunaListaCronograma) && (ord.direcao === "asc" || ord.direcao === "desc")
      ? { coluna: ord.coluna as ColunaListaCronograma, direcao: ord.direcao } : null,
    calendario: bruto.calendario === "mes" ? "mes" : "semana",
    categoriasRotina: listaDeTextos(bruto.categoriasRotina, 20),
  };
}

export function salvarPreferenciasCronograma(storage: Pick<Storage, "setItem"> | undefined, idUsuario: number | string, p: PreferenciasCronograma): void {
  try {
    storage?.setItem(chavePreferenciasCronograma(idUsuario), JSON.stringify(p));
  } catch {
    // Sem armazenamento (modo privado): a tela só não lembra.
  }
}

/** Há algum filtro diferente do padrão? (para mostrar "Limpar filtros"). */
export const temFiltroAtivo = (p: PreferenciasCronograma) =>
  p.busca.trim() !== "" || p.categoria !== "Todas" || p.pessoas.tipo !== "todos"
  || Object.keys(p.filtrosColuna).length > 0 || p.ordenacao !== null || p.categoriasRotina.length > 0;
