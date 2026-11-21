import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import type { ModoEncaixe } from "@/react-app/utils/games/encaixe";
import { META_MARATONA, META_SPRINT } from "@/react-app/utils/games/encaixe";
import { TEMAS_ENCAIXE, criarMotorEncaixe, type TemaEncaixe } from "./motorEncaixe";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

const DETALHE: Record<ModoEncaixe, string> = {
  versus: "linhas limpas mandam lixo para os rivais",
  sprint: `${META_SPRINT} linhas: quem chegar primeiro vence`,
  maratona: `chegue a ${META_MARATONA} linhas; a velocidade sobe a cada 10`,
};

/** Encaixe Versus: puzzle de peças caindo, com lixo para os rivais (Versus), corrida de linhas (Sprint) e Maratona. */
export default function EncaixeVersus({ vagas, modo, tema, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoEncaixe; tema: TemaEncaixe }) {
  const solo = vagas.length === 1;
  const efetivo: ModoEncaixe = solo ? (modo === "versus" ? "maratona" : modo) : modo === "maratona" ? "versus" : modo;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorEncaixe(caixa, vagas, efetivo, tema, ganchos), [vagas, efetivo, tema]);
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={150}
      titulo="Encaixe Versus" modoRotulo={efetivo === "versus" ? "Versus" : efetivo === "sprint" ? "Sprint" : "Maratona"}
      detalhe={`${TEMAS_ENCAIXE[tema].nome} · ${DETALHE[efetivo]}`}
      botoes={{ a: "Girar", b: "Guardar" }}
      ajudaTeclado="←/→ mover · ↓ desce · ↑ cai de vez · Espaço/Z gira · X/Shift guarda · Esc pausa"
      textosSolo={{ venceu: efetivo === "sprint" ? "🏆 Sprint completo!" : "🏆 Maratona cumprida!", perdeu: "Topo cheio! Tente de novo" }} />
  );
}
