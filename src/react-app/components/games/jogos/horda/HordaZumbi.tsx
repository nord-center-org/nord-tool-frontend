import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { META_ONDAS, META_ONDAS_SOLO, type ModoHorda } from "@/react-app/utils/games/horda";
import { CENARIOS_HORDA, criarMotorHorda, type CenarioHorda } from "./motorHorda";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

const ROTULOS: Record<ModoHorda, string> = { ondas: "Ondas", resgate: "Resgate", chefe: "Chefão" };

/** Horda Zumbi: sobrevivência cooperativa de 1 a 8, vista de cima. */
export default function HordaZumbi({ vagas, modo, cenario, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoHorda; cenario: CenarioHorda }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorHorda(caixa, vagas, modo, cenario, ganchos), [vagas, modo, cenario]);
  const regra = modo === "ondas" ? `sobreviva a ${solo ? META_ONDAS_SOLO : META_ONDAS} ondas` : modo === "resgate" ? "leve os 3 sobreviventes ao centro da casa" : "3 ondas e o chefão";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={92}
      titulo="Horda Zumbi" modoRotulo={ROTULOS[modo]}
      detalhe={`${CENARIOS_HORDA[cenario].nome} · ${regra} · juntos`}
      botoes={{ a: "Atirar", b: "Usar" }}
      ajudaTeclado="Setas andam e miram · Espaço/Z atira (mira ajuda) · segure X: consertar porta, levantar aliado, comprar na bancada · Esc pausa"
      textosSolo={{ venceu: "🧟 Você sobreviveu à horda!", perdeu: "A horda venceu…" }} />
  );
}
