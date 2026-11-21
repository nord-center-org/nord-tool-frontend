/**
 * Avatar de corpo inteiro para os Games, no mesmo estilo pixel do avatar do NordTool. A cabeça é a do avatar da
 * pessoa (mesmo rosto, cabelo, capacete e acessórios); os ombros e a roupa da função vêm do busto, encolhidos em
 * proporção "chibi"; braços, cinto, calça e botas são desenhados aqui. Tudo por código, sem imagem.
 */
import { CONTORNO, LADO, montarGrade, type Grade } from "../avatarPixel.ts";
import { CORES_CABELO, FUNCOES, PELES, tom, type AvatarConfig } from "../avatar.ts";

export const LARGURA_CORPO = 32;
export const ALTURA_CORPO = 48;
/** Linha onde termina a cabeça (com pescoço) no busto 32×32. */
const FIM_CABECA = 22;
/** Faixa de colunas do tronco depois de encolher os ombros. */
const TRONCO_X0 = 8;
const TRONCO_LARG = 16;

export type DirecaoCorpo = "baixo" | "cima" | "lado";
export type AcaoCorpo = "parado" | "andando" | "vitoria";
export interface Pose { direcao: DirecaoCorpo; acao: AcaoCorpo; quadro: number }

/** Quadros de cada animação (o "lado" é desenhado olhando para a direita; a esquerda espelha). */
export const QUADROS: Record<AcaoCorpo, number> = { parado: 2, andando: 4, vitoria: 2 };

const vazia = (): Grade => Array.from({ length: ALTURA_CORPO }, () => Array<string | null>(LARGURA_CORPO).fill(null));

function ret(g: Grade, x0: number, y0: number, w: number, h: number, cor: string) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (y >= 0 && y < ALTURA_CORPO && x >= 0 && x < LARGURA_CORPO) g[y][x] = cor;
}

/** Calça e bota pela função: macacão do encanador na cor da roupa, o resto de calça de obra. */
function coresDaRoupa(c: AvatarConfig) {
  const f = FUNCOES[c.funcao];
  const calca = f.extra === "macacao" ? tom(f.camisa, -0.35) : c.funcao === "administrativo" || c.funcao === "arquiteto" ? "#1e293b" : "#334155";
  return {
    pele: PELES[c.pele], peleSombra: tom(PELES[c.pele], -0.16),
    manga: f.camisa, mangaSombra: tom(f.camisa, -0.25),
    calca, calcaSombra: tom(calca, -0.3), calcaLuz: tom(calca, 0.18),
    cinto: "#3f2a1d", fivela: "#facc15", bota: "#4a2f1d", botaLuz: "#7c5233", sola: "#1c1917",
  };
}

/** Uma perna: coxa/canela na cor da calça e a bota; {@code curta} encolhe (perna erguida no passo). */
function perna(g: Grade, x: number, topo: number, cores: ReturnType<typeof coresDaRoupa>, curta: number) {
  const comprimento = 7 - curta;
  ret(g, x, topo, 5, comprimento, cores.calca);
  ret(g, x + 4, topo, 1, comprimento, cores.calcaSombra);
  ret(g, x, topo, 1, comprimento, cores.calcaLuz);
  const bota = topo + comprimento;
  ret(g, x, bota, 5, 2, cores.bota);
  ret(g, x, bota, 2, 1, cores.botaLuz);
  ret(g, x - (curta ? 0 : 0), bota + 2, 6, 1, cores.sola);
}

/** Braço caído ao lado do tronco (manga curta + antebraço + mão); {@code dy} move no balanço do passo. */
function braco(g: Grade, x: number, topo: number, dy: number, cores: ReturnType<typeof coresDaRoupa>) {
  ret(g, x, topo + dy, 3, 4, cores.manga);
  ret(g, x, topo + 3 + dy, 3, 1, cores.mangaSombra);
  ret(g, x, topo + 4 + dy, 3, 4, cores.pele);
  ret(g, x, topo + 7 + dy, 3, 1, cores.peleSombra);
}

/** Braço erguido (vitória): sai do ombro e sobe por fora da cabeça, com a mão aberta lá em cima. */
function bracoErguido(g: Grade, x: number, ombro: number, cores: ReturnType<typeof coresDaRoupa>) {
  ret(g, x, ombro - 4, 3, 5, cores.manga);
  ret(g, x, ombro - 4, 3, 1, cores.mangaSombra);
  ret(g, x, ombro - 10, 3, 6, cores.pele);
  ret(g, x - 1, ombro - 13, 5, 3, cores.pele);
  ret(g, x - 1, ombro - 13, 5, 1, cores.peleSombra);
}

/** Contorno em volta das peças desenhadas por cima da cabeça (braços erguidos). */
function contornarPeca(g: Grade, pintar: (h: Grade) => void) {
  const h = vazia();
  pintar(h);
  for (let y = 0; y < ALTURA_CORPO; y++) {
    for (let x = 0; x < LARGURA_CORPO; x++) {
      if (h[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => h[y + dy]?.[x + dx])) g[y][x] = CONTORNO;
    }
  }
  for (let y = 0; y < ALTURA_CORPO; y++) for (let x = 0; x < LARGURA_CORPO; x++) if (h[y][x]) g[y][x] = h[y][x];
}

/** Cabeça de costas: a silhueta da cabeça no cabelo (o capacete continua aparecendo). */
function cabecaDeCostas(busto: Grade, c: AvatarConfig): Grade {
  const cabelo = c.cabelo === "careca" || c.cabelo === "raspado" ? tom(PELES[c.pele], -0.08) : CORES_CABELO[c.corCabelo];
  const sombra = tom(cabelo, -0.28);
  const out: Grade = busto.slice(0, FIM_CABECA + 1).map(l => [...l]);
  // O capacete (quando há) ocupa as linhas de cima: fica como está; o resto da cabeça vira cabelo/nuca.
  const inicio = c.capacete ? 10 : 0;
  for (let y = inicio; y <= FIM_CABECA; y++) {
    for (let x = 0; x < LADO; x++) {
      const cor = out[y][x];
      if (!cor) continue;
      // Contorno de fora fica; os traços de dentro (olhos, boca, sobrancelhas) somem na nuca.
      const fora = !out[y][x - 1] || !out[y][x + 1] || !out[y - 1]?.[x] || !out[y + 1]?.[x];
      if (cor === CONTORNO && fora) continue;
      const borda = fora;
      out[y][x] = y >= FIM_CABECA - 2 ? tom(PELES[c.pele], -0.12) : borda ? sombra : cabelo;
    }
  }
  return out;
}

/** Contorno escuro em volta do que foi desenhado do pescoço para baixo (o busto já tem o dele). */
function contornar(g: Grade, desde: number) {
  const marcar: [number, number][] = [];
  for (let y = desde; y < ALTURA_CORPO; y++) {
    for (let x = 0; x < LARGURA_CORPO; x++) {
      if (g[y][x]) continue;
      const vizinho = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const v = g[y + dy]?.[x + dx];
        return v && v !== CONTORNO && y + dy >= desde;
      });
      if (vizinho) marcar.push([x, y]);
    }
  }
  marcar.forEach(([x, y]) => { g[y][x] = CONTORNO; });
}

/** Monta um quadro do corpo inteiro (32×48). */
export function montarCorpo(c: AvatarConfig, pose: Pose): Grade {
  const busto = montarGrade(c, null, false, true);
  const cores = coresDaRoupa(c);
  const g = vazia();
  const q = ((pose.quadro % QUADROS[pose.acao]) + QUADROS[pose.acao]) % QUADROS[pose.acao];
  // Balanço: respirando (parado), passo (andando) e pulinho (vitória).
  const sobe = pose.acao === "andando" ? (q % 2 === 1 ? 1 : 0) : q === 1 ? 1 : 0;
  const base = 2 - sobe;

  const topoTronco = base + FIM_CABECA + 1;
  const fimTronco = topoTronco + 11;
  const pernaTopo = fimTronco + 1;

  // Pernas primeiro (o tronco cobre o encaixe).
  if (pose.direcao === "lado" && pose.acao === "andando") {
    const passo = q === 1 ? 2 : q === 3 ? -2 : 0;
    perna(g, 11 - passo, pernaTopo, cores, 0);
    perna(g, 15 + passo, pernaTopo, cores, 0);
  } else {
    const esquerdaErguida = pose.acao === "andando" && q === 1 ? 2 : 0;
    const direitaErguida = pose.acao === "andando" && q === 3 ? 2 : 0;
    perna(g, 10, pernaTopo, cores, esquerdaErguida);
    perna(g, 17, pernaTopo, cores, direitaErguida);
  }

  // Braços atrás do tronco quando de lado; nos lados dele de frente/costas.
  const balanco = pose.acao === "andando" ? (q === 1 ? -1 : q === 3 ? 1 : 0) : 0;
  if (pose.direcao === "lado" && pose.acao !== "vitoria") braco(g, 14, topoTronco + 1, -balanco, cores);

  // Tronco: os ombros e a roupa do busto (linhas 23–31) encolhidos para 16 colunas, mais a barra da camisa e o cinto.
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < TRONCO_LARG; x++) {
      const origem = Math.min(LADO - 1, 2 + Math.floor((x + 0.5) * (28 / TRONCO_LARG)));
      const cor = busto[23 + y][origem];
      if (cor) g[topoTronco + y][TRONCO_X0 + x] = cor;
    }
  }
  for (let y = 9; y < 11; y++) {
    for (let x = 0; x < TRONCO_LARG; x++) g[topoTronco + y][TRONCO_X0 + x] = g[topoTronco + 8][TRONCO_X0 + x];
  }
  ret(g, TRONCO_X0, fimTronco, TRONCO_LARG, 1, cores.cinto);
  ret(g, TRONCO_X0 + 7, fimTronco, 2, 1, cores.fivela);
  // Braços na frente das laterais do tronco (de frente e de costas) ou o braço da frente (de lado).
  if (pose.acao !== "vitoria") {
    if (pose.direcao === "lado") braco(g, 14, topoTronco + 1, balanco, cores);
    else {
      braco(g, TRONCO_X0 - 2, topoTronco + 1, balanco, cores);
      braco(g, TRONCO_X0 + TRONCO_LARG - 1, topoTronco + 1, -balanco, cores);
    }
  }
  contornar(g, base + FIM_CABECA + 1);

  // Cabeça por cima de tudo (de costas, só a silhueta no cabelo).
  const cabeca = pose.direcao === "cima" ? cabecaDeCostas(busto, c) : busto;
  for (let y = 0; y <= FIM_CABECA; y++) {
    for (let x = 0; x < LADO; x++) {
      const cor = cabeca[y][x];
      if (cor && y + base >= 0) g[y + base][x] = cor;
    }
  }
  if (pose.acao === "vitoria") {
    contornarPeca(g, h => {
      bracoErguido(h, 2, topoTronco + 1, cores);
      bracoErguido(h, LARGURA_CORPO - 5, topoTronco + 1, cores);
    });
  }
  return g;
}
