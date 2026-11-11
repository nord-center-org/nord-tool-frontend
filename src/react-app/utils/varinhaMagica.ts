/**
 * Varinha mágica (estilo Paint.net): seleção por cor. A seleção é uma máscara do tamanho da imagem, um byte por pixel
 * (0 = fora, 255 = dentro; valores no meio = borda suave). Regras puras, testáveis em node.
 */
import type { Cor, Pixels } from "./editorImagem.ts";

export type Mascara = Uint8Array;
export type ModoSelecao = "nova" | "somar" | "tirar" | "cruzar";
export type Caixa = { x: number; y: number; w: number; h: number };

export const MODOS_SELECAO: { id: ModoSelecao; rotulo: string; dica: string }[] = [
  { id: "nova", rotulo: "Nova", dica: "Troca a seleção" },
  { id: "somar", rotulo: "Somar", dica: "Junta com a seleção (Shift)" },
  { id: "tirar", rotulo: "Tirar", dica: "Tira da seleção (Alt ou botão direito)" },
  { id: "cruzar", rotulo: "Cruzar", dica: "Fica só o que está nas duas" },
];

/**
 * Pixels com cor parecida com a do ponto clicado, com tolerância 0–100 (a mesma régua do balde de tinta).
 * `global` pega todos os pixels parecidos da imagem; sem ele, só a área contínua que encosta no ponto.
 */
export function varinhaMagica(px: Pixels, x: number, y: number, tolerancia = 30, global = false): Mascara {
  const { width: w, height: h, data } = px;
  const m: Mascara = new Uint8Array(w * h);
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return m;
  const i0 = (y * w + x) * 4;
  const a0 = data[i0], a1 = data[i0 + 1], a2 = data[i0 + 2], a3 = data[i0 + 3];
  const lim = (Math.max(0, Math.min(100, tolerancia)) / 100) * 255 * 2;
  const parecida = (p: number) => {
    const i = p * 4;
    // Pixels quase transparentes valem como "transparente", seja qual for a cor guardada neles.
    if (a3 < 8 && data[i + 3] < 8) return true;
    return Math.abs(data[i] - a0) + Math.abs(data[i + 1] - a1) + Math.abs(data[i + 2] - a2) + Math.abs(data[i + 3] - a3) <= lim;
  };
  if (global) {
    for (let p = 0; p < w * h; p++) if (parecida(p)) m[p] = 255;
    return m;
  }
  // Preenchimento por varredura de linhas (como o balde), marcando na máscara em vez de pintar.
  const pilha = [x, y];
  while (pilha.length) {
    const py = pilha.pop() as number, px0 = pilha.pop() as number;
    let xe = px0;
    while (xe >= 0 && !m[py * w + xe] && parecida(py * w + xe)) xe--;
    xe++;
    let acima = false, abaixo = false;
    for (let xx = xe; xx < w && !m[py * w + xx] && parecida(py * w + xx); xx++) {
      m[py * w + xx] = 255;
      if (py > 0) {
        const ok = !m[(py - 1) * w + xx] && parecida((py - 1) * w + xx);
        if (ok && !acima) pilha.push(xx, py - 1);
        acima = ok;
      }
      if (py < h - 1) {
        const ok = !m[(py + 1) * w + xx] && parecida((py + 1) * w + xx);
        if (ok && !abaixo) pilha.push(xx, py + 1);
        abaixo = ok;
      }
    }
  }
  return m;
}

/** Junta a seleção que já existe com a nova, conforme o modo. Sem seleção anterior, "tirar" e "cruzar" dão vazio. */
export function combinar(atual: Mascara | null, nova: Mascara, modo: ModoSelecao): Mascara {
  if (modo === "nova" || !atual) return modo === "tirar" || modo === "cruzar" ? new Uint8Array(nova.length) : nova;
  const r = new Uint8Array(nova.length);
  for (let i = 0; i < r.length; i++) {
    const a = atual[i], b = nova[i];
    r[i] = modo === "somar" ? Math.max(a, b) : modo === "tirar" ? Math.min(a, 255 - b) : Math.min(a, b);
  }
  return r;
}

export function inverter(m: Mascara): Mascara {
  const r = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) r[i] = 255 - m[i];
  return r;
}

export function mascaraDoRetangulo(c: Caixa, w: number, h: number): Mascara {
  const m = new Uint8Array(w * h);
  for (let y = Math.max(0, c.y); y < Math.min(h, c.y + c.h); y++) m.fill(255, y * w + Math.max(0, c.x), y * w + Math.min(w, c.x + c.w));
  return m;
}

/** Menor retângulo que contém a seleção; null se ela estiver vazia. */
export function caixaDa(m: Mascara, w: number, h: number): Caixa | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      if (!m[base + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export const contar = (m: Mascara) => { let n = 0; for (let i = 0; i < m.length; i++) if (m[i] >= 128) n++; return n; };

/**
 * Borda suave: esfuma a máscara com um desfoque de caixa de raio `raio` px (horizontal e depois vertical), para o
 * recorte não ficar serrilhado. Raio 0 devolve a mesma máscara.
 */
export function suavizar(m: Mascara, w: number, h: number, raio: number): Mascara {
  raio = Math.floor(raio);
  if (raio <= 0) return m;
  const tmp = new Float32Array(w * h), out = new Uint8Array(w * h);
  const janela = raio * 2 + 1;
  for (let y = 0; y < h; y++) {
    let soma = 0;
    for (let k = -raio; k <= raio; k++) soma += m[y * w + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = soma / janela;
      soma += m[y * w + Math.min(w - 1, x + raio + 1)] - m[y * w + Math.max(0, x - raio)];
    }
  }
  for (let x = 0; x < w; x++) {
    let soma = 0;
    for (let k = -raio; k <= raio; k++) soma += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = Math.round(soma / janela);
      soma += tmp[Math.min(h - 1, y + raio + 1) * w + x] - tmp[Math.max(0, y - raio) * w + x];
    }
  }
  return out;
}

/** Apaga (deixa transparente) os pixels selecionados, na proporção da máscara. Mexe nos pixels recebidos. */
export function apagarNaMascara(px: Pixels, m: Mascara) {
  const d = px.data;
  for (let p = 0; p < m.length; p++) if (m[p]) d[p * 4 + 3] = Math.round(d[p * 4 + 3] * (1 - m[p] / 255));
}

/** Pinta a cor nos pixels selecionados (borda suave mistura). Mexe nos pixels recebidos. */
export function preencherNaMascara(px: Pixels, m: Mascara, cor: Cor) {
  const d = px.data;
  for (let p = 0; p < m.length; p++) {
    const k = m[p] / 255;
    if (!k) continue;
    const i = p * 4;
    const aDe = d[i + 3] / 255, aCor = (cor[3] / 255) * k;
    const a = aCor + aDe * (1 - aCor);
    for (let c = 0; c < 3; c++) d[i + c] = a ? Math.round((cor[c] * aCor + d[i + c] * aDe * (1 - aCor)) / a) : 0;
    d[i + 3] = Math.round(a * 255);
  }
}

/** Devolve os pixels de `antes` onde a máscara é 0 (o que se pintou fora da seleção volta a ser como era). */
export function restaurarFora(depois: Pixels, antes: Pixels, m: Mascara) {
  const d = depois.data, a = antes.data;
  for (let p = 0; p < m.length; p++) {
    const k = m[p] / 255;
    if (k === 1) continue;
    const i = p * 4;
    for (let c = 0; c < 4; c++) d[i + c] = Math.round(d[i + c] * k + a[i + c] * (1 - k));
  }
}

/**
 * Desenho da seleção para mostrar na tela, em RGBA do tamanho da imagem: um véu azul claro por dentro e a borda
 * tracejada em preto e branco.
 */
export function desenhoDaSelecao(m: Mascara, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const dentro = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] >= 128;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!dentro(x, y)) continue;
      const i = (y * w + x) * 4;
      const borda = !dentro(x - 1, y) || !dentro(x + 1, y) || !dentro(x, y - 1) || !dentro(x, y + 1);
      if (borda) { const v = ((x + y) >> 2) & 1 ? 255 : 0; out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255; }
      else { out[i] = 59; out[i + 1] = 130; out[i + 2] = 246; out[i + 3] = 56; }
    }
  }
  return out;
}

/** Recorta a máscara para um retângulo (usado ao recortar a imagem na seleção). */
export function recortarMascara(m: Mascara, w: number, c: Caixa): Mascara {
  const r = new Uint8Array(c.w * c.h);
  for (let y = 0; y < c.h; y++) r.set(m.subarray((c.y + y) * w + c.x, (c.y + y) * w + c.x + c.w), y * c.w);
  return r;
}
