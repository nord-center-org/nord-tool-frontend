/** Gerador de ZIP mínimo (sem compressão, "store"), sem dependências e testável em node. PDFs já são comprimidos. */

export interface EntradaZip {
  nome: string;
  bytes: Uint8Array;
}

const LIMITE_ZIP32 = 0xffffffff;
const LIMITE_ENTRADAS = 0xffff;

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = TABELA_CRC[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Data/hora no formato MS-DOS (ano mínimo 1980). */
function dataHoraDos(data: Date): { hora: number; dia: number } {
  const ano = Math.max(1980, data.getFullYear());
  return {
    hora: (data.getHours() << 11) | (data.getMinutes() << 5) | (data.getSeconds() >> 1),
    dia: ((ano - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate(),
  };
}

/** Monta um arquivo .zip com os nomes em UTF-8. Lança erro acima dos limites do ZIP clássico (4 GB / 65 535 arquivos). */
export function criarZip(entradas: EntradaZip[], data: Date = new Date()): Uint8Array {
  if (entradas.length > LIMITE_ENTRADAS) throw new Error("Arquivos demais para um único ZIP.");
  const codificador = new TextEncoder();
  const { hora, dia } = dataHoraDos(data);

  const nomes = entradas.map(e => codificador.encode(e.nome));
  const tamanhoLocais = entradas.reduce((soma, e, i) => soma + 30 + nomes[i].length + e.bytes.length, 0);
  const tamanhoDiretorio = nomes.reduce((soma, n) => soma + 46 + n.length, 0);
  const total = tamanhoLocais + tamanhoDiretorio + 22;
  if (total > LIMITE_ZIP32) throw new Error("O ZIP passaria de 4 GB. Selecione menos apartamentos.");

  const saida = new Uint8Array(total);
  const visao = new DataView(saida.buffer);
  let posicao = 0;
  const diretorio: { crc: number; deslocamento: number }[] = [];

  entradas.forEach((entrada, i) => {
    const crc = crc32(entrada.bytes);
    diretorio.push({ crc, deslocamento: posicao });
    visao.setUint32(posicao, 0x04034b50, true);
    visao.setUint16(posicao + 4, 20, true); // versão necessária
    visao.setUint16(posicao + 6, 0x0800, true); // nome em UTF-8
    visao.setUint16(posicao + 8, 0, true); // sem compressão
    visao.setUint16(posicao + 10, hora, true);
    visao.setUint16(posicao + 12, dia, true);
    visao.setUint32(posicao + 14, crc, true);
    visao.setUint32(posicao + 18, entrada.bytes.length, true);
    visao.setUint32(posicao + 22, entrada.bytes.length, true);
    visao.setUint16(posicao + 26, nomes[i].length, true);
    visao.setUint16(posicao + 28, 0, true);
    saida.set(nomes[i], posicao + 30);
    saida.set(entrada.bytes, posicao + 30 + nomes[i].length);
    posicao += 30 + nomes[i].length + entrada.bytes.length;
  });

  const inicioDiretorio = posicao;
  entradas.forEach((entrada, i) => {
    visao.setUint32(posicao, 0x02014b50, true);
    visao.setUint16(posicao + 4, 20, true); // versão de criação
    visao.setUint16(posicao + 6, 20, true); // versão necessária
    visao.setUint16(posicao + 8, 0x0800, true);
    visao.setUint16(posicao + 10, 0, true);
    visao.setUint16(posicao + 12, hora, true);
    visao.setUint16(posicao + 14, dia, true);
    visao.setUint32(posicao + 16, diretorio[i].crc, true);
    visao.setUint32(posicao + 20, entrada.bytes.length, true);
    visao.setUint32(posicao + 24, entrada.bytes.length, true);
    visao.setUint16(posicao + 28, nomes[i].length, true);
    // extra, comentário, disco, atributos internos e externos ficam em zero
    visao.setUint32(posicao + 42, diretorio[i].deslocamento, true);
    saida.set(nomes[i], posicao + 46);
    posicao += 46 + nomes[i].length;
  });

  visao.setUint32(posicao, 0x06054b50, true);
  visao.setUint16(posicao + 8, entradas.length, true);
  visao.setUint16(posicao + 10, entradas.length, true);
  visao.setUint32(posicao + 12, posicao - inicioDiretorio, true);
  visao.setUint32(posicao + 16, inicioDiretorio, true);
  return saida;
}

/**
 * Lê um ZIP (como o pacote baixado do Construcode): arquivos "store" e "deflate" pelo diretório central, sem
 * dependências (deflate pelo DecompressionStream do navegador/node). Pastas e arquivos de sistema ficam de fora.
 */
export async function lerZip(bytes: Uint8Array, filtro: (nome: string) => boolean = () => true): Promise<EntradaZip[]> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("Arquivo ZIP inválido ou corrompido.");
  const total = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const saida: EntradaZip[] = [];
  const texto = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Arquivo ZIP inválido ou corrompido.");
    const metodo = dv.getUint16(p + 10, true);
    const tamanho = dv.getUint32(p + 20, true);
    const lenNome = dv.getUint16(p + 28, true), lenExtra = dv.getUint16(p + 30, true), lenComent = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = texto.decode(bytes.subarray(p + 46, p + 46 + lenNome));
    p += 46 + lenNome + lenExtra + lenComent;
    const base = nome.split("/").pop() ?? nome;
    if (nome.endsWith("/") || nome.startsWith("__MACOSX/") || base.startsWith(".") || !filtro(base)) continue;
    const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const dados = bytes.subarray(inicio, inicio + tamanho);
    if (metodo === 0) saida.push({ nome: base, bytes: dados.slice() });
    else if (metodo === 8) {
      const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      saida.push({ nome: base, bytes: new Uint8Array(await new Response(fluxo).arrayBuffer()) });
    } else throw new Error(`O arquivo ${base} usa uma compressão que o NordTool não lê.`);
  }
  return saida;
}
