/**
 * Favoritos do menu lateral: as telas marcadas com o tijolo aparecem num grupo "Favoritos" no topo. A lista fica no
 * servidor (vale em todos os aparelhos) e uma cópia neste aparelho, para o menu já abrir com eles.
 */
const PREFIXO = "@NordTool:menu_favoritos:";
export const MAX_FAVORITOS = 40;

export const chaveFavoritos = (idUsuario: number | string) => `${PREFIXO}${idUsuario}`;

const valido = (c: unknown): c is string => typeof c === "string" && /^\/[a-z0-9/-]{0,100}$/.test(c);

/** Lista limpa: só caminhos de tela, sem repetir, até o limite. */
export function limparFavoritos(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter(valido))].slice(0, MAX_FAVORITOS);
}

export function lerFavoritosLocais(storage: Pick<Storage, "getItem"> | undefined, idUsuario: number | string): string[] {
  try {
    const bruto = storage?.getItem(chaveFavoritos(idUsuario));
    return limparFavoritos(bruto ? JSON.parse(bruto) : []);
  } catch {
    return [];
  }
}

export function salvarFavoritosLocais(storage: Pick<Storage, "setItem"> | undefined, idUsuario: number | string, lista: string[]): void {
  try {
    storage?.setItem(chaveFavoritos(idUsuario), JSON.stringify(lista));
  } catch {
    // Sem armazenamento: o servidor continua com a lista.
  }
}

/** Marca (no fim da lista) ou desmarca. Passando do limite, não marca. */
export function alternarFavorito(lista: string[], caminho: string): string[] {
  if (lista.includes(caminho)) return lista.filter(c => c !== caminho);
  return lista.length >= MAX_FAVORITOS ? lista : [...lista, caminho];
}

/** Os itens do menu que estão nos favoritos, na ordem em que foram marcados (só os que a pessoa pode abrir). */
export function itensFavoritos<I extends { path: string }>(favoritos: string[], grupos: { items: I[] }[]): I[] {
  const porCaminho = new Map(grupos.flatMap(g => g.items).map(i => [i.path, i] as const));
  return favoritos.map(c => porCaminho.get(c)).filter((i): i is I => !!i);
}
