import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { META_MOEDAS, type Arena, type ModoCoroa } from "@/react-app/utils/games/coroa";
import { VISUAL_ARENA, criarMotorCoroa } from "./motorCoroa";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Coroa Maldita: pique-pega de plataforma, de 1 a 8. */
export default function CoroaMaldita({ vagas, modo, arena, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoCoroa; arena: Arena }) {
  const efetivo: ModoCoroa = vagas.length === 1 ? "moedas" : modo === "moedas" ? "coroa" : modo;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorCoroa(caixa, vagas, efetivo, arena, ganchos), [vagas, efetivo, arena]);
  const regra = efetivo === "coroa" ? "fique com a coroa o maior tempo (90 s)" : efetivo === "pegapega" ? "passe a bomba antes que ela exploda" : `pegue ${META_MOEDAS} moedas em 60 s`;
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={140}
      titulo="Coroa Maldita" modoRotulo={efetivo === "coroa" ? "Coroa" : efetivo === "pegapega" ? "Pega-Pega" : "Caça às moedas"}
      detalhe={`${VISUAL_ARENA[arena].nome} · ${regra}`}
      botoes={{ a: "Pular", b: "Investida" }}
      ajudaTeclado="←/→ andam · Espaço/Z ou ↑ pula (pulo duplo no ar) · ↓ desce da plataforma · X investida · cair na cabeça atordoa · Esc pausa"
      textosSolo={{ venceu: "🪙 Todas as moedas!", perdeu: "O tempo acabou…" }} />
  );
}
