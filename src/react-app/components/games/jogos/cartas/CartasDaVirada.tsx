import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import type { ModoCartas } from "@/react-app/utils/games/cartas";
import { MESAS_CARTAS, criarMotorCartas, type MesaCartas } from "./motorCartas";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

const ROTULOS: Record<ModoCartas, string> = { classico: "Clássico", caotico: "Empilhamento Caótico", rapido: "Rápido" };
const REGRA: Record<ModoCartas, string> = {
  classico: "cor, número ou símbolo; zere a mão",
  caotico: "+2/+4 acumulam · 7 troca mãos · 0 gira as mãos",
  rapido: "5 cartas e 8 s por vez",
};

/** Cartas da Virada: descarte por cor ou número, de 2 a 8 na mesa; sozinho, contra 3 bots. */
export default function CartasDaVirada({ vagas, modo, mesa, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoCartas; mesa: MesaCartas }) {
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorCartas(caixa, vagas, modo, mesa, ganchos), [vagas, modo, mesa]);
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={104}
      titulo="Cartas da Virada" modoRotulo={vagas.length === 1 ? `${ROTULOS[modo]} contra 3 bots` : ROTULOS[modo]}
      detalhe={`${MESAS_CARTAS[mesa].nome} · ${REGRA[modo]}`}
      botoes={{ a: "Jogar", b: "Comprar" }}
      ajudaTeclado="←/→ escolhe a carta · Espaço/Z joga · X compra (ou passa) · ↑ avisa VIRADA! com 1 carta · Esc pausa"
      textosSolo={{ venceu: "🃏 Mão zerada! Você venceu a mesa", perdeu: "Um bot zerou primeiro…" }} />
  );
}
