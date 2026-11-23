import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { META_SOLO, type ModoMineracao } from "@/react-app/utils/games/mineracao";
import { MINAS, criarMotorMineracao, type MinaMineracao } from "./motorMineracao";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Corrida do Ouro: mineração vista de lado, com picareta, dinamite, carga e carrinho, de 1 a 8. */
export default function CorridaOuro({ vagas, modo, mina, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoMineracao; mina: MinaMineracao }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorMineracao(caixa, vagas, modo, mina, ganchos), [vagas, modo, mina]);
  const regra = solo ? `entregue ${META_SOLO[modo]} pontos em 4 minutos` : "4 minutos; vence quem entregar mais";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={100}
      titulo="Corrida do Ouro" modoRotulo={modo === "corrida" ? "Corrida" : "Sobrevivência"}
      detalhe={`${MINAS[mina].nome} · ${regra}${modo === "sobrevivencia" ? " · a lava sobe!" : ""}`}
      botoes={{ a: "Picareta", b: "Dinamite" }}
      ajudaTeclado="Setas andam e escolhem para onde cavar · ↑ pula e sobe pelo túnel · Espaço/Z picareta · X dinamite (3 por viagem) · entregue a carga no carrinho · Esc pausa"
      textosSolo={{ venceu: "💰 Meta batida!", perdeu: "Faltou ouro desta vez…" }} />
  );
}
