/** Regras puras dos mapeamentos (contagem de campo e quantitativos), testáveis em node. */

export type TipoMapeamento = "CONTAGEM" | "QUANTITATIVO";

export const ROTULO_TIPO: Record<TipoMapeamento, string> = {
  CONTAGEM: "Contagem em campo",
  QUANTITATIVO: "Quantitativo (projeto × medido × solicitado)",
};

export interface LinhaMapeamento {
  nmGrupo: string | null;
  nmItem: string;
  nmUnidade: string;
  qtProjeto: number | null;
  qtMedida: number | null;
  qtSolicitada: number | null;
  txObservacao: string | null;
}

export type Alerta = "SOLICITADO_ACIMA_MEDIDO" | "MEDIDO_ACIMA_PROJETO" | "SOLICITADO_ACIMA_PROJETO" | "SEM_PROJETO";

export const ROTULO_ALERTA: Record<Alerta, string> = {
  SOLICITADO_ACIMA_MEDIDO: "Solicitado acima do medido",
  SOLICITADO_ACIMA_PROJETO: "Solicitado acima do projeto",
  MEDIDO_ACIMA_PROJETO: "Medido acima do projeto",
  SEM_PROJETO: "Sem quantidade de projeto",
};

export interface Comparacao {
  /** medido − projeto */
  difMedido: number | null;
  /** medido / projeto em % (100 = igual ao projeto) */
  pctMedido: number | null;
  /** solicitado − medido */
  difSolicitado: number | null;
  alertas: Alerta[];
}

const arred = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Compara uma linha de quantitativo. Passar do projeto (medido ou solicitado) só alerta acima da tolerância;
 * solicitado acima do medido alerta sempre (quem pede não pode pedir mais do que foi medido).
 */
export function comparar(l: Pick<LinhaMapeamento, "qtProjeto" | "qtMedida" | "qtSolicitada">, tolerancia: number): Comparacao {
  const alertas: Alerta[] = [];
  const { qtProjeto: p, qtMedida: m, qtSolicitada: s } = l;
  const limite = p == null ? null : p * (1 + tolerancia / 100);
  if (p == null && (m != null || s != null)) alertas.push("SEM_PROJETO");
  if (limite != null && m != null && m > limite + 1e-9) alertas.push("MEDIDO_ACIMA_PROJETO");
  if (s != null && m != null && s > m + 1e-9) alertas.push("SOLICITADO_ACIMA_MEDIDO");
  if (limite != null && s != null && s > limite + 1e-9) alertas.push("SOLICITADO_ACIMA_PROJETO");
  return {
    difMedido: p != null && m != null ? arred(m - p) : null,
    pctMedido: p != null && m != null && p > 0 ? Math.round((m / p) * 1000) / 10 : null,
    difSolicitado: s != null && m != null ? arred(s - m) : null,
    alertas,
  };
}

export interface TotalGrupo { grupo: string; unidade: string; linhas: number; projeto: number; medida: number; solicitada: number }

/** Soma por grupo e unidade (não se soma m² com m³). Grupo vazio vira "Sem grupo". */
export function totaisPorGrupo(linhas: LinhaMapeamento[]): TotalGrupo[] {
  const mapa = new Map<string, TotalGrupo>();
  for (const l of linhas) {
    const grupo = l.nmGrupo?.trim() || "Sem grupo";
    const unidade = l.nmUnidade?.trim() || "un";
    const chave = `${grupo}\u0000${unidade}`;
    const t = mapa.get(chave) ?? { grupo, unidade, linhas: 0, projeto: 0, medida: 0, solicitada: 0 };
    t.linhas += 1;
    t.projeto = arred(t.projeto + (l.qtProjeto ?? 0));
    t.medida = arred(t.medida + (l.qtMedida ?? 0));
    t.solicitada = arred(t.solicitada + (l.qtSolicitada ?? 0));
    mapa.set(chave, t);
  }
  return [...mapa.values()].sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR") || a.unidade.localeCompare(b.unidade, "pt-BR"));
}

/** Número digitado em pt-BR ("1.250,5", "12,75", "3") ou com ponto decimal ("12.75"). Vazio = null; inválido = NaN. */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, "");
  if (!t) return null;
  let normal = t;
  if (t.includes(",")) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(normal)) return Number.NaN;
  return Number(normal);
}

export function formatarNumero(n: number | null | undefined, casas = 3): string {
  if (n == null || Number.isNaN(n)) return "";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

/**
 * Linhas coladas de uma planilha (Tab entre colunas). Colunas: Grupo, Item, Unidade, Projeto, Medido, Solicitado.
 * Cabeçalho (linha com "item") é ignorado; linhas sem item são descartadas; números inválidos viram erro.
 */
export function lerColagem(texto: string): { linhas: LinhaMapeamento[]; erros: string[] } {
  const linhas: LinhaMapeamento[] = [];
  const erros: string[] = [];
  texto.split(/\r?\n/).forEach((bruta, i) => {
    if (!bruta.trim()) return;
    const c = bruta.split("\t").map(x => x.trim());
    if (i === 0 && c.some(x => x.toLowerCase() === "item")) return;
    const [grupo = "", item = "", unidade = "", ...numeros] = c;
    if (!item) { erros.push(`Linha ${i + 1}: sem item.`); return; }
    const [p, m, s] = [0, 1, 2].map(k => lerNumero(numeros[k] ?? ""));
    if ([p, m, s].some(v => v != null && (Number.isNaN(v) || v < 0))) { erros.push(`Linha ${i + 1}: quantidade inválida.`); return; }
    linhas.push({ nmGrupo: grupo || null, nmItem: item.slice(0, 150), nmUnidade: (unidade || "un").slice(0, 10), qtProjeto: p, qtMedida: m, qtSolicitada: s, txObservacao: null });
  });
  return { linhas, erros };
}

/** Linhas para a planilha exportada (cabeçalhos em português, números como número). */
export function linhasPlanilha(tipo: TipoMapeamento, linhas: LinhaMapeamento[], tolerancia: number): Record<string, string | number | null>[] {
  return linhas.map((l): Record<string, string | number | null> => {
    if (tipo === "CONTAGEM") {
      return { Grupo: l.nmGrupo, Item: l.nmItem, Unidade: l.nmUnidade, Contado: l.qtMedida, Observação: l.txObservacao };
    }
    const c = comparar(l, tolerancia);
    return {
      Grupo: l.nmGrupo, Item: l.nmItem, Unidade: l.nmUnidade, Projeto: l.qtProjeto, Medido: l.qtMedida, Solicitado: l.qtSolicitada,
      "Medido − Projeto": c.difMedido, "% do projeto": c.pctMedido, "Solicitado − Medido": c.difSolicitado,
      Alertas: c.alertas.map(a => ROTULO_ALERTA[a]).join("; ") || null, Observação: l.txObservacao,
    };
  });
}
