/**
 * Cronograma semanal v3: a demanda pontual pode durar vários dias (do dia de início ao dia de fim). Datas aqui são
 * sempre AAAA-MM-DD (dá para comparar como texto).
 */

export type PosicaoNoPeriodo = "unico" | "inicio" | "meio" | "fim";

/** Onde o dia cai no período da demanda; null = fora. Sem fim (ou fim igual ao início) é um dia só. */
export function posicaoNoPeriodo(inicio: string | null | undefined, fim: string | null | undefined, dia: string): PosicaoNoPeriodo | null {
  if (!inicio) return null;
  if (!fim || fim <= inicio) return dia === inicio ? "unico" : null;
  if (dia < inicio || dia > fim) return null;
  return dia === inicio ? "inicio" : dia === fim ? "fim" : "meio";
}

/** Os dois dias tocados no calendário, em ordem. */
export const emOrdem = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

/** Quantos dias o período tem (contando os dois). */
export function diasNoPeriodo(inicio: string, fim: string | null | undefined): number {
  if (!fim || fim <= inicio) return 1;
  const ms = Date.UTC(+fim.slice(0, 4), +fim.slice(5, 7) - 1, +fim.slice(8, 10)) - Date.UTC(+inicio.slice(0, 4), +inicio.slice(5, 7) - 1, +inicio.slice(8, 10));
  return Math.round(ms / 86_400_000) + 1;
}

const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** O que aparece em cima da demanda em cada dia do período. */
export function rotuloDoPeriodo(posicao: PosicaoNoPeriodo, inicio: string, fim: string | null | undefined, hora: string): string {
  if (posicao === "unico") return `◷ ${hora}`;
  if (posicao === "inicio") return `◷ ${hora} → ${curta(fim as string)}`;
  if (posicao === "fim") return `⇥ termina (${diasNoPeriodo(inicio, fim)} dias)`;
  return `↔ até ${curta(fim as string)}`;
}
