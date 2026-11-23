import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import type { ModoChefao, TipoChefe } from "@/react-app/utils/games/chefao";
import { CHEFES, criarMotorChefao } from "./motorChefao";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Chefão Colossal (2D): chefe gigante em três fases, ataques avisados, escudo de pilares e esquiva, de 1 a 8. */
export default function ChefaoColossal({ vagas, modo, chefe, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoChefao; chefe: TipoChefe }) {
  const solo = vagas.length === 1;
  const efetivo: ModoChefao = solo && modo === "competitivo" ? "coop" : modo;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorChefao(caixa, vagas, modo, chefe, ganchos), [vagas, modo, chefe]);
  const regra = efetivo === "rush" ? "três chefes seguidos, cada um mais forte" : efetivo === "competitivo" ? "todos contra o chefe; vence quem causar mais dano" : solo ? "derrube o chefe com 3 vidas" : "derrubem o chefe; levante quem cair";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={146}
      titulo="Chefão Colossal" modoRotulo={efetivo === "rush" ? "Boss Rush" : efetivo === "competitivo" ? "Competitivo" : "Cooperativo"}
      detalhe={`${CHEFES[chefe].nome} · ${regra} · quebre os pilares para tirar o escudo`}
      botoes={{ a: "Atirar", b: "Esquiva" }}
      ajudaTeclado="Setas andam · Espaço/Z atira (mira sozinha: pilares, lacaios, chefe) · X esquiva invulnerável · fuja das áreas vermelhas antes do golpe; no anel, fique na brecha verde · Esc pausa"
      textosSolo={{ venceu: "👑 O colosso caiu!", perdeu: "O chefão venceu desta vez…" }} />
  );
}
