/** Central do bloco de notas (v3): cadernos, planilhas e documentos numa lista só, com filtro e busca. */
export type TipoItemBloco = "CADERNO" | "PLANILHA" | "DOCUMENTO";
export type FiltroBloco = "TODOS" | TipoItemBloco;

export interface ItemBloco { tipo: TipoItemBloco; id: number; titulo: string; cor: string; alteracao: string; detalhe?: string }

interface CadernoLista { id: number; nmTitulo: string; cdCor: string; dhAlteracao: string; qtPaginas: number }
interface ArquivoLista { id: number; cdTipo: "PLANILHA" | "DOCUMENTO"; nmTitulo: string; cdCor: string; dhAlteracao: string }

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tudo junto, do mais recente para o mais antigo; o filtro escolhe o tipo e a busca olha o nome (sem acento). */
export function itensDoBloco(cadernos: CadernoLista[], arquivos: ArquivoLista[], filtro: FiltroBloco, busca: string): ItemBloco[] {
  const termo = semAcento(busca.trim());
  const todos: ItemBloco[] = [
    ...cadernos.map(c => ({ tipo: "CADERNO" as const, id: c.id, titulo: c.nmTitulo, cor: c.cdCor, alteracao: c.dhAlteracao, detalhe: `${c.qtPaginas} página${c.qtPaginas === 1 ? "" : "s"}` })),
    ...arquivos.map(a => ({ tipo: a.cdTipo, id: a.id, titulo: a.nmTitulo, cor: a.cdCor, alteracao: a.dhAlteracao })),
  ];
  return todos
    .filter(i => (filtro === "TODOS" || i.tipo === filtro) && (!termo || semAcento(i.titulo).includes(termo)))
    .sort((a, b) => b.alteracao.localeCompare(a.alteracao) || a.titulo.localeCompare(b.titulo, "pt-BR"));
}
