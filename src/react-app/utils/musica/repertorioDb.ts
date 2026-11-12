/**
 * Músicas do Repertório guardadas no próprio aparelho (IndexedDB): o arquivo de áudio, a análise, a cifra e os
 * ajustes. Nada sobe para o servidor.
 */
import type { ResultadoAnalise } from "./analise.ts";
import type { IdInstrumento } from "./instrumentos.ts";

export interface AjustesMusica {
  semitons: number;
  /** Andamento em relação ao original (1 = 100%). */
  andamento: number;
  instrumento: IdInstrumento;
  /** Transposição só da cifra (para casar uma cifra escrita em outro tom com o áudio). */
  semitonsCifra: number;
  /** Nome das notas no instrumento: "C D E" ou "Dó Ré Mi" (músicas antigas não têm: vale "cifra"). */
  nomesNotas?: "cifra" | "solfejo";
}

export interface Musica {
  id: string;
  titulo: string;
  artista: string;
  criadaEm: string;
  atualizadaEm: string;
  nomeArquivo: string;
  tamanho: number;
  duracao: number;
  analise: ResultadoAnalise | null;
  cifra: string;
  /** Início (s) de cada bloco da cifra; null = calcula pelos acordes. */
  tempos: (number | null)[] | null;
  ajustes: AjustesMusica;
}

export const AJUSTES_PADRAO: AjustesMusica = { semitons: 0, andamento: 1, instrumento: "baixo4", semitonsCifra: 0, nomesNotas: "cifra" };

const BANCO = "nordtool-repertorio", LOJA = "musicas", ARQUIVOS = "arquivos";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    if (typeof indexedDB === "undefined") { erro(new Error("Este navegador não guarda arquivos no aparelho.")); return; }
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => {
      // os dados da música e o áudio ficam em lojas separadas: salvar um ajuste não regrava o arquivo
      if (!req.result.objectStoreNames.contains(LOJA)) req.result.createObjectStore(LOJA, { keyPath: "id" });
      if (!req.result.objectStoreNames.contains(ARQUIVOS)) req.result.createObjectStore(ARQUIVOS);
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error ?? new Error("Não deu para abrir o repertório no aparelho."));
  });
}

async function operar<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest<T>, loja = LOJA): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, erro) => {
      const tx = db.transaction(loja, modo);
      const req = fazer(tx.objectStore(loja));
      tx.oncomplete = () => ok(req.result);
      tx.onerror = () => erro(tx.error ?? new Error("Não deu para salvar no aparelho."));
      tx.onabort = () => erro(tx.error ?? new Error("Sem espaço no aparelho para guardar a música."));
    });
  } finally {
    db.close();
  }
}

export const listarMusicas = async () => (await operar<Musica[]>("readonly", l => l.getAll() as IDBRequest<Musica[]>)).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
export const lerMusica = (id: string) => operar<Musica | undefined>("readonly", l => l.get(id) as IDBRequest<Musica | undefined>);
export const salvarMusica = (m: Musica) => operar("readwrite", l => l.put({ ...m, atualizadaEm: new Date().toISOString() }));
export async function excluirMusica(id: string) {
  await operar("readwrite", l => l.delete(id));
  await operar("readwrite", l => l.delete(id), ARQUIVOS);
}
export const salvarArquivo = (id: string, arquivo: Blob) => operar("readwrite", l => l.put(arquivo, id), ARQUIVOS);
export const lerArquivo = (id: string) => operar<Blob | undefined>("readonly", l => l.get(id) as IDBRequest<Blob | undefined>, ARQUIVOS);

/** Título e artista a partir do nome do arquivo ("Artista - Música.mp3"). */
export function tituloDoArquivo(nome: string): { titulo: string; artista: string } {
  const base = nome.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const partes = base.split(/\s+[-–—]\s+/);
  if (partes.length >= 2) return { artista: partes[0].trim(), titulo: partes.slice(1).join(" - ").trim() };
  return { titulo: base || "Música", artista: "" };
}
