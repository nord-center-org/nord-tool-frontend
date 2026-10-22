/** Regras puras do compartilhamento do cronograma pessoal (testáveis em node). */

export interface PessoaCompartilhavel { id: number; nmNome: string; nmCargo: string | null; inEquipe: boolean }

export type FiltroDono = "TODOS" | "MEUS" | "COMIGO";

const normalizar = (t: string) => t.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");

export function filtrarPessoas(pessoas: PessoaCompartilhavel[], busca: string): PessoaCompartilhavel[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  if (!termos.length) return pessoas;
  return pessoas.filter(p => termos.every(t => normalizar(`${p.nmNome} ${p.nmCargo ?? ""}`).includes(t)));
}

export const alternarPessoa = (ids: number[], id: number): number[] => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

/** Marca toda a equipe (quem está abaixo na hierarquia) sem desmarcar quem já estava escolhido. */
export function comEquipe(ids: number[], pessoas: PessoaCompartilhavel[]): number[] {
  const equipe = pessoas.filter(p => p.inEquipe).map(p => p.id);
  return [...ids, ...equipe.filter(id => !ids.includes(id))];
}

/** Item é meu quando o backend não disse o contrário (flProprio ausente em itens antigos). */
export const ehMeu = (item: { flProprio?: boolean }) => item.flProprio !== false;

export function passaFiltroDono(item: { flProprio?: boolean }, filtro: FiltroDono): boolean {
  if (filtro === "MEUS") return ehMeu(item);
  if (filtro === "COMIGO") return !ehMeu(item);
  return true;
}

/** "Ana, Bruno e mais 2" para mostrar com quem está compartilhado. */
export function resumoNomes(ids: number[], pessoas: PessoaCompartilhavel[], max = 2): string {
  const nomes = ids.map(id => pessoas.find(p => p.id === id)?.nmNome.split(" ")[0] ?? `#${id}`);
  if (nomes.length <= max) return nomes.join(" e ");
  return `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}`;
}

export const mesmosIds = (a: number[], b: number[]) => a.length === b.length && a.every(x => b.includes(x));
