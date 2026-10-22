/** Regras puras dos Treinos (testáveis em node). Dias: 1 = segunda … 7 = domingo. */

export const DIAS_CURTOS = ["S", "T", "Q", "Q", "S", "S", "D"];
export const DIAS_NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function diasDeTexto(texto: string | null | undefined): number[] {
  return [...new Set((texto ?? "").split(",").map(x => Number(x.trim())).filter(n => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b);
}

export const textoDeDias = (dias: number[]): string | null => (dias.length ? [...new Set(dias)].sort((a, b) => a - b).join(",") : null);

/** Dia da semana (1–7, segunda primeiro) de uma data yyyy-MM-dd. */
export function diaDaSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  const js = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

export function treinosDoDia<T extends { txDias: string | null; inAtivo: boolean }>(treinos: T[], hojeIso: string): T[] {
  const dia = diaDaSemana(hojeIso);
  return treinos.filter(t => t.inAtivo && diasDeTexto(t.txDias).includes(dia));
}

/** Dias inteiros entre duas datas yyyy-MM-dd (b − a). */
export function diasEntre(aIso: string, bIso: string): number {
  const p = (iso: string) => { const [a, m, d] = iso.split("-").map(Number); return Date.UTC(a, m - 1, d); };
  return Math.round((p(bIso) - p(aIso)) / 86_400_000);
}

export function quandoFoi(dataIso: string | null, hojeIso: string): string {
  if (!dataIso) return "Ainda não treinado";
  const d = diasEntre(dataIso, hojeIso);
  if (d <= 0) return "Treinado hoje";
  if (d === 1) return "Ontem";
  return `Há ${d} dias`;
}

/** Segunda-feira da semana de uma data. */
export function inicioDaSemana(hojeIso: string): string {
  const [a, m, d] = hojeIso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - (diaDaSemana(hojeIso) - 1));
  return dt.toISOString().slice(0, 10);
}

export function treinosNaSemana(sessoes: { dtSessao: string }[], hojeIso: string): number {
  const inicio = inicioDaSemana(hojeIso);
  return sessoes.filter(s => s.dtSessao >= inicio && s.dtSessao <= hojeIso).length;
}

/** 90 → "1:30"; 45 → "0:45". */
export function formatarSegundos(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Carga para mostrar: 42.5 → "42,5 kg"; null → "". */
export const formatarCarga = (n: number | null | undefined) => (n == null ? "" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`);
