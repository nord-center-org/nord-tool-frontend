/** Apoio da exportação do Cronograma em imagem: nome do arquivo e o resumo dos filtros que aparece na imagem. */

const doisDigitos = (n: number) => String(n).padStart(2, "0");

export type ModoExportacao = "lista" | "semana" | "mes";

/** Ex.: cronograma-lista-2026-11-03.png, cronograma-semana-2026-11-02.png, cronograma-mes-2026-11.png */
export function nomeArquivoImagem(modo: ModoExportacao, referencia: Date): string {
  const ano = referencia.getFullYear();
  const mes = doisDigitos(referencia.getMonth() + 1);
  const dia = doisDigitos(referencia.getDate());
  return modo === "mes" ? `cronograma-mes-${ano}-${mes}.png` : `cronograma-${modo}-${ano}-${mes}-${dia}.png`;
}

export interface FiltrosParaResumo {
  busca: string;
  categoria?: string;
  categorias?: string[];
  pessoas?: string | null;
  colunas?: { rotulo: string; valores: string[] }[];
}

/** Os filtros ativos em texto curto, para quem recebe a imagem saber o que está (e o que não está) nela. */
export function resumoFiltros(f: FiltrosParaResumo): string[] {
  const partes: string[] = [];
  if (f.busca.trim()) partes.push(`Busca: “${f.busca.trim()}”`);
  if (f.categoria && f.categoria !== "Todas") partes.push(`Categoria: ${f.categoria}`);
  if (f.categorias?.length) partes.push(`Categorias: ${f.categorias.join(", ")}`);
  if (f.pessoas) partes.push(`Pessoas: ${f.pessoas}`);
  for (const c of f.colunas ?? []) {
    if (!c.valores.length) continue;
    const valores = c.valores.length > 3 ? `${c.valores.slice(0, 3).join(", ")} +${c.valores.length - 3}` : c.valores.join(", ");
    partes.push(`${c.rotulo}: ${valores}`);
  }
  return partes;
}

/** Agrupa mantendo a ordem em que os grupos aparecem pela primeira vez. */
export function agruparEmOrdem<T, K>(itens: T[], chave: (item: T) => K): { chave: K; itens: T[] }[] {
  const grupos: { chave: K; itens: T[] }[] = [];
  for (const item of itens) {
    const k = chave(item);
    const grupo = grupos.find(g => g.chave === k);
    if (grupo) grupo.itens.push(item);
    else grupos.push({ chave: k, itens: [item] });
  }
  return grupos;
}

export const dataHoraBr = (d: Date) =>
  `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} às ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
