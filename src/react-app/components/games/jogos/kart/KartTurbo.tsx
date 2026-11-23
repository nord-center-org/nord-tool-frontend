import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { ALVOS_SOLO, VOLTAS, type ModoKart, type PistaKart } from "@/react-app/utils/games/kart";
import { PISTAS_KART, criarMotorKart } from "./motorKart";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Kart Turbo & Balões (3D): Grande Prêmio com drift e itens, ou arena de balões, de 1 a 8. */
export default function KartTurbo({ vagas, modo, pista, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoKart; pista: PistaKart }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorKart(caixa, vagas, modo, pista, ganchos), [vagas, modo, pista]);
  const gp = modo === "gp";
  const regra = gp ? (solo ? `contra o relógio, ${VOLTAS} voltas` : `${VOLTAS} voltas; a chegada dá os pontos`) : solo ? `estoure ${ALVOS_SOLO} balões-alvo em 90 s` : "3 balões cada; fica quem tiver balão";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={140}
      titulo="Kart Turbo & Balões" modoRotulo={gp ? "Grande Prêmio" : "Arena de Balões"}
      detalhe={`${gp ? PISTAS_KART[pista].nome : "Arena"} · ${regra}`}
      botoes={{ a: "Drift", b: "Item" }}
      ajudaTeclado="Acelera sozinho · ←/→ vira · ↓ freia · segure Espaço/Z na curva para o drift (solte = turbo azul, laranja ou roxo) · X usa o item · Esc pausa"
      textosSolo={{ venceu: gp ? "🏁 Recorde batido!" : "🎈 Todos os balões!", perdeu: gp ? "Passou do tempo…" : "Faltaram balões…" }} />
  );
}
