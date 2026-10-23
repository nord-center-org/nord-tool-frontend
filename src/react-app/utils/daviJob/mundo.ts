/** Mapas do Davi Job: o puleiro (hub) e a arena do minigame. Coordenadas em pixels do mundo (480 × 270). */
import { escada, ponte, type Plataforma } from "./motor.ts";

export const LARGURA = 480;
export const ALTURA = 270;
export const CHAO_Y = 258;

export interface Arranhador { x: number; topo: number; base: number }
export interface Pote { x: number; y: number; cor: string }
export interface Caixa { x: number; y: number; w: number; h: number }
export interface CordaDef { x: number; y: number; comprimento: number; cor: string }
export interface BolaDef { x: number; y: number; cor: string }
export interface Porta { x: number; y: number; w: number; h: number }

export interface Mapa {
  plataformas: Plataforma[];
  /** Prateleiras desenhadas com suportes (as de verdade; degraus e pontes têm desenho próprio). */
  arranhadores: Arranhador[];
  potes: Pote[];
  caixas: Caixa[];
  cordas: CordaDef[];
  bolas: BolaDef[];
  brinquedos: BolaDef[];
  porta: Porta | null;
  /** Onde os gatos e os ratos podem nascer. */
  nascer: { x: number; y: number }[];
}

const chao: Plataforma = { id: "chao", x: 0, y: CHAO_Y, w: LARGURA, tipo: "chao" };
const prat = (id: string, x: number, y: number, w: number): Plataforma => ({ id, x, y, w, tipo: "prateleira" });

/** O puleiro: prateleiras em andares de ~36 px (alcançáveis com um pulo), pontes, escadas, caixas e brinquedos. */
export const HUB: Mapa = {
  plataformas: [
    chao,
    // andar 222
    prat("a1", 14, 222, 66), prat("a2", 150, 222, 64), prat("a3", 296, 222, 84), prat("a4", 392, 222, 50),
    ...escada("e1", 232, 254, 292, 224, 6),
    // andar 186
    prat("b1", 78, 186, 72), prat("b2", 226, 186, 62), prat("b3", 352, 186, 62),
    ...escada("e2", 152, 184, 196, 154, 4),
    // andar 150
    prat("c1", 12, 150, 62), prat("c2", 196, 150, 70), prat("c3", 318, 150, 34), prat("c4", 404, 150, 66),
    // andar 114: pontes
    prat("d1", 56, 114, 70), ...ponte("p1", 126, 226, 114, 9, 10), prat("d2", 226, 114, 60), ...ponte("p2", 286, 380, 114, 8, 9),
    prat("d3", 380, 114, 76),
    // andar 78
    prat("f1", 16, 78, 64), prat("f2", 140, 78, 76), prat("f3", 236, 78, 104), prat("f4", 396, 78, 70),
    // topo das caixas
    { id: "cx1", x: 244, y: 46, w: 88, tipo: "caixa" }, { id: "cx2", x: 404, y: 46, w: 54, tipo: "caixa" },
  ],
  arranhadores: [{ x: 40, topo: 226, base: CHAO_Y }, { x: 340, topo: 190, base: 222 }, { x: 440, topo: 118, base: 150 }],
  potes: [{ x: 110, y: 186, cor: "#3b82f6" }, { x: 330, y: 222, cor: "#ef4444" }, { x: 252, y: 114, cor: "#3b82f6" }],
  caixas: [{ x: 244, y: 46, w: 88, h: 32 }, { x: 404, y: 46, w: 54, h: 32 }, { x: 18, y: 54, w: 52, h: 24 }],
  cordas: [{ x: 176, y: 122, comprimento: 34, cor: "#ef4444" }, { x: 333, y: 121, comprimento: 30, cor: "#a855f7" }, { x: 100, y: 78, comprimento: 26, cor: "#22c55e" }],
  bolas: [{ x: 120, y: 170, cor: "#3b82f6" }, { x: 178, y: 60, cor: "#a855f7" }, { x: 320, y: 200, cor: "#22c55e" }, { x: 60, y: 240, cor: "#f97316" }],
  brinquedos: [{ x: 196, y: 70, cor: "#9ca3af" }, { x: 420, y: 214, cor: "#9ca3af" }, { x: 430, y: 106, cor: "#a8a29e" }],
  porta: { x: 448, y: CHAO_Y - 34, w: 26, h: 34 },
  nascer: [{ x: 60, y: 222 }, { x: 180, y: 222 }, { x: 330, y: 222 }, { x: 110, y: 186 }, { x: 250, y: 186 }, { x: 380, y: 186 },
    { x: 40, y: 150 }, { x: 230, y: 150 }, { x: 430, y: 150 }, { x: 90, y: 114 }, { x: 255, y: 114 }, { x: 415, y: 114 },
    { x: 46, y: 78 }, { x: 175, y: 78 }, { x: 290, y: 78 }, { x: 430, y: 78 }, { x: 150, y: CHAO_Y }, { x: 300, y: CHAO_Y }],
};

/** Arena do "Caça ao rato": puleiros espalhados para o rato fugir pulando (pique-pega). */
export const ARENA: Mapa = {
  plataformas: [
    chao,
    prat("a1", 30, 222, 90), prat("a2", 196, 222, 90), prat("a3", 360, 222, 90),
    prat("b1", 100, 186, 80), prat("b2", 290, 186, 80),
    prat("c1", 20, 150, 80), prat("c2", 196, 150, 88), prat("c3", 380, 150, 80),
    prat("d1", 106, 114, 76), prat("d2", 298, 114, 76),
    prat("f1", 30, 78, 86), prat("f2", 200, 78, 80), prat("f3", 364, 78, 86),
    ...escada("e1", 150, 254, 194, 224, 4), ...escada("e2", 330, 224, 358, 254, 4),
  ],
  arranhadores: [], potes: [], caixas: [], cordas: [], bolas: [], brinquedos: [], porta: null,
  nascer: [{ x: 70, y: 78 }, { x: 240, y: 78 }, { x: 400, y: 78 }, { x: 60, y: 150 }, { x: 240, y: 150 }, { x: 420, y: 150 },
    { x: 140, y: 186 }, { x: 330, y: 186 }, { x: 140, y: 114 }, { x: 335, y: 114 }, { x: 240, y: 222 }],
};

/** Prateleiras "de verdade" (com suportes no desenho). */
export const prateleiras = (m: Mapa) => m.plataformas.filter(p => p.tipo === "prateleira");
