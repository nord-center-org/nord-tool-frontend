/**
 * Gerador de QR Code feito aqui (nada de biblioteca nem imagem): modo byte, correção M, versões 1 a 10 (até 213
 * bytes, de sobra para o link da sala). Segue a norma ISO/IEC 18004: Reed-Solomon em GF(256), entrelaçamento dos
 * blocos, padrões fixos, informação de formato e versão e a máscara de menor penalidade.
 */

/** Versão → [total de codewords, codewords de correção por bloco, quantidade de blocos] no nível M. */
const TABELA_M: Record<number, [number, number, number]> = {
  1: [26, 10, 1], 2: [44, 16, 1], 3: [70, 26, 1], 4: [100, 18, 2], 5: [134, 24, 2],
  6: [172, 16, 4], 7: [196, 18, 4], 8: [242, 22, 4], 9: [292, 22, 5], 10: [346, 26, 5],
};

const ALINHAMENTO: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const FORMATO_M = 0;

export interface QrCode {
  versao: number;
  tamanho: number;
  mascara: number;
  /** modulos[linha][coluna]: true = escuro. */
  modulos: boolean[][];
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function multiplicar(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function divisor(grau: number): number[] {
  const r = new Array<number>(grau).fill(0);
  r[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = multiplicar(r[j], raiz);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    raiz = multiplicar(raiz, 0x02);
  }
  return r;
}

/** Codewords de correção (Reed-Solomon) de um bloco. */
export function reedSolomon(dados: number[], grau: number): number[] {
  const div = divisor(grau);
  const r = new Array<number>(grau).fill(0);
  for (const b of dados) {
    const fator = b ^ (r.shift() as number);
    r.push(0);
    for (let i = 0; i < r.length; i++) r[i] ^= multiplicar(div[i], fator);
  }
  return r;
}

const capacidade = (v: number) => TABELA_M[v][0] - TABELA_M[v][1] * TABELA_M[v][2];
const bitsDoTamanho = (v: number) => (v < 10 ? 8 : 16);

/** A menor versão que cabe os bytes. */
export function versaoPara(bytes: number): number {
  for (let v = 1; v <= 10; v++) if (4 + bitsDoTamanho(v) + bytes * 8 <= capacidade(v) * 8) return v;
  throw new Error("Texto grande demais para o QR Code");
}

function codewords(texto: string, v: number): number[] {
  const bytes = Array.from(new TextEncoder().encode(texto));
  const bits: number[] = [];
  const por = (valor: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  por(0b0100, 4);
  por(bytes.length, bitsDoTamanho(v));
  bytes.forEach(b => por(b, 8));
  const total = capacidade(v) * 8;
  por(0, Math.min(4, total - bits.length));
  por(0, (8 - (bits.length % 8)) % 8);
  for (let p = 0xec; bits.length < total; p ^= 0xec ^ 0x11) por(p, 8);
  const dados: number[] = [];
  for (let i = 0; i < bits.length; i += 8) dados.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // Blocos curtos primeiro, cada um com a sua correção; depois entrelaça.
  const [brutos, grau, blocos] = TABELA_M[v];
  const curtos = blocos - (brutos % blocos);
  const tamCurto = Math.floor(brutos / blocos);
  const lista: number[][] = [];
  for (let i = 0, k = 0; i < blocos; i++) {
    const n = tamCurto - grau + (i < curtos ? 0 : 1);
    const dat = dados.slice(k, k + n);
    k += n;
    const ecc = reedSolomon(dat, grau);
    if (i < curtos) dat.push(0);
    lista.push([...dat, ...ecc]);
  }
  const saida: number[] = [];
  for (let i = 0; i < lista[0].length; i++) {
    lista.forEach((b, j) => { if (i !== tamCurto - grau || j >= curtos) saida.push(b[i]); });
  }
  return saida;
}

class Grade {
  readonly m: boolean[][];
  readonly fixo: boolean[][];
  readonly n: number;
  constructor(n: number) {
    this.n = n;
    this.m = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
    this.fixo = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  }
  /** x = coluna, y = linha. */
  marcar(x: number, y: number, escuro: boolean) {
    this.m[y][x] = escuro;
    this.fixo[y][x] = true;
  }
}

function padroes(g: Grade, v: number) {
  const n = g.n;
  for (let i = 0; i < n; i++) {
    g.marcar(6, i, i % 2 === 0);
    g.marcar(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) g.marcar(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const pos = ALINHAMENTO[v];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) g.marcar(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  formato(g, 0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bits = (v << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = n - 11 + (i % 3), b = Math.floor(i / 3);
      g.marcar(a, b, bit(bits, i));
      g.marcar(b, a, bit(bits, i));
    }
  }
}

function formato(g: Grade, mascara: number) {
  const n = g.n;
  const dado = (FORMATO_M << 3) | mascara;
  let r = dado;
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  const bits = ((dado << 10) | r) ^ 0x5412;
  for (let i = 0; i <= 5; i++) g.marcar(8, i, bit(bits, i));
  g.marcar(8, 7, bit(bits, 6));
  g.marcar(8, 8, bit(bits, 7));
  g.marcar(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) g.marcar(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) g.marcar(n - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) g.marcar(8, n - 15 + i, bit(bits, i));
  g.marcar(8, n - 8, true);
}

function posicionar(g: Grade, dados: number[]) {
  const n = g.n;
  let i = 0;
  for (let direita = n - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = direita - j;
        const subindo = ((direita + 1) & 2) === 0;
        const y = subindo ? n - 1 - vert : vert;
        if (!g.fixo[y][x] && i < dados.length * 8) {
          g.m[y][x] = bit(dados[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

const MASCARAS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  x => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function mascarar(g: Grade, k: number) {
  for (let y = 0; y < g.n; y++) for (let x = 0; x < g.n; x++) if (!g.fixo[y][x] && MASCARAS[k](x, y)) g.m[y][x] = !g.m[y][x];
}

/** Penalidade da norma (sequências, blocos 2×2, padrões parecidos com o localizador e equilíbrio de escuros). */
export function penalidade(m: boolean[][]): number {
  const n = m.length;
  let p = 0;
  const linhas = [...m, ...m[0].map((_, x) => m.map(l => l[x]))];
  for (const l of linhas) {
    let corrida = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && l[i] === l[i - 1]) corrida++;
      else {
        if (corrida >= 5) p += 3 + corrida - 5;
        corrida = 1;
      }
    }
    const s = l.map(c => (c ? "1" : "0")).join("");
    p += 40 * ((s.match(/(?=10111010000)/g)?.length ?? 0) + (s.match(/(?=00001011101)/g)?.length ?? 0));
  }
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
  }
  const escuros = m.reduce((s, l) => s + l.filter(Boolean).length, 0);
  p += Math.floor(Math.abs(escuros * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

export function gerarQr(texto: string): QrCode {
  const v = versaoPara(new TextEncoder().encode(texto).length);
  const dados = codewords(texto, v);
  let melhor: QrCode | null = null;
  for (let k = 0; k < 8; k++) {
    const g = new Grade(17 + 4 * v);
    padroes(g, v);
    posicionar(g, dados);
    mascarar(g, k);
    formato(g, k);
    const pena = penalidade(g.m);
    if (!melhor || pena < penalidade(melhor.modulos)) melhor = { versao: v, tamanho: g.n, mascara: k, modulos: g.m };
  }
  return melhor as QrCode;
}
