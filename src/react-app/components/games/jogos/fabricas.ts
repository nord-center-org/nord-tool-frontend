import type { GanchosMotor, MotorJogo, VagaJogo } from "../comum/MolduraPartida";

/** Cria o motor de um jogo (carregado sob demanda): usado pelo celular para desenhar o jogo que roda na tela. */
export type FabricaMotor = (caixa: HTMLDivElement, vagas: VagaJogo[], modo: string, cenario: string, ganchos: GanchosMotor) => MotorJogo;

export async function fabricaDoMotor(jogo: string): Promise<FabricaMotor | null> {
  switch (jogo) {
    case "bombas": {
      const m = await import("./bombas/motorBombas");
      return (c, v, modo, cen, g) => m.criarMotorBombas(c, v, modo as Parameters<typeof m.criarMotorBombas>[2], cen as Parameters<typeof m.criarMotorBombas>[3], g);
    }
    case "hexagonos": {
      const m = await import("./hexagonos/motorHexagonos");
      return (c, v, modo, cen, g) => m.criarMotorHexagonos(c, v, modo as Parameters<typeof m.criarMotorHexagonos>[2], cen as Parameters<typeof m.criarMotorHexagonos>[3], g);
    }
    case "encaixe": {
      const m = await import("./encaixe/motorEncaixe");
      return (c, v, modo, cen, g) => m.criarMotorEncaixe(c, v, modo as Parameters<typeof m.criarMotorEncaixe>[2], cen as Parameters<typeof m.criarMotorEncaixe>[3], g);
    }
    case "duelo": {
      const m = await import("./duelo/motorDuelo");
      return (c, v, modo, cen, g) => m.criarMotorDuelo(c, v, modo as Parameters<typeof m.criarMotorDuelo>[2], cen as Parameters<typeof m.criarMotorDuelo>[3], g);
    }
    case "naval": {
      const m = await import("./naval/motorNaval");
      return (c, v, modo, cen, g) => m.criarMotorNaval(c, v, modo as Parameters<typeof m.criarMotorNaval>[2], cen as Parameters<typeof m.criarMotorNaval>[3], g);
    }
    case "defesa": {
      const m = await import("./defesa/motorDefesa");
      return (c, v, modo, cen, g) => m.criarMotorDefesa(c, v, modo as Parameters<typeof m.criarMotorDefesa>[2], cen as Parameters<typeof m.criarMotorDefesa>[3], g);
    }
    case "torres": {
      const m = await import("./torres/motorTorres");
      return (c, v, modo, cen, g) => m.criarMotorTorres(c, v, modo as Parameters<typeof m.criarMotorTorres>[2], cen as Parameters<typeof m.criarMotorTorres>[3], g);
    }
    case "espacial": {
      const m = await import("./espacial/motorEspacial");
      return (c, v, modo, cen, g) => m.criarMotorEspacial(c, v, modo as Parameters<typeof m.criarMotorEspacial>[2], cen as Parameters<typeof m.criarMotorEspacial>[3], g);
    }
    case "coroa": {
      const m = await import("./coroa/motorCoroa");
      return (c, v, modo, cen, g) => m.criarMotorCoroa(c, v, modo as Parameters<typeof m.criarMotorCoroa>[2], cen as Parameters<typeof m.criarMotorCoroa>[3], g);
    }
    case "masmorra": {
      const m = await import("./masmorra/motorMasmorra");
      return (c, v, modo, cen, g) => m.criarMotorMasmorra(c, v, modo as Parameters<typeof m.criarMotorMasmorra>[2], cen as Parameters<typeof m.criarMotorMasmorra>[3], g);
    }
    case "horda": {
      const m = await import("./horda/motorHorda");
      return (c, v, modo, cen, g) => m.criarMotorHorda(c, v, modo as Parameters<typeof m.criarMotorHorda>[2], cen as Parameters<typeof m.criarMotorHorda>[3], g);
    }
    case "cartas": {
      const m = await import("./cartas/motorCartas");
      return (c, v, modo, cen, g) => m.criarMotorCartas(c, v, modo as Parameters<typeof m.criarMotorCartas>[2], cen as Parameters<typeof m.criarMotorCartas>[3], g);
    }
    default:
      return null;
  }
}
