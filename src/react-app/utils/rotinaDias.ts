/** Atividade fixa em vários dias: cada dia é um item (o backend guarda um dia por item). */

export interface PlanoDias {
  /** Dia para o item que já existe (null = criação). */
  manter: number | null;
  /** Dias que viram itens novos (cópias). */
  criar: number[];
}

/**
 * Edição: o item existente fica no dia dele se continuar marcado (senão vai para o primeiro marcado) e os outros
 * dias viram cópias. Criação: um item por dia marcado.
 */
export function planejarDias(diaAtual: number | null | undefined, marcados: number[]): PlanoDias {
  const dias = [...new Set(marcados)].sort((a, b) => a - b);
  if (diaAtual == null) return { manter: null, criar: dias };
  const manter = dias.includes(diaAtual) ? diaAtual : dias[0] ?? diaAtual;
  return { manter, criar: dias.filter(d => d !== manter) };
}

/** Liga/desliga um dia na lista. */
export const alternarDia = (marcados: number[], dia: number) =>
  marcados.includes(dia) ? marcados.filter(d => d !== dia) : [...marcados, dia];
