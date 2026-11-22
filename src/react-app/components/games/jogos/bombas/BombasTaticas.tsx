import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type FasePartida, type ResultadoPartida, type VagaJogo } from "../../comum/MolduraPartida";
import { META_MOEDAS_SOLO, type Bioma, type Modo } from "@/react-app/utils/games/bombas";
import { criarMotorBombas } from "./motorBombas";
import { BIOMAS } from "./desenho";

/** Uma vaga da partida: bot, quem está na tela (teclado/toque), um gamepad próprio ou um celular da sala. */
export type VagaBombas = VagaJogo;
export type ResultadoBombas = ResultadoPartida;
export type FaseBombas = FasePartida;

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

const TITULO_MODO: Record<Modo, string> = { sobrevivencia: "Sobrevivência", times: "Times", moedas: "Caça às Moedas" };

/** Bombas Táticas: a arena em grade dentro da moldura comum das partidas. */
export default function BombasTaticas({ vagas, modo, bioma, ...resto }: Comum & { vagas: VagaJogo[]; modo: Modo; bioma: Bioma }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorBombas(caixa, vagas, modo, bioma, ganchos), [vagas, modo, bioma]);
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={modo === "moedas" ? 140 : 128}
      titulo="Bombas Táticas" modoRotulo={solo ? (modo === "moedas" ? "Meta de moedas" : "Desafio") : TITULO_MODO[modo]}
      detalhe={`${BIOMAS[bioma].nome}${solo ? ` · ${modo === "moedas" ? `junte ${META_MOEDAS_SOLO} moedas em 2 min` : "exploda todas as caixas sem cair"}` : ""}`}
      botoes={{ a: "Bomba", b: "Ação" }}
      ajudaTeclado="Setas/WASD andam · Espaço/Z solta bomba · X/Shift detona ou arremessa · Esc pausa" />
  );
}
