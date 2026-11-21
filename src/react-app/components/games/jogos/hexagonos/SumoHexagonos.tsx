import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import type { ModoHex } from "@/react-app/utils/games/hexagonos";
import { CENARIOS_HEX, criarMotorHexagonos, type CenarioHex } from "./motorHexagonos";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Sumô dos Hexágonos (3D): Queda (pisos que caem, 3 camadas) ou Sumô (empurre todos para fora). */
export default function SumoHexagonos({ vagas, modo, cenario, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoHex; cenario: CenarioHex }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorHexagonos(caixa, vagas, solo ? "queda" : modo, cenario, ganchos), [vagas, modo, cenario, solo]);
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={136}
      titulo="Sumô dos Hexágonos" modoRotulo={solo ? "Desafio" : modo === "queda" ? "Queda" : "Sumô"}
      detalhe={`${CENARIOS_HEX[cenario].nome} · ${solo ? "sobreviva 60 s sem cair" : modo === "queda" ? "o piso pisado cai · 3 camadas" : "empurre os rivais para fora"}`}
      botoes={{ a: "Dash", b: "Pular" }} ajudaTeclado="Setas/WASD andam · Espaço/Z dash · X/Shift pula · Esc pausa"
      textosSolo={{ venceu: "🏆 Sobreviveu!", perdeu: "Caiu! Tente de novo" }} />
  );
}
