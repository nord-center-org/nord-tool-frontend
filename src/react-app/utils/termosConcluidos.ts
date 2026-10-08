/** Regras do download em massa dos termos de reprova concluídos (sem React, testável em node). */

export interface ApartamentoParaDownload {
  idApartamentoVistoria: number;
  nmApartamentoVistoria: string;
  inTermoAnexado?: boolean | null;
  nrUltimoTermo?: number | null;
  nmSituacaoTermo?: string | null;
}

export interface SelecaoDeTermos<T extends ApartamentoParaDownload> {
  /** Último termo concluído: entram no download. */
  concluidos: T[];
  /** Sem termo, pendentes ou em andamento: ficam de fora. */
  ignorados: T[];
}

export function termoConcluido(apt: ApartamentoParaDownload): boolean {
  return Boolean(apt.inTermoAnexado) && apt.nmSituacaoTermo === "CONCLUIDO" && apt.nrUltimoTermo != null;
}

export function separarConcluidos<T extends ApartamentoParaDownload>(apartamentos: T[]): SelecaoDeTermos<T> {
  const concluidos: T[] = [];
  const ignorados: T[] = [];
  for (const apt of apartamentos) (termoConcluido(apt) ? concluidos : ignorados).push(apt);
  return { concluidos, ignorados };
}

/** Garante nomes distintos dentro do ZIP: "a.pdf", "a (2).pdf", "a (3).pdf"… */
export function nomeUnico(nome: string, usados: Set<string>): string {
  const ponto = nome.lastIndexOf(".");
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  const extensao = ponto > 0 ? nome.slice(ponto) : "";
  let candidato = nome;
  for (let n = 2; usados.has(candidato.toLowerCase()); n++) candidato = `${base} (${n})${extensao}`;
  usados.add(candidato.toLowerCase());
  return candidato;
}

/** "termos-concluidos-2026-10-08.zip" */
export function nomeArquivoZip(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `termos-concluidos-${ano}-${mes}-${dia}.zip`;
}
