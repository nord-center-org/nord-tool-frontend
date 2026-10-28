/** Filtro de demandas por pessoa: todas, só as minhas, de outras pessoas, ou de um grupo (pessoas ou equipe). */

export type FiltroPessoas =
  | { tipo: "todos" }
  | { tipo: "meus" }
  | { tipo: "outros" }
  | { tipo: "pessoas"; ids: number[]; rotulo?: string };

interface ItemComDono { idDono?: number | null; nmDono?: string | null; flProprio?: boolean }

/** Item é meu quando o backend não disse o contrário (flProprio ausente em itens antigos). */
const ehMeu = (item: ItemComDono) => item.flProprio !== false;

export function passaFiltroPessoas(item: ItemComDono, filtro: FiltroPessoas, meuId?: number | null): boolean {
  switch (filtro.tipo) {
    case "meus": return ehMeu(item);
    case "outros": return !ehMeu(item);
    case "pessoas": {
      // Item sem dono (antigo) conta como meu quando o grupo me inclui.
      const dono = item.idDono ?? (ehMeu(item) ? meuId ?? null : null);
      return dono != null && filtro.ids.includes(dono);
    }
    default: return true;
  }
}

export interface DonoDemanda { id: number; nome: string }

/** Donos das demandas carregadas (eu primeiro, depois por nome) — são as pessoas que dá para filtrar. */
export function donosDasDemandas(itens: ItemComDono[], meuId?: number | null, meuNome = "Eu"): DonoDemanda[] {
  const mapa = new Map<number, string>();
  for (const i of itens) {
    const id = i.idDono ?? (ehMeu(i) ? meuId : null);
    if (id == null || mapa.has(id)) continue;
    mapa.set(id, id === meuId ? meuNome : i.nmDono?.trim() || `Pessoa #${id}`);
  }
  if (meuId != null && !mapa.has(meuId)) mapa.set(meuId, meuNome);
  return [...mapa.entries()].map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => (a.id === meuId ? -1 : b.id === meuId ? 1 : a.nome.localeCompare(b.nome, "pt-BR")));
}

/** Liga/desliga uma pessoa no filtro; sem ninguém volta para "todas". */
export function alternarPessoaNoFiltro(filtro: FiltroPessoas, id: number): FiltroPessoas {
  const atuais = filtro.tipo === "pessoas" ? filtro.ids : [];
  const ids = atuais.includes(id) ? atuais.filter(x => x !== id) : [...atuais, id];
  return ids.length ? { tipo: "pessoas", ids } : { tipo: "todos" };
}

/** Texto do botão do filtro. */
export function rotuloFiltro(filtro: FiltroPessoas, donos: DonoDemanda[]): string {
  switch (filtro.tipo) {
    case "meus": return "Só as minhas";
    case "outros": return "De outras pessoas";
    case "pessoas": {
      if (filtro.rotulo) return filtro.rotulo;
      const nomes = filtro.ids.map(id => donos.find(d => d.id === id)?.nome.split(" ")[0] ?? `#${id}`);
      if (nomes.length === 1) return nomes[0];
      if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
      return `${nomes.length} pessoas`;
    }
    default: return "Todas as pessoas";
  }
}
