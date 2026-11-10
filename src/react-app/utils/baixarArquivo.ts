/** Dispara o download de um arquivo gerado no navegador. */
export function baixarArquivo(arquivo: File): void {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Nome de arquivo a partir de um título: sem acento (alguns navegadores trocam o nome por "download" quando tem),
 * sem símbolos, com hífen no lugar dos espaços, até 60 letras.
 */
export function nomeDeArquivo(titulo: string, padrao: string): string {
  const s = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return s || padrao;
}
