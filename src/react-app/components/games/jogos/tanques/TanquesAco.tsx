import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { ALVOS_SOLO, type ArenaTanques, type ModoTanques } from "@/react-app/utils/games/tanques";
import { ARENAS_TANQUES, criarMotorTanques } from "./motorTanques";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Tanques de Aço (3D): arena com muros, ricochete e minas, de 1 a 8. */
export default function TanquesAco({ vagas, modo, arena, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoTanques; arena: ArenaTanques }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorTanques(caixa, vagas, modo, arena, ganchos), [vagas, modo, arena]);
  const regra = solo ? `destrua os ${ALVOS_SOLO} alvos em 90 s` : modo === "times" ? "vermelho contra azul; fica o time que sobrar" : "fica o último tanque";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={112}
      titulo="Tanques de Aço" modoRotulo={solo ? "Tiro ao alvo" : modo === "times" ? "Times" : "Mata-Mata"}
      detalhe={`${ARENAS_TANQUES[arena].nome} · ${regra} · tiros ricocheteiam`}
      botoes={{ a: "Atirar", b: "Mina" }}
      ajudaTeclado="↑/↓ anda · ←/→ gira o chassi · a torre mira sozinha no inimigo à vista · Espaço/Z atira (ricocheteia 2×) · X solta mina · Esc pausa"
      textosSolo={{ venceu: "🎯 Todos os alvos!", perdeu: "Faltaram alvos…" }} />
  );
}
