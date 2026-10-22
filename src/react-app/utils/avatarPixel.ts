/**
 * Avatar em pixel art (32×32). Cada camada é um "sprite" de texto: um caractere por pixel, "." = transparente.
 * Sprites simétricos são escritos pela metade esquerda (16 colunas) e espelhados.
 */
import { CORES_CABELO, FUNCOES, FUNDOS, PELES, type AvatarConfig, type DataComemorativa } from "./avatar.ts";

export const LADO = 32;
export type Grade = (string | null)[][];
type Cores = Record<string, string>;

const CONTORNO = "#241c2b";

/** Mistura uma cor com preto (f < 0) ou branco (f > 0). */
export function tom(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(canal);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const espelho = (metades: string[]) => metades.map(l => l + [...l].reverse().join(""));

function pintar(g: Grade, linhas: string[], y0: number, cores: Cores, x0 = 0) {
  linhas.forEach((linha, i) => {
    const y = y0 + i;
    if (y < 0 || y >= LADO) return;
    for (let j = 0; j < linha.length; j++) {
      const c = linha[j];
      if (c === ".") continue;
      const cor = c === "K" ? CONTORNO : cores[c];
      if (!cor) throw new Error(`Cor "${c}" sem definição`);
      const x = x0 + j;
      if (x >= 0 && x < LADO) g[y][x] = cor;
    }
  });
}

const px = (g: Grade, pontos: [number, number][], cor: string) => pontos.forEach(([x, y]) => { g[y][x] = cor; });

// ---------- Sprites ----------

const CABECA = espelho([
  "..........KKKKKK",
  "........KKSSSSSS",
  ".......KSSSSSSSS",
  "......KSSSSSSSSS",
  "......KSSSSSSSSS",
  "......KSSSSSSSSS",
  "......KSSSSSSSSS",
  "......KSSSSSSSSS",
  "....KKKSSSSSSSSS",
  "...KSsKSSSSSSSSS",
  "...KSsKSSSSSSSSS",
  "...KSsKSSSSSSSSS",
  "....KKKSSSSSSSSS",
  "......KsSSSSSSSS",
  ".......KsSSSSSSS",
  "........KKsSSSSS",
  "..........KKKKKK",
]); // y0 = 5

const PESCOCO = espelho([
  "............KsSS",
  "............KsSS",
  "............KsSS",
  "............KssS",
  ".............KsS",
  "..............KS",
]); // y0 = 20

const CORPO = espelho([
  ".........KKKKTTT",
  "......KKKTTTTuTT",
  ".....KTTTTTTTTuT",
  "....KTuTTTTTTTTT",
  "...KTuTTTTTTTTTT",
  "...KTuTTTTTTTTTT",
  "..KTuTTTtTTTTTTT",
  "..KTTTTTtTTTTTTT",
  "..KTTTTTtTTTTTTT",
]); // y0 = 23

const COLETE = espelho([
  ".....KVVVK......",
  "....KVVVVVK.....",
  "...KZZZZZZK.....",
  "...KVVVVVVK.....",
  "..KVVVVVVVVK....",
  "..KZZZZZZZZK....",
  "..KVVVVVVVVK....",
]); // y0 = 25

const PRANCHETA = [
  "...KKK...",
  "KKKcccKKK",
  "KbWWWWWbK",
  "KbWllWWbK",
  "KbWWWWWbK",
  "KbWlllWbK",
  "KbWWWWWbK",
  "KbWllWWbK",
]; // x0 = 20, y0 = 24

const RAIO = ["..ZZ.", ".ZZ..", "ZZZZ.", "..ZZ.", ".ZZ.."]; // x0 = 7, y0 = 25
const CRUZ = [".WWW.", "WWgWW", "WgggW", "WWgWW", ".WWW."]; // x0 = 7, y0 = 25
const CRACHA = ["KKKKKK", "KbbWWK", "KbbllK", "KWWWWK"]; // x0 = 13, y0 = 28

const CABELO_CURTO = espelho([
  "..........KKKKKK",
  "........KKHHHHHH",
  ".......KHHHHiiHH",
  "......KHHHHHHiHH",
  "......KHHHHHHHHH",
  "......KHHhHHHHhH",
  "......KHh.hHHh..",
  "......KH........",
  "......Kh........",
]); // y0 = 4

const CABELO_RASPADO = espelho([
  "..........KKKKKK",
  "........KKhhhhhh",
  ".......Khhhhhhhh",
  "......Khhhhhhhhh",
  "......Kh.h.h.h.h",
]); // y0 = 5

const CRISTA = espelho([
  "..............KK",
  ".............KHH",
  ".............KHi",
  ".............KHH",
  ".............KHH",
  ".............KHH",
  ".............KHH",
  ".............KhH",
  ".............KhH",
]); // y0 = 0

const CABELO_CACHEADO = espelho([
  "...........KKK..",
  ".........KKHHHKK",
  "........KHHiHHHH",
  "......KKHHHHHhHH",
  ".....KHHiHHhHHHH",
  ".....KHHHHhHHHiH",
  "....KHHhHHHHHHHH",
  "....KHHHHiHHhHHH",
  "....KHhHHHHHHHHh",
  "....KHHHhH.hH..h",
  "....KHHhK.......",
  "....KHHHK.......",
  ".....KhK........",
]); // y0 = 1

const CABELO_LONGO_TRAS = espelho([
  ".....KHHHHHHHHHH",
  ...Array.from({ length: 12 }, () => "....KHhHHHHHHHHH"),
  ...Array.from({ length: 6 }, () => "....KHhHHHK....."),
  ".....KHHK.......",
  "......KK........",
]); // y0 = 6

const CABELO_LONGO_LADOS = espelho([
  "......KHH.......",
  "......KHH.......",
  ".....KHHh.......",
  ".....KHHh.......",
  ".....KHh........",
]); // y0 = 11

const COQUE = espelho([
  "..............KK",
  ".............KHH",
  "............KHHi",
  "............KHHH",
]); // y0 = 0

const CAPACETE = espelho([
  "...........KKKKK",
  ".........KKYYYYy",
  "........KYGGYYYy",
  ".......KYGYYYYYy",
  "......KYGYYYYYYy",
  "......KYYYYYYYYy",
  ".....KYYYYYYYYYy",
  "....KYYYYYYYYYYy",
  "..KKyyyyyyyyyyyy",
  "...KKKKKKKKKKKKK",
]); // y0 = 2

const GORRO = espelho([
  "..........KKKKKK",
  "........KKRRRRRR",
  ".......KRRRRRRRR",
  "......KRRrRRRRRR",
  "......KRRRRRRRRR",
  ".....KRRRRRRRRRR",
  "...KKKKKKKKKKKKK",
  "..KFFFFFFFFFFFFF",
  "..KFFfFFFFFfFFFF",
  "...KKKKKKKKKKKKK",
]); // y0 = 2

const GORRO_PONTA = [
  "........................KKKK....",
  "......................KKFFFFK...",
  "....................KKRKFFFFK...",
  "..................KKRRRKFFFFK...",
  "................KKRRRRRRKKKK....",
  "...................RRRRK........",
]; // y0 = 0

const CHAPEU_FESTA = espelho([
  "..............KK",
  ".............KQQ",
  "..............KK",
  ".............KYY",
  ".............KQQ",
  "............KYYY",
  "............KQQQ",
  "...........KYYYY",
  "...........KQQQQ",
  "..........KYYYYY",
  "..........KKKKKK",
]); // y0 = 0

const CHAPEU_PALHA = espelho([
  "...........KKKKK",
  ".........KKYYYYY",
  "........KYYyYYYY",
  "........KYYYYyYY",
  "........KRRRRRRR",
  "...KKKKKKYYYYYYY",
  ".KKYYyYYYYyYYYYy",
  "..KKKKKKKKKKKKKK",
]); // y0 = 3

const CHAPEU_BRUXA = [
  "..................KKK...........",
  ".................KPPK...........",
  "................KPPK............",
  "...............KPPPK............",
  "..............KPPPPK............",
  ".............KPPPPPPK...........",
  "............KOOOOOOOOK..........",
  "...........KPPPPPPPPPPK.........",
  "..KKKKKKKKKPPPPPPPPPPPPKKKKKKKK.",
  ".KPPPPPPPPPPPPPPPPPPPPPPPPPPPPK.",
  "..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..",
]; // y0 = 1

const ORELHAS = espelho([
  ".........KKK....",
  "........KWWWK...",
  "........KWpWK...",
  "........KWpWK...",
  "........KWpWK...",
]); // y0 = 0

const MASCARA = espelho([
  ".......KKKKKKK..",
  "......KMMMMMMMKK",
  "......KMMMMMMMMM",
  ".......KMMMMMKKK",
  "........KKKKK...",
]); // y0 = 13

// ---------- Montagem ----------

export function montarGrade(c: AvatarConfig, tema: DataComemorativa | null, olhosFechados = false, semFundo = false): Grade {
  const g: Grade = Array.from({ length: LADO }, () => Array<string | null>(LADO).fill(null));
  const pele = PELES[c.pele];
  const cabelo = CORES_CABELO[c.corCabelo];
  const funcao = FUNCOES[c.funcao];
  const fundo = FUNDOS[c.fundo];
  const cores: Cores = {
    S: pele, s: tom(pele, -0.18), L: tom(pele, 0.35),
    H: cabelo, h: tom(cabelo, -0.3), i: tom(cabelo, 0.35),
    T: funcao.camisa, t: tom(funcao.camisa, -0.25), u: tom(funcao.camisa, 0.25),
    Y: funcao.capacete, y: tom(funcao.capacete, -0.2), G: tom(funcao.capacete, 0.6),
    V: c.funcao === "engenheiro" ? "#84cc16" : "#f97316", Z: "#fef08a",
    b: "#a16207", W: "#f8fafc", l: "#94a3b8", c: "#cbd5e1", g: "#16a34a",
    R: "#dc2626", r: "#991b1b", F: "#f8fafc", f: "#cbd5e1", Q: "#ec4899", p: "#f9a8d4",
    P: "#312e81", O: "#f97316", M: "#a21caf",
  };
  const chapeuDoTema = tema === "natal" || tema === "anoNovo" || tema === "junina" || tema === "halloween";
  const comCapacete = c.capacete && !chapeuDoTema;

  const fundoDe = (y: number) => (y > 25 ? tom(fundo, -0.06) : fundo);
  // Fundo com um brilho suave no alto e o chão mais escuro.
  if (!semFundo) {
    for (let y = 0; y < LADO; y++) for (let x = 0; x < LADO; x++) g[y][x] = fundoDe(y);
    px(g, [[3, 3], [4, 3], [3, 4], [27, 6], [28, 5], [26, 20], [5, 18]], tom(fundo, 0.55));
    if (tema === "junina") bandeirinhas(g);
    if (tema === "anoNovo" || tema === "carnaval") confete(g);
  }
  const soFundo = g.map(l => [...l]);

  pintar(g, CORPO, 23, cores);
  if (funcao.extra === "colete") pintar(g, COLETE, 25, cores);
  if (funcao.extra === "prancheta") pintar(g, PRANCHETA, 24, cores, 20);
  if (funcao.extra === "raio") pintar(g, RAIO, 25, cores, 7);
  if (funcao.extra === "cruz") pintar(g, CRUZ, 25, cores, 7);
  pintar(g, PESCOCO, 20, cores);
  if (funcao.extra === "cracha") {
    px(g, [[13, 24], [13, 25], [14, 26], [14, 27], [18, 24], [18, 25], [17, 26], [17, 27]], "#ef4444");
    pintar(g, CRACHA, 28, { ...cores, b: "#60a5fa" }, 13);
  }

  if (c.cabelo === "longo") pintar(g, CABELO_LONGO_TRAS, 6, cores);
  pintar(g, CABECA, 5, cores);

  // Rosto
  px(g, [[10, 17], [11, 17], [20, 17], [21, 17]], mistura(pele, "#f472b6", 0.35));
  px(g, [[16, 16], [16, 17]], cores.s);
  if (tema === "junina") px(g, [[9, 16], [11, 18], [20, 18], [22, 16]], tom(pele, -0.35));
  if (c.barba === "cheia") barbaCheia(g, pele, cores.s, cabelo, cores.h);
  if (c.barba === "cavanhaque") { px(g, [[14, 20], [15, 20], [16, 20], [17, 20], [15, 21], [16, 21]], cabelo); px(g, [[14, 21], [17, 21]], cores.h); }
  if (tema === "carnaval") pintar(g, MASCARA, 13, cores);
  olhos(g, c.olhos, olhosFechados);
  if (c.cabelo !== "careca") {
    px(g, [[10, 12], [11, 12], [12, 12], [19, 12], [20, 12], [21, 12]], cabelo);
    px(g, [[10, 11], [21, 11]], cores.h);
  }
  boca(g, c.boca);
  if (c.barba !== "nenhuma") {
    // Bigode (vem em todas as barbas).
    px(g, [[13, 17], [14, 17], [15, 17], [16, 17], [17, 17], [18, 17]], cabelo);
    px(g, [[12, 18], [19, 18]], cores.h);
  }

  // Cabelo da frente (crista e coque não cabem debaixo de chapéu).
  const semChapeu = !comCapacete && !chapeuDoTema;
  switch (c.cabelo) {
    case "curto": pintar(g, CABELO_CURTO, 4, cores); break;
    case "raspado": pintar(g, CABELO_RASPADO, 5, cores); break;
    case "moicano": pintar(g, CABELO_RASPADO, 5, cores); if (semChapeu) pintar(g, CRISTA, 0, cores); break;
    case "cacheado": pintar(g, CABELO_CACHEADO, 1, cores); break;
    case "longo": pintar(g, CABELO_CURTO, 4, cores); pintar(g, CABELO_LONGO_LADOS, 11, cores); break;
    case "coque": if (semChapeu) pintar(g, COQUE, 0, cores); pintar(g, CABELO_CURTO, 4, cores); break;
    case "careca": px(g, [[12, 7], [13, 7], [12, 8]], cores.L); break;
  }

  // Chapéu de aba larga: acima da aba só aparece o fundo (e o chapéu por cima).
  const aba = tema === "halloween" ? 9 : tema === "junina" ? 8 : 0;
  for (let y = 0; y < aba; y++) g[y] = [...soFundo[y]];

  // Chapéus
  if (comCapacete) pintar(g, CAPACETE, 2, cores);
  if (tema === "natal") { pintar(g, GORRO, 2, cores); pintar(g, GORRO_PONTA, 0, cores); }
  if (tema === "anoNovo") pintar(g, CHAPEU_FESTA, 0, { ...cores, Y: "#facc15" });
  if (tema === "junina") pintar(g, CHAPEU_PALHA, 3, { ...cores, Y: "#eab308", y: "#a16207" });
  if (tema === "halloween") pintar(g, CHAPEU_BRUXA, 1, cores);
  if (tema === "pascoa") pintar(g, ORELHAS, 0, cores);
  if (tema === "carnaval") px(g, [[24, 9], [25, 10], [24, 11], [25, 12], [24, 13]], "#facc15");
  return g;
}

function mistura(a: string, b: string, f: number): string {
  const [x, y] = [parseInt(a.slice(1), 16), parseInt(b.slice(1), 16)];
  const canal = (s: number) => Math.round(((x >> s) & 255) * (1 - f) + ((y >> s) & 255) * f);
  return `#${((1 << 24) | (canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).slice(1)}`;
}

function olhos(g: Grade, tipo: AvatarConfig["olhos"], piscada = false) {
  const aberto = (x: number) => { px(g, [[x, 14]], "#f8fafc"); px(g, [[x + 1, 14], [x, 15], [x + 1, 15]], CONTORNO); };
  const fechado = (x: number) => piscada
    ? px(g, [[x, 15], [x + 1, 15]], CONTORNO)
    : px(g, [[x - 1, 15], [x, 14], [x + 1, 14], [x + 2, 15]], CONTORNO);
  if (tipo === "oculos") {
    for (const x0 of [9, 17]) {
      for (let x = x0 + 1; x < x0 + 5; x++) for (let y = 14; y < 16; y++) g[y][x] = "#cfe8ff";
      for (let x = x0; x < x0 + 6; x++) { g[13][x] = CONTORNO; g[16][x] = CONTORNO; }
      g[14][x0] = g[15][x0] = g[14][x0 + 5] = g[15][x0 + 5] = CONTORNO;
    }
    px(g, [[15, 14], [16, 14], [7, 14], [8, 14], [23, 14], [24, 14]], CONTORNO);
  }
  if (tipo === "feliz" || piscada) { fechado(11); fechado(19); return; }
  aberto(11);
  if (tipo === "piscando") fechado(19); else aberto(19);
}

function boca(g: Grade, tipo: AvatarConfig["boca"]) {
  const M = "#7f1d1d";
  if (tipo === "aberta") {
    px(g, [[13, 18], [18, 18], [14, 19], [15, 19], [16, 19], [17, 19]], M);
    px(g, [[14, 18], [15, 18], [16, 18], [17, 18]], "#f8fafc");
    px(g, [[15, 19], [16, 19]], "#f87171");
    return;
  }
  if (tipo === "seria") { px(g, [[14, 19], [15, 19], [16, 19], [17, 19]], M); return; }
  px(g, [[13, 18], [18, 18], [14, 19], [15, 19], [16, 19], [17, 19]], M);
}

function barbaCheia(g: Grade, pele: string, sombra: string, cabelo: string, escuro: string) {
  for (let y = 15; y <= 21; y++) {
    for (let x = 6; x <= 25; x++) {
      const naPele = g[y][x] === pele || g[y][x] === sombra;
      const lateral = x <= 9 || x >= 22;
      const queixo = y >= 19 && !(y === 19 && x >= 13 && x <= 18);
      if (naPele && (lateral || queixo)) g[y][x] = (x + y) % 3 === 0 ? escuro : cabelo;
    }
  }
  px(g, [[13, 21], [14, 21], [15, 21], [16, 21], [17, 21], [18, 21]], escuro);
}

function bandeirinhas(g: Grade) {
  const cores = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ec4899"];
  for (let x = 0; x < LADO; x++) g[1][x] = "#92400e";
  cores.forEach((cor, i) => {
    const x0 = 1 + i * 6;
    for (let x = x0; x < x0 + 5; x++) g[2][x] = cor;
    for (let x = x0 + 1; x < x0 + 4; x++) g[3][x] = cor;
    g[4][x0 + 2] = cor;
  });
}

function confete(g: Grade) {
  const pontos: [number, number, string][] = [[2, 8, "#ec4899"], [29, 3, "#facc15"], [4, 22, "#22c55e"], [28, 20, "#3b82f6"], [1, 14, "#f97316"], [30, 12, "#a855f7"], [6, 2, "#22c55e"]];
  pontos.forEach(([x, y, cor]) => { g[y][x] = cor; });
}

/** Pixels que mudam entre duas grades (a piscada desenha só a diferença por cima). */
export function diferenca(a: Grade, b: Grade): Grade {
  return b.map((linha, y) => linha.map((cor, x) => (cor !== a[y][x] ? cor : null)));
}

/** Junta pixels vizinhos da mesma cor numa linha (bem menos retângulos no SVG). */
export function emRetangulos(g: Grade): { x: number; y: number; w: number; cor: string }[] {
  const saida: { x: number; y: number; w: number; cor: string }[] = [];
  g.forEach((linha, y) => {
    let x = 0;
    while (x < LADO) {
      const cor = linha[x];
      let w = 1;
      while (x + w < LADO && linha[x + w] === cor) w++;
      if (cor) saida.push({ x, y, w, cor });
      x += w;
    }
  });
  return saida;
}
