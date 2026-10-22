/** Grupos do menu lateral que a pessoa deixou abertos (guardado por usuário neste aparelho). */
const PREFIXO = "@NordTool:menu_grupos:";

export const chaveGrupos = (idUsuario: number | string) => `${PREFIXO}${idUsuario}`;

export function lerGruposAbertos(storage: Pick<Storage, "getItem"> | undefined, idUsuario: number | string): string[] {
  try {
    const bruto = storage?.getItem(chaveGrupos(idUsuario));
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function salvarGruposAbertos(storage: Pick<Storage, "setItem"> | undefined, idUsuario: number | string, grupos: string[]): void {
  try {
    storage?.setItem(chaveGrupos(idUsuario), JSON.stringify(grupos));
  } catch {
    // Sem armazenamento (modo privado): o menu só não lembra.
  }
}

export const alternarGrupo = (abertos: string[], grupo: string): string[] =>
  abertos.includes(grupo) ? abertos.filter(g => g !== grupo) : [...abertos, grupo];

/** O grupo da tela atual: "/" só casa com "/"; os demais pelo começo do caminho. */
export function grupoDaRota<G extends { title: string; items: { path: string }[] }>(grupos: G[], caminho: string): string | null {
  const casa = (p: string) => (p === "/" ? caminho === "/" : caminho === p || caminho.startsWith(`${p}/`));
  return grupos.find(g => g.items.some(i => casa(i.path)))?.title ?? null;
}

export function iniciais(nome: string): string {
  return nome.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";
}
