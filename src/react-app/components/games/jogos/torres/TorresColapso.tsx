import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { ALVOS_SOLO, TIROS_SOLO, type ModoTorres, type Paisagem } from "@/react-app/utils/games/torres";
import { PAISAGENS, criarMotorTorres } from "./motorTorres";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Torres em Colapso: artilharia por turnos com vento e torres que desabam, de 1 a 8. */
export default function TorresColapso({ vagas, modo, paisagem, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoTorres; paisagem: Paisagem }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorTorres(caixa, vagas, modo, paisagem, ganchos), [vagas, modo, paisagem]);
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={96}
      titulo="Torres em Colapso" modoRotulo={solo ? "Tiro ao alvo" : "Batalha"}
      detalhe={`${PAISAGENS[paisagem].nome} · ${solo ? `${ALVOS_SOLO} alvos em ${TIROS_SOLO} tiros` : "derrube os reis rivais; o último de pé vence"} · atenção ao vento`}
      botoes={{ a: "Atirar", b: "Bomba" }}
      ajudaTeclado="←/→ ângulo · ↑/↓ força · Espaço/Z atira · X troca para a bomba pesada (1 por partida) · Esc pausa"
      textosSolo={{ venceu: "🎯 Todos os alvos no chão!", perdeu: "Acabaram os tiros…" }} />
  );
}
