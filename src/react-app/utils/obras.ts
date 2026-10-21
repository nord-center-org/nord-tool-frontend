/** Regras puras do cadastro de obras e fases. */

/** Sugere um código de acesso a partir do nome (letras/números, maiúsculo, até 12) + ano. */
export function sugerirCodigo(nome: string, ano = new Date().getFullYear()): string {
  const base = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  return base ? `${base}${ano}`.slice(0, 20) : "";
}

export const codigoValido = (c: string) => /^[A-Za-z0-9-]{4,20}$/.test(c.trim());
export const siglaValida = (s: string) => s.trim() === "" || /^[A-Za-z0-9]{1,10}$/.test(s.trim());

/** Fases na ordem de exibição: ordem, depois nome. */
export function ordenarFases<T extends { nrOrdem: number; nmFase: string }>(fases: T[]): T[] {
  return [...fases].sort((a, b) => a.nrOrdem - b.nrOrdem || a.nmFase.localeCompare(b.nmFase, "pt-BR", { numeric: true }));
}

/** Liga ou desliga um id na lista (sem repetir). */
export function alternarId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
}

/** Mesmo conjunto, em qualquer ordem? */
export function mesmosIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every(x => b.includes(x));
}
