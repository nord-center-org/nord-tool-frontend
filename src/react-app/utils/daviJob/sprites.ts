/** Sprites em pixel art do Davi Job: 8 gatinhos (vistos de lado, virados para a direita) e o rato. */

export type Grade = (string | null)[][];

export const GATO_W = 20;
export const GATO_H = 16;

/**
 * Corpo do gato (sem pernas nem cauda). K contorno, B corpo, b sombra, C cabeça, W peito/focinho,
 * P rosa (orelha/nariz), E/F olhos esquerdo/direito.
 */
const CORPO = [
  "............K....K..",
  "...........KPK..KPK.",
  "...........KCCKKCCK.",
  "...........KCCCCCCK.",
  "..........KCECCCFCCK",
  "..........KCECCCFCCK",
  "..........KCCWPWCCCK",
  "....KKKKKKKWWWWWCCK.",
  "...KBBBBBBBBWWWWKK..",
  "...KBBBBBBBBBWWWK...",
  "...KbBBBBBBBBBWWK...",
  "...KbbBBBBBBBBBBK...",
];

/** Cauda em dois quadros (balançando), como lista de [x, y, char]. */
const CAUDAS: [number, number, "K" | "T"][][] = [
  [[2, 2, "K"], [3, 2, "K"], [1, 3, "K"], [2, 3, "T"], [3, 3, "K"], [1, 4, "K"], [2, 4, "T"], [3, 4, "K"],
    [1, 5, "K"], [2, 5, "T"], [3, 5, "K"], [1, 6, "K"], [2, 6, "T"], [3, 6, "K"], [2, 7, "K"], [3, 7, "T"], [4, 7, "K"], [3, 8, "K"]],
  [[0, 3, "K"], [1, 3, "K"], [0, 4, "K"], [1, 4, "T"], [2, 4, "K"], [0, 5, "K"], [1, 5, "T"], [2, 5, "K"],
    [1, 6, "K"], [2, 6, "T"], [3, 6, "K"], [2, 7, "K"], [3, 7, "T"], [4, 7, "K"], [3, 8, "K"]],
];

/** Posição (coluna da esquerda, 2 px de largura) das 4 pernas em cada pose. */
const PERNAS: Record<"parado" | "passo" | "pulo", number[]> = {
  parado: [4, 7, 11, 14],
  passo: [3, 8, 10, 15],
  pulo: [2, 5, 13, 16],
};

export type Pose = keyof typeof PERNAS;

export interface Pelagem {
  id: string;
  nome: string;
  contorno: string;
  corpo: string;
  sombra: string;
  cabeca: string;
  cauda: string;
  peito: string;
  perna: string;
  pata: string;
  olhoE: string;
  olhoD: string;
  rosa: string;
  /** Listras (tigrado) na cor indicada. */
  listras?: string;
  /** Manchas fixas (tricolor). */
  manchas?: { cor: string; pontos: [number, number][] }[];
  /** "Pontas" escuras do siamês (orelhas, máscara, cauda, patas). */
  pontas?: string;
}

const area = (x0: number, y0: number, x1: number, y1: number): [number, number][] => {
  const l: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) l.push([x, y]);
  return l;
};

export const PELAGENS: Pelagem[] = [
  { id: "mel", nome: "Mel", contorno: "#2b2118", corpo: "#fbfaf7", sombra: "#d6d3cd", cabeca: "#fbfaf7", cauda: "#e88a2e", peito: "#ffffff",
    perna: "#fbfaf7", pata: "#ffffff", olhoE: "#2b2118", olhoD: "#2b2118", rosa: "#f4a3b4",
    manchas: [
      { cor: "#e88a2e", pontos: [...area(11, 1, 13, 4), ...area(5, 8, 8, 10)] },
      { cor: "#4a4a52", pontos: [...area(16, 2, 18, 3), ...area(9, 9, 11, 11), [4, 9], [4, 10]] },
    ] },
  { id: "pretinho", nome: "Pretinho", contorno: "#000000", corpo: "#2c2c33", sombra: "#1d1d22", cabeca: "#2c2c33", cauda: "#2c2c33", peito: "#3a3a43",
    perna: "#2c2c33", pata: "#2c2c33", olhoE: "#4ade80", olhoD: "#4ade80", rosa: "#e58fa3" },
  { id: "laranjinha", nome: "Laranjinha", contorno: "#4a2508", corpo: "#f59e2b", sombra: "#d97a16", cabeca: "#f59e2b", cauda: "#f59e2b", peito: "#fde4b0",
    perna: "#f59e2b", pata: "#fde4b0", olhoE: "#3b2410", olhoD: "#3b2410", rosa: "#f7a1a1", listras: "#c2610c" },
  { id: "floquinho", nome: "Floquinho", contorno: "#3f3f46", corpo: "#ffffff", sombra: "#e2e5ea", cabeca: "#ffffff", cauda: "#ffffff", peito: "#ffffff",
    perna: "#ffffff", pata: "#ffffff", olhoE: "#38bdf8", olhoD: "#facc15", rosa: "#f9a8c0" },
  { id: "cinzento", nome: "Cinzento", contorno: "#1f2937", corpo: "#9aa6b5", sombra: "#7b8798", cabeca: "#9aa6b5", cauda: "#9aa6b5", peito: "#f1f5f9",
    perna: "#9aa6b5", pata: "#f1f5f9", olhoE: "#f59e0b", olhoD: "#f59e0b", rosa: "#f3a5b6", listras: "#6b7787" },
  { id: "biscoito", nome: "Biscoito", contorno: "#3b2a1c", corpo: "#f6e6c8", sombra: "#e3cca4", cabeca: "#f6e6c8", cauda: "#6b4a2e", peito: "#fbf2e1",
    perna: "#6b4a2e", pata: "#6b4a2e", olhoE: "#3b82f6", olhoD: "#3b82f6", rosa: "#d99a8c", pontas: "#6b4a2e" },
  { id: "frajola", nome: "Frajola", contorno: "#000000", corpo: "#26262c", sombra: "#18181c", cabeca: "#26262c", cauda: "#26262c", peito: "#ffffff",
    perna: "#26262c", pata: "#ffffff", olhoE: "#facc15", olhoD: "#facc15", rosa: "#f2a0b3" },
  { id: "pacoca", nome: "Paçoca", contorno: "#3a2208", corpo: "#b9802f", sombra: "#9a661f", cabeca: "#b9802f", cauda: "#b9802f", peito: "#f6e3b8",
    perna: "#b9802f", pata: "#f6e3b8", olhoE: "#65a30d", olhoD: "#65a30d", rosa: "#e9a08f", listras: "#6e430f" },
];

export const pelagemPorId = (id: string) => PELAGENS.find(p => p.id === id) ?? PELAGENS[0];

export interface QuadroGato {
  pose: Pose;
  cauda: 0 | 1;
  /** Olhos fechados (piscando ou dormindo). */
  fechado?: boolean;
  /** Cabeça baixa (comendo/cheirando): desce 1 px. */
  cabecaBaixa?: boolean;
}

/** Monta a grade de cores do gato (GATO_W × GATO_H). */
export function montarGato(p: Pelagem, q: QuadroGato): Grade {
  const g: Grade = Array.from({ length: GATO_H }, () => Array<string | null>(GATO_W).fill(null));
  const cor = (c: string, x: number, y: number): string | null => {
    switch (c) {
      case "K": return p.contorno;
      case "B": return p.corpo;
      case "b": return p.sombra;
      case "C": return p.cabeca;
      case "W": return p.peito;
      case "P": return p.rosa;
      case "T": return p.cauda;
      case "E": return q.fechado ? p.contorno : p.olhoE;
      case "F": return q.fechado ? p.contorno : p.olhoD;
      default: void x; void y; return null;
    }
  };
  CORPO.forEach((linha, y) => [...linha].forEach((c, x) => {
    const yy = q.cabecaBaixa && x >= 10 && y <= 7 ? y + 1 : y;
    const v = cor(c, x, y);
    if (v && yy < GATO_H) g[yy][x] = v;
  }));
  if (q.fechado) {
    // Olho fechado vira um tracinho (só a linha de baixo).
    const dy = q.cabecaBaixa ? 1 : 0;
    for (const x of [12, 16]) { g[4 + dy][x] = p.cabeca; g[5 + dy][x] = p.contorno; }
  }
  for (const [x, y, c] of CAUDAS[q.cauda]) g[y][x] = c === "K" ? p.contorno : p.cauda;
  // Pernas: 2 px de pelo com contorno dos lados, pata embaixo e contorno no chão.
  for (const x of PERNAS[q.pose]) {
    for (let y = 12; y <= 14; y++) {
      if (x - 1 >= 0) g[y][x - 1] = p.contorno;
      if (x + 2 < GATO_W) g[y][x + 2] = p.contorno;
      g[y][x] = g[y][x + 1] = y === 14 ? p.pata : p.perna;
    }
    g[15][x] = g[15][x + 1] = p.contorno;
  }
  if (p.listras) {
    for (let y = 8; y <= 11; y++) for (const x of [6, 9, 12]) if (g[y][x] === p.corpo || g[y][x] === p.sombra) g[y][x] = p.listras;
    g[3][14] = p.listras; g[3][15] = p.listras; g[2][14] = p.listras;
  }
  for (const m of p.manchas ?? []) for (const [x, y] of m.pontos) {
    const atual = g[y]?.[x];
    if (atual && atual !== p.contorno && atual !== p.rosa && atual !== p.peito && atual !== p.olhoE && atual !== p.olhoD) g[y][x] = m.cor;
  }
  if (p.pontas) {
    for (const [x, y] of [[11, 1], [13, 1], [16, 1], [18, 1], [12, 2], [13, 2], [16, 2], [17, 2]] as [number, number][]) if (g[y][x] && g[y][x] !== p.contorno) g[y][x] = p.pontas;
    for (const [x, y] of area(12, 5, 16, 7)) if (g[y][x] === p.cabeca) g[y][x] = p.pontas;
  }
  return g;
}

export const RATO_W = 16;
export const RATO_H = 7;
const RATO = [
  "..........KK....",
  ".........KPPK...",
  "......KKKKGGGKK.",
  ".....KGGGGGGGEGK",
  "PPP.KGGGGGGGGGPK",
  "...PKKGGKKKGGKK.",
];
const PES_RATO = ["......K.K...K.K.", ".....K...K.K...K"];

/** Rato cinza (virado para a direita), com as patinhas em dois quadros. */
export function montarRato(quadro: 0 | 1, cor = "#9ca3af"): Grade {
  const cores: Record<string, string> = { K: "#374151", G: cor, P: "#f9a8d4", E: "#111827" };
  return [...RATO, PES_RATO[quadro]].map(l => [...l].map(c => cores[c] ?? null));
}

/** Junta pixels vizinhos da mesma cor numa linha (bem menos retângulos para desenhar). */
export function emRetangulos(g: Grade): { x: number; y: number; w: number; cor: string }[] {
  const saida: { x: number; y: number; w: number; cor: string }[] = [];
  g.forEach((linha, y) => {
    let x = 0;
    while (x < linha.length) {
      const cor = linha[x];
      let w = 1;
      while (x + w < linha.length && linha[x + w] === cor) w++;
      if (cor) saida.push({ x, y, w, cor });
      x += w;
    }
  });
  return saida;
}
