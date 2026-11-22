import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { SETORES, VOLTAS, type ModoEspacial, type Setor } from "@/react-app/utils/games/espacial";
import { criarMotorEspacial } from "./motorEspacial";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;
const ROTULO: Record<ModoEspacial, string> = { corrida: "Corrida", asteroides: "Asteroides", coleta: "Coleta" };

/** Corrida Espacial: naves com inércia e gravidade, de 1 a 8. */
export default function CorridaEspacial({ vagas, modo, setor, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoEspacial; setor: Setor }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorEspacial(caixa, vagas, modo, setor, ganchos), [vagas, modo, setor]);
  const regra = modo === "corrida" ? (solo ? `${VOLTAS} voltas em 75 s` : `${VOLTAS} voltas pelos anéis`) : modo === "asteroides" ? (solo ? "1500 pontos em 90 s" : "mais pontos em 90 s") : (solo ? "25 cristais em 90 s" : "mais cristais em 90 s");
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={150}
      titulo="Corrida Espacial" modoRotulo={ROTULO[modo]}
      detalhe={`${SETORES[setor].nome} · ${regra} · cuidado com a gravidade`}
      botoes={{ a: "Acelerar", b: "Laser" }}
      ajudaTeclado="←/→ giram · Espaço/Z ou ↑ acelera · ↓ freia · X laser · a nave tem inércia e os planetas puxam · Esc pausa"
      textosSolo={{ venceu: "🚀 Missão cumprida!", perdeu: "Faltou pouco, piloto!" }} />
  );
}
