/**
 * Armazenamento do Drumcam ao vivo no próprio aparelho (IndexedDB):
 * - "galeria": vídeos e fotos do estúdio e do monitoramento, para assistir sem baixar;
 * - "partes": pedaços da gravação em alta qualidade da câmera (gravados a cada segundo, para não estourar a memória
 *   do celular numa gravação longa).
 */
const BANCO = "nordtool-drumcam";
const VERSAO = 1;

export interface ItemGaleria {
  id: string;
  tipo: "video" | "foto";
  nome: string;
  origem: "estudio" | "montagem" | "movimento" | "foto" | "clipe";
  camera?: string;
  criadoEm: number;
  duracao?: number;
  tamanho: number;
  mime: string;
  blob: Blob;
  miniatura?: string;
}

let aberto: Promise<IDBDatabase> | null = null;
function banco(): Promise<IDBDatabase> {
  if (!aberto) {
    aberto = new Promise((ok, erro) => {
      const r = indexedDB.open(BANCO, VERSAO);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("galeria")) db.createObjectStore("galeria", { keyPath: "id" });
        if (!db.objectStoreNames.contains("partes")) db.createObjectStore("partes", { keyPath: ["sessao", "n"] });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => { aberto = null; erro(r.error); };
    });
  }
  return aberto;
}

function pedido<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
}

async function loja(nome: "galeria" | "partes", modo: IDBTransactionMode) {
  return (await banco()).transaction(nome, modo).objectStore(nome);
}

export const galeria = {
  async listar(): Promise<ItemGaleria[]> {
    const itens = await pedido((await loja("galeria", "readonly")).getAll()) as ItemGaleria[];
    return itens.sort((a, b) => b.criadoEm - a.criadoEm);
  },
  async salvar(item: ItemGaleria) { await pedido((await loja("galeria", "readwrite")).put(item)); notificar(); },
  async renomear(id: string, nome: string) {
    const l = await loja("galeria", "readwrite");
    const item = await pedido(l.get(id)) as ItemGaleria | undefined;
    if (item) await pedido(l.put({ ...item, nome }));
    notificar();
  },
  async apagar(id: string) { await pedido((await loja("galeria", "readwrite")).delete(id)); notificar(); },
};

/** Avisa as telas abertas (estúdio, monitoramento, galeria) que a galeria mudou. */
const ouvintes = new Set<() => void>();
function notificar() { for (const f of ouvintes) f(); }
export function aoMudarGaleria(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; }

/** Partes da gravação em alta qualidade, na câmera. */
export const partes = {
  async guardar(sessao: string, n: number, blob: Blob) { await pedido((await loja("partes", "readwrite")).put({ sessao, n, blob })); },
  async juntar(sessao: string, mime: string): Promise<Blob> {
    const faixa = IDBKeyRange.bound([sessao, 0], [sessao, Number.MAX_SAFE_INTEGER]);
    const lista = await pedido((await loja("partes", "readonly")).getAll(faixa)) as { n: number; blob: Blob }[];
    return new Blob(lista.sort((a, b) => a.n - b.n).map(p => p.blob), { type: mime });
  },
  async apagar(sessao: string) {
    const faixa = IDBKeyRange.bound([sessao, 0], [sessao, Number.MAX_SAFE_INTEGER]);
    await pedido((await loja("partes", "readwrite")).delete(faixa));
  },
  /** Apaga gravações antigas que ficaram (sobra de uma câmera que caiu no meio). */
  async limparMenos(sessaoAtual: string | null) {
    const l = await loja("partes", "readwrite");
    const chaves = await pedido(l.getAllKeys()) as [string, number][];
    for (const [s, n] of chaves) if (s !== sessaoAtual) l.delete([s, n]);
  },
};

export const idAleatorio = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
