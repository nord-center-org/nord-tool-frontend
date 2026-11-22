import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import type { ModoMasmorra } from "@/react-app/utils/games/masmorra";
import { TEMAS_MASMORRA, criarMotorMasmorra, type TemaMasmorra } from "./motorMasmorra";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Fuga da Masmorra: roguelite de salas em equipe, de 1 a 8. */
export default function FugaMasmorra({ vagas, modo, tema, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoMasmorra; tema: TemaMasmorra }) {
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorMasmorra(caixa, vagas, modo, tema, ganchos), [vagas, modo, tema]);
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={100}
      titulo="Fuga da Masmorra" modoRotulo={modo === "diario" ? "Desafio Diário" : "Fuga"}
      detalhe={`${TEMAS_MASMORRA[tema].nome} · ache a chave e derrote o guardião · juntos`}
      botoes={{ a: "Espada", b: "Esquiva" }}
      ajudaTeclado="Setas andam · Espaço/Z espada · X esquiva (invulnerável por um instante) · portas abrem com a sala limpa · Esc pausa"
      textosSolo={{ venceu: "🗝️ Você escapou da masmorra!", perdeu: "A masmorra venceu desta vez…" }} />
  );
}
