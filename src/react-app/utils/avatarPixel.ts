/**
 * Avatar em pixel art (32×32). Cada camada é um "sprite" de texto: um caractere por pixel, "." = transparente.
 * Sprites simétricos são escritos pela metade esquerda (16 colunas) e espelhados.
 * Acabamento: contorno colorido (cada contorno puxa a cor da região que envolve), luz e sombra em todas as peças.
 */
import {
  CORES_CABELO, CORES_OLHOS, FUNCOES, FUNDOS, PELES, corDoCapacete, mistura, tom, type AvatarConfig, type DataComemorativa,
} from "./avatar.ts";

export { tom } from "./avatar.ts";

export const LADO = 32;
export type Grade = (string | null)[][];
type Cores = Record<string, string>;

export const CONTORNO = "#241c2b";

/** Estado da montagem: a grade, onde há contorno ("K") e onde ainda é só fundo. */
interface Tela {
  g: Grade;
  contorno: boolean[][];
  fundo: boolean[][];
}

const espelho = (metades: string[]) => metades.map(l => l + [...l].reverse().join(""));

function pintar(t: Tela, linhas: string[], y0: number, cores: Cores, x0 = 0) {
  linhas.forEach((linha, i) => {
    const y = y0 + i;
    if (y < 0 || y >= LADO) return;
    for (let j = 0; j < linha.length; j++) {
      const c = linha[j];
      if (c === ".") continue;
      const cor = c === "K" ? CONTORNO : cores[c];
      if (!cor) throw new Error(`Cor "${c}" sem definição`);
      const x = x0 + j;
      if (x < 0 || x >= LADO) continue;
      t.g[y][x] = cor;
      t.contorno[y][x] = c === "K";
      t.fundo[y][x] = false;
    }
  });
}

function px(t: Tela, pontos: [number, number][], cor: string) {
  for (const [x, y] of pontos) {
    if (x < 0 || x >= LADO || y < 0 || y >= LADO) continue;
    t.g[y][x] = cor;
    t.contorno[y][x] = false;
    t.fundo[y][x] = false;
  }
}

/** Troca "H" por "h" em colunas alternadas (mechas de dread, tranças). */
const listras = (linhas: string[]) => linhas.map(l => [...l].map((c, x) => (c === "H" && x % 2 === 1 ? "h" : c)).join(""));

// ---------- Corpo ----------

const CABECA = espelho([
  "..........KKKKKK",
  "........KKSSSSSS",
  ".......KSSSSSSSS",
  "......KSLSSSSSSS",
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

/** Gola: dá forma ao pescoço e separa a camisa. */
const GOLA = espelho([
  "...........cK...",
  "............cK..",
]); // y0 = 23

// ---------- Uniforme e ferramentas ----------

const COLETE = espelho([
  ".....KVVVK......",
  "....KVVVVVK.....",
  "...KZZZZZZK.....",
  "...KVVVVVVK.....",
  "..KVVVVVVVVK....",
  "..KZZZZZZZZK....",
  "..KVVVVVVVVK....",
]); // y0 = 25

const MACACAO = espelho([
  ".........MM.....",
  ".........MM.....",
  "..........MM....",
  "..........MMm...",
  "..........MMMMMM",
  "..........MMMMMM",
  "..........MMmmmm",
  "..........MMMMMM",
]); // y0 = 24

const AVENTAL = espelho([
  "............A...",
  "............A...",
  "..........KAAAAA",
  "..........KAaAAA",
  "..........KAAAAA",
  "..........KAaaaa",
  "..........KAAAAA",
  "..........KAAAAA",
]); // y0 = 24

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

const PLANTA = [
  ".KKKKKKKKK.",
  "KbBBBnBBBBK",
  "KbBnBBBBnBK",
  "KbBBBBBBBBK",
  ".KKKKKKKKK.",
]; // x0 = 18, y0 = 26

const TRENA = [
  "KKKK.",
  "KYYYK",
  "KYkYK",
  "KYYYKZ",
  ".KKKK",
]; // x0 = 7, y0 = 26

const RAIO = ["..ZZ.", ".ZZ..", "ZZZZ.", "..ZZ.", ".ZZ.."]; // x0 = 7, y0 = 25
const CRUZ = [".WWW.", "WWgWW", "WgggW", "WWgWW", ".WWW."]; // x0 = 7, y0 = 25
const CRACHA = ["KKKKKK", "KbbWWK", "KbbllK", "KWWWWK"]; // x0 = 13, y0 = 28

const RADIO = [
  ".K...",
  ".K...",
  "KKKK.",
  "KrrK.",
  "KggK.",
  "KrrK.",
  "KrrK.",
  "KKKK.",
]; // x0 = 6, y0 = 23

// ---------- Cabelos ----------

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

const TOPETE = [
  "...........KKKKKKK..............",
  ".........KKHHHHiiHKK............",
  "........KHHHHHHHiiHHK...........",
  ".......KHHhHHHHHHHHHHKK.........",
]; // y0 = 1

const FRANJA = espelho([
  "......KHHHHHHHHH",
  "......KHHHHHHiHH",
  "......KHHhHHHHHH",
  "......KHh.HHh.Hh",
]); // y0 = 8

const ONDAS = espelho([
  ".....KHH........",
  ".....KHhK.......",
  "......KHHK......",
  ".....KHhK.......",
  ".....KHHK.......",
  "......KhK.......",
  "......KK........",
]); // y0 = 10

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

const AFRO_TRAS = espelho([
  "..........KKKKKK",
  ".......KKKHHHHHH",
  ".....KKHHHHHiHHH",
  "....KHHHHiHHHHHH",
  "...KHHHHHHHHHhHH",
  "...KHHhHHHHHHHHH",
  "..KHHHHHHHHHHHHH",
  "..KHHHHHHHHHHHHH",
  "..KHHHHhHHHHHHHH",
  "..KHHHHHHHHHHHHH",
  "..KHHHHHHHHHHHHH",
  "..KHHhHHHHHHHHHH",
  "...KHHHHHHHHHHHH",
  "....KKHHHHHHHHHH",
]); // y0 = 0

const AFRO_FRENTE = espelho([
  "......KHHHHHHHHH",
  "......KHHHHiHHHH",
  "......KHHhHHHHHH",
  "......KHHHHHHHhH",
  "......KhHH.hHH.h",
  "......Kh........",
]); // y0 = 5

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

const RABO = [
  "......................KQK.......",
  ".......................KHHK.....",
  "........................KHHK....",
  ".........................KHHK...",
  ".........................KHhK...",
  "..........................KHHK..",
  "..........................KHiK..",
  ".........................KHhHK..",
  "..........................KHHK..",
  "...........................KHK..",
  "............................K...",
]; // y0 = 3

const TRANCA = espelho([
  "....KHHK........",
  ...Array.from({ length: 11 }, (_, i) => (i % 2 ? "....KhHK........" : "....KHhK........")),
  "....KQQK........",
  "....KHiK........",
  ".....KK.........",
]); // y0 = 11

const CHANEL = espelho([
  "..........KKKKKK",
  "........KKHHHHHH",
  ".......KHHHHiiHH",
  "......KHHHHHHHiH",
  ".....KHHHHHHHHHH",
  ".....KHHHHHHHHHH",
  ".....KHHhHHHHhHH",
  ".....KHHK.......",
  ".....KHHK.......",
  "....KHHHK.......",
  "....KHHHK.......",
  "....KHHhK.......",
  "....KHHHK.......",
  "....KHhHK.......",
  "....KHHHK.......",
  "....KKKKK.......",
]); // y0 = 4

const COQUE = espelho([
  "..............KK",
  ".............KHH",
  "............KHHi",
  "............KHHH",
]); // y0 = 0

// ---------- Chapéus ----------

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
  "..KFFfFFFFFFfFFF",
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

const MASCARA_CARNAVAL = espelho([
  ".......KKKKKKK..",
  "......KMMMMMMMKK",
  "......KMMMMMMMMM",
  ".......KMMMMMKKK",
  "........KKKKK...",
]); // y0 = 13

// ---------- Acessórios ----------

const PFF = espelho([
  "..........KKKKKK",
  ".........KWWWWWW",
  "........sKWWWWWW",
  ".........KWWWWWl",
  "..........KWWWWW",
  "...........KKKKK",
]); // y0 = 15

const ABAFADOR = espelho([
  "...KKK..........",
  "..KOOOK.........",
  "..KOoOK.........",
  "..KOOOK.........",
  "..KOOOK.........",
  "...KKK..........",
]); // y0 = 12

/** Cores das peças que não dependem da pessoa. */
const FIXAS: Cores = {
  V: "#f97316", Z: "#fef08a", b: "#a16207", W: "#f8fafc", l: "#94a3b8", g: "#16a34a",
  R: "#dc2626", r: "#991b1b", F: "#f8fafc", f: "#cbd5e1", Q: "#ec4899", p: "#f9a8d4",
  P: "#312e81", O: "#f97316", o: "#fdba74", M: "#a21caf", B: "#3b82f6", n: "#1e40af", k: "#1f2937", A: "#a16207", a: "#713f12",
};

// ---------- Montagem ----------

export function montarGrade(c: AvatarConfig, tema: DataComemorativa | null, olhosFechados = false, semFundo = false): Grade {
  const t: Tela = {
    g: Array.from({ length: LADO }, () => Array<string | null>(LADO).fill(null)),
    contorno: Array.from({ length: LADO }, () => Array<boolean>(LADO).fill(false)),
    fundo: Array.from({ length: LADO }, () => Array<boolean>(LADO).fill(true)),
  };
  const g = t.g;
  const pele = PELES[c.pele];
  const cabelo = CORES_CABELO[c.corCabelo];
  const funcao = FUNCOES[c.funcao];
  const capacete = corDoCapacete(c);
  const cores: Cores = {
    ...FIXAS,
    S: pele, s: tom(pele, -0.16), L: tom(pele, 0.3),
    H: cabelo, h: tom(cabelo, -0.3), i: mistura(tom(cabelo, 0.2), "#93c5fd", 0.15),
    T: funcao.camisa, t: tom(funcao.camisa, -0.25), u: tom(funcao.camisa, 0.22), c: tom(funcao.camisa, 0.45),
    Y: capacete, y: tom(capacete, -0.22), G: tom(capacete, 0.65),
    V: c.funcao === "engenheiro" || c.funcao === "topografo" ? "#84cc16" : "#f97316",
    M: c.funcao === "encanador" ? tom(funcao.camisa, -0.4) : "#a21caf",
    m: "#facc15",
  };
  const chapeuDoTema = tema === "natal" || tema === "anoNovo" || tema === "junina" || tema === "halloween";
  const comCapacete = c.capacete && !chapeuDoTema;
  const semChapeu = !comCapacete && !chapeuDoTema;

  if (!semFundo) desenharFundo(t, c.fundo, tema);
  const soFundo = g.map(l => [...l]);
  const fundoAntes = t.fundo.map(l => [...l]);

  // Cabelo de trás (fica atrás da cabeça e do corpo).
  if (c.cabelo === "longo") pintar(t, CABELO_LONGO_TRAS, 6, cores);
  if (c.cabelo === "dreads") pintar(t, listras(CABELO_LONGO_TRAS), 6, cores);
  if (c.cabelo === "afro") pintar(t, comCapacete ? AFRO_TRAS.slice(5) : AFRO_TRAS, comCapacete ? 5 : 0, cores);
  if (c.cabelo === "rabo" && semChapeu) pintar(t, RABO, 3, cores);

  pintar(t, CORPO, 23, cores);
  pintar(t, GOLA, 23, cores);
  uniforme(t, c, cores);
  pintar(t, PESCOCO, 20, cores);
  if (funcao.extra === "cracha") {
    px(t, [[13, 24], [13, 25], [14, 26], [14, 27], [18, 24], [18, 25], [17, 26], [17, 27]], "#ef4444");
    pintar(t, CRACHA, 28, { ...cores, b: "#60a5fa" }, 13);
  }
  if (c.acessorio === "radio") pintar(t, RADIO, 23, { ...cores, r: "#334155", g: "#4ade80" }, 6);

  pintar(t, CABECA, 5, cores);

  // Rosto: bochechas, nariz, detalhes.
  const rosado = mistura(pele, "#f472b6", c.detalhe === "bochechas" ? 0.55 : 0.3);
  px(t, [[10, 17], [11, 17], [20, 17], [21, 17]], rosado);
  if (c.detalhe === "bochechas") px(t, [[9, 17], [22, 17], [10, 16], [21, 16]], mistura(pele, "#f472b6", 0.35));
  px(t, [[16, 16], [16, 17]], cores.s);
  px(t, [[15, 17]], tom(pele, 0.18));
  if (c.detalhe === "sardas") px(t, [[9, 16], [11, 16], [10, 17], [20, 16], [22, 16], [21, 17], [13, 16], [18, 16]], tom(pele, -0.32));
  if (c.detalhe === "pinta") px(t, [[20, 19]], tom(pele, -0.6));
  if (tema === "junina") px(t, [[9, 16], [11, 18], [20, 18], [22, 16]], tom(pele, -0.35));

  barba(t, c, pele, cores);
  if (tema === "carnaval") pintar(t, MASCARA_CARNAVAL, 13, cores);
  olhos(t, c, pele, olhosFechados);
  sobrancelhas(t, c, cabelo);
  boca(t, c.boca);
  if (c.barba === "bigode" || c.barba === "cavanhaque" || c.barba === "cheia") bigode(t, cabelo, cores.h);
  if (c.acessorio === "mascara") pintar(t, PFF, 15, { ...cores, s: "#64748b" });

  // Cabelo da frente (crista, topete, coque e rabo não cabem debaixo de chapéu).
  switch (c.cabelo) {
    case "curto": pintar(t, CABELO_CURTO, 4, cores); break;
    case "raspado": pintar(t, CABELO_RASPADO, 5, cores); break;
    case "topete": pintar(t, CABELO_CURTO, 4, cores); if (semChapeu) pintar(t, TOPETE, 1, cores); break;
    case "franja": pintar(t, CABELO_CURTO, 4, cores); pintar(t, FRANJA, 8, cores); break;
    case "ondulado": pintar(t, CABELO_CURTO, 4, cores); pintar(t, ONDAS, 10, cores); break;
    case "moicano": pintar(t, CABELO_RASPADO, 5, cores); if (semChapeu) pintar(t, CRISTA, 0, cores); break;
    case "cacheado": pintar(t, CABELO_CACHEADO, 1, cores); break;
    case "afro": pintar(t, AFRO_FRENTE, 5, cores); break;
    case "longo": pintar(t, CABELO_CURTO, 4, cores); pintar(t, CABELO_LONGO_LADOS, 11, cores); break;
    case "dreads": pintar(t, CABELO_CURTO, 4, cores); pintar(t, listras(CABELO_LONGO_LADOS), 11, cores); break;
    case "rabo": pintar(t, CABELO_CURTO, 4, cores); break;
    case "coque": if (semChapeu) pintar(t, COQUE, 0, cores); pintar(t, CABELO_CURTO, 4, cores); break;
    case "trancas": pintar(t, CABELO_CURTO, 4, cores); pintar(t, TRANCA, 11, cores); break;
    case "chanel": pintar(t, CHANEL, 4, cores); break;
    case "careca": px(t, [[12, 7], [13, 7], [12, 8]], cores.L); break;
  }

  // Óculos e protetor ficam por cima do cabelo. Lentes claras só pintam por cima da pele (o olho aparece).
  oculos(t, c.acessorio, new Set([pele, cores.s, cores.L, tom(pele, 0.18)]));
  if (c.acessorio === "protetorAuricular") {
    if (semChapeu) px(t, [[5, 11], [5, 10], [6, 9], [6, 8], [7, 7], [8, 6], [9, 5], [26, 11], [26, 10], [25, 9], [25, 8], [24, 7], [23, 6], [22, 5]], "#334155");
    pintar(t, ABAFADOR, 12, cores);
  }
  if (c.acessorio === "brinco") px(t, [[5, 18], [26, 18]], "#facc15");

  // Chapéu de aba larga: acima da aba só aparece o fundo (e o chapéu por cima).
  const aba = tema === "halloween" ? 9 : tema === "junina" ? 8 : 0;
  for (let y = 0; y < aba; y++) {
    g[y] = [...soFundo[y]];
    t.contorno[y] = t.contorno[y].map(() => false);
    t.fundo[y] = [...fundoAntes[y]];
  }

  if (comCapacete) pintar(t, CAPACETE, 2, cores);
  if (tema === "natal") { pintar(t, GORRO, 2, cores); pintar(t, GORRO_PONTA, 0, cores); }
  if (tema === "anoNovo") pintar(t, CHAPEU_FESTA, 0, { ...cores, Y: "#facc15" });
  if (tema === "junina") pintar(t, CHAPEU_PALHA, 3, { ...cores, Y: "#eab308", y: "#a16207" });
  if (tema === "halloween") pintar(t, CHAPEU_BRUXA, 1, cores);
  if (tema === "pascoa") pintar(t, ORELHAS, 0, cores);
  if (tema === "carnaval") px(t, [[24, 9], [25, 10], [24, 11], [25, 12], [24, 13]], "#facc15");
  if (c.acessorio === "lapis") {
    px(t, [[28, 9]], "#f472b6");
    px(t, [[27, 10], [26, 11]], "#facc15");
    px(t, [[25, 12]], "#fde68a");
  }

  contornoColorido(t);
  return g;
}

/** Fundo com brilho no alto e chão mais escuro; os fundos de cena ganham desenho. */
function desenharFundo(t: Tela, fundo: AvatarConfig["fundo"], tema: DataComemorativa | null) {
  const base = FUNDOS[fundo];
  const g = t.g;
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      // Degradê suave em 3 faixas e uma luz no canto de cima.
      const f = y < 9 ? 0.1 : y > 25 ? -0.08 : 0;
      g[y][x] = f ? tom(base, f) : base;
    }
  }
  const brilho = tom(base, 0.6);
  for (const [x, y] of [[3, 3], [4, 3], [3, 4], [27, 6], [28, 5], [26, 20], [5, 18]] as [number, number][]) g[y][x] = brilho;
  if (fundo === "ceu") {
    const nuvem = "#f8fafc";
    for (const [x0, y0] of [[1, 5], [22, 9]] as [number, number][]) {
      for (let x = x0 + 1; x < x0 + 6; x++) g[y0][x] = nuvem;
      for (let x = x0; x < x0 + 8; x++) g[y0 + 1][x] = nuvem;
      g[y0 + 1][x0 + 7] = tom(base, 0.3);
    }
  }
  if (fundo === "obra") {
    const ferro = tom(base, -0.45);
    for (let y = 2; y < 24; y++) g[y][28] = ferro;
    for (let x = 18; x < 31; x++) g[3][x] = ferro;
    for (let x = 19; x < 30; x += 2) g[4][x] = ferro;
    for (let y = 4; y < 8; y++) g[y][21] = tom(base, -0.3);
    g[8][21] = "#475569";
    for (let y = 27; y < LADO; y++) for (let x = 0; x < LADO; x++) g[y][x] = tom(base, -0.18);
  }
  if (fundo === "noite") {
    for (const [x, y] of [[2, 2], [6, 7], [29, 2], [24, 12], [3, 21], [29, 18], [12, 1], [19, 2]] as [number, number][]) g[y][x] = "#fef9c3";
    for (const [x, y] of [[25, 3], [26, 3], [24, 4], [25, 4], [24, 5], [25, 5], [25, 6], [26, 6]] as [number, number][]) g[y][x] = "#fde68a";
  }
  if (tema === "junina") bandeirinhas(g);
  if (tema === "anoNovo" || tema === "carnaval") confete(g);
}

function uniforme(t: Tela, c: AvatarConfig, cores: Cores) {
  switch (FUNCOES[c.funcao].extra) {
    case "colete": pintar(t, COLETE, 25, cores); break;
    case "macacao": pintar(t, MACACAO, 24, cores); break;
    case "avental": pintar(t, AVENTAL, 24, cores); break;
    case "prancheta": pintar(t, PRANCHETA, 24, cores, 20); break;
    case "planta": pintar(t, PLANTA, 26, cores, 18); break;
    case "trena": pintar(t, TRENA, 26, { ...cores, Y: "#facc15" }, 7); break;
    case "raio": pintar(t, RAIO, 25, cores, 7); break;
    case "cruz": pintar(t, CRUZ, 25, cores, 7); break;
    case "chave":
      px(t, [[20, 25], [22, 25], [20, 26], [21, 26], [22, 26], [22, 27], [23, 28], [24, 29], [25, 30]], "#cbd5e1");
      px(t, [[21, 27], [22, 28], [23, 29], [24, 30]], "#64748b");
      break;
    case "respingos":
      for (const [x, y, cor] of [[9, 27, "#ef4444"], [14, 29, "#3b82f6"], [22, 26, "#facc15"], [19, 30, "#22c55e"], [6, 30, "#3b82f6"], [25, 28, "#ef4444"], [11, 25, "#facc15"], [17, 27, "#ec4899"]] as [number, number, string][]) {
        px(t, [[x, y]], cor);
      }
      break;
  }
}

function sobrancelhas(t: Tela, c: AvatarConfig, cabelo: string) {
  const clara = c.corCabelo === "branco" || c.corCabelo === "platinado" || c.corCabelo === "loiro" || c.cabelo === "careca";
  const cor = clara ? tom(cabelo, -0.45) : tom(cabelo, -0.08);
  const sombra = tom(cor, -0.3);
  // Cada sobrancelha é descrita pela da esquerda e espelhada (x → 31 - x).
  const par = (pontos: [number, number][], cr: string) => px(t, pontos.flatMap(([x, y]) => [[x, y], [31 - x, y]] as [number, number][]), cr);
  if (c.olhos === "bravo") { par([[10, 11], [11, 11], [12, 12], [13, 12]], cor); return; }
  if (c.olhos === "surpreso") { par([[10, 11], [11, 10], [12, 10], [13, 11]], cor); return; }
  switch (c.sobrancelha) {
    case "grossa": par([[10, 12], [11, 12], [12, 12], [13, 12], [10, 11], [11, 11], [12, 11]], cor); par([[10, 11]], sombra); break;
    case "fina": par([[11, 12], [12, 12], [13, 12]], mistura(cor, PELES[c.pele], 0.25)); break;
    case "arqueada": par([[10, 12], [11, 11], [12, 11], [13, 12]], cor); break;
    default: par([[11, 12], [12, 12], [13, 12]], cor); par([[10, 11]], sombra);
  }
}

/** Olhos: formato (normal, grande…), cor da íris e expressão (feliz, piscando…). x = coluna do olho esquerdo. */
function olhos(t: Tela, c: AvatarConfig, pele: string, piscada: boolean) {
  const iris = CORES_OLHOS[c.corOlhos];
  const pupila = mistura(iris, CONTORNO, 0.65);
  const branco = "#f8fafc";
  const fechadoArco = (x: number) => px(t, [[x - 1, 15], [x, 14], [x + 1, 14], [x + 2, 15]], CONTORNO);
  const fechadoLinha = (x: number) => px(t, [[x, 15], [x + 1, 15]], CONTORNO);
  const fechadoSereno = (x: number) => px(t, [[x - 1, 14], [x, 15], [x + 1, 15], [x + 2, 14]], CONTORNO);
  /** Lado de fora do olho (esquerdo: x - 1; direito: x + 2). */
  const fora = (x: number) => (x < 16 ? x - 1 : x + 2);
  const aberto = (x: number) => {
    const out = fora(x);
    switch (c.olhos === "surpreso" ? "grande" : c.formatoOlhos) {
      case "grande":
        px(t, [[x, 13], [x + 1, 13]], CONTORNO);
        px(t, [[x, 14]], branco); px(t, [[x + 1, 14], [x, 15]], iris); px(t, [[x + 1, 15]], pupila);
        px(t, [[out, 14]], CONTORNO);
        break;
      case "redondo":
        px(t, [[x, 13], [x + 1, 13]], pupila);
        px(t, [[x, 14]], branco); px(t, [[x + 1, 14], [x, 15], [x + 1, 15]], pupila);
        break;
      case "pequeno": {
        const xp = x < 16 ? x + 1 : x;
        px(t, [[xp, 14], [xp, 15]], pupila);
        break;
      }
      case "amendoado":
        px(t, [[x, 14]], branco); px(t, [[x + 1, 14]], CONTORNO); px(t, [[x, 15]], iris); px(t, [[x + 1, 15]], pupila);
        px(t, [[out, 14]], CONTORNO);
        break;
      case "puxado":
        px(t, [[x, 15], [x + 1, 15]], pupila);
        px(t, [[x < 16 ? x : x + 1, 14]], CONTORNO);
        px(t, [[out, 14]], CONTORNO);
        break;
      case "caido":
        px(t, [[x, 14], [x + 1, 14]], CONTORNO);
        px(t, [[x, 15]], iris); px(t, [[x + 1, 15]], pupila);
        px(t, [[out, 15]], CONTORNO);
        break;
      case "semicerrado":
        px(t, [[x, 14], [x + 1, 14]], tom(pele, -0.4));
        px(t, [[x, 15]], iris); px(t, [[x + 1, 15]], pupila);
        break;
      default:
        px(t, [[x, 14]], branco); px(t, [[x + 1, 14]], CONTORNO); px(t, [[x, 15]], iris); px(t, [[x + 1, 15]], pupila);
    }
  };
  if (piscada) {
    // Pálpebra: cobre a área do olho com pele e desenha a linha fechada.
    for (const x of [11, 19]) for (let y = 13; y <= 15; y++) for (let dx = -1; dx <= 2; dx++) px(t, [[x + dx, y]], pele);
    fechadoLinha(11); fechadoLinha(19);
    return;
  }
  if (c.olhos === "feliz") { fechadoArco(11); fechadoArco(19); return; }
  if (c.olhos === "sereno") { fechadoSereno(11); fechadoSereno(19); return; }
  aberto(11);
  if (c.olhos === "piscando") fechadoArco(19); else aberto(19);
  if (c.olhos === "bravo") px(t, [[12, 13], [19, 13]], CONTORNO);
}

function oculos(t: Tela, tipo: AvatarConfig["acessorio"], tonsPele: Set<string>) {
  const isPele = (x: number, y: number) => !t.contorno[y][x] && tonsPele.has(t.g[y][x] ?? "");
  if (tipo === "oculos" || tipo === "oculosSol") {
    const lente = tipo === "oculosSol" ? "#1e293b" : "#cfe8ff";
    for (const x0 of [9, 17]) {
      for (let x = x0 + 1; x < x0 + 5; x++) for (let y = 14; y < 16; y++) {
        // Lente clara deixa o olho aparecer; a escura cobre.
        if (tipo === "oculosSol" || isPele(x, y)) px(t, [[x, y]], lente);
      }
      for (let x = x0; x < x0 + 6; x++) px(t, [[x, 13], [x, 16]], CONTORNO);
      px(t, [[x0, 14], [x0, 15], [x0 + 5, 14], [x0 + 5, 15]], CONTORNO);
      px(t, [[x0 + 1, 14]], tipo === "oculosSol" ? "#64748b" : "#ffffff");
    }
    px(t, [[15, 14], [16, 14], [7, 14], [8, 14], [23, 14], [24, 14]], CONTORNO);
  }
  if (tipo === "oculosSeguranca") {
    for (let x = 8; x <= 23; x++) {
      px(t, [[x, 12]], "#facc15");
      px(t, [[x, 17]], "#ca8a04");
      for (let y = 13; y <= 16; y++) if (isPele(x, y)) px(t, [[x, y]], "#d6f0fb");
    }
    px(t, [[8, 13], [8, 14], [8, 15], [8, 16], [23, 13], [23, 14], [23, 15], [23, 16]], "#ca8a04");
    px(t, [[10, 13], [11, 13], [18, 13], [19, 13]], "#ffffff");
    px(t, [[6, 14], [7, 14], [24, 14], [25, 14]], "#334155");
  }
}

function boca(t: Tela, tipo: AvatarConfig["boca"]) {
  const M = "#7f1d1d";
  switch (tipo) {
    case "aberta":
      px(t, [[13, 18], [18, 18], [14, 19], [15, 19], [16, 19], [17, 19]], M);
      px(t, [[14, 18], [15, 18], [16, 18], [17, 18]], "#f8fafc");
      px(t, [[15, 19], [16, 19]], "#f87171");
      break;
    case "risada":
      px(t, [[12, 18], [19, 18], [13, 19], [18, 19], [14, 20], [15, 20], [16, 20], [17, 20]], M);
      px(t, [[13, 18], [14, 18], [15, 18], [16, 18], [17, 18], [18, 18]], "#f8fafc");
      px(t, [[14, 19], [15, 19], [16, 19], [17, 19]], "#b91c1c");
      px(t, [[15, 19], [16, 19]], "#f87171");
      break;
    case "canto": px(t, [[14, 19], [15, 19], [16, 19], [17, 19], [18, 18]], M); break;
    case "seria": px(t, [[14, 19], [15, 19], [16, 19], [17, 19]], M); break;
    default:
      px(t, [[13, 18], [18, 18], [14, 19], [15, 19], [16, 19], [17, 19]], M);
  }
}

function bigode(t: Tela, cabelo: string, escuro: string) {
  px(t, [[13, 17], [14, 17], [15, 17], [16, 17], [17, 17], [18, 17]], cabelo);
  px(t, [[12, 18], [19, 18]], escuro);
}

function barba(t: Tela, c: AvatarConfig, pele: string, cores: Cores) {
  const cabelo = cores.H, escuro = cores.h;
  const ehPele = (x: number, y: number) => t.g[y][x] === pele || t.g[y][x] === cores.s;
  switch (c.barba) {
    case "cheia":
      for (let y = 15; y <= 21; y++) for (let x = 6; x <= 25; x++) {
        const lateral = x <= 9 || x >= 22;
        const queixo = y >= 19 && !(y === 19 && x >= 13 && x <= 18);
        if (ehPele(x, y) && (lateral || queixo)) px(t, [[x, y]], (x + y) % 3 === 0 ? escuro : cabelo);
      }
      px(t, [[13, 21], [14, 21], [15, 21], [16, 21], [17, 21], [18, 21]], escuro);
      break;
    case "rala": {
      const sombra = mistura(pele, cabelo, 0.45);
      for (let y = 17; y <= 21; y++) for (let x = 7; x <= 24; x++) {
        const queixo = y >= 19 || x <= 9 || x >= 22;
        if (ehPele(x, y) && queixo && (x + y) % 2 === 0) px(t, [[x, y]], sombra);
      }
      break;
    }
    case "cavanhaque":
      px(t, [[14, 20], [15, 20], [16, 20], [17, 20], [15, 21], [16, 21]], cabelo);
      px(t, [[14, 21], [17, 21]], escuro);
      break;
    case "costeleta":
      for (let y = 12; y <= 18; y++) for (const x of [7, 8, 23, 24]) if (ehPele(x, y)) px(t, [[x, y]], (y + x) % 3 === 0 ? escuro : cabelo);
      break;
  }
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

/**
 * Contorno colorido: cada pixel de contorno vira um tom escuro da cor que ele envolve (cabelo, pele, capacete…),
 * em vez do quase-preto chapado. Deixa o desenho mais macio sem perder a leitura.
 */
function contornoColorido(t: Tela) {
  const novos: [number, number, string][] = [];
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      if (!t.contorno[y][x]) continue;
      const conta = new Map<string, number>();
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= LADO || ny >= LADO) continue;
        const cor = t.g[ny][nx];
        if (!cor || t.contorno[ny][nx] || t.fundo[ny][nx]) continue;
        conta.set(cor, (conta.get(cor) ?? 0) + 1);
      }
      if (conta.size === 0) continue;
      const [cor] = [...conta.entries()].sort((a, b) => b[1] - a[1])[0];
      novos.push([x, y, mistura(tom(cor, -0.55), CONTORNO, 0.45)]);
    }
  }
  for (const [x, y, cor] of novos) t.g[y][x] = cor;
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
