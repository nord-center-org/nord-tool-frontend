/**
 * Editor de imagens (estilo Paint.net): regras puras sobre os pixels (RGBA), testáveis em node. Ajustes de cor,
 * desfoque e nitidez, balde de tinta e o histórico de desfazer/refazer.
 */

export interface Pixels { data: Uint8ClampedArray; width: number; height: number }
export type Cor = [number, number, number, number];

export type TipoAjuste = "brilho" | "contraste" | "saturacao" | "matiz" | "cinza" | "sepia" | "inverter" | "desfoque" | "nitidez" | "temperatura";

export interface DefinicaoAjuste { tipo: TipoAjuste; rotulo: string; min: number; max: number; padrao: number; semValor?: boolean }

export const AJUSTES: DefinicaoAjuste[] = [
  { tipo: "brilho", rotulo: "Brilho", min: -100, max: 100, padrao: 0 },
  { tipo: "contraste", rotulo: "Contraste", min: -100, max: 100, padrao: 0 },
  { tipo: "saturacao", rotulo: "Saturação", min: -100, max: 100, padrao: 0 },
  { tipo: "matiz", rotulo: "Matiz", min: -180, max: 180, padrao: 0 },
  { tipo: "temperatura", rotulo: "Temperatura", min: -100, max: 100, padrao: 0 },
  { tipo: "desfoque", rotulo: "Desfoque", min: 0, max: 20, padrao: 3 },
  { tipo: "nitidez", rotulo: "Nitidez", min: 0, max: 100, padrao: 40 },
  { tipo: "cinza", rotulo: "Preto e branco", min: 0, max: 0, padrao: 0, semValor: true },
  { tipo: "sepia", rotulo: "Sépia", min: 0, max: 0, padrao: 0, semValor: true },
  { tipo: "inverter", rotulo: "Inverter cores", min: 0, max: 0, padrao: 0, semValor: true },
];

const limitar = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const c = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [c(h + 1 / 3) * 255, c(h) * 255, c(h - 1 / 3) * 255];
}

/** Desfoque de caixa (horizontal e vertical), rápido mesmo em fotos grandes. */
function desfocar(src: Pixels, raio: number): Uint8ClampedArray {
  const { width: w, height: h } = src;
  const r = Math.max(1, Math.round(raio));
  const tmp = new Float32Array(src.data.length);
  const out = new Uint8ClampedArray(src.data.length);
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 4; c++) {
      let soma = 0;
      for (let x = -r; x <= r; x++) soma += src.data[(y * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = soma / (2 * r + 1);
        const sai = Math.max(0, x - r), entra = Math.min(w - 1, x + r + 1);
        soma += src.data[(y * w + entra) * 4 + c] - src.data[(y * w + sai) * 4 + c];
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      let soma = 0;
      for (let y = -r; y <= r; y++) soma += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = soma / (2 * r + 1);
        const sai = Math.max(0, y - r), entra = Math.min(h - 1, y + r + 1);
        soma += tmp[(entra * w + x) * 4 + c] - tmp[(sai * w + x) * 4 + c];
      }
    }
  }
  return out;
}

/** Aplica o ajuste e devolve os pixels novos (o original não muda). */
export function aplicarAjuste(src: Pixels, tipo: TipoAjuste, valor: number): Uint8ClampedArray {
  if (tipo === "desfoque") return valor <= 0 ? new Uint8ClampedArray(src.data) : desfocar(src, valor);
  if (tipo === "nitidez") {
    const borrado = desfocar(src, 1);
    const k = valor / 50;
    const out = new Uint8ClampedArray(src.data.length);
    for (let i = 0; i < src.data.length; i += 4) {
      for (let c = 0; c < 3; c++) out[i + c] = limitar(src.data[i + c] + (src.data[i + c] - borrado[i + c]) * k);
      out[i + 3] = src.data[i + 3];
    }
    return out;
  }
  const d = src.data;
  const out = new Uint8ClampedArray(d.length);
  const fatorContraste = (259 * (valor * 2.55 + 255)) / (255 * (259 - valor * 2.55));
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    switch (tipo) {
      case "brilho": r += valor * 2.55; g += valor * 2.55; b += valor * 2.55; break;
      case "contraste": r = fatorContraste * (r - 128) + 128; g = fatorContraste * (g - 128) + 128; b = fatorContraste * (b - 128) + 128; break;
      case "temperatura": r += valor * 0.6; b -= valor * 0.6; break;
      case "inverter": r = 255 - r; g = 255 - g; b = 255 - b; break;
      case "cinza": { const y = 0.299 * r + 0.587 * g + 0.114 * b; r = g = b = y; break; }
      case "sepia": {
        const nr = 0.393 * r + 0.769 * g + 0.189 * b, ng = 0.349 * r + 0.686 * g + 0.168 * b, nb = 0.272 * r + 0.534 * g + 0.131 * b;
        r = nr; g = ng; b = nb; break;
      }
      case "saturacao": case "matiz": {
        const [h, s, l] = rgbParaHsl(r, g, b);
        const nh = tipo === "matiz" ? (((h + valor / 360) % 1) + 1) % 1 : h;
        const ns = tipo === "saturacao" ? Math.min(1, Math.max(0, s * (1 + valor / 100))) : s;
        [r, g, b] = hslParaRgb(nh, ns, l);
        break;
      }
    }
    out[i] = limitar(r); out[i + 1] = limitar(g); out[i + 2] = limitar(b); out[i + 3] = d[i + 3];
  }
  return out;
}

/**
 * Balde de tinta: pinta a área contínua da cor clicada (com tolerância 0–100) com a cor nova. Devolve quantos pixels
 * mudaram. Mexe nos pixels recebidos.
 */
export function preencher(px: Pixels, x: number, y: number, cor: Cor, tolerancia = 20): number {
  const { width: w, height: h, data } = px;
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const i0 = (y * w + x) * 4;
  const alvo = [data[i0], data[i0 + 1], data[i0 + 2], data[i0 + 3]];
  if (alvo.every((v, k) => v === cor[k])) return 0;
  const lim = (tolerancia / 100) * 255 * 2;
  const parecida = (i: number) => Math.abs(data[i] - alvo[0]) + Math.abs(data[i + 1] - alvo[1]) + Math.abs(data[i + 2] - alvo[2]) + Math.abs(data[i + 3] - alvo[3]) <= lim;
  const visto = new Uint8Array(w * h);
  const pilha = [x, y];
  let n = 0;
  while (pilha.length) {
    const py = pilha.pop() as number, px0 = pilha.pop() as number;
    let xe = px0;
    while (xe >= 0 && !visto[py * w + xe] && parecida((py * w + xe) * 4)) xe--;
    xe++;
    let acimaAberto = false, abaixoAberto = false;
    for (let xx = xe; xx < w && !visto[py * w + xx] && parecida((py * w + xx) * 4); xx++) {
      const i = (py * w + xx) * 4;
      visto[py * w + xx] = 1;
      data[i] = cor[0]; data[i + 1] = cor[1]; data[i + 2] = cor[2]; data[i + 3] = cor[3];
      n++;
      const vizinhas: [number, boolean][] = [[py - 1, acimaAberto], [py + 1, abaixoAberto]];
      for (const [yy, aberto] of vizinhas) {
        if (yy < 0 || yy >= h) continue;
        const ok: boolean = !visto[yy * w + xx] && parecida((yy * w + xx) * 4);
        if (ok && !aberto) pilha.push(xx, yy);
        if (yy === py - 1) acimaAberto = ok; else abaixoAberto = ok;
      }
    }
  }
  return n;
}

export const hexParaCor = (hex: string, alfa = 255): Cor => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alfa];
};
export const corParaHex = (c: ArrayLike<number>) => `#${[c[0], c[1], c[2]].map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Desfazer/refazer com limite (o mais antigo sai). */
export class Historico<T> {
  private passado: T[] = [];
  private futuro: T[] = [];
  private limite: number;
  constructor(limite = 30) { this.limite = limite; }
  /** Guarda o estado de antes de uma mudança. */
  guardar(estado: T) { this.passado.push(estado); if (this.passado.length > this.limite) this.passado.shift(); this.futuro = []; }
  desfazer(atual: T): T | null { const e = this.passado.pop(); if (e === undefined) return null; this.futuro.push(atual); return e; }
  refazer(atual: T): T | null { const e = this.futuro.pop(); if (e === undefined) return null; this.passado.push(atual); return e; }
  /** Muda o limite (ex.: menos passos para imagens grandes); os mais antigos saem. */
  ajustarLimite(n: number) { this.limite = Math.max(1, n); while (this.passado.length > this.limite) this.passado.shift(); }
  get podeDesfazer() { return this.passado.length > 0; }
  get podeRefazer() { return this.futuro.length > 0; }
  limpar() { this.passado = []; this.futuro = []; }
}

/** Novo tamanho mantendo a proporção quando um dos lados muda. */
export function redimensionarProporcional(w: number, h: number, novo: { largura?: number; altura?: number }): { largura: number; altura: number } {
  if (novo.largura) return { largura: Math.max(1, Math.round(novo.largura)), altura: Math.max(1, Math.round((h * novo.largura) / w)) };
  if (novo.altura) return { largura: Math.max(1, Math.round((w * novo.altura) / h)), altura: Math.max(1, Math.round(novo.altura)) };
  return { largura: w, altura: h };
}

/** Retângulo normalizado (de dois cantos quaisquer), cortado nos limites da imagem. */
export function retanguloDe(a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number) {
  const x = Math.max(0, Math.floor(Math.min(a.x, b.x))), y = Math.max(0, Math.floor(Math.min(a.y, b.y)));
  const x2 = Math.min(w, Math.ceil(Math.max(a.x, b.x))), y2 = Math.min(h, Math.ceil(Math.max(a.y, b.y)));
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}
