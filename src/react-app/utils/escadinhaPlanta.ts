/**
 * Acha o contorno da torre numa planta rasterizada (prancha do PDF desenhada em canvas).
 * Ideia: o traço escuro da planta, engrossado para fechar as falhas, delimita uma região fechada;
 * tudo que a "água" vinda da borda não alcança é a torre. Molduras, carimbo e linhas que cruzam a prancha são descartados.
 */
import { ortogonalizar, simplificar, type Ponto } from "./escadinha.ts";

export interface Recorte { x: number; y: number; largura: number; altura: number }

export interface OpcoesDeteccao {
  /** Área (em pixels) onde procurar a torre; sem ela, a prancha toda. */
  recorte?: Recorte;
  /** Luminância abaixo da qual o pixel é traço (0–255). */
  limiar?: number;
}

export interface ContornoDetectado {
  /** Vértices em pixels da imagem (y para baixo), só com lados horizontais e verticais. */
  contorno: Ponto[];
  /** Fração do recorte ocupada pela torre. */
  ocupacao: number;
}

/** Luminância de cada pixel a partir do RGBA do canvas (fundo transparente conta como branco). */
export function luminancia(rgba: ArrayLike<number>, largura: number, altura: number): Uint8Array {
  const lum = new Uint8Array(largura * altura);
  for (let i = 0; i < lum.length; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const l = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    lum[i] = Math.round(l * a + 255 * (1 - a));
  }
  return lum;
}

/** Engrossa a máscara num quadrado de raio r (duas passadas separáveis). */
function dilatar(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    let ultimo = -Infinity;
    for (let x = 0; x < w; x++) { if (m[y * w + x]) ultimo = x; if (x - ultimo <= r) tmp[y * w + x] = 1; }
    ultimo = Infinity;
    for (let x = w - 1; x >= 0; x--) { if (m[y * w + x]) ultimo = x; if (ultimo - x <= r) tmp[y * w + x] = 1; }
  }
  const out = new Uint8Array(m.length);
  for (let x = 0; x < w; x++) {
    let ultimo = -Infinity;
    for (let y = 0; y < h; y++) { if (tmp[y * w + x]) ultimo = y; if (y - ultimo <= r) out[y * w + x] = 1; }
    ultimo = Infinity;
    for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) ultimo = y; if (ultimo - y <= r) out[y * w + x] = 1; }
  }
  return out;
}

/** Componentes conexos (4 vizinhos) dos pixels marcados; devolve o rótulo de cada pixel e a caixa de cada componente. */
function componentes(m: Uint8Array, w: number, h: number) {
  const rotulo = new Int32Array(m.length).fill(-1);
  const caixas: Array<{ minX: number; minY: number; maxX: number; maxY: number; n: number }> = [];
  const pilha: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || rotulo[i] >= 0) continue;
    const id = caixas.length;
    const c = { minX: w, minY: h, maxX: 0, maxY: 0, n: 0 };
    rotulo[i] = id;
    pilha.push(i);
    while (pilha.length) {
      const p = pilha.pop()!;
      const x = p % w, y = (p - x) / w;
      c.n++;
      if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y;
      if (x > 0 && m[p - 1] && rotulo[p - 1] < 0) { rotulo[p - 1] = id; pilha.push(p - 1); }
      if (x < w - 1 && m[p + 1] && rotulo[p + 1] < 0) { rotulo[p + 1] = id; pilha.push(p + 1); }
      if (y > 0 && m[p - w] && rotulo[p - w] < 0) { rotulo[p - w] = id; pilha.push(p - w); }
      if (y < h - 1 && m[p + w] && rotulo[p + w] < 0) { rotulo[p + w] = id; pilha.push(p + w); }
    }
    caixas.push(c);
  }
  return { rotulo, caixas };
}

/** Contorno externo de uma máscara pelas arestas dos pixels (polígono em escada, fechado). */
function tracarBorda(m: Uint8Array, w: number, h: number): Ponto[] {
  const saidas = new Map<number, number[]>();
  const chave = (x: number, y: number) => y * (w + 1) + x;
  const ligar = (x1: number, y1: number, x2: number, y2: number) => {
    const k = chave(x1, y1);
    const lista = saidas.get(k);
    if (lista) lista.push(chave(x2, y2)); else saidas.set(k, [chave(x2, y2)]);
  };
  const em = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!em(x, y)) continue;
      if (!em(x, y - 1)) ligar(x, y, x + 1, y);
      if (!em(x + 1, y)) ligar(x + 1, y, x + 1, y + 1);
      if (!em(x, y + 1)) ligar(x + 1, y + 1, x, y + 1);
      if (!em(x - 1, y)) ligar(x, y + 1, x, y);
    }
  }
  let melhor: Ponto[] = [];
  let melhorArea = 0;
  for (const inicio of [...saidas.keys()]) {
    if (!saidas.get(inicio)?.length) continue;
    const laco: Ponto[] = [];
    let atual = inicio;
    for (let passos = 0; passos < 4 * (w + 1) * (h + 1); passos++) {
      const prox = saidas.get(atual)?.pop();
      if (prox === undefined) break;
      laco.push([atual % (w + 1), Math.floor(atual / (w + 1))]);
      atual = prox;
      if (atual === inicio) break;
    }
    let a = 0;
    for (let i = 0; i < laco.length; i++) {
      const [x1, y1] = laco[i], [x2, y2] = laco[(i + 1) % laco.length];
      a += x1 * y2 - x2 * y1;
    }
    if (Math.abs(a) > melhorArea) { melhorArea = Math.abs(a); melhor = laco; }
  }
  // Tira os pontos intermediários dos lados retos.
  return melhor.filter((p, i) => {
    const a = melhor[(i - 1 + melhor.length) % melhor.length], b = melhor[(i + 1) % melhor.length];
    return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
  });
}

/** Procura a torre na imagem (luminância 0–255). Devolve null se não achar uma região fechada razoável. */
export function detectarContorno(lum: ArrayLike<number>, largura: number, altura: number, opcoes: OpcoesDeteccao = {}): ContornoDetectado | null {
  const limiar = opcoes.limiar ?? 170;
  const rc = opcoes.recorte;
  const x0 = Math.max(0, Math.floor(rc?.x ?? 0)), y0 = Math.max(0, Math.floor(rc?.y ?? 0));
  const w = Math.min(largura - x0, Math.floor(rc?.largura ?? largura)), h = Math.min(altura - y0, Math.floor(rc?.altura ?? altura));
  if (w < 8 || h < 8) return null;

  const traco = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) traco[y * w + x] = lum[(y + y0) * largura + x + x0] < limiar ? 1 : 0;

  const r = Math.max(1, Math.round(Math.min(w, h) / 300));
  const grosso = dilatar(traco, w, h, r);

  // Moldura da prancha, carimbo e linhas que atravessam tudo: traços que cobrem quase toda a largura ou altura.
  const { rotulo: rotTraco, caixas: caixasTraco } = componentes(grosso, w, h);
  const atravessa = caixasTraco.map(c => (c.maxX - c.minX) > w * 0.9 || (c.maxY - c.minY) > h * 0.9);
  for (let i = 0; i < grosso.length; i++) if (grosso[i] && atravessa[rotTraco[i]]) grosso[i] = 0;

  // Água a partir da borda: o que não molha é traço ou região fechada.
  const fora = new Uint8Array(w * h);
  const pilha: number[] = [];
  const molhar = (p: number) => { if (!fora[p] && !grosso[p]) { fora[p] = 1; pilha.push(p); } };
  for (let x = 0; x < w; x++) { molhar(x); molhar((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { molhar(y * w); molhar(y * w + w - 1); }
  while (pilha.length) {
    const p = pilha.pop()!;
    const x = p % w;
    if (x > 0) molhar(p - 1);
    if (x < w - 1) molhar(p + 1);
    if (p >= w) molhar(p - w);
    if (p < w * (h - 1)) molhar(p + w);
  }
  const solido = new Uint8Array(w * h);
  for (let i = 0; i < solido.length; i++) solido[i] = fora[i] ? 0 : 1;

  const { rotulo, caixas } = componentes(solido, w, h);
  let escolhido = -1;
  caixas.forEach((c, i) => {
    if (c.maxX - c.minX > w * 0.95 && c.maxY - c.minY > h * 0.95) return;
    if (escolhido < 0 || c.n > caixas[escolhido].n) escolhido = i;
  });
  if (escolhido < 0 || caixas[escolhido].n < w * h * 0.01) return null;

  const mascara = new Uint8Array(w * h);
  for (let i = 0; i < mascara.length; i++) mascara[i] = rotulo[i] === escolhido ? 1 : 0;
  const borda = tracarBorda(mascara, w, h);
  if (borda.length < 4) return null;

  const tolerancia = Math.max(2, Math.hypot(w, h) * 0.012);
  let contorno = ortogonalizar(simplificar(borda, tolerancia));
  if (contorno.length < 4) contorno = borda;
  return {
    contorno: contorno.map(([x, y]) => [Math.round(x + x0), Math.round(y + y0)] as Ponto),
    ocupacao: caixas[escolhido].n / (w * h),
  };
}
