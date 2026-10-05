/** Cache LRU simples em memória (por chave id+versão) para imagens e PDFs autenticados. */
export class BlobCache {
  private readonly mapa = new Map<string, Blob>();

  private readonly limite: number;

  constructor(limite: number) {
    this.limite = limite;
  }

  get(chave: string): Blob | undefined {
    const valor = this.mapa.get(chave);
    if (valor === undefined) return undefined;
    // move para o fim (mais recente)
    this.mapa.delete(chave);
    this.mapa.set(chave, valor);
    return valor;
  }

  set(chave: string, valor: Blob): void {
    this.mapa.delete(chave);
    this.mapa.set(chave, valor);
    while (this.mapa.size > this.limite) {
      const maisAntiga = this.mapa.keys().next().value as string;
      this.mapa.delete(maisAntiga);
    }
  }

  has(chave: string): boolean {
    return this.mapa.has(chave);
  }

  clear(): void {
    this.mapa.clear();
  }

  get tamanho(): number {
    return this.mapa.size;
  }
}

export const cacheBlobs = new BlobCache(150);
