import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import type { Andamento, ModoRitmo } from "@/react-app/utils/games/ritmo";
import { ANDAMENTOS, criarMotorRitmo } from "./motorRitmo";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Batalha de Banda (2D): notas caindo em 4 trilhas, combo, Show e duelo com obstáculos, de 1 a 8. */
export default function BatalhaBanda({ vagas, modo, andamento, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoRitmo; andamento: Andamento }) {
  const solo = vagas.length === 1;
  const efetivo: ModoRitmo = solo ? "solo" : modo === "solo" ? "duelo" : modo;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorRitmo(caixa, vagas, modo, andamento, ganchos), [vagas, modo, andamento]);
  const regra = efetivo === "solo" ? "termine a música com 70% de acertos" : efetivo === "banda" ? "todos juntos: o público é um só" : "mais pontos vence; A manda obstáculo ao líder";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={0}
      titulo="Batalha de Banda" modoRotulo={efetivo === "solo" ? "Solo" : efetivo === "banda" ? "Banda" : "Duelo"}
      detalhe={`${ANDAMENTOS[andamento]} · ${regra}`}
      botoes={{ a: "Ataque", b: "Show" }}
      ajudaTeclado="←/↓/↑/→ tocam as 4 trilhas na hora em que a nota chega na linha (segure nas notas longas) · X liga o Show (energia pela metade) · Espaço/Z manda obstáculo no Duelo · Esc pausa"
      textosSolo={{ venceu: "🎸 Público de pé!", perdeu: "O público não curtiu…" }} />
  );
}
