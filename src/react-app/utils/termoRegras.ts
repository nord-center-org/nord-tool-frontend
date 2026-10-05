/** Regras puras da aba "Termo de reprova" (sem dependências, testáveis em node). */

export interface FotoDaPagina {
  idTermoFoto: number;
  nrPagina: number;
  nrOrdem: number;
}

/** "1º termo", "2º termo"... */
export function rotuloTermo(nrTermo: number): string {
  return `${nrTermo}º termo`;
}

/** Fotos de uma página, na ordem definida pelo usuário (empate pelo id). */
export function fotosDaPagina<T extends FotoDaPagina>(fotos: T[], pagina: number): T[] {
  return fotos
    .filter(f => f.nrPagina === pagina)
    .sort((a, b) => a.nrOrdem - b.nrOrdem || a.idTermoFoto - b.idTermoFoto);
}

/** Mapa página → quantidade de fotos. */
export function contarFotosPorPagina(fotos: FotoDaPagina[]): Record<number, number> {
  const contagem: Record<number, number> = {};
  for (const foto of fotos) contagem[foto.nrPagina] = (contagem[foto.nrPagina] ?? 0) + 1;
  return contagem;
}

/** "2 de 5 · 3 fotos" / "2 de 5 · sem foto" para o seletor de página. */
export function rotuloPagina(pagina: number, total: number, qtFotos: number): string {
  const fotos = qtFotos === 0 ? 'sem foto' : qtFotos === 1 ? '1 foto' : `${qtFotos} fotos`;
  return `${pagina} de ${total} · ${fotos}`;
}

/** Mantém a página dentro de 1..total. */
export function limitarPagina(pagina: number, total: number): number {
  if (total < 1) return 1;
  return Math.min(Math.max(1, pagina), total);
}

export function mensagemExclusaoTermo(qtFotos: number): string {
  const vinculadas = qtFotos === 1 ? 'A 1 foto vinculada também será removida.' : `As ${qtFotos} fotos vinculadas também serão removidas.`;
  return qtFotos === 0 ? 'Excluir este termo? Esta ação não pode ser desfeita.' : `Excluir este termo? ${vinculadas} Esta ação não pode ser desfeita.`;
}

export const SITUACOES_TERMO = [
  { valor: 'PENDENTE', rotulo: 'Pendente' },
  { valor: 'EM_ANDAMENTO', rotulo: 'Em andamento' },
  { valor: 'CONCLUIDO', rotulo: 'Concluído' },
] as const;

export function rotuloSituacao(valor: string): string {
  return SITUACOES_TERMO.find(s => s.valor === valor)?.rotulo ?? valor;
}
