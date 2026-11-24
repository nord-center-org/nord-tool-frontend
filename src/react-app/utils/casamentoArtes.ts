/** Casamento → Artes: categorias, filtro e regras do envio (puras, testáveis em node). */

export type CategoriaArte = "CONVITE" | "SAVE_THE_DATE" | "CARDAPIO" | "PAPELARIA" | "IDENTIDADE" | "OUTRO";

export const CATEGORIAS_ARTE: { id: CategoriaArte; nome: string }[] = [
  { id: "CONVITE", nome: "Convite" },
  { id: "SAVE_THE_DATE", nome: "Save the date" },
  { id: "CARDAPIO", nome: "Cardápio" },
  { id: "PAPELARIA", nome: "Papelaria" },
  { id: "IDENTIDADE", nome: "Identidade visual" },
  { id: "OUTRO", nome: "Outras" },
];

export function nomeDaCategoria(id: string): string {
  return CATEGORIAS_ARTE.find(c => c.id === id)?.nome ?? "Outras";
}

export const MAX_ARTE = 15 * 1024 * 1024;
const TIPOS = ["application/pdf", "image/jpeg", "image/png"];

/** Erro para mostrar, ou nulo se o arquivo pode subir (PDF, JPEG ou PNG até 15 MB). */
export function problemaDaArte(arquivo: { name: string; type: string; size: number }): string | null {
  const tipo = arquivo.type || (/\.pdf$/i.test(arquivo.name) ? "application/pdf" : /\.png$/i.test(arquivo.name) ? "image/png" : /\.jpe?g$/i.test(arquivo.name) ? "image/jpeg" : "");
  if (!TIPOS.includes(tipo)) return `"${arquivo.name}": envie PDF, JPEG ou PNG.`;
  if (arquivo.size <= 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > MAX_ARTE) return `"${arquivo.name}" passa de 15 MB.`;
  return null;
}

/** Título sugerido pelo nome do arquivo ("save-the-date_final.png" → "save the date final"). */
export function tituloDoArquivo(nome: string): string {
  return nome.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) || "Arte";
}

/** Filtra por categoria ("TODAS" = todas) e por texto no título. */
export function filtrarArtes<T extends { cdCategoria: string; nmTitulo: string }>(artes: T[], categoria: string, busca: string): T[] {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  return artes.filter(a => (categoria === "TODAS" || a.cdCategoria === categoria)
    && (!termo || a.nmTitulo.toLocaleLowerCase("pt-BR").includes(termo)));
}
