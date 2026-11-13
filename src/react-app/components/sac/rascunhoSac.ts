/**
 * Rascunho do chamado guardado fora dos componentes: a pessoa sai do SAC (ou da janelinha do botão do SAC) para tirar
 * o print de outra tela e, quando volta, o título, a descrição e os prints continuam lá.
 */
export interface PrintLocal { chave: string; nome: string; blob: Blob; url: string; tela: string | null }

export const rascunhoSac: { titulo: string; descricao: string; prints: PrintLocal[] } = { titulo: "", descricao: "", prints: [] };
