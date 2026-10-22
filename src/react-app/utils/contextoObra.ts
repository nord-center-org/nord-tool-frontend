/** Obra escolhida no app e fases dela para os filtros (regras puras, testáveis em node). */

export const CHAVE_OBRA_ATUAL = "@NordTool:obra_atual";

export interface FaseContexto { id: number; idObra: number; nmFase: string; cdFase: string | null; nrOrdem: number; inAtivo: boolean }
export interface ObraContexto { id: number; nmObra: string; fases: FaseContexto[] }

/** Opção de filtro de fase: a sigla é o começo do código do apartamento (N1-01-0101). */
export interface FaseFiltro { sigla: string; nome: string; id: number | null }

/** Enquanto nenhuma obra/fase estiver configurada, os filtros continuam com as fases de antes. */
export const FASES_LEGADAS: FaseFiltro[] = [
  { sigla: "N1", nome: "Nord 1", id: null },
  { sigla: "N2", nome: "Nord 2", id: null },
  { sigla: "EN", nome: "Energy", id: null },
];

export function lerObraAtual(storage: Pick<Storage, "getItem"> | undefined): number | null {
  try {
    const v = storage?.getItem(CHAVE_OBRA_ATUAL);
    const n = v ? Number(v) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function salvarObraAtual(storage: Pick<Storage, "setItem" | "removeItem"> | undefined, id: number | null): void {
  try {
    if (id) storage?.setItem(CHAVE_OBRA_ATUAL, String(id));
    else storage?.removeItem(CHAVE_OBRA_ATUAL);
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
}

/** A obra salva, se o usuário ainda tiver acesso a ela; senão a primeira da lista. */
export function escolherObraInicial(obras: ObraContexto[], salva: number | null): number | null {
  if (salva && obras.some(o => o.id === salva)) return salva;
  return obras[0]?.id ?? null;
}

/** Fases da obra para os filtros das telas (só as ativas com sigla, na ordem); sem obra configurada, as de antes. */
export function fasesParaFiltro(obras: ObraContexto[], idObra: number | null): FaseFiltro[] {
  const obra = obras.find(o => o.id === idObra);
  if (!obra) return obras.length ? [] : FASES_LEGADAS;
  return [...obra.fases]
    .filter(f => f.inAtivo && f.cdFase)
    .sort((a, b) => a.nrOrdem - b.nrOrdem || a.nmFase.localeCompare(b.nmFase, "pt-BR"))
    .map(f => ({ sigla: (f.cdFase ?? "").toUpperCase(), nome: f.nmFase, id: f.id }));
}

/** O código pertence à fase? (sigla no começo: "N1-01-0101" é da N1). */
export function codigoDaFase(codigo: string, sigla: string): boolean {
  return codigo.trim().toUpperCase().startsWith(`${sigla.toUpperCase()}-`) || codigo.trim().toUpperCase() === sigla.toUpperCase();
}
